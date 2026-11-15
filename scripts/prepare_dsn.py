"""Generate Earth orientation samples for the station screening tool."""
import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spiceypy as spice

root = Path(__file__).resolve().parents[1]
cache = root / ".cache/validation"
out = root / "public/lunar"
base = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/"
earth = {
    "earth_1962_260806_2126_combined.bpc": "cc87ad1a495cf598800ba403763d350f087ac0b97da9fec603278a3864c6a53e",
    "earth_000101_270208_261113.bpc": "6e77690ba455a644e509b0b9cb308b0dec1a7154ceecf3355659b917b21ca45e",
}
ephemeris = json.loads((out / "ephemeris-provenance.json").read_text())
sources = [source for source in ephemeris["sources"] if not source["url"].endswith(".bsp")]
os.chdir(cache)
for source in sources:
    path = Path(source["url"].rsplit("/", 1)[1])
    if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        raise ValueError(f"Unexpected checksum for {path}")
    spice.furnsh(str(path))
for name, expected in earth.items():
    digest = hashlib.sha256(Path(name).read_bytes()).hexdigest()
    if digest != expected:
        raise ValueError(f"Unexpected checksum for {name}")
    sources.append({"url": base + name, "sha256": digest})
    spice.furnsh(name)

start = datetime.fromisoformat(ephemeris["coverageStart"])
end = datetime.fromisoformat(ephemeris["coverageEnd"])
step = 600
count = int((end - start).total_seconds()) // step + 1
first = spice.str2et(start.isoformat().replace("+00:00", ""))
end_et = spice.str2et(end.isoformat().replace("+00:00", ""))
if abs(end_et - first - (count - 1) * step) > .005 or start.tzinfo != timezone.utc:
    raise ValueError("Time grid requires UTC without leap seconds")

rows = np.empty((count, 4), dtype="<f4")
for index in range(count):
    rows[index] = spice.m2q(spice.pxform("ITRF93", "MOON_ME_DE421", first + index * step))
spice.kclear()
data = rows.tobytes()
(out / "dsn-orientation.f32").write_bytes(data)
(out / "dsn-orientation.json").write_text(json.dumps({
    "start": start.isoformat(), "stepMs": step * 1000, "count": count, "frame": "ITRF93 to MOON_ME_DE421",
    "encoding": "SPICE scalar-first unit quaternion, little endian float32",
    "sources": sources, "sha256": hashlib.sha256(data).hexdigest(),
}, indent=2) + "\n", encoding="utf-8")
print(f"Generated {count} station orientation samples")
