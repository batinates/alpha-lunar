import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const root = new URL('../public/lunar/site-archive/', import.meta.url)
const read = path => readFileSync(new URL(path, root))
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')

test('archive context matches site IDs and preserves source coverage in bundled artifacts', () => {
  const { sites } = JSON.parse(read('manifest.json'))
  const manifest = JSON.parse(read('context/manifest.json'))
  assert.equal(Object.keys(manifest.sites).length, 22)
  const catalog = new Map(sites.map(site => [site.id, site]))
  for (const [id, hashes] of Object.entries(manifest.sites)) {
    assert.ok(catalog.get(id)?.series, id)
    const data = read(`context/${id}.json`)
    assert.equal(sha256(data), hashes.jsonSha256)
    const map = read(`context/${id}-slope.webp`)
    assert.equal(sha256(map), hashes.mapSha256)
    assert.equal(map.toString('ascii', 8, 12), 'WEBP')
    const { terrain, months, events, id: fileId, schema } = JSON.parse(data)
    assert.equal(fileId, id)
    assert.equal(schema, 1)
    assert.ok(terrain.map.pixelMeters > 0 && terrain.map.x > 0 && terrain.map.x < 1 && terrain.map.y > 0 && terrain.map.y < 1)
    assert.equal(Object.keys(months).length, 84)
    assert.equal(months['2029-12'][0], 743.833)
    for (const [month, row] of Object.entries(months)) {
      assert.match(month, /^202[3-9]-(0[1-9]|1[012])$/)
      assert.equal(row.length, 6)
      assert.ok(row.every(value => Number.isFinite(value) && value >= 0))
      assert.ok(row[1] <= 100 && row[4] <= 100)
      const times = (events[month] ?? []).map(([time, body, kind, azimuth, sensitivity]) => {
        assert.ok(time.startsWith(month) && Number.isFinite(Date.parse(time)))
        assert.ok(['sun', 'earth'].includes(body) && ['rise', 'set'].includes(kind))
        assert.ok(azimuth >= 0 && azimuth <= 360)
        assert.ok(sensitivity === null || Number.isFinite(sensitivity))
        return time
      })
      assert.deepEqual(times, times.toSorted())
    }
  }
})
