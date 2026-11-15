import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { horizonAngles, interpolateEphemeris, validateEphemeris } from '../src/services/science/ephemeris.ts'
import { polarToLatLon, samplePolarHorizon } from '../src/services/science/lunarAssets.ts'
import { buildHorizon, horizonAt } from '../src/services/science/terrainHorizon.ts'
import { SOLAR_RADIUS_KM } from '../src/services/science/solarPower.ts'

const root = new URL('../', import.meta.url)
const input = process.argv[2] && resolve(process.argv[2])
if (!input) throw new Error('Usage: node scripts/validate_external.mjs <folder containing PGDA IMG and LBL files>')
const cache = new URL('.cache/validation/', root)
mkdirSync(cache, { recursive: true })
const read = path => readFileSync(new URL(path, root))
const sha = data => createHash('sha256').update(data).digest('hex')
const epiBytes = read('public/lunar/ephemeris.json')
const ephemeris = validateEphemeris(JSON.parse(epiBytes))
const demBytes = read('public/lunar/south-pole-height.f32')
const values = Float32Array.from({ length: demBytes.length / 4 }, (_, i) => demBytes.readFloatLE(i * 4))
const raster = { width: 1896, height: 1896, values }
if (values.length !== raster.width * raster.height) throw new Error('Unexpected DEM dimensions')
const { sites } = JSON.parse(read('public/lunar/regional/manifest.json'))
const DEG = Math.PI / 180
const HOUR = 3_600_000
const api = 'https://ssd.jpl.nasa.gov/api/horizons.api'
const pgda = 'https://imbrium.mit.edu/EXTRAS/ILLUMINATION/IMG/'
const bodies = [{ key: 'sun', id: 10, radius: SOLAR_RADIUS_KM, offset: 0 },
  { key: 'earth', id: 399, radius: 6378.137, offset: 3 }]
const windows = ['2026-01-15', '2026-07-15', '2027-01-15', '2027-07-15', '2028-02-01', '2028-11-15']
const stats = samples => {
  if (!samples.length || samples.some(v => !Number.isFinite(v))) throw new Error('Invalid sample set')
  const mean = f => samples.reduce((sum, n) => sum + f(n), 0) / samples.length
  return { count: samples.length, bias: mean(n => n), mae: mean(Math.abs), rmse: Math.sqrt(mean(n => n * n)), maxAbs: Math.max(...samples.map(Math.abs)) }
}
const wrap = deg => ((deg + 180) % 360 + 360) % 360 - 180
const angle = (a, b) => {
  const vector = v => [Math.cos(v.elevation * DEG) * Math.cos(v.azimuth * DEG), Math.cos(v.elevation * DEG) * Math.sin(v.azimuth * DEG), Math.sin(v.elevation * DEG)]
  return 2 * Math.asin(Math.min(1, Math.hypot(...vector(a).map((n, i) => n - vector(b)[i])) / 2)) / DEG
}
const toApi = ms => new Date(ms).toISOString().slice(0, 16).replace('T', ' ')

