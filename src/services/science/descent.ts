import type { Coordinates } from '../../domain/lunar.ts'
import { latLonToPolar, polarHeight, type HeightRaster } from './lunarAssets.ts'
import { screenTerrain, terrainSlope } from './siteScreening.ts'

export const GRAVITY = 1.62
export const DESCENT_FIELDS = {
  altitude: { label: 'Entry altitude (m)', min: 200, max: 4000, step: 10 },
  speed: { label: 'Entry speed (m/s)', min: 10, max: 500, step: 1 },
  angle: { label: 'Descent angle (°)', min: 25, max: 85, step: 1 },
  bearing: { label: 'Travel heading (° true)', min: 0, max: 359, step: 1 },
  thrustKN: { label: 'Available thrust (kN)', min: 1, max: 10000, step: .1 },
  alongSigma: { label: 'Along-track 1σ (m)', min: 0, max: 600, step: 1 },
  acrossSigma: { label: 'Cross-track 1σ (m)', min: 0, max: 600, step: 1 },
  speedSigma: { label: 'Entry speed 1σ (%)', min: 0, max: 25, step: 1 },
  trials: { label: 'Monte Carlo trials', min: 100, max: 2000, step: 1 },
  seed: { label: 'Random seed', min: 1, max: 2147483647, step: 1 },
} as const

export type DescentSettings = Record<keyof typeof DESCENT_FIELDS, number>
export const DEFAULT_DESCENT: DescentSettings = {
  altitude: 1800, speed: 85, angle: 50, bearing: 45, thrustKN: 10,
  alongSigma: 220, acrossSigma: 130, speedSigma: 5, trials: 600, seed: 42,
}

export interface DescentRequest {
  coordinates: Coordinates
  settings: DescentSettings
  massKg: number
  squareMeters: number
  slopeLimit: number
  roughnessLimit: number
}

export interface PathPoint { x: number; y: number; z: number; ground: number | null; time: number; speed: number }
type Outcome = 'within' | 'exceeded' | 'unknown'
export interface DescentTrial { x: number; y: number | null; z: number; outcome: Outcome }
export interface DescentScenario {
  name: string
  settings: DescentSettings
  path: PathPoint[]
  ellipse: { x: number; y: number | null; z: number }[]
  points: DescentTrial[]
  nominal: { duration: number; thrustKN: number; clearance: number | null; touchdownSlope: number | null }
  counts: Record<Outcome | 'thrust' | 'terrain' | 'footprint' | 'slope' | 'roughness', number>
}

export function validDescent(request: DescentRequest) {
  const { settings, coordinates, massKg, squareMeters, slopeLimit, roughnessLimit } = request
  return Number.isFinite(coordinates.latitude) && coordinates.latitude >= -90 && coordinates.latitude <= -85 &&
    Number.isFinite(coordinates.longitude) && Math.abs(coordinates.longitude) <= 180 &&
    Number.isFinite(massKg) && massKg >= 1 && massKg <= 1e6 &&
    Number.isFinite(squareMeters) && squareMeters >= 320 && squareMeters <= 3200 &&
    Number.isFinite(slopeLimit) && slopeLimit > 0 && slopeLimit <= 45 &&
    Number.isFinite(roughnessLimit) && roughnessLimit >= .1 && roughnessLimit <= 100 &&
    Number.isInteger(settings.trials) && Number.isInteger(settings.seed) &&
    Object.entries(DESCENT_FIELDS).every(([field, { min, max }]) => {
      const value = settings[field as keyof DescentSettings]
      return Number.isFinite(value) && value >= min && value <= max
    })
}

function localFrame(coordinates: Coordinates, bearing: number) {
  const theta = (bearing + coordinates.longitude) * Math.PI / 180
  return { sin: Math.sin(theta), cos: Math.cos(theta) }
}

export function descentKinematics(settings: DescentSettings, speed: number, massKg: number) {
  const angle = settings.angle * Math.PI / 180
  const down = speed * Math.sin(angle)
  const horizontal = speed * Math.cos(angle)
  const duration = 2 * settings.altitude / down
  return { duration, range: horizontal * duration / 2,
    thrustKN: massKg * Math.hypot(horizontal / duration, GRAVITY + down / duration) / 1000 }
}

// Shared draws make scenario differences attributable to changed assumptions.
function gaussianDraws(seed: number, count: number) {
  let state = seed
  function uniform() {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) + .5) / 4294967296
  }
  function normal() {
    return Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform())
  }
  return Array.from({ length: count }, () => [normal(), normal(), normal()])
}

