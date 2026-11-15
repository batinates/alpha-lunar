import { latLonToPolar } from './lunarAssets'
import type { Coordinates } from '../../domain/lunar'

type Tile = { id: string; x: number; z: number; size: number; levels: { '20': { file: string; width: number } } }
const base = '/lunar/regional/'
let manifest: Promise<{ sites: Tile[] }> | undefined
const tiles = new Map<string, Promise<DataView>>()
const nearRadius = 3000

export async function regionalNear(point: Coordinates) {
  manifest ??= fetch(base + 'manifest.json').then(r => {
    if (!r.ok) throw new Error('Regional terrain manifest unavailable')
    return r.json()
  }).catch(error => { manifest = undefined; throw error })
  const { x, z } = latLonToPolar(point.latitude, point.longitude)
  const tile = (await manifest).sites.find(t => Math.max(Math.abs(x - t.x), Math.abs(z - t.z)) <= t.size / 2 - nearRadius - 20)
  if (!tile) return undefined
  const { file, width } = tile.levels['20']
  let pending = tiles.get(file)
  if (!pending) {
    pending = fetch(base + file).then(async r => {
      if (!r.ok) throw new Error('Regional terrain unavailable')
      const bytes = await r.arrayBuffer()
      if (bytes.byteLength !== width * width * 2) throw new Error('Invalid regional terrain dimensions')
      return new DataView(bytes)
    }).catch(error => { tiles.delete(file); throw error })
    tiles.set(file, pending)
  }
  const grid = await pending
  return { radiusMeters: nearRadius, sample(lat: number, lon: number) {
    const p = latLonToPolar(lat, lon)
    const col = (p.x - tile.x + tile.size / 2) * width / tile.size - .5
    const row = (p.z - tile.z + tile.size / 2) * width / tile.size - .5
    const i = Math.floor(col), j = Math.floor(row)
    if (i < 0 || j < 0 || i + 1 >= width || j + 1 >= width) return null
    const read = (c: number, r: number) => grid.getInt16(2 * (r * width + c), true)
    const a = read(i,j), b = read(i + 1,j), c = read(i,j + 1), d = read(i + 1,j + 1)
    if ([a,b,c,d].includes(-32768)) return null
    const u = col - i, v = row - j
    return ((a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v) / 2
  } }
}
