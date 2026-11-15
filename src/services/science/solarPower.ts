import type { Coordinates } from '../../domain/lunar.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from './ephemeris.ts'
import { horizonAt, type HorizonProfile } from './terrainHorizon.ts'
import { eclipseTransmission } from './lunarEvents.ts'

const DEG = Math.PI / 180
const HOUR = 3_600_000
export const POWER_STEP_MS = 10 * 60_000
export const SOLAR_RADIUS_KM = 695_700
const AU_KM = 149_597_870.7
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export const POWER_FIELDS = {
  area: { label: 'Panel area (m²)', min: 0.01, max: 1000, step: 0.1, value: 2 },
  efficiency: { label: 'Panel efficiency (%)', min: 1, max: 100, step: 1, value: 30 },
  load: { label: 'Continuous load (W)', min: 1, max: 1e6, step: 1, value: 120 },
  capacity: { label: 'Usable battery (Wh)', min: 1, max: 1e7, step: 1, value: 2400 },
  initial: { label: 'Initial charge (%)', min: 0, max: 100, step: 1, value: 100 },
  chargeEfficiency: { label: 'Charge efficiency (%)', min: 1, max: 100, step: 1, value: 95 },
  dischargeEfficiency: { label: 'Discharge efficiency (%)', min: 1, max: 100, step: 1, value: 95 },
  azimuth: { label: 'Panel facing (° N clockwise)', min: 0, max: 360, step: 1, value: 90 },
} as const
export type PowerInputs = Record<keyof typeof POWER_FIELDS, number> & { orientation: 'tracking' | 'horizontal' | 'vertical' }
export const DEFAULT_POWER: PowerInputs = {
  ...Object.fromEntries(Object.entries(POWER_FIELDS).map(([key, { value }]) => [key, value])) as Record<keyof typeof POWER_FIELDS, number>,
  orientation: 'tracking',
}
export function validPower(inputs: PowerInputs) {
  return ['tracking', 'horizontal', 'vertical'].includes(inputs.orientation) &&
    Object.entries(POWER_FIELDS).every(([key, { min, max }]) => {
      if (key === 'azimuth' && inputs.orientation !== 'vertical') return true
      const value = inputs[key as keyof typeof POWER_FIELDS]
      return Number.isFinite(value) && value >= min && value <= max
    })
}

/** Area and vertical first moment of the part of a uniform circular disk above a straight edge. */
function diskSegment(centerAboveEdgeDeg: number, radiusDeg: number) {
  const x = clamp(centerAboveEdgeDeg / radiusDeg, -1, 1)
  const chord = Math.sqrt(1 - x * x)
  return { fraction: (Math.acos(-x) + x * chord) / Math.PI, momentDeg: 2 * radiusDeg * chord ** 3 / (3 * Math.PI) }
}
export const diskVisibleFraction = (clearanceDeg: number, radiusDeg: number) => diskSegment(clearanceDeg, radiusDeg).fraction

export function panelPowerAt(sun: { elevation: number; azimuth: number; distance: number }, horizon: number, inputs: PowerInputs) {
  const radius = Math.asin(SOLAR_RADIUS_KM / sun.distance) / DEG
  const visible = diskVisibleFraction(sun.elevation - horizon, radius)
  let projected = visible
  if (inputs.orientation === 'horizontal') {
    // Integrate approximate incidence across the disk, including an upper limb above the panel plane.
    const front = diskSegment(sun.elevation - Math.max(horizon, 0), radius)
    projected = front.fraction * Math.sin(sun.elevation * DEG) + front.momentDeg * DEG * Math.cos(sun.elevation * DEG)
  } else if (inputs.orientation === 'vertical') {
    projected = visible * Math.cos(sun.elevation * DEG) * Math.cos((sun.azimuth - inputs.azimuth) * DEG)
  }
  const power = clamp(projected, 0, 1) * 1361 * (AU_KM / sun.distance) ** 2 * inputs.area * inputs.efficiency / 100
  return { visible, power }
}

export function integratePower(start: number, end: number, inputs: PowerInputs,
  sample: (time: number) => { visible: number; power: number } | null) {
  let charge = inputs.capacity * inputs.initial / 100
  let chargeKnown = true
  let minimum = charge, generatedWh = 0, unservedWh = 0, unknownHours = 0
  let deficit = 0, longestDeficitHours = 0
  let darkness = 0, longestDarkHours = 0
  const rows = []
  for (let from = start; from < end; from += POWER_STEP_MS) {
    const to = Math.min(from + POWER_STEP_MS, end)
    const hours = (to - from) / HOUR
    const value = sample((from + to) / 2)
    if (value === null) {
      unknownHours += hours
      chargeKnown = false
      deficit = darkness = 0
    } else {
      generatedWh += value.power * hours
      const net = (value.power - inputs.load) * hours
      deficit = net < 0 ? deficit + hours : 0
      darkness = value.visible === 0 ? darkness + hours : 0
      longestDeficitHours = Math.max(longestDeficitHours, deficit)
      longestDarkHours = Math.max(longestDarkHours, darkness)
      if (chargeKnown) {
        if (net >= 0) charge = Math.min(inputs.capacity, charge + net * inputs.chargeEfficiency / 100)
        else {
          const delivered = Math.min(-net, charge * inputs.dischargeEfficiency / 100)
          charge = Math.max(0, charge - delivered / (inputs.dischargeEfficiency / 100))
          unservedWh += -net - delivered
        }
        minimum = Math.min(minimum, charge)
      }
    }
    rows.push({ from, to, visible: value?.visible ?? null, power: value?.power ?? null,
      batteryPercent: chargeKnown ? 100 * charge / inputs.capacity : null })
  }
  return { rows, generatedWh, longestDeficitHours, longestDarkHours, unknownHours,
    minimumPercent: chargeKnown ? 100 * minimum / inputs.capacity : null, unservedWh: chargeKnown ? unservedWh : null }
}

export function surfacePower(data: Ephemeris, start: number, end: number, site: Coordinates, terrain: HorizonProfile, inputs: PowerInputs) {
  return integratePower(start, end, inputs, time => {
    const vectors = interpolateEphemeris(data, time)
    const height = terrain.observerElevation + terrain.mastHeight
    const sun = horizonAngles(vectors.sun, site.latitude, site.longitude, height)
    const horizon = horizonAt(terrain, sun.azimuth)
    if (!horizon) return null
    const result = panelPowerAt(sun, horizon.elevation, inputs)
    if (result.power > 0) {
      const lat = site.latitude * DEG, lon = site.longitude * DEG, radius = 1737.4 + height / 1000
      const observer = [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)]
      const relative = (body: typeof vectors.sun) => body.map((value, i) => value - observer[i]) as typeof vectors.sun
      result.power *= eclipseTransmission(relative(vectors.sun), relative(vectors.earth))
    }
    // A known obstruction remains a blockage even if the ray is truncated farther out.
    return horizon.range + terrain.stepMeters > terrain.radiusMeters || result.visible === 0 ? result : null
  })
}
