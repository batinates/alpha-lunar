import type { LunarFeature } from '../domain/lunar'

// IAU-adopted centers from the USGS Gazetteer of Planetary Nomenclature.
// Planetographic latitude; positive-east longitude normalized to -180..180.
export const LUNAR_FEATURES: LunarFeature[] = [
  { id: 'shackleton', name: 'Shackleton', kind: 'crater', latitude: -89.67, longitude: 129.78, diameterKm: 20.92, priority: 1, summary: 'A south-polar impact crater whose rim lies close to the lunar south pole.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/5450' },
  { id: 'de-gerlache', name: 'de Gerlache', kind: 'crater', latitude: -88.48, longitude: -88.34, diameterKm: 32.71, priority: 1, summary: 'A prominent south-polar crater west of the prime meridian.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/1439' },
  { id: 'haworth', name: 'Haworth', kind: 'crater', latitude: -86.9, longitude: -4, diameterKm: 35, priority: 1, summary: 'A large crater in the immediate south-polar region.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/14502' },
  { id: 'shoemaker', name: 'Shoemaker', kind: 'crater', latitude: -88.14, longitude: 45.91, diameterKm: 51.82, priority: 1, summary: 'A deep south-polar crater named for planetary geologist Eugene Shoemaker.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/5494' },
  { id: 'faustini', name: 'Faustini', kind: 'crater', latitude: -87.18, longitude: 84.31, diameterKm: 42.48, priority: 1, summary: 'A south-polar crater east of Shoemaker.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/1919' },
  { id: 'nobile', name: 'Nobile', kind: 'crater', latitude: -85.28, longitude: 53.27, diameterKm: 79.27, priority: 2, summary: 'A large crater in the broader south-polar exploration region.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/4321' },
  { id: 'mons-malapert', name: 'Mons Malapert', kind: 'mons', latitude: -85.98, longitude: -1.67, diameterKm: 67, priority: 1, summary: 'An IAU-named mountain near the lunar south pole.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/SearchResults?Feature+Type=27_Mons&Target=16_Moon' },
  { id: 'tycho', name: 'Tycho', kind: 'crater', latitude: -43.31, longitude: -11.36, diameterKm: 85.29, priority: 1, summary: 'A young, ray-system crater in the southern lunar highlands.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/6163' },
  { id: 'copernicus', name: 'Copernicus', kind: 'crater', latitude: 9.62, longitude: -20.08, diameterKm: 96.07, priority: 1, summary: 'A prominent complex crater with a bright ray system.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/1296' },
  { id: 'mare-imbrium', name: 'Mare Imbrium', kind: 'mare', latitude: 32.8, longitude: -15.6, diameterKm: 1123, priority: 1, summary: 'A vast basaltic plain filling the Imbrium impact basin.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/3675' },
  { id: 'oceanus-procellarum', name: 'Oceanus Procellarum', kind: 'oceanus', latitude: 18.4, longitude: -57.4, diameterKm: 2592, priority: 2, summary: 'The largest named lunar mare-like expanse on the near side.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/4394' },
  { id: 'mare-orientale', name: 'Mare Orientale', kind: 'mare', latitude: -19.4, longitude: -92.8, diameterKm: 327, priority: 2, summary: 'A striking multi-ring impact basin near the western limb.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/Feature/3758' },
  { id: 'spa-basin', name: 'South Pole–Aitken', kind: 'basin', latitude: -53, longitude: 169, diameterKm: 2500, priority: 2, summary: 'An immense ancient impact structure spanning much of the lunar far side.', gazetteerUrl: 'https://planetarynames.wr.usgs.gov/' },
]

export const SOUTH_POLE_FEATURES = LUNAR_FEATURES.filter((feature) => feature.latitude < -84)
