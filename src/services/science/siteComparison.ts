import type { Coordinates } from '../../domain/lunar.ts'
import { earthLinkAt, HOUR, LINK_FIELDS, type LinkInputs } from './earthLink.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from './ephemeris.ts'
import { surfacePower, type PowerInputs } from './solarPower.ts'
import { horizonAt, type HorizonProfile } from './terrainHorizon.ts'
import { compareCrossings, findCrossings } from './horizonTransitions.ts'
import { DSN_STATIONS, dsnAt, type DsnOrientation } from './dsn.ts'

export interface CompareSite extends Coordinates { id: string; name: string; arrival?: number }
export const coordinateKey = (site: Coordinates) => `${site.latitude.toFixed(7)}/${site.longitude.toFixed(7)}`
export const DEFAULT_LINK = Object.fromEntries(Object.entries(LINK_FIELDS).map(([key, field]) => [key, field.value])) as LinkInputs

export function compareSite(data: Ephemeris, site: CompareSite, horizon: HorizonProfile, start: number, end: number,
  power: PowerInputs, link: LinkInputs, alternative?: HorizonProfile, sensitivity: 'regional' | 'coarse' = 'coarse',
  orientation?: DsnOrientation, stationMask = 10) {
  const energy = surfacePower(data, start, end, site, horizon, power)
  let goodMs = 0, unknownMs = 0, outageMs = 0, longestOutageMs = 0
  const windows: { from: number; to: number; status: string }[] = []
  const stationTime = DSN_STATIONS.map(station => ({ station, hours: 0 }))
  let networkMs = 0
  let earthClearMs = 0, sunVisibleMs = 0
  const rows = energy.rows.map(row => {
    const t = (row.from + row.to) / 2, step = row.to - row.from
    const radio = earthLinkAt(data, t, site, horizon, link)
    if (radio.clearance !== null && radio.clearance > 0) earthClearMs += step
    if (row.visible !== null && row.visible > 0) sunVisibleMs += step
    const sun = horizonAngles(interpolateEphemeris(data, t).sun, site.latitude, site.longitude, horizon.observerElevation + horizon.mastHeight)
    if (radio.status === 'Meets modeled limits') { goodMs += step; outageMs = 0 }
    else if (radio.status === 'Unknown terrain') { unknownMs += step; outageMs = 0 }
    else { outageMs += step; longestOutageMs = Math.max(longestOutageMs, outageMs) }
    const prior = windows.at(-1)
    if (prior?.status === radio.status) prior.to = row.to
    else windows.push({ from: row.from, to: row.to, status: radio.status })
    const stations = orientation ? stationTime.map(({ station }, i) => {
      const result = dsnAt(data, orientation, t, site, horizon, horizon.mastHeight, station, stationMask, link)
      if (result.status === 'Meets modeled limits') stationTime[i].hours += step / HOUR
      return { id: station.id, status: result.status, margin: result.margin }
    }) : []
    if (stations.some(s => s.status === 'Meets modeled limits')) networkMs += step
    return { ...row, sun, radio, stations }
  })
  const transitions = (['sun', 'earth'] as const).map(body => {
    const events = (profile: HorizonProfile) => findCrossings(start, end, time => {
      const angle = horizonAngles(interpolateEphemeris(data, time)[body], site.latitude, site.longitude,
        profile.observerElevation + profile.mastHeight)
      const terrain = horizonAt(profile, angle.azimuth)
      if (!terrain || terrain.range + profile.stepMeters <= profile.radiusMeters) return null
      return angle.elevation - terrain.elevation
    })
    const nominal = events(horizon)
    const coarse = alternative ? events(alternative) : []
    return { body, coarseCount: coarse.length, events: compareCrossings(nominal, coarse) }
  })
  const totalMs = end - start
  return { site, horizon, rows, energy, windows, transitions, sensitivity, stationTime: orientation ? stationTime : [],
    sunVisibleHours: energy.unknownHours >= totalMs / HOUR - 1e-8 ? null : sunVisibleMs / HOUR,
    earthClearHours: unknownMs >= totalMs ? null : earthClearMs / HOUR,
    networkHours: orientation ? networkMs / HOUR : null, linkHours: unknownMs >= totalMs ? null : goodMs / HOUR,
    linkUnknownHours: unknownMs / HOUR, longestOutageHours: longestOutageMs / HOUR }
}
