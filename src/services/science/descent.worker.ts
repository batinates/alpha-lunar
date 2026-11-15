import { loadHeightRaster } from './lunarAssets'
import { simulateDescents, type DescentRequest } from './descent'

self.onmessage = async ({ data }: MessageEvent<DescentRequest>) => {
  try {
    self.postMessage({ scenarios: simulateDescents(data, await loadHeightRaster('south-pole')) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Simulation could not complete.' })
  }
}
