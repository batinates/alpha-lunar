"""Reproducible NASA/PDS raster ingestion. No fabricated surface samples."""
from pathlib import Path
import hashlib, json, urllib.request, time
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / 'data-source'
OUT = ROOT / 'public' / 'lunar'
SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/'
PDS = 'https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/'
SOURCES = {
    'lroc_color_poles_8k.tif': (SVS, 50641970),
    'ldem_16_uint.tif': (SVS, 33201026),
    'ldem_85s_40m.img': (PDS, 115034112),
    'ldem_85s_40m.lbl': (PDS, 4986),
}

def download(item):
    name, (base, expected) = item
    dest = CACHE / name
    if dest.exists() and (expected is not None and dest.stat().st_size == expected):
        return
    if name.endswith('.img'):
        offset = dest.stat().st_size if dest.exists() else 0
        while offset < expected:
            end = min(offset + 2 * 1024 * 1024, expected) - 1
            for attempt in range(12):
                try:
                    req = urllib.request.Request(base + name, headers={'Range': f'bytes={offset}-{end}'})
                    with urllib.request.urlopen(req, timeout=60) as response:
                        assert response.status == 206
                        block = response.read()
                    assert len(block) == end-offset+1
                    with dest.open('ab') as output: output.write(block)
                    offset = end+1
                    break
                except Exception:
                    if attempt == 11: raise
                    time.sleep(.5)
        print('Downloaded', name, flush=True)
        return
    for attempt in range(5):
        try:
            with urllib.request.urlopen(base + name, timeout=90) as response, dest.open('wb') as output:
                expected_size = int(response.headers.get('Content-Length', 0))
                while block := response.read(1024 * 1024):
                    output.write(block)
            assert dest.stat().st_size == (expected or expected_size)
            print('Downloaded', name, flush=True)
            return
        except Exception as error:
            print('Retry', name, type(error).__name__, flush=True)
            if attempt == 4: raise
            time.sleep(1)

def normal_map(height, step):
    dz, dx = np.gradient(height, step)
    normals = np.stack((-dx, dz, np.ones_like(height)), axis=-1)
    normals /= np.linalg.norm(normals, axis=-1, keepdims=True)
    return Image.fromarray(np.clip((normals * .5 + .5) * 255, 0, 255).astype('uint8'))

def main():
    CACHE.mkdir(exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as pool:
        list(pool.map(download, SOURCES.items()))
    albedo = Image.open(CACHE / 'lroc_color_poles_8k.tif').convert('RGB')
    assert albedo.size == (8192, 4096)
    if not (OUT / 'albedo-8k.webp').exists() or not (OUT / 'albedo-8k.webp').stat().st_size:
        albedo.save(OUT / 'albedo-8k.webp', quality=92, method=6)
    if not (OUT / 'albedo-4k.webp').exists() or not (OUT / 'albedo-4k.webp').stat().st_size:
        albedo.resize((4096, 2048), Image.Resampling.LANCZOS).save(OUT / 'albedo-4k.webp', quality=90, method=6)
    dem = np.asarray(Image.open(CACHE / 'ldem_16_uint.tif'), dtype=np.float32) * .5 - 10000
    assert dem.shape == (2880, 5760) and np.isfinite(dem).all()
    # Browser derivatives preserve meters; the full 24km bump range includes peaks above 10km.
    assert dem.min() >= -12000 and dem.max() <= 12000
    Image.fromarray(np.clip((dem + 12000) / 24000 * 255, 0, 255).astype('uint8')).save(OUT / 'global-height.png')
    global_small = np.asarray(Image.fromarray(dem).resize((1440,720), Image.Resampling.BILINEAR), dtype='<f4')
    global_small.tofile(OUT / 'global-height.f32')
    label = (CACHE / 'ldem_85s_40m.lbl').read_text()
    for required in ['LSB_INTEGER', 'SCALING_FACTOR        = 0.5', 'LINES                 = 7584', 'MAP_SCALE                    = 40']:
        assert required in label, f'Unexpected PDS metadata: {required}'
    raw = np.fromfile(CACHE / 'ldem_85s_40m.img', dtype='<i2').reshape(7584,7584)
    assert raw.min() > -32768, 'No-data requires explicit masking'
    # Exact 4x4 area average: 40m source -> 160m browser sampling, pixel registered.
    polar = raw.reshape(1896,4,1896,4).mean(axis=(1,3), dtype=np.float32) * .5
    polar.astype('<f4').tofile(OUT / 'south-pole-height.f32')
    # Residual detail only: full DEM normals on displaced geometry count slope twice.
    # Reconstruct the 641x641 vertex grid, then subtract its low-frequency slope.
    coarse = Image.fromarray(polar).resize((641,641), Image.Resampling.BILINEAR)
    smooth = np.asarray(coarse.resize((1896,1896), Image.Resampling.BILINEAR))
    normal_map(polar-smooth,160).save(OUT / 'south-pole-normal.webp', lossless=True)
    (OUT / 'ldem_85s_40m.lbl').write_text(label)
    sources = [{ 'file': name, 'url': base+name, 'sha256': hashlib.sha256((CACHE/name).read_bytes()).hexdigest(), 'bytes': (CACHE/name).stat().st_size } for name,(base,_) in SOURCES.items()]
    manifest = {
        'version': 2, 'retrievedAt': '2026-11-11', 'credit': 'NASA Scientific Visualization Studio / LRO / LOLA / LROC / PDS Geosciences Node',
        'sources': sources,
        'global': {'width':1440,'height':720,'radiusMeters':1737400,'unit':'meter','bumpRangeMeters':[-12000,12000],'projection':'equirectangular','bounds':[-180,-90,180,90],'registration':'pixel-center','color':'NASA SVS 2019 visualization mosaic; polar albedo infill; not raw radiometry'},
        'polar': {'width':1896,'height':1896,'sourceSpacingMeters':40,'spacingMeters':160,'halfExtentMeters':151680,'referenceRadiusMeters':1737400,'unit':'meter','projection':'south polar stereographic','centerLongitude':0,'frame':'MEAN EARTH/POLAR AXIS OF DE421','productVersion':'V2.0','representation':'interpolated','coverage':'85–90 degrees south; rectangular corner areas extend farther north','derivation':'4x4 area averaging of signed little-endian int16 samples, scaling factor 0.5; output float32 meters'},
        'limitations':['Gridded LOLA ground tracks are interpolated, not every pixel is a laser return.','Color is a visualization mosaic.','Lighting is user-controlled for inspection, not an ephemeris solution.','Terrain is displayed with explicitly selectable vertical exaggeration; no hazard or landing calculations.','Regional rendering mesh is 641x641 vertices (474m spacing); residual normals add detail from the 160m derivative.'],
        'outputs':[]
    }
    manifest['outputs']=[{'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in OUT.iterdir() if p.name!='manifest.json']
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
    print('Ingested NASA lunar assets:',[(p.name,p.stat().st_size) for p in OUT.iterdir()],flush=True)

if __name__ == '__main__': main()
