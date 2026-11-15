import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { latLonToPolar } from '../src/services/science/lunarAssets.ts'
import { lunarSkyAxes, skyDirection, touchdownCoordinates, touchdownHorizon, touchdownSky } from '../src/services/science/touchdownSky.ts'

const read = name => readFileSync(new URL('../public/lunar/' + name, import.meta.url))

test('touchdown sky matches the bundled Horizons check at a real DEM observer', () => {
  const rows = read('validation/angles.csv').toString().split(/\r?\n/).slice(1).map(row => row.split(','))
  const observations = rows.filter(row => row[0] === 'Connecting Ridge' && row[5] === '2026-01-15T00:30:00.000Z')
  assert.equal(observations.length, 2)
  const [, , latitude, longitude, height, utc] = observations[0]
  const coordinates = { latitude: Number(latitude), longitude: Number(longitude) }
  const { x, z } = latLonToPolar(coordinates.latitude, coordinates.longitude)
  const point = touchdownCoordinates(x, z, coordinates)
  const dem = read('south-pole-height.f32')
  const raster = { width: 1896, height: 1896, values: new Float32Array(dem.buffer, dem.byteOffset, dem.byteLength / 4) }
  const profile = touchdownHorizon(raster, point)
  assert.ok(Math.abs(profile.observerElevation + profile.mastHeight - Number(height)) < 1e-6)
  const sky = touchdownSky(JSON.parse(read('ephemeris.json')), Date.parse(utc), point, profile)
  for (const [, body, , , , , referenceAz, referenceEl] of observations) {
    const azimuthError = (sky[body].azimuth - Number(referenceAz) + 540) % 360 - 180
    assert.ok(Math.abs(azimuthError) < .01)
    assert.ok(Math.abs(sky[body].elevation - Number(referenceEl)) < .001)
    assert.ok(Math.abs(Math.hypot(...sky[body].direction) - 1) < 1e-12)
  }
  assert.ok(sky.earth.radius > .8 && sky.earth.radius < 1.1)
  assert.ok(sky.sun.radius > .25 && sky.sun.radius < .28)
  const incomplete = { ...profile, distances: profile.distances.map(() => 800), elevations: profile.elevations.map(() => -80) }
  assert.equal(touchdownSky(JSON.parse(read('ephemeris.json')), Date.parse(utc), point, incomplete).sun.visibleFraction, null)
})

test('polar panorama places north toward -Z, east toward +X, and zenith toward +Y', () => {
  const near = (a, b) => a.every((component, i) => Math.abs(component - b[i]) < 1e-12)
  assert.ok(near(skyDirection(0, 0), [0, 0, -1]))
  assert.ok(near(skyDirection(90, 0), [1, 0, 0]))
  assert.ok(near(skyDirection(180, 90), [0, 1, 0]))
  assert.deepEqual(touchdownCoordinates(0, 0, { latitude: -90, longitude: 90 }), { latitude: -90, longitude: 90 })
  const [east, up, south] = lunarSkyAxes({ latitude: -90, longitude: 0 })
  assert.ok(near(east, [0, 1, 0]) && near(up, [0, 0, -1]) && near(south, [-1, 0, 0]))
})
