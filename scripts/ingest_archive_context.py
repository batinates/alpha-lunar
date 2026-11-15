"""Build the archive's reference context from the supplied Navigator exports."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import math
from datetime import datetime

import numpy as np
from PIL import Image


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path, value):
    path.write_text(json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_slope(path, out, latitude, longitude):
    with Image.open(path) as raster:
        scale_x, scale_y, _ = raster.tag_v2[33550]
        pixel_x, pixel_y, _, map_x, map_y, _ = raster.tag_v2[33922]
        height = np.array(raster, dtype=np.float64)
        nodata = raster.tag_v2.get(42113)
    if height.ndim != 2 or not 0 < scale_x == scale_y:
        raise ValueError(f"Unexpected DEM registration: {path.name}")
    height[~np.isfinite(height) | (np.abs(height) > 15_000)] = np.nan
    if nodata is not None:
        height[height == float(nodata.rstrip("\x00"))] = np.nan
    radius = 1_737_400 * 2 * math.tan(math.radians(90 + latitude) / 2)
    east = radius * math.sin(math.radians(longitude))
    north = radius * math.cos(math.radians(longitude))
    x = (pixel_x + (east - map_x) / scale_x) / height.shape[1]
    y = (pixel_y + (map_y - north) / scale_y) / height.shape[0]
    if not (.45 < x < .55 and .45 < y < .55):
        raise ValueError(f"Site falls outside expected chip center: {path.name}")
    slope_y, slope_x = np.gradient(height, scale_y, scale_x)
    slope = np.degrees(np.arctan(np.hypot(slope_y, slope_x)))
    colors = np.array([[25, 47, 66], [82, 136, 144], [232, 177, 101], [202, 90, 88]])
    rgb = np.stack([np.interp(slope, [0, 5, 15, 30], colors[:, c]) for c in range(3)], axis=-1)
    rgb[~np.isfinite(slope)] = [8, 14, 22]
    Image.fromarray(rgb.astype(np.uint8)).save(out, format="WEBP", lossless=True)
    return {"pixelMeters": scale_x, "x": round(x, 6), "y": round(y, 6), "inputSha256": sha256(path), "sha256": sha256(out)}


def ingest(source, archive):
    catalog = {site["id"]: site for site in load(archive / "manifest.json")["sites"]}
    files = {
        "terrain": source / "input 3 topography" / "terrain_sites.json",
        "solar": source / "output 2 sunlight windows and power" / "power_tables" / "monthly_power_summary.json",
        "earth": source / "output 3 earth windows and communication" / "communication_tables" / "monthly_communication_summary.json",
        "events": source / "output 1 rise and set times" / "event_table" / "rise_set_events.json",
    }
    terrain, solar, earth, events = (load(path) for path in files.values())
    ids = {site["id"] for site in terrain["sites"]}
    if len(ids) != len(terrain["sites"]) or ids != set(events["sites"]):
        raise ValueError("Terrain and event sites do not match")
    months = [f"{year:04}-{month:02}" for year in range(2023, 2030) for month in range(1, 13)]
    monthly = {}
    for name, rows in (("solar", solar), ("earth", earth)):
        index = {(row["site_id"], row["month"]): row for row in rows}
        if len(index) != len(rows) or set(index) != {(ident, month) for ident in ids for month in months}:
            raise ValueError(f"Unexpected {name} site or month coverage")
        monthly[name] = index
    output = archive / "context"
    output.mkdir(exist_ok=True)
    artifacts = {}
    for item in terrain["sites"]:
        ident = item["id"]
        site = catalog[ident]
        if not re.fullmatch(r"[a-z0-9_]+", ident) or any(abs(item[key] - site[key]) > 0.000001 for key in ("lat", "lon")):
            raise ValueError(f"Archive location mismatch: {ident}")
        rows = {}
        for month in months:
            s = monthly["solar"][ident, month]
            e = monthly["earth"][ident, month]
            if s["hours_covered"] != e["hours_covered"]:
                raise ValueError(f"Month coverage mismatch: {ident} {month}")
            rows[month] = [s["hours_covered"], s["average_sunlight_percent"], s["energy_kilowatt_hours_per_square_meter"],
                           s["longest_without_sunlight_hours"], e["average_earth_visible_percent"], e["longest_without_earth_hours"]]
        windows = {}
        for body in ("sun", "earth"):
            for event in events["sites"][ident][body]["events"]:
                time = event["time_utc"]
                datetime.fromisoformat(time)
                if time[:7] not in rows or event["event"] not in ("rise", "set"):
                    raise ValueError(f"Unexpected event: {ident} {time}")
                windows.setdefault(time[:7], []).append([time, body, event["event"], event["azimuth_deg"],
                                                        event["minutes_shift_per_tenth_degree_terrain_error"]])
        chip = files["terrain"].parent / item["chips"]["near2km"]
        if chip.resolve().parent != (files["terrain"].parent / "chips").resolve():
            raise ValueError(f"Unexpected chip path: {ident}")
        map_file = output / f"{ident}-slope.webp"
        slope = make_slope(chip, map_file, item["lat"], item["lon"])
        result = output / f"{ident}.json"
        write(result, {"schema": 1, "id": ident, "terrain": {
            "product": item["elevation_source"], "elevation": item["elevation_m"], "slope": item["slope_site_deg"],
            "aspect": item["aspect_site_deg"], "meanSlope": item["slope_mean_r100m_deg"], "maxSlope": item["slope_max_r100m_deg"],
            "baselineMeters": item["slope_baseline_m"], "map": slope,
        }, "months": rows, "events": {month: sorted(entries) for month, entries in windows.items()}})
        artifacts[ident] = {"jsonSha256": sha256(result), "mapSha256": slope["sha256"]}
    write(output / "manifest.json", {"schema": 1, "start": events["start_utc"], "end": events["end_utc"],
          "source": "Supplied Lunar Landing Site Navigator exports (2026-11-15)", "observerMeters": 2,
          "sources": {key: {"name": path.name, "sha256": sha256(path)} for key, path in files.items()}, "sites": artifacts})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--archive", type=Path, default=Path("public/lunar/site-archive"))
    args = parser.parse_args()
    ingest(args.source, args.archive)
