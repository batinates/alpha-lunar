import { useLanguage } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Coordinates } from '../domain/lunar'
import type { Ephemeris } from '../services/science/ephemeris'
import type { HorizonProfile } from '../services/science/terrainHorizon'
import { earthLinkAt, HOUR, LINK_FIELDS, linkWindows, validLink, type LinkInputs } from '../services/science/earthLink'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { DsnWindows } from './DsnWindows'

const utc = (time: number) => new Date(time).toISOString().slice(0, 16).replace('T', ' ')
const labels = ['Meets modeled limits', 'Below sensitivity', 'Blocked by terrain', 'Unknown terrain']

export function EarthCommunication({ data, error, coordinates, time, onTime, initialHeight, onClose }: {
  data: Ephemeris | null; error: string; coordinates: Coordinates; time: number; onTime: (time: number) => void
  initialHeight: number; onClose: () => void
}) {
  const { t } = useLanguage()
  const [inputs, setInputs] = useState(() => Object.fromEntries(Object.entries(LINK_FIELDS).map(([key, field]) => [key, field.value])) as LinkInputs)
  const [height, setHeight] = useState(initialHeight)
  const [days, setDays] = useState(7)
  const [mode, setMode] = useState<'earth' | 'dsn'>('earth')
  const [retry, setRetry] = useState(0)
  const { latitude, longitude } = coordinates
  const key = `${latitude}/${longitude}/${height}/${retry}`
  const polar = latitude <= -85
  const validHeight = Number.isFinite(height) && height >= 0 && height <= 100
  const [terrain, setTerrain] = useState<{ key: string; profile?: HorizonProfile; error?: string } | null>(null)
  useEffect(() => {
    if (!polar || !validHeight) return
    let worker: Worker
    try {
      worker = new Worker(new URL('../services/science/horizon.worker.ts', import.meta.url), { type: 'module' })
    } catch {
      setTerrain({ key, error: 'The terrain horizon could not be computed.' })
      return
    }
    worker.onmessage = event => setTerrain({ key, ...event.data })
    worker.onerror = () => setTerrain({ key, error: 'The terrain horizon could not be computed.' })
    worker.postMessage({ id: 1, latitude, longitude, mastHeight: height })
    return () => worker.terminate()
  }, [key, polar, validHeight, latitude, longitude, height])

  const profile = terrain?.key === key && polar && validHeight ? terrain.profile ?? null : null
  const terrainError = terrain?.key === key ? terrain?.error : undefined
  const start = data ? Date.parse(data.start) : 0
  const end = data ? start + (data.rows.length - 1) * data.stepMs : 0
  const first = Math.floor(Math.max(start, Math.min(time, end - days * 24 * HOUR)) / HOUR) * HOUR
  const valid = validLink(inputs)
  const samples = useMemo(() => data && valid && validHeight ? Array.from({ length: days * 24 + 1 }, (_, index) =>
    earthLinkAt(data, first + index * HOUR, { latitude, longitude }, profile, inputs, height)) : [],
  [data, valid, validHeight, days, first, latitude, longitude, profile, inputs, height])
  const current = data && valid && validHeight ? earthLinkAt(data, time, coordinates, profile, inputs, height) : null
  const windows = linkWindows(samples)
  const csv = () => {
    const rows = samples.map(row => [new Date(row.time).toISOString(), latitude, longitude, height, row.elevation,
      row.azimuth, row.distance, row.clearance ?? '', row.loss, row.received, row.margin, row.status,
      inputs.frequency, inputs.power, inputs.transmitGain, inputs.receiveGain, inputs.losses, inputs.sensitivity].join(','))
    const heading = 'utc,latitude_deg,longitude_deg,observer_height_m,earth_elevation_deg,earth_azimuth_deg,distance_km,terrain_clearance_deg,path_loss_db,received_dbm,margin_db,status,frequency_ghz,power_w,tx_gain_dbi,rx_gain_dbi,other_losses_db,sensitivity_dbm'
    const url = URL.createObjectURL(new Blob([[heading, ...rows].join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'alpha-lunar-earth-link.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="time-explorer earth-link" aria-label={t('Earth Communication')}>
    <header><div><small>{t('DIRECT-TO-EARTH ANALYSIS')}</small><h2>{t('Earth Communication')}</h2></div>
      <button aria-label={t('Close Earth Communication')} onClick={onClose}><X size={18} /></button></header>
    <p>{formatLatitude(latitude)} · {formatLongitude(longitude)}</p>
    <div className="mission-tabs" aria-label={t('Earth communication mode')}>
      <button aria-pressed={mode === 'earth'} onClick={() => setMode('earth')}>{t('Earth center')}</button>
      <button aria-pressed={mode === 'dsn'} onClick={() => setMode('dsn')}>{t('DSN stations')}</button>
    </div>
    {error && <p role="alert">{t(error)}</p>}
    {!data && !error && <p role="status">{t('Loading SPICE ephemeris…')}</p>}
    {data && <label className="time-date">{t('Epoch (UTC)')}<input type="datetime-local" value={new Date(time).toISOString().slice(0, 16)}
      min={new Date(start).toISOString().slice(0, 16)} max={new Date(end).toISOString().slice(0, 16)}
      onChange={event => { const value = Date.parse(event.target.value + 'Z'); if (Number.isFinite(value)) onTime(Math.max(start, Math.min(end, value))) }} /></label>}
    <div className="mission-fields mission-date">
      <label>{t('Observer height (m)')}<input type="number" min="0" max="100" step=".1" value={Number.isFinite(height) ? height : ''} onChange={e => setHeight(e.target.valueAsNumber)} /></label>
      <label>{t('Sample range')}<select value={days} onChange={e => setDays(Number(e.target.value))}><option value="1">{t('24 hours')}</option><option value="7">{t('7 days')}</option><option value="28">{t('28 days')}</option></select></label>
      {Object.entries(LINK_FIELDS).map(([key, field]) => <label key={key}>{t(field.label)}
        <input type="number" min={field.min} max={field.max} step={field.step}
          value={Number.isFinite(inputs[key as keyof LinkInputs]) ? inputs[key as keyof LinkInputs] : ''}
          onChange={e => setInputs(previous => ({ ...previous, [key]: e.target.valueAsNumber }))} /></label>)}
    </div>
    {terrainError && <p role="alert">{terrainError} <button onClick={() => setRetry(value => value + 1)}>{t('Retry')}</button></p>}
    {!polar && <p>{t('Select a location from 85°S to 90°S to include the lunar terrain horizon.')}</p>}
    {polar && validHeight && !profile && !terrainError && <p role="status">{t('Computing regional terrain horizon…')}</p>}
    {(!valid || !validHeight) && <p role="alert">{t('Enter values within the displayed field ranges.')}</p>}
    {mode === 'dsn' && data && current && <DsnWindows data={data} coordinates={coordinates} profile={profile} height={height}
      radio={inputs} time={time} first={first} end={first + days * 24 * HOUR} />}
    {mode === 'earth' && current && <>
      <div className="mission-metrics">
        <span>{t('Earth center')} <b>{current.elevation.toFixed(2)}° el. · {current.azimuth.toFixed(2)}° az.</b></span>
        <span>{t('Range')} <b>{Math.round(current.distance).toLocaleString()} km</b></span>
        <span>{t('Free-space loss')} <b>{current.loss.toFixed(1)} dB</b></span>
        <span>{t('Received power / margin')} <b>{current.received.toFixed(1)} dBm / {current.margin.toFixed(1)} dB</b></span>
      </div>
      <p className="analysis-result" role="status">{t(current.status)}{current.clearance === null ? '' : ` · ${current.clearance.toFixed(2)}° terrain clearance`}</p>
      <h3>{t('Hourly link screening')}</h3>
      <div className="link-strip" aria-hidden="true">{samples.map(row =>
        <i key={row.time} className={`link-state-${labels.indexOf(row.status)}`} />)}</div>
      <ul className="link-legend">{labels.map((label, index) => <li key={label}><i className={`link-state-${index}`} />{label} · {samples.filter(row => row.status === label).length}</li>)}</ul>
      <details className="mission-candidate"><summary>{t('Sample windows (UTC)')}</summary>
        <ul className="mission-rejections">{windows.map(window => <li key={window.start}>{utc(window.start)} → {utc(window.end)} · {t(window.status)} ({window.count})</li>)}</ul>
      </details>
      <button onClick={csv} disabled={polar && !profile && !terrainError}>{t('Download hourly CSV')}</button>
    </>}
    {mode === 'earth' && <p className="time-note">{t('Earth center with a sampled 100 km local horizon. Window boundaries are hourly samples.')}</p>}
    <a href="https://www.itu.int/rec/R-REC-P.525-5-202411-I/en" target="_blank" rel="noreferrer">{t('ITU-R P.525 · free-space attenuation ↗')}</a>
  </section>
}
