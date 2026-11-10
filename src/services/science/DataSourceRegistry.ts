export type ScientificRepresentation = 'measured' | 'modeled' | 'interpolated' | 'reference' | 'visual-only'
export type DataSourceState = 'ready' | 'queued' | 'unavailable'

export interface SpatialCoverage {
  north: number
  south: number
  east: number
  west: number
}

export interface ScientificDatasetManifest {
  id: string
  title: string
  provider: string
  productVersion?: string
  representation: ScientificRepresentation
  state: DataSourceState
  referenceFrame: string
  resolution?: string
  coverage?: SpatialCoverage
  sourceUrl: string
  retrievedAt?: string
  checksum?: string
  limitations: string[]
}

export interface TerrainTileRequest {
  datasetId: string
  level: number
  x: number
  y: number
  signal?: AbortSignal
}

export interface TerrainTile {
  request: Omit<TerrainTileRequest, 'signal'>
  elevation: Float32Array
  width: number
  height: number
  noDataValue?: number
  manifest: ScientificDatasetManifest
}

export interface TerrainDataProvider {
  readonly id: string
  describe(): Promise<ScientificDatasetManifest>
  getTile(request: TerrainTileRequest): Promise<TerrainTile>
}

/**
 * Runtime boundary for Phase 2 scientific providers. The renderer depends on
 * this contract, not on NASA product URLs or raster formats directly.
 */
export class DataSourceRegistry {
  private readonly terrainProviders = new Map<string, TerrainDataProvider>()

  registerTerrainProvider(provider: TerrainDataProvider): void {
    if (this.terrainProviders.has(provider.id)) {
      throw new Error(`Terrain provider already registered: ${provider.id}`)
    }
    this.terrainProviders.set(provider.id, provider)
  }

  getTerrainProvider(id: string): TerrainDataProvider | undefined {
    return this.terrainProviders.get(id)
  }

  listTerrainProviders(): string[] {
    return [...this.terrainProviders.keys()]
  }
}
