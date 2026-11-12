# Phase 3 — SPICE geometry milestone

Time Explorer is opened with the Sun button in the header. Choose a UTC date, scrub the timeline, step a day or play at four simulated hours per second. Select a feature or surface point to update Sun/Earth center elevation and azimuth. The 28-day plot shows both elevations; its center line is the spherical horizon.

Coverage: 2026-01-01 through 2028-01-01 UTC, inclusive. Positions are sampled hourly offline using SpiceyPy/CSPICE and linearly interpolated in the browser. Geometric Sun/Earth vectors use `spkpos`, observer `MOON`, correction `NONE`, frame `MOON_ME_DE421`. DE421 and its matching lunar orientation/frame kernels preserve consistency with the existing polar dataset. Kernel URLs, SHA256 hashes and version are in `/lunar/ephemeris-provenance.json`.

Regenerate: `python -m pip install spiceypy numpy`, then `python scripts/ingest_ephemeris.py`. Kernels are cached in ignored `.cache/spice`. Every interval midpoint is compared with direct SPICE output; measured maximum directional error was about 0.000134 degrees. This validates interpolation only, not the physical accuracy of the source ephemeris. No extrapolation is allowed. The leap-second kernel is recorded; regenerate if UTC leap-second definitions change.

Local angles subtract an observer on a 1737.4 km sphere and use its radial normal. Terrain height, terrain horizons, finite solar/Earth disk, light-time, aberration, eclipses, refraction and communication link budgets are excluded. Above-horizon status is not a claim of illumination or communication availability. The global scene follows the epoch's solar direction, with artistic ambient fill; the projected polar terrain retains inspection lighting until terrain-aware geometry is implemented.

Next Phase 3 milestone: curved/locally tangent polar surface geometry, DEM horizon tracing, occultation, illumination-duration maps and validation against reference products. Phase 2 tile streaming/LOD remains open. Phases 4–7 remain planned.
