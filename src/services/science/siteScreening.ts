import { LUNAR_RADIUS, POLAR_HALF_EXTENT, polarHeight, type HeightRaster } from './lunarAssets.ts'

export const TERRAIN_SPACING = 160
const HALF_SAMPLE = POLAR_HALF_EXTENT - TERRAIN_SPACING / 2

function localSpacing(x: number, z: number) {
  return TERRAIN_SPACING / (1 + (Math.hypot(x, z) / (2 * LUNAR_RADIUS)) ** 2)
}

export function terrainSlope(raster: HeightRaster, x: number, z: number) {
  const step = TERRAIN_SPACING
  if (!Number.isFinite(x) || !Number.isFinite(z)) return null
  if (Math.abs(x) + step > HALF_SAMPLE || Math.abs(z) + step > HALF_SAMPLE) return null
  const riseX = polarHeight(raster, x + step, z)! - polarHeight(raster, x - step, z)!
  const riseZ = polarHeight(raster, x, z + step)! - polarHeight(raster, x, z - step)!
  return Math.atan2(Math.hypot(riseX, riseZ), 2 * localSpacing(x, z)) * 180 / Math.PI
}

function planeRoughness(raster: HeightRaster, x: number, z: number) {
  const samples = [-1, 0, 1].flatMap(row =>
    [-1, 0, 1].map(col => polarHeight(raster, x + col * TERRAIN_SPACING, z + row * TERRAIN_SPACING)!))
  const mean = samples.reduce((total, height) => total + height, 0) / 9
  const dx = (samples[2] + samples[5] + samples[8] - samples[0] - samples[3] - samples[6]) / 6
  const dz = (samples[6] + samples[7] + samples[8] - samples[0] - samples[1] - samples[2]) / 6
  const variance = samples.reduce((total, height, i) => {
    const fitted = mean + (i % 3 - 1) * dx + (Math.floor(i / 3) - 1) * dz
    return total + (height - fitted) ** 2
  }, 0) / 9
  return Math.sqrt(variance)
}

export function screenTerrain(raster: HeightRaster, x: number, z: number, span: number) {
  if (![x, z, span].every(Number.isFinite) || span < 320 || span > 3200) return null
  const halfSpan = span / 2 * TERRAIN_SPACING / localSpacing(x, z)
  const intervals = 2 * Math.ceil(halfSpan / TERRAIN_SPACING)
  if (Math.abs(x) + halfSpan + TERRAIN_SPACING > HALF_SAMPLE ||
      Math.abs(z) + halfSpan + TERRAIN_SPACING > HALF_SAMPLE) return null
  let maxSlope = 0
  let maxRoughness = 0
  for (let row = 0; row <= intervals; row++) {
    for (let col = 0; col <= intervals; col++) {
      const px = x + (2 * col / intervals - 1) * halfSpan
      const pz = z + (2 * row / intervals - 1) * halfSpan
      maxSlope = Math.max(maxSlope, terrainSlope(raster, px, pz)!)
      maxRoughness = Math.max(maxRoughness, planeRoughness(raster, px, pz))
    }
  }
  return { height: polarHeight(raster, x, z)!, centerSlope: terrainSlope(raster, x, z)!,
    maxSlope, maxRoughness, sampleCount: (intervals + 1) ** 2 }
}

export function thermalExceedances(peak: number, lower: number, upper: number) {
  if (![peak, lower, upper].every(Number.isFinite) || lower <= 0 || upper < lower) return null
  if (peak > upper) return 'Model peak exceeds upper limit'
  if (peak < lower) return 'Even the model peak is below the lower limit'
  return 'No exceedance established from peak alone'
}
