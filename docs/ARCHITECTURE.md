# ALPHA LUNAR architecture — first Phase 2 milestone

The Phase 1 interface and exploration foundation now render NASA surface products. This milestone adds reproducible raster ingestion and a working regional elevation view. It does not yet implement terrain streaming, scientific illumination analysis, or landing assessment.

## Runtime layers

1. **Experience shell** — responsive mission-control layout, navigation, search, panels, fullscreen, and scientific-integrity messaging.
2. **Lunar domain** — typed feature, coordinate, and exploration-mode models independent of React and Three.js.
3. **Reference data** — IAU/USGS gazetteer feature records with source links.
4. **Raster access** — `lunarAssets.ts` fetches complete bundled float32 rasters, validates byte counts and sample ranges, caches pending and completed requests, and provides bilinear sampling. Failed requests are removed from the cache so they can be retried.
5. **3D presentation** — separate globe and South Pole renderers, indexed displaced geometry, GPU sprite labels, and frame-loop suspension for inactive scenes. The regional scene mounts on first use.
6. **Scientific provider contracts** — `DataSourceRegistry.ts` defines dataset manifests and terrain-tile interfaces. These are extension contracts; the current bundled-raster loader is not a tile-streaming implementation.

## Source products and browser derivatives

| Product | Source | Browser representation | Important limit |
| --- | --- | --- | --- |
| LROC color | NASA SVS 2019 `lroc_color_poles_8k.tif`, 8192×4096 | 8K WebP; a 4K derivative is also generated | Visualization color with polar albedo infill, not raw radiometry |
| Global LOLA elevation | NASA SVS `ldem_16_uint.tif`, 5760×2880 | 1440×720 float32 meters for displacement; 8-bit normalized height texture for bump shading | Geometry and shading have different effective resolutions |
| Polar LOLA elevation | PDS `LDEM_85S_40M.IMG`, V2.0, 7584×7584, 40 m/pixel | 1896×1896 float32 meters at 160 m spacing, plus a normal map | Interpolated altimetry; 4×4 area averaging removes fine source detail |

The regional mesh samples the 303.36 km-wide projected square with 640 segments per axis: approximately 474 m vertex spacing and 819,200 triangles. The 160 m normal map represents residual detail after subtracting a bilinearly reconstructed coarse surface, avoiding full-slope double counting. It adds shading detail without adding geometry. Neither the normal texture nor a close camera position restores 40 m geometry. The regional base material is a neutral surface color, not local orbital photography.

The globe uses a 384×256 segmented sphere displaced by bilinearly sampled elevation. The surface/relief switch changes the material and bump strength; the enhanced relief view is a visual aid, not a slope product. The global bump texture encodes a −12,000 to +12,000 m range to retain the source peaks without clipping; this rendering texture is separate from the meter-valued displacement raster.

Elevation mode assigns vertex colors from sampled LOLA heights on both the globe and regional terrain. Its displayed legend spans −10 to +12 km relative to the 1,737.4 km reference sphere. These palette limits are display choices, not measured regional extrema, geoid-referenced height, or hazard thresholds. Regional vertical exaggeration changes geometry while elevation coloring continues to describe the sampled height values.

## Coordinate convention

Longitude is positive east, normalized to `[-180, 180]`. The global renderer uses a spherical reference radius of 1,737,400 m. Its Three.js frame maps:

- `+Y` to lunar north
- `+Z` to `0°E`
- `+X` to `90°E`

- `u = (longitude + 180) / 360`, with the texture seam at ±180°
- `v = (latitude + 90) / 180` for texture coordinates; raster rows run north to south

The polar product label specifies planetocentric latitude, the **Mean Earth/Polar Axis of DE421** frame, south polar stereographic projection, central longitude 0°, and a spherical radius of 1,737,400 m. For latitude `φ` and east longitude `λ`, the application uses:

```text
ρ = 2 R tan((90° + φ) / 2)
x = ρ sin λ
z = −ρ cos λ
```

`z` increases down the raster. Its projected bounds are ±151,680 m on each axis, and samples are pixel-centered. The browser height loader returns meters relative to the reference sphere. Scene coordinates divide horizontal distances and heights by 30,000; the regional vertical-scale control multiplies height by 1, 2, or 3. At 1×, horizontal and vertical scene units use the same meter scale. The view is a projected regional surface, not a geocentric curved patch.

Gazetteer records retain their supplied reference conventions. The current spherical rendering makes planetographic and planetocentric latitude numerically equivalent, but it does not perform a separately validated transformation between gazetteer control networks and DE421. Quantitative co-registration and any future nonspherical reference surface need explicit validation.

## Implemented ingestion path

```text
NASA SVS / PDS source files
  → local source cache
  → dimension, sample-format, and selected metadata checks
  → unit conversion and resampling
  → bundled float32 rasters / WebP textures / product label
  → provenance manifest with SHA-256 hashes
  → cached browser raster loader
  → indexed geometry and surface materials
```

`scripts/ingest_lunar.py` requires Python, Pillow, and NumPy. It converts the unsigned global TIFF using `height_m = DN × 0.5 − 10000`. The polar IMG is signed little-endian int16; its label specifies `height_m = DN × 0.5` relative to the 1,737,400 m sphere. Polar samples are averaged in 4×4 blocks. The original PDS label is shipped with the app.

The manifest under `public/lunar/manifest.json` records source URLs, product version, reference frame, units, resolution, derivative processing, source and output sizes, and hashes. Hashes provide reproducibility and corruption checks for the captured files; they do not establish independent scientific correctness or authenticate the files against publisher-signed checksums.

No-data sentinels must be handled explicitly: ingestion currently rejects the signed int16 minimum sentinel instead of filling it. Regional lookups outside the rectangular raster bounds return `null`. Fetch or raster-validation failure produces a visible load error. The current pipeline does not produce per-sample uncertainty or a separate coverage mask.

## Performance strategy

- Hidden renderers suspend their frame loops.
- Raster promises are cached and reused across scene visits.
- Imagery is preprocessed to WebP and served with the built application, avoiding runtime dependence on NASA availability.
- Regional terrain uses indexed buffer geometry and a separately derived normal map.
- Label textures use GPU sprites; global labels use screen-space collision checks and far-side culling.
- Pixel ratios are capped to bound rendering cost.
- The browser currently loads the full polar raster on first regional use. Quadtree LOD, streamed tiles, worker-based processing, and abortable tile requests are planned, not implemented.

## Verification

`pnpm check` runs TypeScript checks; `pnpm build` creates the production bundle. `pnpm test` uses Node's test runner and TypeScript stripping to check global reference axes, coordinate round trips, polar projection orientation and round trips, pixel-center sampling, seam wrapping, regional coverage rejection, and bundled derivative hashes.

These tests check implementation consistency and file integrity. They are not a substitute for independent geodetic validation, terrain accuracy assessment, or mission qualification.

## Scientific boundary

The regional surface now derives from LOLA altimetry, whose tracks were interpolated into the source grid. Color remains a NASA visualization product. Inspection lighting is controlled by the user and has no date, time, SPICE, or solar-ephemeris solution. Rendered shadows therefore show the selected display light, not predicted lunar illumination or permanent shadow regions.

Vertical exaggeration and enhanced bump shading are display choices. No slope hazard, thermal environment, water-ice probability, communication availability, or landing recommendation is calculated. Next work should add higher-resolution tiles and validated alignment before developing these analysis engines.
