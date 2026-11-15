"""Convert the published Diviner grids and PDS LOLA shadow mask to browser data."""

import hashlib
import json
from pathlib import Path
import urllib.request

import numpy as np
from scipy.io import netcdf_file

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data-source"
OUTPUT = ROOT / "public" / "lunar"
DIVINER = "https://dataverse.harvard.edu/api/access/datafile"
LOLA = "https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG"
SHADOW = "LPSR_85S_060M_201608"
SOURCES = {
    "diviner-tmax.grd": (f"{DIVINER}/8134810", "299833ab0f6a96b17a5255eb04b7672e"),
    "diviner-tmean.grd": (f"{DIVINER}/8134809", "8b0813862ab4383cb3faced7070d4d47"),
    "diviner-bins.grd": (f"{DIVINER}/8134808", "cd727066f86f8974b4b1834af293713c"),
    f"{SHADOW.lower()}.lbl": (f"{LOLA}/{SHADOW}.LBL", None),
    f"{SHADOW.lower()}.img": (f"{LOLA}/{SHADOW}.IMG", None),
}
RADIUS = 1737400
HALF_EXTENT = 151680
SPACING = 480
WIDTH = 2 * HALF_EXTENT // SPACING


def download_sources():
    CACHE.mkdir(exist_ok=True)
    records = []
    for name, (url, md5) in SOURCES.items():
        path = CACHE / name
        if not path.exists():
            tmp = path.with_suffix(path.suffix + ".part")
            urllib.request.urlretrieve(url, tmp)
            tmp.replace(path)
        content = path.read_bytes()
        if md5 and hashlib.md5(content).hexdigest() != md5:
            raise ValueError(f"Publisher checksum mismatch: {path}")
        records.append(dict(file=name, url=url, bytes=len(content), sha256=hashlib.sha256(content).hexdigest()))
    return records


def diviner_neighbors(filename):
    centers = np.arange(WIDTH) * SPACING + SPACING / 2 - HALF_EXTENT
    with netcdf_file(CACHE / filename, mmap=False) as grid:
        x = grid.variables["x"][:] * RADIUS
        y = grid.variables["y"][:] * RADIUS
        data = grid.variables["z"][:]
        if (
            grid.node_offset != 1 or grid.variables["z"].dimensions != ("y", "x")
            or data.shape != (2533, 2533) or not np.array_equal(x, y)
            or not np.allclose(np.diff(x), 240, atol=0.1)
        ):
            raise ValueError(f"Unexpected Diviner grid registration: {filename}")
        center_cols = np.searchsorted(x, centers)
        center_cols -= np.abs(x[center_cols - 1] - centers) < np.abs(x[center_cols] - centers)
        center_rows = center_cols[::-1]
        if not np.allclose(x[center_cols], centers, rtol=0, atol=24):
            raise ValueError("Diviner grid no longer aligns with the output stencil")
        neighbors = np.array([
            data[np.ix_(center_rows + row, center_cols + col)]
            for row in (-1, 0, 1) for col in (-1, 0, 1)
        ])
        half_source = (x[1] - x[0]) / 2
        offsets = np.arange(-1, 2)[:, None]
        differences = x[center_cols + offsets] - centers
        overlaps = np.minimum(SPACING / 2, differences + half_source) - np.maximum(-SPACING / 2, differences - half_source)
        weights = (overlaps[:, None, ::-1, None] * overlaps[None, :, None, :]).reshape(9, WIDTH, WIDTH)
        return neighbors, weights


def shadow_counts():
    label = (CACHE / f"{SHADOW.lower()}.lbl").read_text()
    for value in ("5058", "60 <m/pix>", "2528.5 <pix>", "MEAN EARTH/POLAR AXIS OF DE421", "LSB_INTEGER"):
        if value not in label:
            raise ValueError(f"Missing shadow grid label field: {value}")
    source = np.fromfile(CACHE / f"{SHADOW.lower()}.img", dtype="<i2").reshape(5058, 5058)
    if not np.isin(source, [-20000, 0, 20000]).all():
        raise ValueError("Unexpected shadow value")
    blocks = source[1:-1, 1:-1].reshape(WIDTH, 8, WIDTH, 8)
    # The label defines only ±20000. Treat the five zero-coded source cells as unknown.
    return np.where((blocks == 0).any(axis=(1, 3)), 255, (blocks == 20000).sum(axis=(1, 3)))


