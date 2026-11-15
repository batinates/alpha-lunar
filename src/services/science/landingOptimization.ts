import type { Coordinates } from '../../domain/lunar.ts'
import { PRIORITIES, validMission, type MissionProfile } from '../../domain/mission.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from './ephemeris.ts'
import { buildHorizon, horizonAt } from './terrainHorizon.ts'
import { latLonToPolar, samplePolarHorizon, polarToLatLon, type HeightRaster } from './lunarAssets.ts'
import { COLD_TRAP_K, sampleEnvironment } from './polarEnvironment.ts'
import { screenTerrain } from './siteScreening.ts'

export interface LandingSite extends Coordinates { id: string; name: string }
export interface SearchRequest {
  profile: MissionProfile
  sites: LandingSite[]
  first: number
  last: number
}

export interface LandingOption {
  site: LandingSite
  time: number
  mastHeight: number
  slope: number
  roughness: number
  peak: number | null
  bins: number | null
  sunPercent: number
  earthPercent: number
  sunUnknown: number
  earthUnknown: number
  sunClearance: number | null
  earthClearance: number | null
  coldDistanceKm: number | null
  objectives: [number, number, number, number]
  score: number
  pareto: boolean
}

export interface SearchResult {
  best: LandingOption[]
  byObjective: (LandingOption | null)[]
  paretoCount: number
  passed: number
  screened: number
  rejected: { site: LandingSite; reason: string; count: number; time: number }[]
}

export const HOUR = 3600000
export const SEARCH_STEP_HOURS = 6
export const MAX_SEARCH_DAYS = 28
const SCIENCE_RADIUS_KM = 10
const WEIGHTS = [
  [.35, .25, .25, .15], [.65, .15, .15, .05], [.20, .60, .15, .05],
  [.20, .15, .60, .05], [.20, .15, .15, .50],
]

export function priorityWeights(priority: MissionProfile['priority']) {
  return WEIGHTS[PRIORITIES.indexOf(priority)]
}

export function candidateSites(selected: Coordinates, landmarks: LandingSite[]) {
  const grid: LandingSite[] = []
  for (let z = -60000; z <= 60000; z += 20000) {
    for (let x = -60000; x <= 60000; x += 20000) {
      const id = String(grid.length + 1).padStart(2, '0')
      grid.push({ ...polarToLatLon(x, z), id: `grid-${id}`, name: `Polar grid ${id}` })
    }
  }
  return [{ ...selected, id: 'selected', name: 'Selected coordinate' }, ...landmarks, ...grid]
    .filter((site, i, sites) => sites.findIndex(other =>
      Math.abs(site.latitude - other.latitude) < 1e-7 &&
      (site.latitude === -90 || Math.abs(site.longitude - other.longitude) < 1e-7)) === i)
}

export function validSearch(data: Ephemeris, request: SearchRequest) {
  const { profile, first, last, sites } = request
  const start = Date.parse(data.start)
  const end = start + (data.rows.length - 1) * data.stepMs
  return validMission(profile) && [first, last].every(Number.isSafeInteger) &&
    (first - start) % HOUR === 0 && (last - start) % HOUR === 0 &&
    first >= start && last >= first && last - first <= MAX_SEARCH_DAYS * 24 * HOUR &&
    last + profile.durationHours * HOUR <= end && sites.length > 0 && sites.length <= 64
}

export function coldTrapDistance(environment: DataView, x: number, z: number) {
  let closest = Infinity
  for (let dz = -10080; dz <= 10080; dz += 480) {
    for (let dx = -10080; dx <= 10080; dx += 480) {
      const distance = Math.hypot(dx, dz) / 1000
      if (distance >= closest || distance > SCIENCE_RADIUS_KM) continue
      const cell = sampleEnvironment(environment, x + dx, z + dz)
      if (cell?.peak != null && cell.peak < COLD_TRAP_K) closest = distance
    }
  }
  return Number.isFinite(closest) ? closest : null
}

export function clearanceStatus(elevation: number, horizon: ReturnType<typeof horizonAt>, radius: number) {
  if (!horizon) return { clearance: null, clear: false, unknown: true }
  const clearance = elevation - horizon.elevation
  const unknown = clearance > 0 && horizon.range < radius
  return { clearance, clear: clearance > 0 && !unknown, unknown }
}

export function paretoFront<T extends { objectives: number[] }>(options: T[]) {
  return options.filter(option => !options.some(other =>
    other.objectives.every((value, i) => value >= option.objectives[i]) &&
    other.objectives.some((value, i) => value > option.objectives[i])))
}

