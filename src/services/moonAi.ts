import catalog from '../../public/lunar/site-archive/manifest.json'
import references from '../../public/lunar/site-archive/context/manifest.json'
import { SOUTH_POLE_FEATURES, LUNAR_FEATURES } from '../data/lunarFeatures'
import { ARTEMIS_MISSIONS } from '../data/artemis'
import type { LanderModel } from '../data/spacecraft'
import { PRIORITIES, validMission, type MissionProfile } from '../domain/mission'
import type { Coordinates } from '../domain/lunar'
import type { SearchEvidence } from '../domain/missionReport'
import { DEFAULT_DESCENT, validDescent, type DescentScenario } from './science/descent'
import { latLonToPolar } from './science/lunarAssets'
import { LCROSS_IMPACT, loadPolarEnvironment, sampleEnvironment } from './science/polarEnvironment'
import { candidateSites, coldTrapDistance, HOUR, type LandingOption, type LandingSite } from './science/landingOptimization'
import { DEFAULT_POWER } from './science/solarPower'
import { coordinateKey, DEFAULT_LINK } from './science/siteComparison'
import type { ComparisonMessage } from './science/comparison.worker'
import type { LandingMessage } from './science/landing.worker'

export const modules = ['map', 'archive', 'optimize', 'simulation', 'risk', 'ice', 'thermal', 'terrain', 'power', 'radio', 'time', 'comparison', 'reports', 'artemis', 'missions', 'regional', 'documentation', 'settings'] as const
export type MoonModule = typeof modules[number]
export type MoonAction = {
  module: MoonModule; site?: LandingSite; time?: number
  comparison?: { sites: LandingSite[]; hours: number }
  landing?: { option: LandingOption; profile: MissionProfile; search: SearchEvidence }
  descent?: { settings: typeof DEFAULT_DESCENT; profile: MissionProfile; scenarios: DescentScenario[]; vehicle: LanderModel }
}
export type ToolUse = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
export type Block = { type: 'text'; text: string } | ToolUse | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
export type MoonMessage = { role: 'assistant' | 'user'; content: Block[] }
type Context = { coordinates: Coordinates; time: number; profile: MissionProfile }
type Result = { evidence: unknown; actions?: MoonAction[] }
const firstEpoch = Date.parse('2026-01-01T00:00:00Z')
const endEpoch = Date.parse('2029-01-01T00:00:00Z')
const archiveSites = catalog.sites.flatMap(site => site.lat === null || site.lon === null ? [] : [{ id: site.id, name: site.name, latitude: site.lat, longitude: site.lon }])
const landmarks = [...SOUTH_POLE_FEATURES, ...LUNAR_FEATURES].map(({ id, name, latitude, longitude }) => ({ id, name, latitude, longitude }))

function startDate(value: unknown, context: Context, duration: number) {
  const time = value === undefined ? Math.min(context.time, endEpoch - duration) :
    typeof value === 'string' && /^\d{4}-\d\d-\d\d(?:T\d\d:\d\d(?::\d\d)?Z)?$/.test(value) ? Date.parse(value) : NaN
  const start = Math.floor(time / HOUR) * HOUR
  if (!Number.isFinite(start) || start < firstEpoch || start + duration > endEpoch) throw new Error('Use a UTC start and full study window within 2026–2028 coverage.')
  return start
}

function workerResult<T, R>(worker: Worker, payload: unknown, select: (message: T) => R | undefined, signal: AbortSignal) {
  return new Promise<R>((resolve, reject) => {
    function finish() {
      worker.terminate()
      signal.removeEventListener('abort', abort)
      clearTimeout(timeout)
    }
    function abort() { finish(); reject(new DOMException('Aborted', 'AbortError')) }
    const timeout = window.setTimeout(() => { finish(); reject(new Error('The analysis exceeded its time limit.')) }, 60_000)
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    worker.onerror = () => { finish(); reject(new Error('The analysis worker could not complete.')) }
    worker.onmessage = ({ data }: MessageEvent<T>) => {
      try {
        const result = select(data)
        if (result !== undefined) { finish(); resolve(result) }
      } catch (error) { finish(); reject(error) }
    }
    worker.postMessage(payload)
  })
}

