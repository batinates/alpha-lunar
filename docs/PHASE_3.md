# Phase 3 — SPICE geometry milestone

Time Explorer is opened with the Sun button in the header. Choose a UTC date, scrub the timeline, step a day or play at four simulated hours per second. Select a feature or surface point to update Sun/Earth center elevation and azimuth. The 28-day plot shows both elevations; its center line is the spherical horizon.

Coverage: 2026-01-01 through 2029-01-01 UTC, inclusive. Positions are sampled hourly offline using SpiceyPy/CSPICE and linearly interpolated in the browser. Geometric Sun/Earth vectors use `spkpos`, observer `MOON`, correction `NONE`, frame `MOON_ME_DE421`. DE421 and its matching lunar orientation/frame kernels preserve consistency with the existing polar dataset. Kernel URLs, SHA256 hashes and version are in `/lunar/ephemeris-provenance.json`.

Regenerate: `python -m pip install spiceypy numpy`, then `python scripts/ingest_ephemeris.py`. Kernels are cached in ignored `.cache/spice`. Every interval midpoint is compared with direct SPICE output; measured maximum directional error was about 0.000134 degrees. This validates interpolation only, not the physical accuracy of the source ephemeris. No extrapolation is allowed. The leap-second kernel is recorded; regenerate if UTC leap-second definitions change.

Local angles subtract an observer on a 1737.4 km sphere and use its radial normal. Terrain height, terrain horizons, finite solar/Earth disk, light-time, aberration, eclipses, refraction and communication link budgets are excluded. Above-horizon status is not a claim of illumination or communication availability. The global scene follows the epoch's solar direction, with artistic ambient fill; the projected polar terrain retains inspection lighting until terrain-aware geometry is implemented.

## Regional terrain horizon milestone — 13 November 2026

Selecting a location south of 85°S now starts a dedicated Web Worker that loads the 160 m polar raster. It traces 360 azimuths at one-degree spacing, sampling great-circle paths at 160 m increments up to 100 km or the raster's pixel-center boundary. Each sample is converted into a curved-Moon observer-relative elevation angle using the actual DEM elevation and a selectable 2/5/10 m mast. The maximum angle defines that ray's sampled horizon. Adjacent azimuths are linearly interpolated; missing samples remain unknown. The worker is reused and stale responses are discarded after selection changes.

The new terrain section uses topocentric Sun/Earth vectors with DEM elevation plus mast height. It shows center clearance and scan range in each direction, an azimuth horizon plot and 672 hourly midpoint samples over 28 UTC days. The percentage is the fraction of known sampled centers above the regional profile. It is **not illumination duration**, finite-disk visibility, a PSR classification or link availability. Sub-grid ridges, gaps between azimuths, terrain beyond 100 km/outside the raster, finite disks and eclipses remain unmodeled. No exterior flat terrain is invented. Exaggeration in the visual scene never changes this analysis.

Analytic tests cover spherical curvature, mast-height horizon dip, south-pole geodesics, wrapped azimuths, missing coverage and observer parallax. External scientific validation against higher-resolution reference products remains pending. NASA reference visualization: https://svs.gsfc.nasa.gov/5027/ (context only; not a numerical validation).

Next: curved/locally tangent polar rendering, finer adaptive horizon sampling, finite-disk occultation, illumination-duration maps and external validation. Phase 2 tile streaming/LOD remains open. Phases 4–7 remain planned.