export function optimizeLandings(
  request: SearchRequest, ephemeris: Ephemeris, raster: HeightRaster, environment: DataView,
  onProgress: (done: number) => void = () => {},
): SearchResult {
  if (!validSearch(ephemeris, request)) throw new RangeError('Enter valid UTC hours within the SPICE coverage and a search of at most 28 days.')
  const { profile, first, last, sites } = request
  const count = Math.floor((last - first) / (SEARCH_STEP_HOURS * HOUR)) + 1
  const timeline = Array.from({ length: (count - 1) * SEARCH_STEP_HOURS + profile.durationHours + 1 },
    (_, hour) => interpolateEphemeris(ephemeris, first + hour * HOUR))
  const rejected: SearchResult['rejected'] = []
  const passed: LandingOption[] = []
  const weights = priorityWeights(profile.priority)
  for (const [index, site] of sites.entries()) {
    onProgress(index)
    const { x, z } = latLonToPolar(site.latitude, site.longitude)
    const terrain = site.latitude >= -90 && site.latitude <= -85 ? screenTerrain(raster, x, z, profile.footprintMeters) : null
    const cell = sampleEnvironment(environment, x, z)
    const peak = cell?.peak ?? null
    const reasons = []
    if (!terrain) reasons.push('Screening area outside supported terrain')
    else {
      if (terrain.maxSlope > profile.maxSlope) reasons.push(`Slope ${terrain.maxSlope.toFixed(1)}° exceeds limit`)
      if (terrain.maxRoughness > profile.maxRoughness) reasons.push(`RMS roughness ${terrain.maxRoughness.toFixed(1)} m exceeds limit`)
    }
    if (profile.maxSurfacePeak > 0 && (peak === null || peak > profile.maxSurfacePeak))
      reasons.push(peak === null ? 'Surface thermal peak unavailable' : `Modeled surface peak ${peak.toFixed(1)} K exceeds limit`)
    if (!terrain || reasons.length) {
      rejected.push({ site, reason: reasons.join(' · '), count, time: first })
      continue
    }
    const horizon = buildHorizon(site.latitude, site.longitude, profile.mastHeight,
      (lat, lon) => samplePolarHorizon(raster, lat, lon))
    const status = (vector: typeof timeline[number]['sun']) => {
      const angle = horizonAngles(vector, site.latitude, site.longitude, horizon.observerElevation + profile.mastHeight)
      return clearanceStatus(angle.elevation, horizonAt(horizon, angle.azimuth), horizon.radiusMeters)
    }
    const hours = timeline.map(({ sun, earth }) => [status(sun), status(earth)] as const)
    const coldDistanceKm = coldTrapDistance(environment, x, z)
    const terrainScore = 1 - (terrain.maxSlope / profile.maxSlope + terrain.maxRoughness / profile.maxRoughness) / 2
    const coldScore = coldDistanceKm === null ? 0 : Math.max(0, 1 - coldDistanceKm / SCIENCE_RADIUS_KM)
    const failures = new Map<string, { site: LandingSite; reason: string; count: number; time: number }>()
    for (let slot = 0; slot < count; slot++) {
      const offset = slot * SEARCH_STEP_HOURS
      const time = first + offset * HOUR
      const window = hours.slice(offset, offset + profile.durationHours + 1)
      const percentages = ([0, 1] as const).map(body => ({
        clear: 100 * window.filter(hour => hour[body].clear).length / window.length,
        unknown: window.filter(hour => hour[body].unknown).length,
      }))
      const [sun, earth] = percentages
      const failuresHere = []
      if (sun.clear < profile.minSunPercent) failuresHere.push('Sun clearance below target')
      if (earth.clear < profile.minEarthPercent) failuresHere.push('Earth clearance below target')
      if (failuresHere.length) {
        const reason = failuresHere.join(' · ')
        const previous = failures.get(reason)
        failures.set(reason, { site, reason, count: (previous?.count ?? 0) + 1, time: previous?.time ?? time })
        continue
      }
      const objectives: LandingOption['objectives'] = [terrainScore, sun.clear / 100, earth.clear / 100, coldScore]
      passed.push({
        site, time, mastHeight: profile.mastHeight, slope: terrain.maxSlope, roughness: terrain.maxRoughness, peak, bins: cell?.bins ?? null,
        sunPercent: sun.clear, earthPercent: earth.clear, sunUnknown: sun.unknown, earthUnknown: earth.unknown,
        sunClearance: window[0][0].unknown ? null : window[0][0].clearance,
        earthClearance: window[0][1].unknown ? null : window[0][1].clearance,
        coldDistanceKm, objectives, score: objectives.reduce((sum, value, i) => sum + weights[i] * value, 0), pareto: false,
      })
    }
    rejected.push(...failures.values())
  }
  passed.sort((a, b) => b.score - a.score || a.time - b.time || a.site.id.localeCompare(b.site.id))
  const unique = [...new Map(passed.map(option => [option.objectives.join('|'), option])).values()]
  const objectiveFront = new Set(paretoFront(unique).map(option => option.objectives.join('|')))
  for (const option of passed) option.pareto = objectiveFront.has(option.objectives.join('|'))
  const frontier = passed.filter(option => option.pareto)
  const bestAtSite = [...new Set(frontier.map(option => option.site.id))].map(id => frontier.find(option => option.site.id === id)!)
  const featured = new Set(bestAtSite.slice(0, 5))
  for (const option of passed) {
    if (featured.size === 8) break
    featured.add(option)
  }
  const best = passed.filter(option => featured.has(option))
  return {
    best, byObjective: [0, 1, 2, 3].map(i =>
      passed.reduce<LandingOption | null>((bestOption, option) =>
        !bestOption || option.objectives[i] > bestOption.objectives[i] ? option : bestOption, null)),
    paretoCount: frontier.length, passed: passed.length, screened: sites.length * count, rejected,
  }
}
