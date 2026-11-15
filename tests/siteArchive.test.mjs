import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { archiveRow, archivedHorizonAt } from '../src/services/science/siteArchive.ts'

const directory = new URL('../public/lunar/site-archive/', import.meta.url)
const read = (name) => readFileSync(new URL(name, directory))

test('catalog preserves distinct locations while identical data share one series', () => {
  const manifest = JSON.parse(read('manifest.json'))
  assert.equal(manifest.sites.length, 25)
  assert.equal(manifest.sites.filter(site => site.series).length, 22)
  assert.equal(Object.keys(manifest.series).length, 21)
  const ridge = manifest.sites.find(site => site.id === 'a3_2022_connecting_ridge')
  const endurance = manifest.sites.find(site => site.id === 'blue_moon_mk1_endurance')
  assert.equal(ridge.series, endurance.series)
  assert.notEqual(ridge.id, endurance.id)
  assert.equal(manifest.sites.find(site => site.id === 'griffin1').lat, null)
})

test('packed archive retains signed elevation and wrapped azimuth at both time boundaries', () => {
  const manifest = JSON.parse(read('manifest.json'))
  for (const [id, metadata] of Object.entries(manifest.series)) {
    const bytes = read(id + '.i16')
    assert.equal(bytes.length, manifest.count * 8)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256)
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    for (const index of [0, manifest.count - 1]) {
      const { sunAz, sunEl, earthAz, earthEl } = archiveRow(data, index)
      assert.ok(sunAz >= 0 && sunAz < 360 && earthAz >= 0 && earthAz < 360)
      assert.ok(Math.abs(sunEl) <= 90 && Math.abs(earthEl) <= 90)
    }
  }
  const bytes = read('a3_peak_near_cabeus_b.i16')
  assert.deepEqual(archiveRow(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0),
    { sunAz: 142.17, sunEl: -3.68, earthAz: 75.77, earthEl: .45 })
})

test('horizon interpolation crosses the north seam without dropping the last sample', () => {
  const profile = { az_step_deg: .25, el_deg: Array(1440).fill(0) }
  profile.el_deg[1439] = -1
  profile.el_deg[0] = 3
  assert.equal(archivedHorizonAt(profile, 359.875), 1)
  assert.equal(archivedHorizonAt(profile, -0.125), 1)
})
