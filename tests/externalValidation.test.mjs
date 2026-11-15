import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const asset = name => readFileSync(new URL('../public/lunar/' + name, import.meta.url))
const digest = bytes => createHash('sha256').update(bytes).digest('hex')

test('external validation results match the published model inputs and downloadable evidence', () => {
  const report = JSON.parse(asset('validation/report.json'))
  const files = {
    ephemerisSha256: 'ephemeris.json', demSha256: 'south-pole-height.f32',
    anglesCsvSha256: 'validation/angles.csv', visibilityCsvSha256: 'validation/visibility.csv',
  }
  for (const [key, path] of Object.entries(files)) assert.equal(digest(asset(path)), report.assets[key], path)
  const rows = path => {
    const [header, ...lines] = asset(path).toString('utf8').trim().split('\n').map(line => line.split(','))
    return lines.map(line => Object.fromEntries(header.map((key, i) => [key, line[i]])))
  }
  const angles = rows(files.anglesCsvSha256), visibility = rows(files.visibilityCsvSha256)
  assert.equal(angles.length, 1044)
  assert.equal(angles.filter(row => row.utc.startsWith('2028-')).length, 348)
  assert.equal(visibility.length, 150)
  for (const group of report.groups) {
    const select = row => group.body === row.body && (group.site === 'All sites' || group.site === row.site)
    const directions = angles.filter(select).map(row => Number(row.separation))
    const vis = visibility.filter(select)
    const complete = vis.filter(row => row.unknownSamples === '0')
    assert.equal(group.angles.separation.count, directions.length)
    assert.equal(group.angles.separation.maxAbs, Math.max(...directions))
    assert.equal(group.visibility.total, vis.length)
    assert.equal(group.visibility.complete, complete.length)
    const diffs = complete.map(row => Number(row.modelPct) - Number(row.referencePct))
    assert.ok(Math.abs(group.visibility.delta.mae - diffs.reduce((sum, d) => sum + Math.abs(d), 0) / diffs.length) < 1e-12)
  }
})
