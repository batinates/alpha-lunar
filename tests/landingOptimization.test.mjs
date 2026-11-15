import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ARTEMIS, ROBOTIC, validMission } from '../src/domain/mission.ts'
import { clearanceStatus, HOUR, optimizeLandings, paretoFront, validSearch } from '../src/services/science/landingOptimization.ts'
import { polarToLatLon } from '../src/services/science/lunarAssets.ts'
import { readEnvironment } from '../src/services/science/polarEnvironment.ts'

test('an incomplete terrain ray can rule out clearance but cannot establish it', () => {
  assert.deepEqual(clearanceStatus(3, { elevation: 2, range: 80000 }, 100000), { clearance: 1, clear: false, unknown: true })
  assert.deepEqual(clearanceStatus(1, { elevation: 2, range: 80000 }, 100000), { clearance: -1, clear: false, unknown: false })
  assert.deepEqual(clearanceStatus(3, { elevation: 2, range: 100000 }, 100000), { clearance: 1, clear: true, unknown: false })
})

test('Pareto retains real tradeoffs and equivalent options', () => {
  const a = { objectives: [1, .5] }, b = { objectives: [.5, 1] }, c = { objectives: [.5, .5] }
  const equivalent = { objectives: [1, .5] }
  assert.deepEqual(paretoFront([a, b, c, equivalent]), [a, b, equivalent])
})

test('the full stay must fit in ephemeris coverage and limits must be numeric', () => {
  const data = { start: '2026-01-01T00:00Z', stepMs: HOUR, rows: new Array(49) }
  const first = Date.parse(data.start)
  const options = { profile: ROBOTIC, first, last: first + 24 * HOUR, sites: [{}] }
  assert.ok(validSearch(data, options))
  assert.equal(validSearch(data, { ...options, last: options.last + HOUR }), false)
  assert.equal(validMission({ ...ARTEMIS, maxSlope: NaN }), false)
})

test('bundled terrain and SPICE produce alternatives with auditable rejections', () => {
  const assets = new URL('../public/lunar/', import.meta.url)
  const buffer = (name) => {
    const file = readFileSync(new URL(name, assets))
    return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength)
  }
  const raster = { width: 1896, height: 1896, values: new Float32Array(buffer('south-pole-height.f32')) }
  const environment = readEnvironment(buffer('polar-environment.bin'))
  const ephemeris = JSON.parse(readFileSync(new URL('ephemeris.json', assets), 'utf8'))
  const first = Date.parse('2026-11-14T12:00Z')
  const sites = [
    { id: 'sample', name: 'Grid sample', ...polarToLatLon(-60000, -40000) },
    { id: 'outside', name: 'Outside', latitude: 0, longitude: 0 },
  ]
  const r = optimizeLandings({ profile: ROBOTIC, sites, first, last: first + 14 * 24 * HOUR }, ephemeris, raster, environment)
  assert.ok(r.passed > 1 && r.best.length > 1)
  assert.ok(r.best.every(o => o.sunPercent >= ROBOTIC.minSunPercent && o.earthPercent >= ROBOTIC.minEarthPercent))
  assert.equal(r.best[0].site.id, 'sample')
  assert.equal(r.screened, r.passed + r.rejected.reduce((sum, entry) => sum + entry.count, 0))
  assert.ok(r.rejected.some(entry => entry.site.id === 'outside' && /terrain/.test(entry.reason)))
})
