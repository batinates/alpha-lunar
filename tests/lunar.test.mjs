import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {latLonToPolar,polarToLatLon,sampleRaster,polarHeight} from '../src/services/science/lunarAssets.ts'
import {latLonToVector3,vector3ToLatLon} from '../src/lib/lunarCoordinates.ts'

test('lunar reference axes match texture registration',()=>{
  assert.deepEqual(latLonToVector3(0,0).toArray(),[0,0,1])
  assert.ok(latLonToVector3(0,90).distanceTo({x:1,y:0,z:0})<1e-12)
  for(const [lat,lon] of [[0,0],[-89.67,129.78],[-88.48,-88.34],[9.62,-20.08],[-43.31,-11.36],[30,179.99]]){
    const actual=vector3ToLatLon(latLonToVector3(lat,lon))
    assert.ok(Math.abs(actual.latitude-lat)<1e-9)
    assert.ok(Math.abs(actual.longitude-lon)<1e-9)
  }
})
test('south polar stereographic respects longitude axes and invertibility',()=>{
  assert.equal(Math.hypot(...Object.values(latLonToPolar(-90,0))),0)
  assert.ok(latLonToPolar(-89,0).z<0)
  assert.ok(latLonToPolar(-89,90).x>0)
  for(const [lat,lon] of [[-89.67,129.78],[-88.48,-88.34],[-85.28,53.27]]){
    const p=latLonToPolar(lat,lon),actual=polarToLatLon(p.x,p.z)
    assert.ok(Math.abs(lat-actual.latitude)<1e-9)
    assert.ok(Math.abs(lon-actual.longitude)<1e-9)
  }
})
test('pixel centers, longitude wrapping and missing regional coverage',()=>{
  const r={width:2,height:2,values:Float32Array.from([10,20,30,40])}
  assert.equal(sampleRaster(r,.25,.25),10)
  assert.equal(sampleRaster(r,.5,.5),25)
  assert.equal(sampleRaster(r,0,.25,true),15)
  assert.equal(sampleRaster(r,1,.25,true),15)
  assert.equal(polarHeight(r,200000,0),null)
})
test('bundled NASA derivatives agree with provenance checksums',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/lunar/manifest.json',import.meta.url)))
  for(const output of manifest.outputs){
    const buffer=readFileSync(new URL(`../public/lunar/${output.file}`,import.meta.url))
    assert.equal(buffer.byteLength,output.bytes)
    assert.equal(createHash('sha256').update(buffer).digest('hex'),output.sha256)
  }
  assert.equal(manifest.polar.sourceSpacingMeters,40)
  assert.equal(manifest.polar.spacingMeters,160)
})
