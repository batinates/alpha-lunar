export type FeatureKind = 'crater' | 'mare' | 'basin' | 'mons' | 'oceanus' | 'region'

export interface LunarFeature {
  id: string
  name: string
  kind: FeatureKind
  latitude: number
  longitude: number
  diameterKm?: number
  summary: string
  priority: 1 | 2 | 3
  gazetteerUrl: string
}

export interface Coordinates {
  latitude: number
  longitude: number
}

export type ExplorerMode = 'global' | 'south-pole'
export type SurfaceStyle = 'surface' | 'relief'
