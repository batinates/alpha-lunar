/** Sampling model only: unresolved terrain between rays or outside coverage is unknown. */
export interface HorizonProfile {
  elevations: number[]; distances: number[]; observerElevation: number; mastHeight: number
  stepMeters: number; radiusMeters: number; latitude: number; longitude: number
}
const R = 1737400, DEG = Math.PI/180
export function destination(latitude:number,longitude:number,azimuth:number,distance:number) {
  // Cartesian great-circle stepping remains well defined at the pole.
  const lat=latitude*DEG,lon=longitude*DEG,a=azimuth*DEG,d=distance/R
  const up=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]
  const north=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)]
  const east=[-Math.sin(lon),Math.cos(lon),0]
  const p=up.map((v,i)=>v*Math.cos(d)+(north[i]*Math.cos(a)+east[i]*Math.sin(a))*Math.sin(d))
  return {latitude:Math.atan2(p[2],Math.hypot(p[0],p[1]))/DEG,longitude:Math.atan2(p[1],p[0])/DEG}
}
export function terrainElevationAngle(observerHeight:number,targetHeight:number,distance:number) {
  const d=distance/R, radius=R+targetHeight
  return Math.atan2(radius*Math.cos(d)-(R+observerHeight),radius*Math.sin(d))/DEG
}
export function buildHorizon(latitude:number,longitude:number,mastHeight:number,sample:(lat:number,lon:number)=>number|null):HorizonProfile {
  if(!Number.isFinite(latitude)||latitude < -90||latitude > -85||!Number.isFinite(longitude)||!Number.isFinite(mastHeight)||mastHeight<0||mastHeight>100)throw new Error('Invalid polar observer')
  const surface=sample(latitude,longitude)
  if(surface===null||!Number.isFinite(surface))throw new Error('Observer outside DEM coverage')
  const stepMeters=160,radiusMeters=100000,elevations:number[]=[],distances:number[]=[]
  for(let az=0;az<360;az++){
    let angle=-90,range=0
    for(let d=stepMeters;d<=radiusMeters;d+=stepMeters){
      const p=destination(latitude,longitude,az,d),h=sample(p.latitude,p.longitude)
      if(h===null||!Number.isFinite(h))break
      angle=Math.max(angle,terrainElevationAngle(surface+mastHeight,h,d));range=d
    }
    elevations.push(range===0?NaN:angle);distances.push(range)
  }
  return {elevations,distances,observerElevation:surface,mastHeight,stepMeters,radiusMeters,latitude,longitude}
}
export function horizonAt(profile:HorizonProfile,azimuth:number) {
  const a=((azimuth%360)+360)%360,i=Math.floor(a),next=(i+1)%360,t=a-i
  if(!Number.isFinite(profile.elevations[i])||!Number.isFinite(profile.elevations[next]))return null
  return {elevation:profile.elevations[i]*(1-t)+profile.elevations[next]*t,range:Math.min(profile.distances[i],profile.distances[next])}
}