def main():
    sources = download_sources()
    peak = np.max(diviner_neighbors("diviner-tmax.grd")[0], axis=0)
    means, weights = diviner_neighbors("diviner-tmean.grd")
    mean = np.average(means, axis=0, weights=weights)
    bins = np.min(diviner_neighbors("diviner-bins.grd")[0], axis=0)
    shadow = shadow_counts()
    if not np.isin(bins, np.arange(193)).all():
        raise ValueError("Unexpected Diviner sampling count")
    pairs = np.isfinite(peak) & np.isfinite(mean)
    if (pairs & ((peak < mean) | (mean <= 0) | (peak > 500))).any():
        raise ValueError("Unexpected Diviner temperature range")
    grid = np.empty((WIDTH, WIDTH), dtype=[("peak", "<u2"), ("mean", "<u2"), ("bins", "u1"), ("shadow", "u1")])
    grid["peak"] = np.where(np.isfinite(peak), np.rint(peak * 10), 65535)
    grid["mean"] = np.where(np.isfinite(mean), np.rint(mean * 10), 65535)
    grid["bins"] = np.where(pairs, bins, 255)
    grid["shadow"] = shadow
    output = grid.tobytes()
    (OUTPUT / "polar-environment.bin").write_bytes(output)
    metadata = {
        "version": 1,
        "grid": {
            "width": WIDTH, "height": WIDTH, "spacingMeters": SPACING, "halfExtentMeters": HALF_EXTENT,
            "projection": "South polar stereographic, planetocentric, 0° east meridian up, 1737400 m sphere",
            "registration": "Pixel centers; rows run down; bounds match the bundled LOLA DEM derivative",
            "format": "6 bytes per cell, little endian: uint16 peak (0.1 K), uint16 mean (0.1 K), uint8 populated bins, uint8 shadow count out of 64. Missing uint16=65535 or uint8=255.",
        },
        "thermal": {
            "representation": "Observation-derived climatological summaries with interpolation",
            "citation": "Schorghofer & Williams, Harvard Dataverse V3", "doi": "https://doi.org/10.7910/DVN/EGOOCL",
            "files": "Pinned polar_south_96x2 downloads; internal title says 24x6 so no sampling denominator is used",
            "method": "Peak is max over the intersecting 3×3 source cells; mean is weighted by projected overlap area; sampling is the minimum populated-bin count. Missing input in a stencil propagates.",
            "limits": "The source axes are converted from lunar-radius units to meters. Assumed alignment with DE421, no independently fitted registration. Values are climatological and include inferred time bins. Minimum, instant and hardware temperatures are unavailable.",
        },
        "shadow": {
            "representation": "Modeled permanent shadow from LOLA terrain and illumination geometry",
            "citation": "Mazarico et al. (2011), NASA PDS LPSR_85S_060M_201608 V1.05", "source": "https://pgda.gsfc.nasa.gov/products/69",
            "method": "Crop one 60 m pixel on each side, count shadow-flagged pixels in each 8×8 block; unrecognized DN=0 propagates unknown.",
        },
        "ice": {
            "thermalScreenKelvin": 110, "meaning": "Cold-trap screening threshold, independent of ice detection or concentration",
            "thresholdReference": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6130389/",
            "observation": "LCROSS Centaur ejecta at Cabeus; point evidence only",
            "location": {"latitude": -84.6796, "longitude": -48.7093, "oneSigmaMetersNorth": 115, "oneSigmaMetersEast": 44},
            "observationSource": "https://science.nasa.gov/image-detail/20110615lcross/",
            "locationSource": "https://arxiv.org/abs/1103.1687",
        },
        "sources": sources,
        "output": {"file": "polar-environment.bin", "bytes": len(output), "sha256": hashlib.sha256(output).hexdigest()},
    }
    (OUTPUT / "polar-environment.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
