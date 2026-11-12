import test from 'node:test'
import assert from 'node:assert/strict'
import {buildHorizon,destination,horizonAt,terrainElevationAngle} from '../src/services/science/terrainHorizon.ts'
import {horizonAngles} from '../src/services/science/ephemeris.ts'

test('curvature matches exact equal-radius chord elevation',()=>{
 for(const distance of [160,1600,100000])assert.ok(Math.abs(terrainElevationAngle(0,0,distance)+distance/1737400*90/Math.PI)<1e-8)
 assert.ok(terrainElevationAngle(2,1000,10000)>5)
})
test('great-circle stepping is stable at south pole and wraps longitude',()=>{
 for(const az of [0,90,180,270]){
  const p=destination(-90,0,az,10000)
  assert.ok(Math.abs(p.latitude-(-90+10000/1737400*180/Math.PI))<1e-9)
  assert.ok(Math.abs(p.longitude-(az>180?az-360:az))<1e-8)
 }
})
test('flat spherical DEM recovers analytic elevated horizon dip; higher mast lowers horizon',()=>{
 const low=buildHorizon(-89,0,2,()=>0),high=buildHorizon(-89,0,10,()=>0)
 const analytic=-Math.acos(1737400/(1737400+2))*180/Math.PI
 assert.ok(Math.abs(low.elevations[0]-analytic)<.0001)
 assert.ok(high.elevations.every((v,i)=>v<low.elevations[i]))
 assert.equal(low.distances[0],100000)
 assert.deepEqual(horizonAt(low,0),horizonAt(low,360))
 assert.deepEqual(horizonAt(low,-1),horizonAt(low,359))
})
test('missing coverage is unknown rather than invented flat terrain',()=>{
 assert.throws(()=>buildHorizon(-89,0,2,()=>null),/outside/)
 const p=buildHorizon(-89,0,2,(lat,lon)=>lat===-89&&lon===0?0:null)
 assert.equal(horizonAt(p,45),null)
 assert.ok(p.distances.every(d=>d===0))
 assert.throws(()=>buildHorizon(-84,0,2,()=>0),/Invalid/)
})
test('observer height is included in topocentric parallax',()=>{
 assert.ok(horizonAngles([0,400000,0],0,0,1000).elevation<horizonAngles([0,400000,0],0,0).elevation)
})
