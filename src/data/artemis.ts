import archive from '../../public/lunar/site-archive/manifest.json'

export const ARTEMIS_SLS = {
  name: 'Space Launch System Block 1',
  configuration: 'Artemis II crew launch stack',
  heightMeters: 98.27,
  fueledMassTonnes: 2604,
  referenceLaunchThrustKilonewtons: 36787,
  referenceMaximumThrustKilonewtons: 39144,
  translunarPayloadTonnes: 27,
  coreEngines: 4,
  solidRocketBoosters: 2,
  guide: 'https://www.nasa.gov/wp-content/uploads/2026/01/a2-reference-guide-012825.pdf#page=68',
  model: 'https://science.nasa.gov/3d-resources/space-launch-system-sls-block-1/',
  mission: 'https://www.nasa.gov/mission/artemis-ii/',
}

export const architecture = 'https://www.nasa.gov/missions/artemis/nasa-shares-plans-to-accelerate-artemis-return-to-moon/'
export const landers = 'https://www.nasa.gov/missions/artemis/nasa-partners-accelerate-lander-development-for-2028-moon-missions/'
export const operationsIII = 'https://www.nasa.gov/missions/artemis/nasas-artemis-iii-mission-to-test-future-moon-lander-operations/'
export const hardwareIII = 'https://www.nasa.gov/blogs/missions/2026/08/05/nasa-joins-artemis-iii-orion-modules-rocket-hardware-update/'
export const regions2024 = 'https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/'
export const ARTEMIS_MISSIONS = {
  III: { target: '2027', updated: '2026-11-04', source: 'https://www.nasa.gov/mission/artemis-iii/', title: 'Crewed low Earth orbit demonstration' },
  IV: { target: 'Early 2028', updated: '2026-11-04', source: 'https://www.nasa.gov/mission/artemis-iv/', title: 'First crewed Artemis lunar landing', studyStart: '2028-02-01T00:00Z' },
  V: { target: 'Late 2028', updated: '2026-09-01', source: 'https://www.nasa.gov/event/artemis-v/', title: 'Lunar surface mission and start of Moon base work', studyStart: '2028-11-15T00:00Z' },
} as const
export type ArtemisMission = keyof typeof ARTEMIS_MISSIONS
export type ArtemisSurfaceMission = Exclude<ArtemisMission, 'III'>

export const HISTORICAL_STUDY_SITES = archive.sites.flatMap(site =>
  ['a3_haworth', 'a3_mons_mouton', 'a3_nobile_rim_2'].includes(site.id) && site.lat !== null && site.lon !== null
    ? [{ id: site.id, name: site.name, latitude: site.lat, longitude: site.lon }] : [])

export const ARTEMIS_TIMELINE = [
  ['Blue Moon launch', 'Blue Origin launches its Mark 2 test vehicle into Earth orbit ahead of the crew.'],
  ['SLS launches Orion', 'Four astronauts launch on SLS and enter low Earth orbit aboard Orion.'],
  ['Blue Moon rendezvous and docking', 'Orion approaches and docks with the Mark 2 test vehicle. The crew evaluates its cabin and systems.'],
  ['Starship rendezvous and docking', 'After Orion undocks from Blue Moon, it meets and docks with the separately launched Starship Version 3 test vehicle.'],
  ['Orion returns to Earth', 'Orion leaves orbit and returns the crew to Earth at the end of the demonstration.'],
] as const

export function artemisVehicles(mission: ArtemisMission): [string, string][] {
  return [
    ['Launch vehicle', mission === 'V' ? 'Standardized SLS' : 'SLS'],
    ['Orion', mission === 'III' ? 'Crew transport, rendezvous and Earth return' : 'Crew transport to orbit and Earth return'],
    ['Upper stage', mission === 'III' ? 'Non-propulsive spacer in place of ICPS' : mission === 'IV'
      ? 'ICPS · Under evaluation / Extended Centaur V · Under evaluation' : 'Not announced'],
    mission === 'III' ? ['Docking test vehicles', 'Blue Moon Mark 2 and Starship Version 3 test articles'] :
      ['Human landing system', mission === 'IV' ? 'Starship HLS / Blue Moon Mark 2 · Provider selection pending' : 'Not announced'],
    ['Exact launch date', 'Not announced'],
    ...(mission === 'III' ? [] : [['Landing coordinates', 'Not announced'] as [string, string]]),
  ]
}

export const ARTEMIS_DATA_SOURCES = [
  { label: 'Observation-derived data', name: 'LRO LOLA · LDEM_85S_40M V2.0', detail: '40 m source grid, 160 m analysis grid where covered. Extended terrain uses 480 m derivatives of 240 m LOLA polar products.', href: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm' },
  { label: 'Observation-derived data', name: 'LRO Diviner · Schorghofer & Williams V3', detail: '480 m application grid. Climatological surface mean and peak across populated time bins. Exact acquisition span: Unavailable in the bundled derivative.', href: '/lunar/polar-environment.json' },
  { label: 'Observation-derived data', name: 'NASA PDS · LRO Diviner archive', detail: 'Instrument archive for the observations underlying the climatology.', href: 'https://pds-geosciences.wustl.edu/missions/lro/diviner.htm' },
  { label: 'Modeled result', name: 'NASA GSFC · LPSR_85S_060M_201608 V1.05', detail: '60 m source, 480 m area summary. Long-term permanent shadow model. Ice evidence: Unavailable from this product.', href: 'https://pgda.gsfc.nasa.gov/products/69' },
  { label: 'Modeled result', name: 'NAIF SPICE · DE421 / MOON_ME_DE421', detail: '2026–2028 UTC. Hourly vectors interpolated for 10-minute terrain screening. Geometric Sun and Earth centers.', href: '/lunar/ephemeris-provenance.json' },
  { label: 'Modeled result', name: 'NASA/JPL NAIF · Generic SPICE kernels', detail: 'Upstream kernel archive. Exact inputs and checksums are listed in the ephemeris provenance.', href: 'https://naif.jpl.nasa.gov/naif/data_generic.html' },
  { label: 'Modeled result', name: 'JPL Horizons · 2028 direction comparison', detail: 'Airless apparent directions provide an external comparison. Geometric and apparent directions use different corrections.', href: '/lunar/validation/report.json' },
] as const