function scenario(name: string, request: DescentRequest, raster: HeightRaster, draws: number[][]): DescentScenario {
  const { coordinates, settings, massKg, squareMeters, slopeLimit, roughnessLimit } = request
  const target = latLonToPolar(coordinates.latitude, coordinates.longitude)
  const { sin, cos } = localFrame(coordinates, settings.bearing)
  const point = (along: number, across: number) => ({
    x: target.x + along * sin + across * cos,
    z: target.z - along * cos + across * sin,
  })
  const targetHeight = polarHeight(raster, target.x, target.z)!
  const motion = descentKinematics(settings, settings.speed, massKg)
  const path = Array.from({ length: 81 }, (_, i) => {
    const progress = i / 80, remaining = (1 - progress) ** 2
    const { x, z } = point(-motion.range * remaining, 0)
    return { x, z, y: targetHeight + settings.altitude * remaining, ground: polarHeight(raster, x, z),
      time: motion.duration * progress, speed: settings.speed * (1 - progress) }
  })
  const approach = path.slice(0, -1)
  const nominal = {
    duration: motion.duration, thrustKN: motion.thrustKN,
    clearance: approach.some(p => p.ground === null) ? null : Math.min(...approach.map(p => p.y - p.ground!)),
    touchdownSlope: terrainSlope(raster, target.x, target.z),
  }
  const ellipse = Array.from({ length: 65 }, (_, i) => {
    const angle = i / 64 * Math.PI * 2
    const { x, z } = point(2.4477 * settings.alongSigma * Math.cos(angle), 2.4477 * settings.acrossSigma * Math.sin(angle))
    return { x, z, y: polarHeight(raster, x, z) }
  })
  const counts = { within: 0, exceeded: 0, unknown: 0, thrust: 0, terrain: 0, footprint: 0, slope: 0, roughness: 0 }
  const points: DescentTrial[] = []
  // This coarse footprint test uses projected coordinates, as does the displayed ellipse.
  const terrainScreen = screenTerrain(raster, target.x, target.z, squareMeters)
  for (const [a, b, s] of draws) {
    const along = a * settings.alongSigma, across = b * settings.acrossSigma
    const speed = Math.max(.1, settings.speed * (1 + s * settings.speedSigma / 100))
    const { x, z } = point(along, across)
    const y = polarHeight(raster, x, z)
    const slope = terrainSlope(raster, x, z)
    const thrust = descentKinematics(settings, speed, massKg).thrustKN > settings.thrustKN
    const footprint = Math.max(Math.abs(x - target.x), Math.abs(z - target.z)) > squareMeters / 2
    const steep = slope !== null && slope > slopeLimit
    const rough = terrainScreen !== null && terrainScreen.maxRoughness > roughnessLimit
    let terrain = false
    let unknown = y === null || slope === null || terrainScreen === null
    if (y !== null) {
      for (let i = 0; i < 80; i++) {
        const remaining = (1 - i / 80) ** 2
        const sample = point(along - motion.range * remaining, across)
        const ground = polarHeight(raster, sample.x, sample.z)
        if (ground === null) unknown = true
        else if (y + settings.altitude * remaining <= ground) terrain = true
      }
    }
    if (thrust) counts.thrust++
    if (footprint) counts.footprint++
    if (steep) counts.slope++
    if (rough) counts.roughness++
    if (terrain) counts.terrain++
    const outcome = thrust || footprint || steep || rough || terrain ? 'exceeded' : unknown ? 'unknown' : 'within'
    counts[outcome]++
    points.push({ x, y, z, outcome })
  }
  return { name, settings, path, ellipse, points, nominal, counts }
}

export function simulateDescents(request: DescentRequest, raster: HeightRaster) {
  if (!validDescent(request)) throw new RangeError('Enter valid descent parameters and select a site from 85°S to 90°S.')
  const { x, z } = latLonToPolar(request.coordinates.latitude, request.coordinates.longitude)
  if (polarHeight(raster, x, z) === null) throw new RangeError('The selected touchdown is outside DEM coverage.')
  const { settings } = request
  const draws = gaussianDraws(settings.seed, settings.trials)
  return [
    scenario('Baseline', request, raster, draws),
    scenario('Heading +45°', { ...request, settings: { ...settings, bearing: (settings.bearing + 45) % 360 } }, raster, draws),
    scenario('30% lower navigation dispersion', { ...request, settings: { ...settings,
      alongSigma: settings.alongSigma * .7, acrossSigma: settings.acrossSigma * .7 } }, raster, draws),
  ]
}
