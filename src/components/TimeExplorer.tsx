import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, X } from 'lucide-react'
import { horizonAngles, interpolateEphemeris, type Ephemeris } from '../services/science/ephemeris'
import type { Coordinates } from '../domain/lunar'
import { TerrainHorizon } from './TerrainHorizon'

export function TimeExplorer({data,time,onTime,coordinates,onClose,polar}:{data:Ephemeris|null;time:number;onTime:(time:number)=>void;coordinates:Coordinates;onClose:()=>void;polar:boolean}) {
  const [playing,setPlaying]=useState(false)
  const start=data?Date.parse(data.start):0, end=data?start+(data.rows.length-1)*data.stepMs:0
  useEffect(()=>{
    if(!playing||!data)return
    const id=window.setInterval(()=>onTime(Math.min(end,time+3600000)),250)
    if(time>=end)setPlaying(false)
    return ()=>window.clearInterval(id)
  },[playing,time,data,end,onTime])
  const series=useMemo(()=>{
    if(!data)return []
    const from=Math.max(start,Math.min(time-14*86400000,end-28*86400000))
    return Array.from({length:113},(_,i)=>{
      const t=from+i*6*3600000, p=interpolateEphemeris(data,t)
      return {time:t,sun:horizonAngles(p.sun,coordinates.latitude,coordinates.longitude).elevation,earth:horizonAngles(p.earth,coordinates.latitude,coordinates.longitude).elevation}
    })
  },[data,time,start,end,coordinates.latitude,coordinates.longitude])
  const vectors=data?interpolateEphemeris(data,time):null
  const sun=vectors?horizonAngles(vectors.sun,coordinates.latitude,coordinates.longitude):null
  const earth=vectors?horizonAngles(vectors.earth,coordinates.latitude,coordinates.longitude):null
  return <section className="time-explorer" aria-label="SPICE time explorer">
    <header><div><small>PHASE 03 / GEOMETRY LAB</small><h2>Time Explorer</h2></div><button onClick={onClose} aria-label="Close time explorer"><X size={18}/></button></header>
    <p className="time-coordinate">{coordinates.latitude.toFixed(2)}° LAT / {coordinates.longitude.toFixed(2)}° LON</p>
    {!data?<p>Loading verified SPICE positions…</p>:<>
      <label className="time-date">EPOCH / UTC<input aria-label="Simulation date UTC" type="datetime-local" min={new Date(start).toISOString().slice(0,16)} max={new Date(end).toISOString().slice(0,16)} value={new Date(time).toISOString().slice(0,16)} onInput={e=>{const value=Date.parse(e.currentTarget.value+'Z');if(Number.isFinite(value))onTime(Math.max(start,Math.min(end,value)))}}/></label>
      <div className="time-transport"><button onClick={()=>onTime(Math.max(start,time-86400000))}>−1 DAY</button><button onClick={()=>setPlaying(v=>!v)} aria-label={playing?'Pause simulation':'Play simulation'}>{playing?<Pause size={14}/>:<Play size={14}/>} {playing?'PAUSE':'PLAY'}</button><button onClick={()=>onTime(Math.min(end,time+86400000))}>+1 DAY</button></div>
      <input className="time-slider" aria-label="Ephemeris timeline" type="range" min={start} max={end} step={3600000} value={time} onInput={e=>onTime(Number(e.currentTarget.value))}/>
      <div className="time-range"><span>JAN 2026</span><span>JAN 2028 · UTC</span></div>
      <div className="time-metrics">{[['SUN',sun],['EARTH',earth]].map(([label,angle])=>{const a=angle as NonNullable<typeof sun>;return <article key={label as string}><small>{label as string} / ELEVATION</small><strong>{a.elevation.toFixed(2)}°</strong><span>Az {a.azimuth.toFixed(1)}°</span><em className={a.elevation>0?'above':''}>{a.elevation>0?'CENTER ABOVE HORIZON':'CENTER BELOW HORIZON'}</em></article>})}</div>
      <div className="time-chart-label"><span>28-DAY HORIZON PROFILE</span><span><i/> SUN <i/> EARTH</span></div>
      <svg className="time-chart" viewBox="0 0 320 120" role="img" aria-label="Sun and Earth elevation over 28 days, minus 90 to plus 90 degrees">
        {[0,60,120].map(y=><line key={y} x1="0" x2="320" y1={y} y2={y} stroke="#293942" strokeDasharray="3 4"/>)}
        {(['sun','earth'] as const).map(key=><polyline key={key} fill="none" stroke={key==='sun'?'#e5bb79':'#71c5de'} strokeWidth="1.6" points={series.map((p,i)=>`${i/112*320},${60-p[key]/90*60}`).join(' ')}/>)}
        {series.length>0&&<line x1={(time-series[0].time)/(28*86400000)*320} x2={(time-series[0].time)/(28*86400000)*320} y1="0" y2="120" stroke="#fff" opacity=".5"/>}
      </svg>
      <div className="time-range"><span>+90° / 0° / −90°</span><span>{series.length?new Date(series[0].time).toISOString().slice(0,10):''} → 28d</span></div>
      <p className="time-note">SPICE · DE421 · MOON_ME_DE421<br/>The angles above use a reference sphere without terrain. {polar?'Polar terrain retains inspection lighting.':'Global sunlight follows the selected UTC epoch.'}</p>
      {coordinates.latitude<=-85?<TerrainHorizon data={data} time={time} coordinates={coordinates}/>:<p className="time-note">Select a location south of 85°S to calculate a regional terrain horizon.</p>}
      <a href="/lunar/ephemeris-provenance.json" target="_blank" rel="noreferrer">KERNEL SOURCES & VALIDATION ↗</a>
    </>}
  </section>
}