async function horizons(site, body, day) {
  const start = Date.parse(day + 'T00:30:00Z'), stop = start + 7 * 24 * HOUR
  const p = {
    format: 'json', COMMAND: body.id, CENTER: 'coord@301', COORD_TYPE: 'GEODETIC',
    SITE_COORD: `${((site.longitude + 360) % 360).toFixed(8)},${site.latitude.toFixed(8)},${(site.height / 1000).toFixed(8)}`,
    EPHEM_TYPE: 'OBSERVER', START_TIME: toApi(start), STOP_TIME: toApi(stop), STEP_SIZE: '6 h',
    MAKE_EPHEM: 'YES', OBJ_DATA: 'NO', QUANTITIES: '4', CSV_FORMAT: 'YES', EXTRA_PREC: 'YES', APPARENT: 'AIRLESS',
  }
  const url = api + '?' + new URLSearchParams(Object.entries(p).map(([k, v]) => [k, k === 'format' ? v : `'${v}'`]))
  const path = new URL(`horizons-${sha(url)}.json`, cache)
  const cached = existsSync(path)
  const raw = cached ? readFileSync(path, 'utf8') : await fetch(url, { signal: AbortSignal.timeout(60_000) }).then(response => {
    if (!response.ok) throw new Error(`Horizons HTTP ${response.status}`)
    return response.text()
  })
  const { result, error } = JSON.parse(raw)
  if (error || !result?.includes('MEAN_ME (high precision)') || !result.includes('NO (AIRLESS)') ||
      !result.includes('Azimuth_(a-app)') || !result.includes('$$SOE') || !result.includes('$$EOE')) throw new Error(error ?? 'Unexpected Horizons output')
  const model = result.match(/Target body name:.*?\{source:\s*([^}]+)\}/)?.[1]
  if (!model) throw new Error('No Horizons ephemeris source')
  const lines = result.split('$$SOE')[1].split('$$EOE')[0].trim().split(/\r?\n/)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (lines.length !== 29) throw new Error('Missing Horizons epochs')
  const rows = lines.map((line, i) => {
    const [date, , , az, el] = line.split(',').map(s => s.trim())
    const m = date.match(/^(\d{4})-([A-Z][a-z]{2})-(\d\d) (\d\d):(\d\d)$/)
    if (!m || !az || !el || !Number.isFinite(+az) || !Number.isFinite(+el)) throw new Error('Unrecognized Horizons row: ' + line)
    const t = Date.UTC(+m[1], months.indexOf(m[2]), +m[3], +m[4], +m[5])
    if (t !== start + i * 6 * HOUR) throw new Error('Horizons UTC grid mismatch')
    const ref = { azimuth: +az, elevation: +el }
    const ours = horizonAngles(interpolateEphemeris(ephemeris, t)[body.key], site.latitude, site.longitude, site.height)
    return { utc: new Date(t).toISOString(), referenceAz: ref.azimuth, referenceEl: ref.elevation, modelAz: ours.azimuth, modelEl: ours.elevation,
      azDelta: wrap(ours.azimuth - ref.azimuth), elDelta: ours.elevation - ref.elevation, separation: angle(ours, ref) }
  })
  if (!cached) writeFileSync(path, raw)
  return { rows, query: { url, model, rawSha256: sha(raw) } }
}

function pgdaRaster(body) {
  const name = 'AVGVISIB_85S_060M_201608' + (body.key === 'earth' ? '_EARTH' : '')
  const label = readFileSync(join(input, name + '.LBL'))
  const img = readFileSync(join(input, name + '.IMG'))
  const field = key => label.toString('ascii').match(new RegExp(`^\\s*${key}\\s*=\\s*(.+)$`, 'm'))?.[1].trim()
  const number = key => parseFloat(field(key))
  const lines = number('LINES'), samples = number('LINE_SAMPLES'), scale = number('MAP_SCALE')
  const x0 = number('SAMPLE_PROJECTION_OFFSET'), z0 = number('LINE_PROJECTION_OFFSET'), factor = number('SCALING_FACTOR')
  if (lines !== 5058 || samples !== 5058 || scale !== 60 || x0 !== (samples - 1) / 2 || z0 !== (lines - 1) / 2 ||
      factor !== 0.00004 || field('SAMPLE_TYPE') !== 'LSB_INTEGER' || number('SAMPLE_BITS') !== 16 || number('OFFSET') !== 0 ||
      number('CENTER_LATITUDE') !== -90 || number('CENTER_LONGITUDE') !== 0 || number('MAP_PROJECTION_ROTATION') !== 0 ||
      !field('COORDINATE_SYSTEM_NAME')?.includes('DE421') || img.length !== lines * samples * 2) throw new Error('Unexpected PGDA grid or encoding: ' + name)
  return {
    source: { product: name, image: pgda + name + '.IMG', label: pgda + name + '.LBL', imageSha256: sha(img), labelSha256: sha(label) },
    at(col, row) {
      const dn = img.readInt16LE(2 * (row * samples + col))
      if (dn < 0 || dn > 25000) throw new Error('PGDA value outside scaling range')
      return dn * factor * 100
    },
    pixel(x, z) { return { col: Math.round(x0 + x / scale), row: Math.round(z0 + z / scale) } },
    center(col, row) { return { x: (col - x0) * scale, z: (row - z0) * scale } },
  }
}

