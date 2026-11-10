# ALPHA LUNAR — Phase 1

ALPHA LUNAR is an interactive lunar exploration foundation for a future scientific digital twin and mission-intelligence platform.

## Phase 1 scope

- Professional dark aerospace design system and responsive mission-control shell
- WebGL lunar globe with orbit, zoom, selection, coordinates, and named landmarks
- IAU/USGS gazetteer reference layer with search and feature provenance
- Smooth camera fly-to navigation
- Dedicated Lunar South Pole command mode
- High-density procedural regional terrain preview
- Clear integrity boundary between reference data and visual-only rendering

No terrain-derived scientific analysis, landing recommendation, hazard score, illumination product, or resource probability is produced in this phase.

## Run locally

```bash
pnpm install
pnpm dev
```

Build with `pnpm build`.

## Architecture

The React/TypeScript application is split into domain types, authoritative reference data, coordinate utilities, rendering components, and interface composition. Three.js is accessed through React Three Fiber; independent global and regional renderers can later consume streamed imagery and DEM tiles without coupling scientific ingestion to the UI.

The planned Phase 2 adapter boundary will support versioned LRO/LOLA/SLDEM raster manifests, coordinate reference metadata, resolution, provenance, coverage, and measured/modeled/interpolated classifications.

## Data status

- **Integrated:** IAU-approved feature names and center coordinates referenced from the USGS Gazetteer of Planetary Nomenclature.
- **Procedural visual assets:** global grayscale albedo and South Pole terrain relief. These are intentionally labeled in the UI and are not scientific products.
- **Queued:** LRO imagery, LOLA/SLDEM elevation products, tile generation, terrain LOD, and verified regional surface geometry.
