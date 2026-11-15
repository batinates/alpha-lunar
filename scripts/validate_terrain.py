"""Compare bundled terrain with NASA PGDA sites and optionally generate regional LOD."""

import hashlib
import argparse
import json
from pathlib import Path
import urllib.request

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[1]
PGDA = "https://pgda.gsfc.nasa.gov/data/LOLA_5mpp"
SITES = {"01": "Connecting Ridge", "04": "Shackleton Rim", "11": "de Gerlache Rim"}
HALF_EXTENT = 151680
SPACING = 160
WIDTH = 1896


def read_source(site):
    name = f"Site{site}_final_adj_5mpp_surf.tif"
    url = f"{PGDA}/Site{site}/{name}"
    source = ROOT / "data-source" / name
    if not source.exists():
        source.parent.mkdir(exist_ok=True)
        temporary = source.with_suffix(".part")
        urllib.request.urlretrieve(url, temporary)
        temporary.replace(source)

    with tifffile.TiffFile(source) as dataset:
        page = dataset.pages[0]
        tags = page.geotiff_tags
        if (
            page.shape != (3200, 3200) or page.dtype != np.dtype("float32")
            or tags["ModelPixelScale"] != [5., 5., 0.]
            or tags["ModelTiepoint"][:3] != [0., 0., 0.]
            or tags["ProjNatOriginLatGeoKey"] != -90
            or tags["ProjStraightVertPoleLongGeoKey"] != 0
            or tags["GeogSemiMajorAxisGeoKey"] != 1737400
            or tags["GeogSemiMinorAxisGeoKey"] != 1737400
        ):
            raise ValueError(f"Unsupported Site{site} grid or projection")
        reference = page.asarray()
        _, _, _, x0, y0, _ = tags["ModelTiepoint"]
    return reference, int(x0), -int(y0), url, hashlib.sha256(source.read_bytes()).hexdigest()


def validate(reference, x0, z0):
    raster = np.fromfile(ROOT / "public/lunar/south-pole-height.f32", dtype="<f4").reshape(WIDTH, WIDTH)
    # The web grid uses down-positive z. GeoTIFF rows also run down.
    col = np.arange(np.ceil((x0 + HALF_EXTENT) / SPACING), np.floor((x0 + HALF_EXTENT + 16000) / SPACING), dtype=int)
    row = np.arange(np.ceil((z0 + HALF_EXTENT) / SPACING), np.floor((z0 + HALF_EXTENT + 16000) / SPACING), dtype=int)
    start_x, start_z = col[0] * SPACING - HALF_EXTENT, row[0] * SPACING - HALF_EXTENT
    left, top = (start_x - x0) // 5, (start_z - z0) // 5
    cells = reference[top:top + row.size * 32, left:left + col.size * 32].reshape(row.size, 32, col.size, 32)
    averaged = cells.mean(axis=(1, 3), dtype=np.float64)
    current = raster[np.ix_(row, col)]
    valid = np.isfinite(averaged) & np.isfinite(current)
    diff = current[valid] - averaged[valid]
    if len(diff) < 1000:
        raise ValueError("Insufficient valid overlap")
    # Compare slopes on the same central-difference baseline, with the same scale correction as the app.
    x, z = np.meshgrid(col[1:-1] * SPACING - HALF_EXTENT + SPACING / 2, row[1:-1] * SPACING - HALF_EXTENT + SPACING / 2)
    baseline = 2 * SPACING / (1 + (np.hypot(x, z) / (2 * 1737400)) ** 2)

    def slopes(elevation):
        return np.degrees(np.arctan2(np.hypot(
            elevation[1:-1, 2:] - elevation[1:-1, :-2],
            elevation[2:, 1:-1] - elevation[:-2, 1:-1],
        ), baseline))

    slope_error = slopes(current.astype(np.float64)) - slopes(averaged)
    slope_error = slope_error[np.isfinite(slope_error)]
    return {
        "elevationCells": int(len(diff)),
        "elevationBiasMeters": float(diff.mean()),
        "elevationRmseMeters": float(np.sqrt(np.mean(diff ** 2))),
        "elevationP95AbsMeters": float(np.percentile(np.abs(diff), 95)),
        "slopeCells": int(len(slope_error)),
        "slopeRmseDeg": float(np.sqrt(np.mean(slope_error ** 2))),
        "slopeP95AbsDeg": float(np.percentile(np.abs(slope_error), 95)),
    }


def export_levels(output, site, reference):
    levels = {}
    for spacing in (80, 20):
        width, factor = 16000 // spacing, spacing // 5
        grid = reference.reshape(width, factor, width, factor).mean(axis=(1, 3), dtype=np.float64)
        scaled = np.rint(grid * 2)
        if np.any(np.isfinite(scaled) & (np.abs(scaled) >= 32767)):
            raise ValueError("Elevation outside signed 16-bit range")
        asset = np.where(np.isfinite(scaled), scaled, -32768).astype("<i2").tobytes()
        file = f"site-{site}-{spacing}m.i16"
        (output / file).write_bytes(asset)
        levels[spacing] = {"file": file, "width": width, "sha256": hashlib.sha256(asset).hexdigest()}
    return levels


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("sites", nargs="*")
    parser.add_argument("--export", action="store_true")
    args = parser.parse_args()
    if any(site not in SITES for site in args.sites):
        parser.error("Supported PGDA sites: 01, 04, 11")
    output = ROOT / "public/lunar/regional"
    if args.export:
        output.mkdir(exist_ok=True)
    results = []
    for site in args.sites or ["04"]:
        reference, x0, z0, url, checksum = read_source(site)
        row = {"id": site, "name": SITES[site], "x": x0, "z": z0, "size": 16000, "reference": url,
               "referenceSha256": checksum, "comparison": validate(reference, x0, z0)}
        if args.export:
            row["levels"] = export_levels(output, site, reference)
        results.append(row)
    manifest = {"frame": "MOON_ME_DE421", "projection": "South polar stereographic, z positive down",
                "encoding": "Little-endian signed int16, 0.5 m per count, -32768 unknown",
                "method": "Valid-only full source blocks averaged from NASA PGDA 5 m DEMs", "sites": results}
    if args.export:
        (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