const long = JSON.parse(readFileSync(new URL('long-geometry.json', cache), 'utf8'))
const geom = readFileSync(new URL('long-geometry.f64', cache))
if (sha(geom) !== long.sha256 || geom.length !== long.count * 48 || long.frame !== ephemeris.frame || long.correction !== 'NONE') throw new Error('Invalid long-period cache')
const rasters = bodies.map(pgdaRaster)
const angleRows = [], brightnessRows = [], queries = []
for (const region of sites) {
  const site = polarToLatLon(region.x, region.z)
  const height = samplePolarHorizon(raster, site.latitude, site.longitude) + 2
  for (const body of bodies) for (const day of windows) {
    const check = await horizons({ ...site, height }, body, day)
    queries.push({ site: region.name, body: body.key, ...check.query })
    angleRows.push(...check.rows.map(row => ({ site: region.name, body: body.key, ...site, height, ...row })))
  }
  const nearest = rasters[0].pixel(region.x, region.z)
  for (const dx of [-12, -6, 0, 6, 12]) for (const dz of [-12, -6, 0, 6, 12]) {
    const col = nearest.col + dx, row = nearest.row + dz
    const { x, z } = rasters[0].center(col, row)
    const point = polarToLatLon(x, z)
    const horizon = buildHorizon(point.latitude, point.longitude, 0, (lat, lon) => samplePolarHorizon(raster, lat, lon))
    for (const [i, body] of bodies.entries()) {
      let seen = 0, unknown = 0
      for (let t = 0; t < long.count; t++) {
        const off = (t * 6 + body.offset) * 8
        const position = [geom.readDoubleLE(off), geom.readDoubleLE(off + 8), geom.readDoubleLE(off + 16)]
        const a = horizonAngles(position, point.latitude, point.longitude, horizon.observerElevation)
        const edge = horizonAt(horizon, a.azimuth)
        const visible = edge === null ? null : a.elevation + Math.asin(body.radius / a.distance) / DEG > edge.elevation
        if (!edge || (visible && edge.range + horizon.stepMeters <= horizon.radiusMeters)) unknown++
        else if (visible) seen++
      }
      const referencePct = rasters[i].at(col, row)
      const modelPct = unknown === 0 ? 100 * seen / long.count : null
      brightnessRows.push({ site: region.name, body: body.key, col, row, x, z, ...point, referencePct, modelPct,
        unknownSamples: unknown, deltaPp: modelPct === null ? null : modelPct - referencePct })
    }
  }
  console.log('Compared', region.name)
}

const groups = ['All sites', ...sites.map(s => s.name)].flatMap(site => bodies.map(({ key: body }) => {
  const filter = r => (site === 'All sites' || site === r.site) && body === r.body
  const angles = angleRows.filter(filter), visibility = brightnessRows.filter(filter)
  return { site, body, angles: { azimuth: stats(angles.map(a => a.azDelta)), elevation: stats(angles.map(a => a.elDelta)), separation: stats(angles.map(a => a.separation)) },
    visibility: { complete: visibility.filter(a => a.deltaPp !== null).length, total: visibility.length,
      delta: visibility.some(a => a.deltaPp !== null) ? stats(visibility.flatMap(a => a.deltaPp === null ? [] : [a.deltaPp])) : null } }
}))
const out = new URL('public/lunar/validation/', root)
mkdirSync(out, { recursive: true })
function csv(name, rows) {
  const text = [Object.keys(rows[0]).join(','), ...rows.map(row => Object.values(row).join(','))].join('\n') + '\n'
  writeFileSync(new URL(name, out), text)
  return sha(text)
}
const report = {
  version: 1, windows, groups, queries, longPeriod: long, pgda: rasters.map(r => r.source),
  assets: { ephemerisSha256: sha(epiBytes), demSha256: sha(demBytes), anglesCsvSha256: csv('angles.csv', angleRows), visibilityCsvSha256: csv('visibility.csv', brightnessRows) },
}
writeFileSync(new URL('report.json', out), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(groups.filter(g => g.site === 'All sites'), null, 2))
