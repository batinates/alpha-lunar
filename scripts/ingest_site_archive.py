"""Validate and package the supplied research archive. Requires NumPy and PyArrow."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path

import numpy as np
import pyarrow.parquet as parquet

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public/lunar/site-archive"
HOUR = 3600000
COLS = ["sun_az", "sun_el", "earth_az", "earth_el"]


def utc_ms(value):
    return int(datetime.fromisoformat(value).timestamp() * 1000)


def angular_residuals(values, times, site, ephemeris):
    start = utc_ms(ephemeris["start"])
    mask = (times >= start) & (times < start + len(ephemeris["rows"]) * HOUR)
    rows = ephemeris["rows"][(times[mask] - start) // HOUR]
    latitude, longitude = np.radians([site["lat"], site["lon"]])
    up = np.array([np.cos(latitude) * np.cos(longitude), np.cos(latitude) * np.sin(longitude), np.sin(latitude)])
    east = np.array([-np.sin(longitude), np.cos(longitude), 0])
    north = np.cross(up, east)
    angles = []
    for vectors in (rows[:, :3], rows[:, 3:]):
        relative = vectors - 1737.4 * up
        angles.extend([np.degrees(np.arctan2(relative @ east, relative @ north)) % 360,
                       np.degrees(np.arcsin((relative @ up) / np.linalg.norm(relative, axis=1)))])
    if len(rows) == 0:
        raise ValueError("No overlap with reference ephemeris")
    delta = (values[mask] - np.array(angles).T + 180) % 360 - 180
    return len(rows), np.max(np.abs(delta), axis=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    locations_path, = args.source.glob("*lokasyon*.json")
    horizons_path, = args.source.glob("*topografya*.json")
    ephemeris_path, = args.source.glob("*.parquet")
    locations = json.loads(locations_path.read_text(encoding="utf-8-sig"))
    horizons = json.loads(horizons_path.read_text(encoding="utf-8-sig"))
    table = parquet.read_table(ephemeris_path, columns=["site_id", "t_utc", *COLS])
    if table.schema.field("t_utc").type.tz != "UTC":
        raise ValueError("Expected UTC timestamps")
    identifiers = np.array(table["site_id"].to_pylist())
    times = table["t_utc"].to_numpy().astype("datetime64[ms]").astype("int64")
    angles = np.column_stack([table[key].to_numpy() for key in COLS])
    ephemeris = json.loads((ROOT / "public/lunar/ephemeris.json").read_text())
    ephemeris["rows"] = np.array(ephemeris["rows"])
    sites = locations["sites"]
    ids = {site["id"] for site in sites}
    if len(sites) != len(ids) or set(identifiers) != set(horizons) or not set(horizons) <= ids:
        raise ValueError("Site IDs are missing, duplicated or inconsistent")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    available = {}
    duplicates = {}
    total_checked = 0
    max_error = np.zeros(4)
    compiled_sites = []
    for site in sites:
        key = site["id"]
        if not key.isascii() or not key.replace("_", "").isalnum():
            raise ValueError(f"Invalid site identifier: {key}")
        lat, lon = site["lat"], site["lon"]
        if not (lat is None and lon is None) and not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise ValueError(f"Invalid coordinate: {key}")
        ring = site.get("polygon")
        if ring and (len(ring) < 4 or ring[0] != ring[-1] or not all(-180 <= x <= 180 and -90 <= y <= 90 for x, y in ring)):
            raise ValueError(f"Invalid region outline: {key}")
        record = {field: site.get(field) for field in ("id", "name", "lat", "lon", "category", "outcome",
                  "target", "actual", "aliases", "polygon", "area_km2", "confidence", "coord_method", "reported_elev_m")}
        record["source"] = ("https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html"
                            if key == "im2_athena" else site["coord_source"])
        event = site.get("date") or {}
        record["actual_date"] = event.get("start_utc") if event.get("kind") == "actual" else None
        record["date_precision"] = event.get("precision") if record["actual_date"] else None
        if key in horizons:
            order = np.flatnonzero(identifiers == key)
            order = order[np.argsort(times[order])]
            timestamp, values = times[order], angles[order]
            if (len(order) != 61368 or timestamp[0] != utc_ms("2023-01-01T00:00:00Z")
                    or not np.all(np.diff(timestamp) == HOUR) or not np.isfinite(values).all()
                    or not ((values[:, ::2] >= 0) & (values[:, ::2] <= 360)).all()
                    or not (np.abs(values[:, 1::2]) <= 90).all()):
                raise ValueError(f"Invalid ephemeris samples: {key}")
            count, residual = angular_residuals(values, timestamp, site, ephemeris)
            total_checked += count
            max_error = np.maximum(max_error, residual)
            profile = horizons[key]
            elevation, distance = (np.array(profile[field]) for field in ("el_deg", "dist_km"))
            if (profile["az_step_deg"] != .25 or profile["observer_height_m"] != 2
                    or len(elevation) != 1440 or len(distance) != 1440
                    or not np.isfinite(elevation).all() or not np.isfinite(distance).all()
                    or not (np.abs(elevation) <= 90).all() or not (distance >= 0).all()):
                raise ValueError(f"Invalid horizon profile: {key}")
            packed = np.empty(values.shape, dtype="<u2")
            packed[:, ::2] = np.rint(values[:, ::2] * 100).astype("<u2") % 36000
            packed[:, 1::2] = np.rint(values[:, 1::2] * 100).astype("<i2").view("<u2")
            payload = packed.tobytes()
            checksum = hashlib.sha256(payload).hexdigest()
            fingerprint = (checksum, hashlib.sha256(json.dumps(profile, sort_keys=True).encode()).hexdigest())
            if fingerprint in duplicates:
                record["series"] = duplicates[fingerprint]
            else:
                duplicates[fingerprint] = key
                record["series"] = key
                (OUTPUT / f"{key}.i16").write_bytes(payload)
                (OUTPUT / f"{key}-horizon.json").write_text(json.dumps(profile, separators=(",", ":")), encoding="utf-8")
                available[key] = {"sha256": checksum, "bytes": len(payload)}
        compiled_sites.append(record)
    if np.any(max_error > [.03, .02, .03, .02]):
        raise ValueError(f"Unexpected difference from bundled SPICE: {max_error}")
    manifest = {
        "schema": 1, "sourceSchema": locations["schema_version"], "sourceDate": locations["generated_utc"],
        "frameAsSupplied": locations["conventions"]["frame"], "start": "2023-01-01T00:00:00Z", "count": 61368,
        "stepMs": HOUR, "encoding": "LE u16 Sun azimuth, i16 Sun elevation, u16 Earth azimuth, i16 Earth elevation; 0.01 degree",
        "referenceComparison": {"epochsAcrossSites": total_checked, "columns": COLS, "absoluteMaxDegrees": max_error.tolist()},
        "inputs": [{"name": path.name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
                   for path in (locations_path, horizons_path, ephemeris_path)],
        "series": available, "sites": compiled_sites,
    }
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(sites)} records, {len(horizons)} profiles, {len(available)} distinct series")
    print(f"SPICE comparison: {total_checked} site-hours; max residuals {max_error} degrees")


if __name__ == "__main__":
    main()
