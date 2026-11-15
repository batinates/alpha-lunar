import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {validateEphemeris,interpolateEphemeris,horizonAngles,sceneSun} from '../src/services/science/ephemeris.ts'
const data=validateEphemeris(JSON.parse(readFileSync('public/lunar/ephemeris.json','utf8')))
test('SPICE asset integrity and sampled interpolation validation',()=>{
 const provenance=JSON.parse(readFileSync('public/lunar/ephemeris-provenance.json','utf8'))
 assert.equal(createHash('sha256').update(readFileSync('public/lunar/ephemeris.json')).digest('hex'),provenance.sha256)
 assert.ok(provenance.maxMidpointAngularErrorDeg<.001)
 assert.equal(data.rows.length,26305)
})
test('coverage includes both endpoints and rejects extrapolation',()=>{
 const start=Date.parse(data.start),end=start+(data.rows.length-1)*data.stepMs
 assert.deepEqual(interpolateEphemeris(data,start).sun,data.rows[0].slice(0,3))
 assert.deepEqual(interpolateEphemeris(data,end).earth,data.rows.at(-1).slice(3))
 assert.throws(()=>interpolateEphemeris(data,start-1),RangeError)
 assert.throws(()=>interpolateEphemeris(data,end+1),RangeError)
 assert.throws(()=>interpolateEphemeris(data,NaN),RangeError)
})
test('topocentric horizon, parallax and scene axes',()=>{
 assert.equal(horizonAngles([400000,0,0],0,0).elevation,90)
 assert.equal(horizonAngles([-400000,0,0],0,0).elevation,-90)
 assert.ok(horizonAngles([0,400000,0],0,0).elevation<0)
 assert.equal(horizonAngles([0,400000,0],0,0).azimuth,90)
 assert.deepEqual(sceneSun([1,0,0]),[0,0,1])
 assert.deepEqual(sceneSun([0,0,1]),[0,1,0])
})
