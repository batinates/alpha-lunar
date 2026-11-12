export type XYZ = [number, number, number]
export interface Ephemeris { start: string; stepMs: number; frame: string; correction: string; units: string; rows: number[][] }
export function validateEphemeris(value: Ephemeris): Ephemeris {
  if (value.frame !== 'MOON_ME_DE421' || value.units !== 'km' || value.correction !== 'NONE' || !Number.isFinite(Date.parse(value.start)) || value.stepMs !== 3600000 || !Array.isArray(value.rows) || value.rows.length < 2 || value.rows.some(row => row.length !== 6 || row.some(n => !Number.isFinite(n)))) throw new Error('Invalid SPICE ephemeris asset')
  return value
}
export function interpolateEphemeris(data: Ephemeris, time: number) {
  const t = (time - Date.parse(data.start)) / data.stepMs
  if (!Number.isFinite(t) || t < 0 || t > data.rows.length - 1) throw new RangeError('Time outside ephemeris coverage')
  const index = Math.min(Math.floor(t), data.rows.length - 2), fraction = t-index
  const values = data.rows[index].map((v,i) => v+(data.rows[index+1][i]-v)*fraction)
  return { sun: values.slice(0,3) as XYZ, earth: values.slice(3,6) as XYZ }
}
/** Geometric center elevation above a spherical local horizon; no terrain, refraction, eclipse or light-time. */
export function horizonAngles(position: XYZ, latitude: number, longitude: number, observerHeightMeters=0) {
  const lat=latitude*Math.PI/180, lon=longitude*Math.PI/180
  const up=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)]
  const relative=position.map((v,i)=>v-(1737.4+observerHeightMeters/1000)*up[i]), distance=Math.hypot(...relative)
  const dot=(v:number[])=>v.reduce((sum,x,i)=>sum+x*relative[i],0)
  const east=dot([-Math.sin(lon),Math.cos(lon),0]), north=dot([-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)])
  return { elevation:Math.asin(Math.max(-1,Math.min(1,dot(up)/distance)))*180/Math.PI, azimuth:(Math.atan2(east,north)*180/Math.PI+360)%360, distance }
}
/** Body-fixed X/Y/Z → scene Z/X/Y. */
export function sceneSun(position: XYZ): XYZ {
  const length=Math.hypot(...position)
  return [position[1]/length,position[2]/length,position[0]/length]
}
