const base = '/lunar/polar-horizon/'
type Hemisphere = 'n' | 's'
type Asset = { file: string; width: number; spacingMeters: number }
const grids = new Map<Hemisphere, Promise<{ grid: DataView; asset: Asset }>>()

export async function loadExtendedPolarHorizon(latitude: number) {
  const hemisphere = latitude >= 0 ? 'n' : 's'
  let task = grids.get(hemisphere)
  if (!task) {
    task = fetch(base + 'manifest.json').then(async response => {
      if (!response.ok) throw new Error('Polar terrain catalog unavailable')
      const catalog = await response.json()
      const asset: Asset = catalog.hemispheres?.[hemisphere]
      if (catalog.frame !== 'MOON_ME_DE421' || asset?.width !== 1906 || asset.spacingMeters !== 480) throw new Error('Invalid polar terrain catalog')
      const raster = await fetch(base + asset.file)
      if (!raster.ok) throw new Error('Extended polar terrain unavailable')
      const bytes = await raster.arrayBuffer()
      if (bytes.byteLength !== asset.width ** 2 * 2) throw new Error('Invalid polar raster size')
      return { grid: new DataView(bytes), asset }
    }).catch(error => { grids.delete(hemisphere); throw error })
    grids.set(hemisphere, task)
  }
  const { grid, asset: { width, spacingMeters } } = await task
  return (lat: number, lon: number) => {
    if (hemisphere === 'n' ? lat < 75 : lat > -75) return null
    const rho = 2 * 1_737_400 * Math.tan((90 - Math.abs(lat)) * Math.PI / 360)
    const longitude = lon * Math.PI / 180
    const col = (width - 1) / 2 + rho * Math.sin(longitude) / spacingMeters
    const row = (width - 1) / 2 + (hemisphere === 'n' ? 1 : -1) * rho * Math.cos(longitude) / spacingMeters
    const x = Math.floor(col), y = Math.floor(row)
    if (x < 0 || y < 0 || x + 1 >= width || y + 1 >= width) return null
    const read = (i: number, j: number) => grid.getInt16((j * width + i) * 2, true)
    const a = read(x, y), b = read(x + 1, y), c = read(x, y + 1), d = read(x + 1, y + 1)
    if (a === -32768 || b === -32768 || c === -32768 || d === -32768) return null
    const fx = col - x, fy = row - y
    return ((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy) / 2
  }
}
