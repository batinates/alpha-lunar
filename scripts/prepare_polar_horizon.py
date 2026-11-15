"""Build compact polar DEMs from the PDS 240 m image/label pairs."""
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np

source = Path(sys.argv[1])
out = Path(__file__).resolve().parents[1] / "public/lunar/polar-horizon"
out.mkdir(exist_ok=True)
base = "https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/"
entries = {}
for hemisphere, latitude in [("s", -90), ("n", 90)]:
    stem = f"ldem_75{hemisphere}_240m"
    label = (source / f"{stem}.lbl").read_bytes()
    img = source / f"{stem}.img"

    def field(key):
        match = re.search(rf"^\s*{key}\s*=\s*([^\r\n]+)", label.decode("ascii"), re.M)
        if not match:
            raise ValueError(f"Missing field: {key}")
        return match[1].strip().split(" <")[0]

    expected = {
        "LINES": 3812, "LINE_SAMPLES": 3812, "MAP_SCALE": 240, "OFFSET": 1737400,
        "SCALING_FACTOR": .5, "SAMPLE_BITS": 16, "CENTER_LATITUDE": latitude,
        "CENTER_LONGITUDE": 0, "MAP_PROJECTION_ROTATION": 0,
        "LINE_PROJECTION_OFFSET": 1905.5, "SAMPLE_PROJECTION_OFFSET": 1905.5,
    }
    if any(float(field(key)) != value for key, value in expected.items()):
        raise ValueError(f"Unexpected geometry or encoding for {stem}")
    if field("SAMPLE_TYPE") != "LSB_INTEGER" or "DE421" not in field("COORDINATE_SYSTEM_NAME"):
        raise ValueError(f"Unexpected sample type or frame for {stem}")
    raw = img.read_bytes()
    if len(raw) != 2 * 3812 ** 2:
        raise ValueError(f"Incomplete raster: {img}")
    grid = np.frombuffer(raw, dtype="<i2").reshape(3812, 3812)
    valid = np.abs(grid.astype(np.int32)) <= 30000
    grouped = grid.reshape(1906, 2, 1906, 2)
    mean = np.rint(grouped.mean(axis=(1, 3))).astype("<i2")
    mean[~valid.reshape(1906, 2, 1906, 2).all(axis=(1, 3))] = -32768
    data = mean.tobytes()
    file = f"pole-{hemisphere}-480m.i16"
    (out / file).write_bytes(data)
    entries[hemisphere] = {"file": file, "width": 1906, "spacingMeters": 480,
        "source": base + stem + ".img", "label": base + stem + ".lbl",
        "sourceSha256": hashlib.sha256(raw).hexdigest(), "labelSha256": hashlib.sha256(label).hexdigest(),
        "sha256": hashlib.sha256(data).hexdigest()}
(out / "manifest.json").write_text(json.dumps({"frame": "MOON_ME_DE421", "hemispheres": entries}, indent=2) + "\n")
