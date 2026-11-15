import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DSN_STATIONS, dsnAt } from '../src/services/science/dsn.ts'
import { DEFAULT_LINK } from '../src/services/science/siteComparison.ts'

test('DSN station elevations agree with JPL Horizons at twelve off-grid epochs', () => {
  const read = name => readFileSync(new URL('../public/lunar/' + name, import.meta.url))
  const metadata = JSON.parse(read('dsn-orientation.json'))
  const bytes = read('dsn-orientation.f32')
  assert.equal(createHash('sha256').update(bytes).digest('hex'), metadata.sha256)
  const orientation = { start: Date.parse(metadata.start), stepMs: metadata.stepMs,
    values: Float32Array.from({ length: bytes.length / 4 }, (_, index) => bytes.readFloatLE(index * 4)) }
  const data = JSON.parse(read('ephemeris.json'))
  // Horizons COMMAND=301, CENTER=DSS-xx@399, quantity 4, AIRLESS, 2027-01-15 00:05 UTC, six-hour step.
  const references = [[61.097394007, 18.080461145, -39.902276666, -9.509300260],
    [-2.081878901, -38.958241183, 10.237133186, 62.807536096],
    [-20.222239513, 39.314314170, 9.498436310, -59.028306110]]
  const start = Date.parse('2027-01-15T00:05Z')
  for (const [index, station] of DSN_STATIONS.entries()) {
    for (const [sample, reference] of references[index].entries()) {
      const time = start + sample * 21_600_000
      // An observer at the Moon center isolates the station-side comparison.
      const actual = dsnAt(data, orientation, time, { latitude: 0, longitude: 0 }, null, -1_737_400, station, 10, DEFAULT_LINK)
      const difference = Math.abs(actual.stationElevation - reference)
      assert.ok(difference < .02, `${station.id} ${difference} degrees`)
      assert.equal(actual.status, reference < 10 ? 'Below station mask' : 'Unknown lunar terrain')
    }
  }
})
