import { validateEphemeris } from './ephemeris'
import { loadHeightRaster } from './lunarAssets'
import { loadPolarEnvironment } from './polarEnvironment'
import { optimizeLandings, type SearchRequest, type SearchResult } from './landingOptimization'

export type LandingMessage =
  | { type: 'progress'; done: number }
  | { type: 'result'; result: SearchResult }
  | { type: 'error'; message: string }

const send = (message: LandingMessage) => self.postMessage(message)

self.onmessage = async (event: MessageEvent<SearchRequest>) => {
  try {
    const [ephemeris, terrain, environment] = await Promise.all([
      fetch('/lunar/ephemeris.json').then(response => {
        if (!response.ok) throw new Error('SPICE ephemeris unavailable')
        return response.json()
      }).then(validateEphemeris),
      loadHeightRaster('south-pole'),
      loadPolarEnvironment(),
    ])
    const result = optimizeLandings(event.data, ephemeris, terrain, environment,
      done => send({ type: 'progress', done }))
    send({ type: 'result', result })
  } catch (error) {
    send({ type: 'error', message: error instanceof Error ? error.message : 'Landing search failed' })
  }
}
