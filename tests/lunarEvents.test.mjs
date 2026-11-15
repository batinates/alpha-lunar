import assert from 'node:assert/strict'
import test from 'node:test'
import { eclipseTransmission, lunarEvents } from '../src/services/science/lunarEvents.ts'

test('geometric eclipse attenuates the disk from full light through partial to total', () => {
  const sun = [149_597_870, 0, 0]
  assert.equal(eclipseTransmission(sun, [-384_000, 0, 0]), 1)
  assert.equal(eclipseTransmission(sun, [384_000, 0, 0]), 0)
  const partial = eclipseTransmission(sun, [384_000, 6378, 0])
  assert.ok(partial > .4 && partial < .6)
  assert.equal(lunarEvents(sun, [384_000, 0, 0]).illuminated, 1)
})
