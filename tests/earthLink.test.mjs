import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { earthLinkAt, HOUR, linkBudget, LINK_FIELDS, linkWindows, validLink } from '../src/services/science/earthLink.ts'

const inputs = Object.fromEntries(Object.entries(LINK_FIELDS).map(([key, field]) => [key, field.value]))

test('free-space loss increases by 6.02 dB when distance doubles', () => {
  const near = linkBudget(192000, inputs)
  const far = linkBudget(384000, inputs)
  assert.ok(Math.abs(far.loss - near.loss - 20 * Math.log10(2)) < 1e-10)
  assert.equal(far.margin, far.received - inputs.sensitivity)
  assert.equal(validLink({ ...inputs, power: 0 }), false)
})

test('a positive link margin cannot establish a window without known terrain clearance', () => {
  const time = Date.parse('2026-01-01T00:00Z')
  const data = { start: new Date(time).toISOString(), stepMs: HOUR, rows: [
    [0, 0, 0, 384000, 0, 0], [0, 0, 0, 384000, 0, 0],
  ] }
  const site = { latitude: 0, longitude: 0 }
  const horizon = { observerElevation: 0, mastHeight: 2, radiusMeters: 100000,
    elevations: Array(360).fill(5), distances: Array(360).fill(100000) }
  assert.ok(earthLinkAt(data, time, site, null, inputs).margin > 0)
  assert.equal(earthLinkAt(data, time, site, null, inputs).status, 'Unknown terrain')
  assert.equal(earthLinkAt(data, time, site, horizon, inputs).status, 'Meets modeled limits')
  assert.equal(earthLinkAt(data, time, site, horizon, { ...inputs, power: .01 }).status, 'Below sensitivity')
  assert.equal(earthLinkAt(data, time, site, { ...horizon, elevations: Array(360).fill(90) }, inputs).status, 'Blocked by terrain')
})

test('window grouping preserves isolated samples and gaps', () => {
  const samples = [0, 1, 3, 4].map((hour, index) => ({ time: hour * HOUR, status: index < 3 ? 'clear' : 'blocked' }))
  assert.deepEqual(linkWindows(samples).map(window => window.count), [2, 1, 1])
})

test('regional terrain manifest pins complete 80 m and 20 m grids for each site', () => {
  const directory = new URL('../public/lunar/regional/', import.meta.url)
  const { sites } = JSON.parse(readFileSync(new URL('manifest.json', directory), 'utf8'))
  assert.deepEqual(sites.map(site => site.id), ['01', '04', '11'])
  for (const site of sites) {
    for (const [spacing, level] of Object.entries(site.levels)) {
      const bytes = readFileSync(new URL(level.file, directory))
      assert.equal(level.width * Number(spacing), site.size)
      assert.equal(bytes.length, 2 * level.width ** 2)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), level.sha256)
    }
  }
})
