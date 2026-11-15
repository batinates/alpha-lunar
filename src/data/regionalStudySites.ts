import { polarToLatLon } from '../services/science/lunarAssets'

// Centers of the regional inspection windows, not surveyed touchdown points.
export const REGIONAL_STUDY_SITES = [
  { id: '01', name: 'Connecting Ridge', ...polarToLatLon(-19000, 4000) },
  { id: '04', name: 'Shackleton Rim', ...polarToLatLon(-9000, -1000) },
  { id: '11', name: 'de Gerlache Rim', ...polarToLatLon(-45000, -23000) },
]
