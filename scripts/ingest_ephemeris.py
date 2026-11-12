"""Generate bounded geometric ephemerides; pip install spiceypy numpy.
Raw kernels stay in .cache; only derived positions and provenance are published.
"""
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timedelta, timezone
from urllib.request import urlretrieve
import numpy as np
import spiceypy as spice

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'spice'
OUT = ROOT / 'public' / 'lunar'
BASE = 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/'
SOURCES = ['lsk/naif0012.tls', 'spk/planets/a_old_versions/de421.bsp',
           'pck/moon_pa_de421_1900-2050.bpc', 'fk/satellites/moon_080317.tf']
CACHE.mkdir(parents=True, exist_ok=True)
os.chdir(CACHE)  # CSPICE on Windows needs ASCII kernel paths.
sources = []
for source in SOURCES:
    path = CACHE / Path(source).name
    if not path.exists():
        print('Downloading', path.name, flush=True)
        urlretrieve(BASE + source, path)
    spice.furnsh(path.name)
    sources.append({'url': BASE + source, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

start = datetime(2026, 1, 1, tzinfo=timezone.utc)
end = datetime(2028, 1, 1, tzinfo=timezone.utc)
count = int((end-start).total_seconds()/3600)+1
def positions(date):
    et = spice.str2et(date.strftime('%Y-%m-%d %H:%M:%S UTC'))
    return [spice.spkpos(body, et, 'MOON_ME_DE421', 'NONE', 'MOON')[0] for body in ['SUN','EARTH']]

rows = np.array([positions(start+timedelta(hours=i)) for i in range(count)])
# Validate interpolation at every half-hour against independent SPICE evaluations.
max_error = 0.0
for i in range(count-1):
    exact = np.array(positions(start+timedelta(hours=i, minutes=30)))
    approx = (rows[i]+rows[i+1])/2
    a = exact/np.linalg.norm(exact, axis=1)[:,None]
    b = approx/np.linalg.norm(approx, axis=1)[:,None]
    max_error = max(max_error, float(np.max(np.degrees(np.arctan2(np.linalg.norm(np.cross(a,b),axis=1),np.sum(a*b,axis=1))))))
payload = {'start':start.isoformat(), 'stepMs':3600000, 'frame':'MOON_ME_DE421', 'correction':'NONE',
           'units':'km', 'rows':np.round(rows.reshape(count,6),6).tolist()}
data = json.dumps(payload,separators=(',',':')).encode()
(OUT/'ephemeris.json').write_bytes(data)
(OUT/'ephemeris-provenance.json').write_text(json.dumps({'sources':sources,'generator':'scripts/ingest_ephemeris.py',
 'spiceypy':spice.__version__, 'frame':payload['frame'], 'correction':'geometric NONE; no light time or aberration',
 'coverageStart':start.isoformat(),'coverageEnd':end.isoformat(),'stepSeconds':3600,
 'validation':'Every interval midpoint compared with direct SPICE; angular error only, not a certified mission accuracy bound.',
 'maxMidpointAngularErrorDeg':max_error,'sha256':hashlib.sha256(data).hexdigest()},indent=2))
spice.kclear()
print('Generated', count, 'samples; max midpoint angular error (deg):', max_error)
