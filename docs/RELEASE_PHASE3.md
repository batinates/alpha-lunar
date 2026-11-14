# Phase 3 terrain horizon milestone

Includes the complete React/TypeScript application, NASA-derived runtime assets, Python data ingestion tools, coordinate and analysis tests, architecture documentation, and Turkish project guide.

Release attachments:
- `alpha-lunar-source-data.tar.gz`: original NASA/PDS rasters and NAIF/SPICE kernels. Extract at the repository root.
- `alpha-lunar-horizon.tar.gz`: production static build and Sites hosting manifest from commit ac3bcfd79bf78d0842ab93457750306959847164. The release's following documentation commit does not change runtime code.

Source checksums: `public/lunar/manifest.json` and `public/lunar/ephemeris-provenance.json`.

Validation: production build and 12 tests passed; terrain analysis checked in desktop/mobile browser layouts. Regional center-clearance estimates exclude terrain beyond the scan, unresolved ridges, eclipses and finite disks. They are not operational illumination-duration or communication-availability predictions.
