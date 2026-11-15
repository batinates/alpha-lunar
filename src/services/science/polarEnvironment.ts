import { POLAR_HALF_EXTENT } from './lunarAssets.ts'

export const ENVIRONMENT_WIDTH = 632
const BYTES_PER_CELL = 6
const NO_TEMPERATURE = 65535
const NO_BYTE = 255
export const COLD_TRAP_K = 110
export const ENVIRONMENT_MANIFEST = '/lunar/polar-environment.json'
export const DIVINER_SOURCE = 'https://doi.org/10.7910/DVN/EGOOCL'
export const SHADOW_SOURCE = 'https://pgda.gsfc.nasa.gov/products/69'
export const LCROSS_IMPACT = {
  name: 'LCROSS Centaur impact',
  latitude: -84.6796,
  longitude: -48.7093,
  scienceUrl: 'https://science.nasa.gov/image-detail/20110615lcross/',
  locationUrl: 'https://arxiv.org/abs/1103.1687',
}

export function readEnvironment(buffer: ArrayBuffer) {
  if (buffer.byteLength !== ENVIRONMENT_WIDTH ** 2 * BYTES_PER_CELL)
    throw new Error('Polar environment grid has an unexpected size')
  return new DataView(buffer)
}

export function environmentCell(grid: DataView, col: number, row: number) {
  const index = (row * ENVIRONMENT_WIDTH + col) * BYTES_PER_CELL
  const peak = grid.getUint16(index, true)
  const mean = grid.getUint16(index + 2, true)
  const bins = grid.getUint8(index + 4)
  const shadow = grid.getUint8(index + 5)
  return {
    peak: peak === NO_TEMPERATURE ? null : peak / 10,
    mean: mean === NO_TEMPERATURE ? null : mean / 10,
    bins: bins === NO_BYTE ? null : bins,
    shadowFraction: shadow === NO_BYTE ? null : shadow / 64,
  }
}

export function sampleEnvironment(grid: DataView, x: number, z: number) {
  if (!Number.isFinite(x) || !Number.isFinite(z) ||
      Math.abs(x) >= POLAR_HALF_EXTENT || Math.abs(z) >= POLAR_HALF_EXTENT) return null
  const col = Math.floor((x / POLAR_HALF_EXTENT + 1) / 2 * ENVIRONMENT_WIDTH)
  const row = Math.floor((z / POLAR_HALF_EXTENT + 1) / 2 * ENVIRONMENT_WIDTH)
  return environmentCell(grid, col, row)
}

let environmentRequest: Promise<DataView> | undefined
export function loadPolarEnvironment() {
  environmentRequest ??= fetch('/lunar/polar-environment.bin').then(async response => {
    if (!response.ok) throw new Error(`Polar environment unavailable (${response.status})`)
    return readEnvironment(await response.arrayBuffer())
  }).catch(error => {
    environmentRequest = undefined
    throw error
  })
  return environmentRequest
}