export function createMoonTools(context: Context, signal: AbortSignal) {
  const regional = candidateSites(context.coordinates, SOUTH_POLE_FEATURES)
  const sites = [...archiveSites, ...regional, ...landmarks]
  const choices = new Map(sites.map(site => [site.id, site]))
  const name = (value: unknown) => {
    const site = typeof value === 'string' ? choices.get(value) : undefined
    if (!site) throw new Error('Site ID unknown. Call find_sites first.')
    return site
  }
  function list(value: unknown, min: number, max: number) {
    if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error('Invalid site count.')
    const locations = value.map(name)
    if (new Set(locations.map(coordinateKey)).size !== locations.length) throw new Error('Choose distinct coordinates.')
    return locations
  }

  return async ({ name: tool, input }: ToolUse): Promise<Result> => {
    switch (tool) {
      case 'find_sites': {
        const query = typeof input.query === 'string' ? input.query.trim().toLowerCase() : ''
        const results = [...new Map(sites.map(site => [site.id, site])).values()].filter(site => query ?
          `${site.name} ${site.id}`.toLowerCase().includes(query) || catalog.sites.find(item => item.id === site.id)?.aliases.some(alias => alias.toLowerCase().includes(query)) :
          site.latitude <= -85)
        return { evidence: results.slice(0, 16) }
      }
      case 'screen_landings': {
        const profile: MissionProfile = { ...context.profile, massKg: Number(input.massKg ?? context.profile.massKg),
          durationHours: Number(input.hours ?? context.profile.durationHours),
          priority: PRIORITIES.find(priority => priority === input.priority) ?? context.profile.priority }
        const days = Number(input.days ?? 2)
        if (!validMission(profile) || !Number.isInteger(days) || days < 0 || days > 28) throw new Error('Invalid profile or search window.')
        const first = startDate(input.start, context, (days * 24 + profile.durationHours) * HOUR)
        const last = first + days * 24 * HOUR
        const selected = input.siteIds === undefined ? regional : list(input.siteIds, 1, 8)
        const result = await workerResult<LandingMessage, SearchEvidence['data']>(
          new Worker(new URL('./science/landing.worker.ts', import.meta.url), { type: 'module' }),
          { profile, sites: selected, first, last }, message => {
            if (message.type === 'error') throw new Error(message.message)
            return message.type === 'result' ? message.result : undefined
          }, signal)
        const search = { first, last, sites: selected.length, from: context.coordinates, data: result }
        return { evidence: { screened: result.screened, passed: result.passed, best: result.best.slice(0, 5), rejected: result.rejected.slice(0, 10),
          firstUtc: new Date(first).toISOString(), lastUtc: new Date(last).toISOString(), profile,
          source: '/lunar/manifest.json', ephemeris: '/lunar/ephemeris-provenance.json' },
          actions: result.best.slice(0, 3).map(option => ({ module: 'simulation', site: option.site, time: option.time, landing: { option, profile, search } })) }
      }
      case 'inspect_site': {
        const site = name(input.siteId)
        const record = catalog.sites.find(item => item.id === site.id)
        const { x, z } = latLonToPolar(site.latitude, site.longitude)
        const grid = site.latitude < 0 ? await loadPolarEnvironment().catch(() => null) : null
        const contextData = Object.hasOwn(references.sites, site.id) ?
          await fetch(`/lunar/site-archive/context/${site.id}.json`, { signal }).then(async response => response.ok ? await response.json() : null).catch(() => null) : null
        const month = typeof input.month === 'string' && /^\d{4}-\d\d$/.test(input.month) ? input.month : new Date(context.time).toISOString().slice(0, 7)
        return { evidence: { site, archiveCategory: record?.category, locationSource: record?.source, terrain: contextData?.terrain,
          month, monthlyReference: contextData?.months[month] ?? null,
          monthlyOrder: ['coveredHours', 'averageVisibleSunDiskPercent', 'incidentSolarKWhPerM2', 'longestSunOutageHours', 'averageVisibleEarthDiskPercent', 'longestEarthOutageHours'],
          environment: grid ? sampleEnvironment(grid, x, z) : null,
          terrainProduct: '/lunar/site-archive/context/manifest.json', environmentalProduct: '/lunar/polar-environment.json',
          coldTrapDistanceKmWithin10Km: grid ? coldTrapDistance(grid, x, z) : null,
          iceAbundance: 'Unavailable; this cell reports thermal and shadow indicators, not ice abundance.',
          lcrossPointObservation: LCROSS_IMPACT },
          actions: [{ module: 'map', site }, ...(record ? [{ module: 'archive' as const, site }] : []),
            ...(grid && sampleEnvironment(grid, x, z) ? [{ module: 'ice' as const, site }] : [])] }
      }
      case 'simulate_descent': {
        const site = name(input.siteId)
        const profile = { ...context.profile, massKg: Number(input.massKg ?? context.profile.massKg) }
        const settings = { ...DEFAULT_DESCENT, thrustKN: Number(input.thrustKN ?? DEFAULT_DESCENT.thrustKN) }
        const request = { coordinates: site, settings, massKg: profile.massKg, squareMeters: profile.footprintMeters,
          slopeLimit: profile.maxSlope, roughnessLimit: profile.maxRoughness }
        if (!validDescent(request)) throw new Error('Descent requires a site from 85°S to 90°S and valid study inputs.')
        const scenarios = await workerResult<{ scenarios?: DescentScenario[]; error?: string }, DescentScenario[]>(
          new Worker(new URL('./science/descent.worker.ts', import.meta.url), { type: 'module' }), request, message => {
            if (message.error || !message.scenarios) throw new Error(message.error ?? 'Simulation returned no results.')
            return message.scenarios
          }, signal)
        const vehicle: LanderModel = input.vehicle === 'apollo' || (input.vehicle === undefined && /apollo/i.test(profile.spacecraft)) ? 'apollo' : 'rocket'
        const descent = { settings, profile, scenarios, vehicle }
        return { evidence: { site, massKg: request.massKg, screeningSquareMeters: request.squareMeters, visualModel: vehicle, source: '/lunar/manifest.json',
          results: scenarios.map(scenario => ({ name: scenario.name, nominal: scenario.nominal, settings: scenario.settings, counts: scenario.counts })) },
          actions: [{ module: 'simulation', site, descent }, { module: 'risk', site, descent }] }
      }
      case 'compare_operations': {
        const locations = list(input.siteIds, 2, 3)
        const hours = Number(input.hours ?? context.profile.durationHours)
        if (!Number.isInteger(hours) || hours < 1 || hours > 672 || locations.some(site => Math.abs(site.latitude) < 75))
          throw new Error('Choose polar sites and a 1–672 h window.')
        const first = startDate(input.start, context, hours * HOUR)
        const result = await workerResult<ComparisonMessage, Extract<ComparisonMessage, { results: unknown }>['results']>(
          new Worker(new URL('./science/comparison.worker.ts', import.meta.url), { type: 'module' }),
          { id: 1, sites: locations, height: context.profile.mastHeight, first, end: first + hours * HOUR,
            power: DEFAULT_POWER, link: DEFAULT_LINK, stationMask: 10, radius: 150_000 }, message => {
            if ('error' in message) throw new Error(message.error)
            return message.results
          }, signal)
        return { evidence: { startUtc: new Date(first).toISOString(), hours, power: DEFAULT_POWER, radio: DEFAULT_LINK,
          reference: '/lunar/ephemeris-provenance.json', sites: result.map(entry => {
            if ('error' in entry) return entry
            const { energy, ...output } = entry.result
            const { rows: _rows, ...battery } = energy
            return { site: entry.site, environment: entry.environment, sunVisibleHours: output.sunVisibleHours, battery,
              earthClearHours: output.earthClearHours, modeledRadioHours: output.linkHours, modeledDsnHours: output.networkHours,
              unresolvedRadioHours: output.linkUnknownHours }
          }) }, actions: [{ module: 'comparison', time: first, comparison: { sites: locations, hours } }] }
      }
      case 'open_module': {
        const module = modules.find(item => item === input.module)
        if (!module) throw new Error('Unknown module.')
        const site = input.siteId === undefined ? undefined : name(input.siteId)
        return { evidence: { module, site, missions: module === 'artemis' ? ARTEMIS_MISSIONS : undefined }, actions: [{ module, site }] }
      }
      default: throw new Error('Unknown analysis tool.')
    }
  }
}
