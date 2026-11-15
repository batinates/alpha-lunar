import type { Coordinates } from '../../domain/lunar.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris, type XYZ } from './ephemeris.ts'
import { linkBudget, type LinkInputs } from './earthLink.ts'
import { horizonAt, type HorizonProfile } from './terrainHorizon.ts'

// JPL 810-005 module 301, ITRF93 Cartesian coordinates in km.
export const DSN_STATIONS = [
  { id: 'DSS-14', name: 'Goldstone', xyz: [-2353.621420, -4641.341472, 3677.052318] },
  { id: 'DSS-63', name: 'Madrid', xyz: [4849.092518, -360.180348, 4115.109251] },
  { id: 'DSS-43', name: 'Canberra', xyz: [-4460.894917, 2682.361507, -3674.748152] },
] as const
export type DsnStation = typeof DSN_STATIONS[number]
export type DsnOrientation = { start: number; stepMs: number; values: Float32Array }
type Quat = [number, number, number, number]

export async function loadDsnOrientation(signal: AbortSignal): Promise<DsnOrientation> {
  async function fetchAsset(name: string) {
    const result = await fetch('/lunar/' + name, { signal })
    if (!result.ok) throw new Error('Station orientation data unavailable')
    return result
  }
  const [metadata, buffer] = await Promise.all([
    fetchAsset('dsn-orientation.json').then(r => r.json()),
    fetchAsset('dsn-orientation.f32').then(r => r.arrayBuffer()),
  ])
  if (metadata.frame !== 'ITRF93 to MOON_ME_DE421' || metadata.stepMs !== 600_000 ||
      !Number.isFinite(Date.parse(metadata.start)) || !Number.isInteger(metadata.count) ||
      metadata.count < 2 || buffer.byteLength !== metadata.count * 16) throw new Error('Invalid station orientation data')
  const view = new DataView(buffer)
  const values = Float32Array.from({ length: metadata.count * 4 }, (_, i) => view.getFloat32(i * 4, true))
  for (let i = 0; i < values.length; i += 4) {
    if (!(Math.abs(Math.hypot(values[i], values[i + 1], values[i + 2], values[i + 3]) - 1) < 1e-5)) throw new Error('Invalid station orientation sample')
  }
  return { start: Date.parse(metadata.start), stepMs: metadata.stepMs, values }
}

export function orientationAt(data: DsnOrientation, time: number): Quat {
  const t = (time - data.start) / data.stepMs
  const last = data.values.length / 4 - 1
  if (!Number.isFinite(t) || t < 0 || t > last) throw new RangeError('Time outside station orientation coverage')
  const index = Math.min(Math.floor(t), last - 1), fraction = t - index
  const a = data.values.subarray(index * 4, index * 4 + 4), b = data.values.subarray(index * 4 + 4, index * 4 + 8)
  const sign = a.reduce((dot, value, i) => dot + value * b[i], 0) < 0 ? -1 : 1
  const q = a.map((value, i) => (1 - fraction) * value + fraction * sign * b[i])
  const norm = Math.hypot(...q)
  return Array.from(q, value => value / norm) as Quat
}

function rotate([w, x, y, z]: Quat, [vx, vy, vz]: readonly number[]): XYZ {
  const tx = 2 * (y * vz - z * vy), ty = 2 * (z * vx - x * vz), tz = 2 * (x * vy - y * vx)
  return [vx + w * tx + y * tz - z * ty, vy + w * ty + z * tx - x * tz, vz + w * tz + x * ty - y * tx]
}

export function dsnAt(data: Ephemeris, orientation: DsnOrientation, time: number, point: Coordinates,
  profile: HorizonProfile | null, height: number, station: DsnStation, minElevation: number, radio: LinkInputs) {
  const q = orientationAt(orientation, time)
  const offset = rotate(q, station.xyz)
  const earth = interpolateEphemeris(data, time).earth
  const target = earth.map((value, i) => value + offset[i]) as XYZ
  const observerHeight = profile ? profile.observerElevation + profile.mastHeight : height
  const { elevation, azimuth, distance } = horizonAngles(target, point.latitude, point.longitude, observerHeight)
  const lat = point.latitude * Math.PI / 180, lon = point.longitude * Math.PI / 180
  const radius = 1737.4 + observerHeight / 1000
  const lunarObserver = [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)]
  const fromStation = lunarObserver.map((v, i) => v - target[i])
  // The ellipsoid normal approximates local vertical. The station position includes its elevation.
  const up = rotate(q, [station.xyz[0], station.xyz[1], station.xyz[2] / (1 - 0.00669437999014)])
  const sine = up.reduce((sum, v, i) => sum + v * fromStation[i], 0) / (Math.hypot(...up) * distance)
  const stationElevation = Math.asin(Math.max(-1, Math.min(1, sine))) * 180 / Math.PI
  const terrain = profile ? horizonAt(profile, azimuth) : null
  const clearance = terrain ? elevation - terrain.elevation : null
  const lunarBlocked = clearance !== null && clearance <= 0
  const lunarKnown = lunarBlocked || !!(terrain && profile && terrain.range + profile.stepMeters > profile.radiusMeters)
  const geometry = stationElevation < minElevation ? 'Below station mask' : lunarBlocked ? 'Blocked by lunar terrain' :
    lunarKnown ? 'Clear geometry' : 'Unknown lunar terrain'
  const budget = linkBudget(distance, radio)
  const status = geometry !== 'Clear geometry' ? geometry : budget.margin < 0 ? 'Below sensitivity' : 'Meets modeled limits'
  return { time, stationElevation, elevation, azimuth, distance, clearance: lunarKnown ? clearance : null, geometry, status, ...budget }
}
