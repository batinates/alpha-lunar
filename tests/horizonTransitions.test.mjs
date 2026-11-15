import assert from 'node:assert/strict'
import test from 'node:test'
import { compareCrossings, findCrossings } from '../src/services/science/horizonTransitions.ts'

test('refines a crossing between samples and exposes the shift caused by a different horizon', () => {
  const minute = 60_000
  const nominal = findCrossings(0, 20 * minute, time => time / minute - 13.2)
  const coarse = findCrossings(0, 20 * minute, time => time / minute - 15.3)
  assert.deepEqual(compareCrossings(nominal, coarse), [
    { time: 13 * minute, direction: 'Rises', earliest: 13 * minute, latest: 15 * minute },
  ])
  assert.deepEqual(findCrossings(0, 20 * minute, time => time === 15 * minute ? null : time / minute - 13.2), [])
  assert.equal(compareCrossings(nominal, [ ...coarse, { time: 20 * minute, direction: 'Sets' } ])[0].earliest, null)
})
