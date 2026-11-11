# ALPHA LUNAR — Lunar Surface Atlas

ALPHA LUNAR is an interactive lunar exploration application and the foundation for a future scientific digital twin and mission-intelligence platform.

Phase 1 established the React/TypeScript application, dark aerospace interface, interactive globe, feature search, camera navigation, and South Pole mode. This first Phase 2 milestone replaces the procedural appearance and crater shapes with NASA imagery and elevation derivatives. Higher-resolution terrain streaming and scientific analysis remain future work.

## Implemented experience

- Responsive mission-control layout with collapsible panels and fullscreen exploration
- WebGL globe with orbit, zoom, surface-coordinate selection, feature search, and camera fly-to
- NASA LROC color imagery with LOLA elevation displacement and relief shading
- Geographically placed South Pole landmarks and a regional LOLA terrain mesh
- Decluttered global labels, optional coordinate grid, and surface/relief views
- Elevation coloring on the globe and regional terrain, derived from sampled LOLA heights, with a −10 to +12 km legend relative to the 1,737.4 km reference sphere
- Adjustable inspection lighting and regional vertical scale of 1×, 2×, or 3×
- Data-status panel, source links, original PDS product label, and a checksum manifest

Inspection lighting is a rendering control, not a date-dependent Sun calculation. Elevation colors and legend limits are display choices, not a hazard classification. The application does not calculate landing suitability, hazards, resource probability, temperature, or communication windows.

## Run locally

```bash
pnpm install
pnpm dev
```

Use Node.js 24 or newer for the supplied TypeScript tests. Build with `pnpm build`, run type checks with `pnpm check`, and run the coordinate and data-integrity tests with `pnpm test`.

The prepared assets under `public/lunar/` are included with the application; a normal build does not download NASA products.

## Regenerate lunar assets

The ingestion script requires Python 3 with Pillow and NumPy:

```bash
python -m pip install Pillow numpy
python scripts/ingest_lunar.py
```

It downloads source products into the ignored `data-source/` directory, validates raster dimensions and relevant PDS metadata, and creates browser derivatives under `public/lunar/`. The generated `manifest.json` records source URLs, sizes, SHA-256 checksums, coordinate metadata, processing steps, limitations, and derivative checksums. Checksums identify the local inputs and outputs; they are not a NASA signature or an independent scientific validation.

## Architecture

React and TypeScript compose the interface; Three.js, React Three Fiber, and Drei render the surface. Global and regional scenes share coordinate utilities and a cached raster loader. A separate Python ingestion step handles source conversion. Dataset-manifest and terrain-provider interfaces reserve a path for future streaming, but the current runtime loads complete bundled rasters rather than a multiresolution tile service.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for coordinate conventions, resolution limits, processing details, and the next development stages.

## Data status

- **Global color:** the 2019 [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) LROC mosaic, converted from 8192×4096 TIFF to WebP. NASA prepared this color product for visualization; it includes polar albedo infill and is not raw radiometry.
- **Global elevation:** the same kit's `ldem_16_uint.tif` LOLA product. The app uses a resampled 1440×720 elevation raster for globe displacement and a separate height texture for visual relief.
- **South Pole elevation:** PDS `LDEM_85S_40M`, version 2.0, with a 40 m source grid in south polar stereographic projection. Its LOLA ground tracks are interpolated into a grid. The browser derivative averages each 4×4 source block into a 160 m sample; the displayed geometry is coarser still. Source resolution does not describe the final mesh resolution.
- **Landmarks:** names, centers, and feature references from the [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/).

## Next development stages

1. Add spatially tiled elevation products, progressive loading, and camera-dependent terrain LOD to retain more source detail near selected landmarks.
2. Validate datum alignment, interpolation behavior, and regional geometry against independent reference products; expose coverage and uncertainty at the sample level.
3. Add higher-resolution regional imagery and DEM products with product-specific provenance.
4. Begin ephemeris, terrain-shadow, and Earth-visibility work after validating the required coordinate and time systems.
