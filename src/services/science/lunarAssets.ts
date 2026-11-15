export interface HeightRaster { width: number; height: number; values: Float32Array }
const cache = new Map<string, Promise<HeightRaster>>()
export function loadHeightRaster(region: 'global' | 'south-pole'): Promise<HeightRaster> {
  const key = region === 'global' ? 'global-height' : 'south-pole-height'
  if (!cache.has(key)) {
    const width = region === 'global' ? 1440 : 1896, height = region === 'global' ? 720 : 1896
    const promise = fetch(`/lunar/${key}.f32`).then(async response => {
      if (!response.ok) throw new Error(`Lunar elevation unavailable (${response.status})`)
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength !== width * height * 4) throw new Error('Elevation raster failed size validation')
      const view = new DataView(buffer), values = new Float32Array(width * height)
      for (let i = 0; i < values.length; i++) {
        values[i] = view.getFloat32(i * 4, true)
        if (!Number.isFinite(values[i]) || Math.abs(values[i]) > 15000) throw new Error('Invalid elevation sample')
      }
      return { width, height, values }
    })
    cache.set(key, promise.catch(error => {
      cache.delete(key)
      throw error
    }))
  }
  return cache.get(key)!
}
export function sampleRaster(raster: HeightRaster, u: number, v: number, wrap = false) {
  const x = u * raster.width - .5, y = Math.max(0, Math.min(raster.height - 1, v * raster.height - .5))
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy
  const sample = (col: number, row: number) => {
    const sx = wrap ? ((col % raster.width) + raster.width) % raster.width : Math.max(0, Math.min(raster.width - 1, col))
    return raster.values[Math.min(raster.height - 1, row) * raster.width + sx]
  }
  return (sample(ix, iy)*(1-fx)+sample(ix+1,iy)*fx)*(1-fy)+(sample(ix,iy+1)*(1-fx)+sample(ix+1,iy+1)*fx)*fy
}
export const POLAR_HALF_EXTENT = 151680, LUNAR_RADIUS = 1737400, TERRAIN_SCALE = 30000
/** South polar stereographic: east positive; z points image-down (away from 0E). */
export function latLonToPolar(latitude: number, longitude: number) {
  const rho=2*LUNAR_RADIUS*Math.tan((90+latitude)*Math.PI/360), lon=longitude*Math.PI/180
  return {x:rho*Math.sin(lon),z:-rho*Math.cos(lon)}
}
export function polarToLatLon(x:number,z:number) {
  return {latitude:-90+2*Math.atan(Math.hypot(x,z)/(2*LUNAR_RADIUS))*180/Math.PI,longitude:Math.atan2(x,-z)*180/Math.PI}
}
export function polarHeight(raster:HeightRaster,x:number,z:number) {
  if(Math.abs(x)>POLAR_HALF_EXTENT||Math.abs(z)>POLAR_HALF_EXTENT)return null
  return sampleRaster(raster,(x/POLAR_HALF_EXTENT+1)/2,(z/POLAR_HALF_EXTENT+1)/2)
}

/** The screening horizon ends at the outer pixel centers, before edge clamping. */
export function samplePolarHorizon(raster: HeightRaster, latitude: number, longitude: number) {
  const { x, z } = latLonToPolar(latitude, longitude)
  const edgeX = POLAR_HALF_EXTENT * (1 - 1 / raster.width)
  const edgeZ = POLAR_HALF_EXTENT * (1 - 1 / raster.height)
  return Math.abs(x) > edgeX || Math.abs(z) > edgeZ ? null : polarHeight(raster, x, z)
}
