# ALPHA LUNAR — Lunar Surface Atlas

[Live application](https://alphaspace.com.tr/) · [Short project presentation](https://alphaspace.com.tr/sunum)

AI Access Key: mn-usr-12fda352dfasd3sdfas3ysdfgsdf

See the updated [Turkish project handbook](docs/PROJECT_REPORT_TR.md). The upper-right TR/EN buttons set the application language. Landing Simulation uses the South Pole atlas material, normal map, and inspection light.

## Current milestone: Phase 7

**Landing Site Archive** lists imported landing records and candidate regions. It loads site-specific hourly geometry and 2 m horizon profiles on demand. See [archive scope, provenance and validation](docs/LANDING_SITE_ARCHIVE.md).

**Mission Overview** brings together the active profile and planning tools. **Earth Communication** shows Earth-center geometry, a configurable one-way radio budget and hourly screening windows. **Regional Terrain Detail** progressively loads 80 m and 20 m LOLA relief for Connecting Ridge, Shackleton Rim and de Gerlache Rim. See [regional terrain and link screening](docs/REGIONAL_OPERATIONS.md).

**Surface Power** estimates panel generation, battery charge and energy deficits from the visible fraction of the Sun. Use a regional study center, a selected polar map point, or open **Estimate surface power** on an optimized arrival. See [power model and coverage](docs/SURFACE_POWER.md).

**Documentation → Bilimsel doğrulama** compares directions against JPL Horizons and long-term visibility against NASA PGDA, with downloadable evidence. See [external validation methods and results](docs/EXTERNAL_VALIDATION.md).

**Site Comparison** compares two or three landing sites on one UTC timeline with shared power and radio assumptions. Launch it from Mission Overview, the sidebar or a Landing Optimization search. See [comparison workflow](docs/SITE_COMPARISON.md).

**Earth Communication → DSN stations** screens direct links to Goldstone DSS-14, Madrid DSS-63 and Canberra DSS-43 with individual windows, margins and a 10-minute CSV. See [regional operations](docs/REGIONAL_OPERATIONS.md).

Create a report from **Landing Optimization** or the descent lab. **Mission Reports** keeps snapshots in this browser and exports a print-ready PDF view and JSON including data checksums. See [Phase 7 reporting and validation](docs/PHASE_7.md).

**Landing Simulation** replays a parameterized approach on the South Pole DEM. **Risk Assessment** compares three reproducible Monte Carlo cases and shows a risk register. Open **Simulate descent** on a Phase 5 result to carry its vehicle, UTC and environmental screening into the lab. See [Phase 6 methods](docs/PHASE_6.md).

Use **Mission Configuration** to edit and save mission and spacecraft profiles, including an Artemis crewed study template. **Landing Optimization** screens South Pole sites and UTC arrivals, ranks options by mission priority, and sends a selected arrival back to the map and Time Explorer. See [Phase 5 methods](docs/PHASE_5.md).

South Pole Command now includes LOLA slope and roughness screening, Diviner-derived thermal summaries and a water ice view with modeled cold traps, modeled permanent shadow and the LCROSS observation at Cabeus. Select a module in the left rail and pick a point on the terrain. The analysis panels show spatial coverage, source sampling and interpretation limits. See [Phase 4 methods and regeneration](docs/PHASE_4.md).

The current application includes the SPICE Time Explorer (2026–2028 UTC), Sun/Earth geometric angles, date-driven global lighting, and a worker-based regional terrain horizon for locations south of 85°S. Choose a 2/5/10 m observer height and inspect the 28-day sampled center-clearance summary. See [Phase 3 methods and limits](docs/PHASE_3.md) and the [Turkish project report](docs/PROJECT_REPORT_TR.md).

Under **Mission Systems → Artemis Launch System**, select Artemis III for vehicle data and the published launch and docking plan, or select IV or V for an editable 72-hour comparison of historical South Pole study areas. Reports record the NASA plan, site data, modeling inputs, and the distinction between geometric Earth visibility and radio-link limits.

The web assets required to build and run the application are included under `public/`. The [Phase 3 release](https://github.com/batinates/alpha-lunar/releases/tag/phase3-horizon-v1) also includes the original data used for that milestone. To regenerate the current data, use the source URLs and checksums in the lunar and ephemeris provenance manifests. Store raw inputs in the ignored `data-source/` and `.cache/spice/` directories.

See [Moon AI setup](docs/MOON_AI.md) for the optional Claude connection. Create a local environment file using `.env.example` as the template.

Install JavaScript dependencies with `pnpm install --frozen-lockfile`. Optional data regeneration uses Python with `Pillow`, `numpy` and `spiceypy`. Run `python scripts/ingest_lunar.py` and `python scripts/ingest_ephemeris.py` to rebuild the datasets. Dependencies, build caches and credentials are not stored in Git.

The sections below describe the original surface-atlas foundation. The milestone notes above describe subsequent analysis features.

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

The inspection light remains a rendering control. The Time Explorer uses SPICE for date-dependent geometry. Terrain Intelligence screens sampled regional terrain against entered limits. Flight validation and radio-link availability require additional data and models.

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

1. Extend progressive terrain coverage beyond the three available sites, and align regional imagery to those DEMs.
2. Use independent measurements to validate regional geometry and quantify uncertainty at vehicle scales.
3. Add station-specific and relay ephemerides, finite-disk visibility and mission-specific link validation.
