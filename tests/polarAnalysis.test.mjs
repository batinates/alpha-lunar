import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { latLonToPolar, POLAR_HALF_EXTENT } from '../src/services/science/lunarAssets.ts'
import { ENVIRONMENT_WIDTH, LCROSS_IMPACT, readEnvironment, sampleEnvironment } from '../src/services/science/polarEnvironment.ts'
import { screenTerrain, terrainSlope, thermalExceedances } from '../src/services/science/siteScreening.ts'

test('a planar DEM returns the analytical slope and zero detrended roughness', () => {
  const width = 1896
  const raster = { width, height: width, values: new Float32Array(width ** 2) }
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) raster.values[row * width + col] = col * 16 + row * 32
  }
  assert.ok(Math.abs(terrainSlope(raster, 0, 0) - Math.atan(Math.hypot(.1, .2)) * 180 / Math.PI) < 1e-9)
  assert.ok(screenTerrain(raster, 0, 0, 640).maxRoughness < 1e-7)
  assert.equal(screenTerrain(raster, POLAR_HALF_EXTENT - 400, 0, 640), null)
  assert.equal(screenTerrain(raster, NaN, 0, 640), null)
  raster.values[948 * width + 948] += 200
  const rough = screenTerrain(raster, 0, 0, 640)
  assert.ok(rough.maxRoughness > 10)
  assert.ok(rough.maxSlope > terrainSlope(raster, -500, -500))
})

test('environment coverage, row orientation and no-data survive binary decoding', () => {
  const buffer = new ArrayBuffer(ENVIRONMENT_WIDTH ** 2 * 6)
  const view = new DataView(buffer)
  view.setUint16(0, 1234, true)
  view.setUint16(2, 65535, true)
  view.setUint8(4, 255)
  view.setUint8(5, 32)
  const grid = readEnvironment(buffer)
  assert.deepEqual(sampleEnvironment(grid, -151440, -151440),
    { peak: 123.4, mean: null, bins: null, shadowFraction: .5 })
  assert.equal(sampleEnvironment(grid, 0, POLAR_HALF_EXTENT), null)
  assert.equal(sampleEnvironment(grid, NaN, 0), null)
  assert.throws(() => readEnvironment(new ArrayBuffer(10)))
})

test('bundled environment matches provenance and registers Cabeus in modeled shadow', () => {
  const manifest = JSON.parse(readFileSync(new URL('../public/lunar/polar-environment.json', import.meta.url), 'utf8'))
  const bytes = readFileSync(new URL('../public/lunar/polar-environment.bin', import.meta.url))
  assert.equal(bytes.length, manifest.output.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.output.sha256)
  const grid = readEnvironment(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const { x, z } = latLonToPolar(LCROSS_IMPACT.latitude, LCROSS_IMPACT.longitude)
  const cell = sampleEnvironment(grid, x, z)
  assert.ok(cell.shadowFraction > 0.5)
  assert.ok(cell.peak >= cell.mean && cell.peak < 120)
  assert.ok(cell.bins > 0 && cell.bins <= 192)
})

test('temperature bounds never interpret a peak inside the interval as a thermal pass', () => {
  assert.match(thermalExceedances(310, 100, 300), /exceeds upper/)
  assert.match(thermalExceedances(90, 100, 300), /below the lower/)
  assert.match(thermalExceedances(250, 100, 300), /peak alone/)
  assert.equal(thermalExceedances(250, 300, 100), null)
})
