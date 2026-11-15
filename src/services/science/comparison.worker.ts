import { validateEphemeris, type Ephemeris } from './ephemeris'
import { latLonToPolar, loadHeightRaster, samplePolarHorizon } from './lunarAssets'
import { loadPolarEnvironment, sampleEnvironment } from './polarEnvironment'
import { buildHorizon, type HorizonProfile } from './terrainHorizon'
import { regionalNear } from './regionalHorizon'
import { compareSite, coordinateKey, type CompareSite } from './siteComparison'
import type { PowerInputs } from './solarPower'
import type { LinkInputs } from './earthLink'
import { loadDsnOrientation, type DsnOrientation } from './dsn'
import { loadExtendedPolarHorizon } from './polarHorizon'
import { terrainSlope } from './siteScreening'

export interface ComparisonRequest { id: number; sites: CompareSite[]; height: number; first: number; end: number; power: PowerInputs; link: LinkInputs; stationMask: number; radius: number }
export type ComparisonResult = { site: CompareSite; result: ReturnType<typeof compareSite>; environment?: {
  elevation: number; slope: number | null; thermal: ReturnType<typeof sampleEnvironment>
} } | { site: CompareSite; error: string }
export type ComparisonMessage = { id: number; results: ComparisonResult[] } | { id: number; error: string }
let data: Promise<Ephemeris> | undefined
let dsn: Promise<DsnOrientation | undefined> | undefined
const horizons = new Map<string, { nominal: HorizonProfile; alternate: HorizonProfile; mode: 'regional' | 'coarse' }>()
self.onmessage = async ({ data: q }: MessageEvent<ComparisonRequest>) => {
  try {
    data ??= fetch('/lunar/ephemeris.json').then(async response => {
      if (!response.ok) throw new Error('SPICE data unavailable')
      return validateEphemeris(await response.json())
    }).catch(error => { data = undefined; throw error })
    dsn ??= loadDsnOrientation(AbortSignal.timeout(30_000)).catch(() => { dsn = undefined; return undefined })
    const [ephemeris, raster, orientation, environmentGrid] = await Promise.all([data,
      q.sites.some(s => s.latitude < 0) ? loadHeightRaster('south-pole') : null, dsn,
      loadPolarEnvironment().catch(() => null)])
    const results: ComparisonResult[] = await Promise.all(q.sites.map(async site => {
      try {
        const key = coordinateKey(site) + '/' + q.height + '/' + q.radius
        let horizon = horizons.get(key)
        if (!horizon) {
          const radius = site.latitude >= -85 ? Math.max(150000, q.radius) : q.radius
          const extended = radius > 100000 ? await loadExtendedPolarHorizon(site.latitude) : undefined
          const sample = (lat: number, lon: number) => (raster && lat < 0 ? samplePolarHorizon(raster, lat, lon) : null) ?? extended?.(lat, lon) ?? null
          const step = radius > 100000 ? 480 : 160
          const near = await regionalNear(site).catch(() => undefined)
          horizon = {
            nominal: buildHorizon(site.latitude, site.longitude, q.height, sample, step, undefined, radius),
            alternate: near ? buildHorizon(site.latitude, site.longitude, q.height, sample, step, near, radius)
              : buildHorizon(site.latitude, site.longitude, q.height, sample, step * 2, undefined, radius),
            mode: near ? 'regional' : 'coarse',
          }
          if (horizons.size >= 12) horizons.delete(horizons.keys().next().value!)
          horizons.set(key, horizon)
        }
        const { x, z } = latLonToPolar(site.latitude, site.longitude)
        const thermal = environmentGrid && site.latitude < 0 ? sampleEnvironment(environmentGrid, x, z) : null
        const slope = raster && site.latitude < 0 ? terrainSlope(raster, x, z) : null
        return { site, environment: { elevation: horizon.nominal.observerElevation, slope, thermal },
          result: compareSite(ephemeris, site, horizon.nominal, q.first, q.end, q.power, q.link, horizon.alternate, horizon.mode, orientation, q.stationMask) }
      } catch (error) { return { site, error: error instanceof Error ? error.message : 'Unable to compare this site' } }
    }))
    self.postMessage({ id: q.id, results } satisfies ComparisonMessage)
  } catch (error) {
    self.postMessage({ id: q.id, error: error instanceof Error ? error.message : 'Comparison unavailable' } satisfies ComparisonMessage)
  }
}
