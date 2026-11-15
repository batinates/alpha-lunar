import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareSite, DEFAULT_LINK } from '../src/services/science/siteComparison.ts'
import { DEFAULT_POWER, POWER_STEP_MS } from '../src/services/science/solarPower.ts'
import { HOUR } from '../src/services/science/earthLink.ts'
import { buildHorizon } from '../src/services/science/terrainHorizon.ts'
import { polarToLatLon, samplePolarHorizon } from '../src/services/science/lunarAssets.ts'

test('two regional locations share UTC intervals while retaining distinct power and radio evidence', () => {
  const read = name => readFileSync(new URL('../public/lunar/' + name, import.meta.url))
  const ephemeris = JSON.parse(read('ephemeris.json')), dem = read('south-pole-height.f32')
  const raster = { width: 1896, height: 1896, values: Float32Array.from({ length: dem.length / 4 }, (_, i) => dem.readFloatLE(i * 4)) }
  const first = Date.parse('2027-01-15T00:00:00Z'), end = first + 7 * 24 * HOUR
  const results = JSON.parse(read('regional/manifest.json')).sites.slice(0, 2).map(({ id, name, x, z }) => {
    const site = { id, name, ...polarToLatLon(x, z) }
    const horizon = buildHorizon(site.latitude, site.longitude, 2, (lat, lon) => samplePolarHorizon(raster, lat, lon))
    return compareSite(ephemeris, site, horizon, first, end, DEFAULT_POWER, DEFAULT_LINK)
  })
  assert.deepEqual(results[0].rows.map(row => row.radio.time), results[1].rows.map(row => row.radio.time))
  assert.notEqual(results[0].energy.generatedWh, results[1].energy.generatedWh)
  for (const result of results) {
    assert.equal(result.rows.length, 1008)
    assert.equal(result.rows.at(-1).to, end)
    assert.equal(result.windows[0].from, first)
    assert.equal(result.windows.at(-1).to, end)
    assert.ok(result.windows.every((w, i, list) => i === 0 || w.from === list[i - 1].to))
    const link = result.windows.filter(w => w.status === 'Meets modeled limits')
    assert.equal(result.linkHours, link.reduce((sum, w) => sum + w.to - w.from, 0) / HOUR)
  }
})

test('unknown terrain breaks outages rather than being counted as one', () => {
  const site = { id: 'test', name: 'Test', latitude: 0, longitude: 0 }
  const data = { start: '2027-01-01T00:00Z', stepMs: HOUR, rows: [
    [100e6, 0, 0, 1000, -400000, 0], [100e6, 0, 0, 1000, 400000, 0],
  ] }
  const horizon = {
    elevations: Array(360).fill(20), distances: Array(360).fill(100000), observerElevation: 0,
    mastHeight: 0, stepMeters: 160, radiusMeters: 100000, latitude: 0, longitude: 0,
  }
  horizon.elevations[270] = NaN
  const first = Date.parse(data.start), result = compareSite(data, site, horizon, first, first + HOUR, DEFAULT_POWER, DEFAULT_LINK)
  assert.deepEqual(result.windows.map(w => w.status), ['Unknown terrain', 'Blocked by terrain'])
  assert.equal(result.linkUnknownHours, 3 * POWER_STEP_MS / HOUR)
  assert.equal(result.longestOutageHours, 3 * POWER_STEP_MS / HOUR)
})
