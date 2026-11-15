import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DEFAULT_POWER, diskVisibleFraction, integratePower, panelPowerAt, surfacePower } from '../src/services/science/solarPower.ts'
import { buildHorizon } from '../src/services/science/terrainHorizon.ts'
import { polarToLatLon, samplePolarHorizon } from '../src/services/science/lunarAssets.ts'

const HOUR = 3_600_000
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} vs ${expected}`)

test('a uniform solar disk is half visible at the terrain edge and symmetric about it', () => {
  assert.equal(diskVisibleFraction(-0.27, 0.27), 0)
  near(diskVisibleFraction(0, 0.27), 0.5)
  assert.equal(diskVisibleFraction(0.27, 0.27), 1)
  near(diskVisibleFraction(0.12, 0.27) + diskVisibleFraction(-0.12, 0.27), 1)
})

test('panel projection is physical for tracking, upright and horizontal panels', () => {
  const sun = { elevation: 0, azimuth: 90, distance: 149_597_870.7 }
  const nominal = 1361 * DEFAULT_POWER.area * DEFAULT_POWER.efficiency / 100
  near(panelPowerAt(sun, 0, DEFAULT_POWER).power, nominal / 2)
  near(panelPowerAt(sun, -1, { ...DEFAULT_POWER, orientation: 'vertical' }).power, nominal)
  assert.equal(panelPowerAt(sun, -1, { ...DEFAULT_POWER, orientation: 'vertical', azimuth: 270 }).power, 0)
  const horizonLevel = panelPowerAt(sun, 0, { ...DEFAULT_POWER, orientation: 'horizontal' })
  assert.ok(horizonLevel.power > 0 && horizonLevel.power < nominal / 100)
  near(panelPowerAt({ ...sun, distance: sun.distance * 2 }, -1, DEFAULT_POWER).power, nominal / 4)
})

test('battery caps at capacity, applies conversion losses and reports unserved energy', () => {
  const inputs = { ...DEFAULT_POWER, initial: 0, capacity: 100, load: 100, chargeEfficiency: 50, dischargeEfficiency: 50 }
  const result = integratePower(0, 3 * HOUR, inputs, time => time < HOUR ? { visible: 1, power: 400 } : { visible: 0, power: 0 })
  near(result.rows[5].batteryPercent, 100)
  near(result.generatedWh, 400)
  near(result.unservedWh, 150)
  near(result.longestDeficitHours, 2)
  near(result.longestDarkHours, 2)
  near(result.minimumPercent, 0)
})

test('partial final step is integrated and unknown terrain breaks outage and charge continuity', () => {
  const inputs = { ...DEFAULT_POWER, load: 100, capacity: 200 }
  const result = integratePower(0, HOUR + HOUR / 12, inputs,
    t => t >= HOUR / 3 && t < HOUR / 2 ? null : { visible: 0, power: 0 })
  near(result.unknownHours, 1 / 6)
  near(result.longestDeficitHours, 7 / 12)
  assert.ok(result.rows[1].batteryPercent > 0)
  assert.equal(result.minimumPercent, null)
  assert.equal(result.unservedWh, null)
  assert.equal(result.rows.at(-1).batteryPercent, null)
})

test('SPICE and LOLA assets drive seven-day energy estimates at all three study centers', () => {
  const data = JSON.parse(readFileSync(new URL('../public/lunar/ephemeris.json', import.meta.url), 'utf8'))
  const grid = readFileSync(new URL('../public/lunar/south-pole-height.f32', import.meta.url))
  const values = new Float32Array(1896 * 1896)
  for (let i = 0; i < values.length; i++) values[i] = grid.readFloatLE(i * 4)
  const raster = { width: 1896, height: 1896, values }
  const manifest = JSON.parse(readFileSync(new URL('../public/lunar/regional/manifest.json', import.meta.url), 'utf8'))
  const start = Date.parse('2027-01-15T00:00Z')
  const yields = []
  for (const { name, x, z } of manifest.sites) {
    const site = polarToLatLon(x, z)
    const horizon = buildHorizon(site.latitude, site.longitude, 2, (lat, lon) => samplePolarHorizon(raster, lat, lon))
    const result = surfacePower(data, start, start + 168 * HOUR, site, horizon, DEFAULT_POWER)
    assert.equal(result.rows.length, 1008, name)
    assert.equal(result.unknownHours, 0, name)
    assert.ok(result.generatedWh > 0 && result.minimumPercent >= 0 && result.minimumPercent <= 100, name)
    assert.ok(result.rows.every(r => r.visible >= 0 && r.visible <= 1 && r.power >= 0), name)
    yields.push(Math.round(result.generatedWh))
  }
  assert.equal(new Set(yields).size, 3)
})
