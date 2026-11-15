"""Compare sampled ALPHA LUNAR terrain with two dated LROC WAC frames."""
import hashlib
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import spiceypy as spice

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).resolve()
out = root / "public/lunar/validation/lroc.json"
dem_path = root / "public/lunar/south-pole-height.f32"
dem = np.fromfile(dem_path, dtype="<f4").reshape(1896, 1896)
radius = 1737400
kernels = json.loads((root / "public/lunar/ephemeris-provenance.json").read_text())["sources"]
os.chdir(root / ".cache/validation")
for kernel in kernels:
    path = Path(kernel["url"].rsplit("/", 1)[1])
    if hashlib.sha256(path.read_bytes()).hexdigest() != kernel["sha256"]:
        raise ValueError(f"Unexpected kernel {path}")
    spice.furnsh(str(path))

def sample(x, z):
    u = x / 160 + 947.5
    v = z / 160 + 947.5
    i, j = np.floor(u).astype(int), np.floor(v).astype(int)
    if np.any((i < 0) | (j < 0) | (i >= 1895) | (j >= 1895)):
        raise ValueError("Ray outside southern DEM")
    a, b = u - i, v - j
    return (dem[j, i]*(1-a)+dem[j, i+1]*a)*(1-b)+(dem[j+1, i]*(1-a)+dem[j+1, i+1]*a)*b

def otsu(values):
    count, edges = np.histogram(values, bins=128)
    centers = (edges[1:] + edges[:-1]) / 2
    weight = count.cumsum()
    moment = (centers * count).cumsum()
    between = np.divide((moment[-1]*weight-moment*weight[-1])**2,
                        weight*(weight[-1]-weight), out=np.zeros(128), where=(weight>0)&(weight<weight[-1]))
    return float(edges[np.argmax(between)+1])

base = "https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_MOVIE_SOUTH/"
products = []
columns, rows = np.meshgrid(np.arange(2870, 3030, 2), np.arange(2950, 3110, 2))
x, z = (columns-3039.5)*100, (rows-3039.5)*100
lat = -np.pi/2 + 2*np.arctan(np.hypot(x,z)/(2*radius))
lon = np.arctan2(x,-z)
up = np.stack((np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)), axis=-1)
height = sample(x,z)
distance = np.arange(160, 100001, 160)
d = distance / radius
for name in ["WAC_MOVIE_S20091106T2212", "WAC_MOVIE_S20091101T2323"]:
    header = (source / (name + ".head")).read_bytes()
    data = (source / (name + ".rows")).read_bytes()
    label = header.decode("ascii", errors="replace")
    def field(key):
        return re.search(rf"^\s*{re.escape(key)}\s*=\s*([^\r\n]+)", label, re.M)[1].strip()
    if field("RECORD_BYTES") != "24320" or field("^IMAGE") != "2" or field("SAMPLE_TYPE") != "PC_REAL":
        raise ValueError("Unexpected LROC encoding")
    for key, value in {"MAP_SCALE":100, "LINES":6080, "LINE_SAMPLES":6080, "SAMPLE_BITS":32, "CENTER_LATITUDE":-90,
                       "CENTER_LONGITUDE":0, "MAP_PROJECTION_ROTATION":0, "LINE_PROJECTION_OFFSET":3039.5, "SAMPLE_PROJECTION_OFFSET":3039.5}.items():
        if float(field(key).split()[0]) != value:
            raise ValueError(f"Unexpected {key} in {name}")
    if len(data) != (76024320 - 71865600):
        raise ValueError("Unexpected range size")
    row0 = 71865600 // 24320 - 1
    brightness = np.frombuffer(data, dtype="<f4").reshape(-1,6080)[rows-row0,columns]
    usable = np.isfinite(brightness) & (brightness > -1e10)
    if usable.sum() < 100:
        raise ValueError("Insufficient observations")
    threshold = otsu(brightness[usable])
    observed = brightness[usable] >= threshold
    start, end = [datetime.fromisoformat(field(key)) for key in ("START_TIME","STOP_TIME")]
    middle = start + (end-start)/2
    vec, _ = spice.spkpos("SUN", spice.str2et(middle.isoformat()), "MOON_ME_DE421", "NONE", "MOON")
    prediction = []
    for v, h in zip(up[usable], height[usable]):
        ray = vec*1000 - (radius+h)*v
        elevation = np.arcsin(np.dot(ray,v)/np.linalg.norm(ray))
        plane = ray - np.dot(ray,v)*v
        plane /= np.linalg.norm(plane)
        p = v*np.cos(d[:,None]) + plane*np.sin(d[:,None])
        rho = 2*radius*np.tan((np.pi/2+np.arctan2(p[:,2],np.hypot(p[:,0],p[:,1])))/2)
        az = np.arctan2(p[:,1],p[:,0])
        terrain = radius + sample(rho*np.sin(az),-rho*np.cos(az))
        horizon = np.max(np.arctan2(terrain*np.cos(d)-(radius+h),terrain*np.sin(d)))
        prediction.append(elevation > horizon)
    prediction = np.array(prediction)
    tp, tn, fp, fn = [int(mask.sum()) for mask in (observed & prediction, ~observed & ~prediction, ~observed & prediction, observed & ~prediction)]
    denom = np.sqrt(float(tp+fp)*(tp+fn)*(tn+fp)*(tn+fn))
    products.append({"id":name, "source":base+name+".IMG", "utc":middle.isoformat()+"Z", "points":int(usable.sum()),
        "matchPercent":100*(tp+tn)/usable.sum(), "mcc":(tp*tn-fp*fn)/denom if denom else None,
        "tp":tp,"tn":tn,"fp":fp,"fn":fn,"threshold":threshold,"headerSha256":hashlib.sha256(header).hexdigest(),
        "rangeSha256":hashlib.sha256(data).hexdigest()})
spice.kclear()
out.write_text(json.dumps({"version":1,"area":"Shackleton Rim (Site04)","products":products,
    "headerRange":"0-16383","imageRange":"71865600-76024319","demSha256":hashlib.sha256(dem_path.read_bytes()).hexdigest()},indent=2)+"\n")
print(json.dumps(products, indent=2))
