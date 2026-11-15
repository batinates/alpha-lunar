import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_DESCENT, GRAVITY, descentKinematics, simulateDescents } from '../src/services/science/descent.ts'
import { POLAR_HALF_EXTENT, polarToLatLon } from '../src/services/science/lunarAssets.ts'

const flat = { width: 1896, height: 1896, values: new Float32Array(1896 ** 2) }
const request = {
  coordinates: { latitude: -89, longitude: 0 }, massKg: 1200, squareMeters: 640, slopeLimit: 10, roughnessLimit: 6,
  settings: { ...DEFAULT_DESCENT, trials: 100 },
}

test('constant braking reaches the target with zero terminal velocity and scales force with mass', () => {
  const settings = { ...request.settings, alongSigma: 0, acrossSigma: 0, speedSigma: 0 }
  const [result] = simulateDescents({ ...request, settings }, flat)
  assert.equal(result.path[0].y, settings.altitude)
  assert.equal(result.path.at(-1).y, 0)
  assert.equal(result.path.at(-1).speed, 0)
  assert.ok(result.nominal.clearance > 0)
  assert.equal(result.counts.within, settings.trials)
  const small = descentKinematics(settings, settings.speed, 1000)
  const large = descentKinematics(settings, settings.speed, 2000)
  assert.ok(small.thrustKN > GRAVITY)
  assert.equal(large.thrustKN, 2 * small.thrustKN)
})

test('shared seed is repeatable and lower dispersion contracts the same sample cloud', () => {
  const scenarios = simulateDescents(request, flat)
  assert.deepEqual(scenarios, simulateDescents(request, flat))
  const [base, turned, tighter] = scenarios
  assert.notEqual(base.path[0].x, turned.path[0].x)
  assert.ok(base.counts.footprint > 0)
  assert.ok(tighter.counts.footprint <= base.counts.footprint)
  assert.ok(Math.abs((tighter.points[0].x - base.path.at(-1).x) - .7 * (base.points[0].x - base.path.at(-1).x)) < 1e-6)
  for (const item of scenarios) assert.equal(item.counts.within + item.counts.exceeded + item.counts.unknown, request.settings.trials)
})

test('thrust deficits and missing coverage are represented distinctly', () => {
  const [underpowered] = simulateDescents({ ...request, settings: { ...request.settings, thrustKN: 1 } }, flat)
  assert.equal(underpowered.counts.thrust, request.settings.trials)
  assert.equal(underpowered.counts.exceeded, request.settings.trials)
  const [edge] = simulateDescents({
    ...request, coordinates: polarToLatLon(0, -POLAR_HALF_EXTENT + 150),
    settings: { ...request.settings, alongSigma: 0, acrossSigma: 0, speedSigma: 0 },
  }, flat)
  assert.equal(edge.counts.unknown, request.settings.trials)
  assert.equal(edge.nominal.touchdownSlope, null)
})
