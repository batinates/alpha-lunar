import type { Coordinates } from '../../domain/lunar.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from './ephemeris.ts'
import { horizonAt, type HorizonProfile } from './terrainHorizon.ts'
import { clearanceStatus, HOUR } from './landingOptimization.ts'
export { HOUR }

export const LINK_FIELDS = {
  frequency: { label: 'Frequency (GHz)', min: .1, max: 100, step: .01, value: 2.2 },
  power: { label: 'Transmit power (W)', min: .01, max: 10000, step: .01, value: 10 },
  transmitGain: { label: 'Transmit antenna gain (dBi)', min: -20, max: 100, step: .1, value: 12 },
  receiveGain: { label: 'Receive antenna gain (dBi)', min: -20, max: 100, step: .1, value: 58 },
  losses: { label: 'Additional losses (dB)', min: 0, max: 150, step: .1, value: 3 },
  sensitivity: { label: 'Receiver sensitivity (dBm)', min: -180, max: -30, step: .1, value: -130 },
} as const

export type LinkInputs = Record<keyof typeof LINK_FIELDS, number>
const LIGHT_SPEED = 299792458

export function validLink(inputs: LinkInputs) {
  return Object.entries(LINK_FIELDS).every(([key, field]) => {
    const value = inputs[key as keyof LinkInputs]
    return Number.isFinite(value) && value >= field.min && value <= field.max
  })
}

export function linkBudget(distanceKm: number, inputs: LinkInputs) {
  const loss = 20 * Math.log10(4 * Math.PI * distanceKm * 1000 * inputs.frequency * 1e9 / LIGHT_SPEED)
  const received = 30 + 10 * Math.log10(inputs.power) + inputs.transmitGain + inputs.receiveGain - loss - inputs.losses
  return { loss, received, margin: received - inputs.sensitivity }
}

export function earthLinkAt(data: Ephemeris, time: number, coordinates: Coordinates, profile: HorizonProfile | null, inputs: LinkInputs, heightMeters = 0) {
  const { earth } = interpolateEphemeris(data, time)
  const height = profile ? profile.observerElevation + profile.mastHeight : heightMeters
  const geometry = horizonAngles(earth, coordinates.latitude, coordinates.longitude, height)
  const horizon = profile ? horizonAt(profile, geometry.azimuth) : null
  const visibility = clearanceStatus(geometry.elevation, horizon, profile?.radiusMeters ?? 0)
  const budget = linkBudget(geometry.distance, inputs)
  const status = visibility.unknown ? 'Unknown terrain' : !visibility.clear ? 'Blocked by terrain' :
    budget.margin < 0 ? 'Below sensitivity' : 'Meets modeled limits'
  return { time, ...geometry, ...budget, status, clearance: visibility.unknown ? null : visibility.clearance }
}

export function linkWindows<T extends { time: number; status: string }>(samples: T[]) {
  const windows: { start: number; end: number; status: string; count: number }[] = []
  for (const { time, status } of samples) {
    const previous = windows.at(-1)
    if (previous?.status === status && previous.end + HOUR === time) {
      previous.end = time
      previous.count++
    } else windows.push({ start: time, end: time, status, count: 1 })
  }
  return windows
}
