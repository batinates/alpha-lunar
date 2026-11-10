# ALPHA LUNAR architecture — Phase 1

## Runtime layers

1. **Experience shell** — responsive mission-control layout, navigation, search, panels, fullscreen, and scientific-integrity messaging.
2. **Lunar domain** — typed feature, coordinate, and exploration-mode models independent of React and Three.js.
3. **Reference data** — versionable IAU/USGS gazetteer feature records with source links.
4. **3D presentation** — independent global globe and South Pole terrain renderers, hidden-scene frame suspension, deterministic textures, and GPU-friendly instancing boundaries.
5. **Scientific provider contracts** — dataset manifests and terrain-tile provider interfaces that preserve provenance, representation class, reference frame, coverage, resolution, limitations, and checksums.

## Coordinate convention

Phase 1 uses planetographic latitude and positive-east longitude normalized to `[-180, 180]`. The Three.js frame maps:

- `+Y` to lunar north
- `+Z` to `0°E`
- `+X` to `90°E`

Any future raster adapter must publish its source CRS/reference frame and transform into this canonical rendering convention explicitly.

## Phase 2 ingestion path

`PDS/LRO source → immutable dataset manifest → validation/checksum → raster reprojection → multiresolution tile pyramid → cache → TerrainDataProvider → renderer`

The renderer never interprets a missing provider as valid zero-valued science data. Missing coverage remains unavailable and visible to the user as such.

## Performance strategy

- Hidden renderers suspend their frame loops.
- Global textures are generated once and disposed with the scene lifecycle.
- Regional terrain uses indexed buffer geometry and vertex colors.
- Label textures are GPU sprites rather than independent DOM roots.
- Future DEMs will use quadtree LOD and abortable tile requests through the provider contract.

## Scientific boundary

The current albedo and terrain relief are deterministic visual assets. They are not measurements and are labeled accordingly in-product. No landing safety, illumination, temperature, communication, resource, or mission recommendation is computed in Phase 1.
