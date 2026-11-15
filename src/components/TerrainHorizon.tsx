import { useLanguage } from '../lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from '../services/science/ephemeris'
import { horizonAt, type HorizonProfile } from '../services/science/terrainHorizon'
import type { Coordinates } from '../domain/lunar'

export function TerrainHorizon({data,time,coordinates,initialMastHeight=2}:{data:Ephemeris;time:number;coordinates:Coordinates;initialMastHeight?:number}){
  const { t } = useLanguage()
  const [mast,setMast]=useState(initialMastHeight),[retry,setRetry]=useState(0)
  const [result,setResult]=useState<{key:string;profile?:HorizonProfile;error?:string}|null>(null)
  const worker=useRef<Worker|null>(null),request=useRef(0)
  const key=`${coordinates.latitude}/${coordinates.longitude}/${mast}/${retry}`
  useEffect(()=>{
    const instance=new Worker(new URL('../services/science/horizon.worker.ts',import.meta.url),{type:'module'})
    worker.current=instance
    return ()=>{instance.terminate();worker.current=null}
  },[retry])
  useEffect(()=>{
    const id=++request.current,w=worker.current
    if(!w)return
    w.onmessage=e=>{if(e.data.id===request.current)setResult({key,...e.data})}
    w.onerror=()=>setResult({key,error:'Terrain worker unavailable'})
    w.postMessage({id,...coordinates,mastHeight:mast})
  },[key,coordinates.latitude,coordinates.longitude,mast])
  const profile=result?.key===key?result.profile:undefined
  const error=result?.key===key?result.error:undefined
  const positions=interpolateEphemeris(data,time)
  const readings=profile?(['sun','earth'] as const).map(body=>{
    const angle=horizonAngles(positions[body],coordinates.latitude,coordinates.longitude,profile.observerElevation+mast)
    const horizon=horizonAt(profile,angle.azimuth)
    return {body,...angle,horizon,clearance:horizon?angle.elevation-horizon.elevation:null}
  }):[]
  const summary=useMemo(()=>{
    if(!profile)return null
    const start=Date.parse(data.start),end=start+(data.rows.length-1)*data.stepMs
    const from=Math.max(start,Math.min(Math.floor(time/86400000)*86400000,end-28*86400000))
    let sun=0,earth=0,known=0
    for(let i=0;i<672;i++){
      const p=interpolateEphemeris(data,from+(i+.5)*3600000)
      const angles=([p.sun,p.earth]).map(v=>horizonAngles(v,coordinates.latitude,coordinates.longitude,profile.observerElevation+mast))
      const horizons=angles.map(a=>horizonAt(profile,a.azimuth))
      if(horizons.some(h=>!h))continue
      known++
      if(angles[0].elevation>horizons[0]!.elevation)sun++
      if(angles[1].elevation>horizons[1]!.elevation)earth++
    }
    return {from,sun,earth,known}
  },[profile,data,Math.floor(time/86400000),coordinates.latitude,coordinates.longitude,mast])
  const values=profile?.elevations.filter(Number.isFinite)??[]
  const min=Math.min(-2,...values,...readings.map(r=>r.elevation)),max=Math.max(5,...values,...readings.map(r=>r.elevation))
  const y=(value:number)=>110-(value-min)/(max-min)*100
  return <section className="terrain-horizon" aria-label={t('Terrain horizon analysis')}>
    <div className="horizon-title"><div><small>{t('LOLA / REGIONAL RAY SAMPLING')}</small><h3>{t('Terrain horizon')}</h3></div><span>{t('PREVIEW')}</span></div>
    <label className="horizon-height">{t('Observer above DEM')}<select aria-label={t('Observer height')} value={mast} onChange={e=>setMast(Number(e.target.value))}>{[...new Set([2,5,10,initialMastHeight])].sort((a,b)=>a-b).map(height=><option key={height} value={height}>{height} m</option>)}</select></label>
    {error?<p role="alert">{t(error)} <button onClick={()=>setRetry(v=>v+1)}>{t('Retry')}</button></p>:!profile?<p role="status">{t('Tracing 360 directions across the polar DEM…')}</p>:<>
      <svg viewBox="0 0 320 130" className="horizon-chart" role="img" aria-label={t('Terrain horizon by azimuth with Sun and Earth centers')}>
        <line x1="0" x2="320" y1={y(0)} y2={y(0)} stroke="#627a86" strokeDasharray="3 4"/>
        {profile.elevations.map((v,i)=>Number.isFinite(v)?<line key={i} x1={i/360*320} x2={i/360*320} y1={y(v)} y2="115" stroke="#365967"/>:null)}
        {readings.map(r=><circle key={r.body} cx={r.azimuth/360*320} cy={y(r.elevation)} r="4" fill={r.body==='sun'?'#efc17d':'#83d9ee'}/>)}
        <text x="3" y="10">{max.toFixed(1)}°</text><text x="3" y="126">{min.toFixed(1)}°</text>
      </svg>
      <div className="time-range"><span>N 0°</span><span>E 90°</span><span>S 180°</span><span>W 270°</span><span>360°</span></div>
      {readings.map(r=><div key={r.body} className="horizon-reading"><strong>{r.body==='sun'?'☀ SUN':'◉ EARTH'}</strong><span>{r.clearance===null?'NO COVERAGE':`${r.clearance>=0?'+':''}${r.clearance.toFixed(2)}° clearance`}</span><small>{r.clearance===null?'Unknown horizon':r.clearance<=0?'CENTER BLOCKED BY SAMPLED TERRAIN':'CENTER ABOVE SAMPLED TERRAIN'} · {r.horizon?(r.horizon.range/1000).toFixed(1):'0'} {t('km scan')}</small></div>)}
      {summary&&<div className="horizon-summary"><strong>{t('28-DAY SAMPLED CENTER CLEARANCE')}</strong><p>{t('Sun')} {summary.known?(summary.sun/summary.known*100).toFixed(1):'—'}% · Earth {summary.known?(summary.earth/summary.known*100).toFixed(1):'—'}%</p><small>{new Date(summary.from).toISOString().slice(0,10)} UTC · {summary.known}{t('/672 hourly midpoints')}</small></div>}
      <p className="time-note">{t('160 m DEM · 1° rays · 160 m steps · up to 100 km. Spherical curvature and observer height included; visual terrain exaggeration has no effect. Coverage ends at the raster boundary. Unresolved ridges, terrain beyond the scan, finite disks and eclipses are excluded. Clearance percentages are regional sample estimates, not sunlight hours or communication availability.')}</p>
      <a href="/lunar/manifest.json" target="_blank" rel="noreferrer">{t('DEM SOURCE & RESOLUTION ↗')}</a>
    </>}
  </section>
}
