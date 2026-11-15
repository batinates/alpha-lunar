"""Build a separate 18.6-year validation cache. Requires numpy and spiceypy."""
import hashlib
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import urlretrieve

import numpy as np
import spiceypy as spice

root = Path(__file__).resolve().parents[1]
cache = root / ".cache" / "validation"
cache.mkdir(parents=True, exist_ok=True)
provenance = json.loads((root / "public/lunar/ephemeris-provenance.json").read_text())
os.chdir(cache)
for source in provenance["sources"]:
    path = Path(source["url"].rsplit("/", 1)[1])
    if not path.exists() or hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
        temp = path.with_suffix(".download")
        urlretrieve(source["url"], temp)
        if hashlib.sha256(temp.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError(f"Unexpected SHA-256 for {path}")
        temp.replace(path)
    spice.furnsh(str(path))

start = datetime(2026, 1, 1, tzinfo=timezone.utc)
hours = 6
count = round(18.6 * 365.25 * 24 / hours)
rows = np.empty((count, 6), dtype="<f8")
for i in range(count):
    when = start + timedelta(hours=(i + .5) * hours)
    et = spice.str2et(when.strftime("%Y-%m-%d %H:%M:%S UTC"))
    for off, body in [(0, "SUN"), (3, "EARTH")]:
        rows[i, off:off + 3] = spice.spkpos(body, et, "MOON_ME_DE421", "NONE", "MOON")[0]
spice.kclear()
path = Path("long-geometry.f64")
rows.tofile(path)
path.with_suffix(".json").write_text(json.dumps({
    "start": start.isoformat(), "end": (start + timedelta(hours=count * hours)).isoformat(),
    "stepHours": hours, "count": count, "frame": "MOON_ME_DE421", "correction": "NONE",
    "sampling": "interval midpoints", "spiceypy": spice.__version__, "numpy": np.__version__,
    "sources": provenance["sources"], "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
}, indent=2), encoding="utf-8")
print(f"Prepared {count} long-period geometry samples")
