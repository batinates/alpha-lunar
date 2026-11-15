import { useLanguage } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Crosshair, Rocket, Settings2, X } from 'lucide-react'
import { ARTEMIS, LIMITS, MISSION_TYPES, PRIORITIES, ROBOTIC, readMissions, validMission, writeMissions, type MissionProfile } from '../domain/mission'
import type { Coordinates } from '../domain/lunar'
import type { MissionReportInput, SearchEvidence } from '../domain/missionReport'
import { SOUTH_POLE_FEATURES } from '../data/lunarFeatures'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { candidateSites, HOUR, priorityWeights, type LandingOption, type SearchResult } from '../services/science/landingOptimization'
import type { LandingMessage } from '../services/science/landing.worker'

export type MissionView = 'configure' | 'optimize'

const NUMERIC_FIELDS: [keyof typeof LIMITS, string, number][] = [
  ['crew', 'Crew size', 1], ['massKg', 'Landing mass (kg)', 1],
  ['durationHours', 'Surface duration (h)', 1], ['footprintMeters', 'Regional screening square (m)', 1],
  ['maxSlope', 'Maximum slope (°)', .1], ['maxRoughness', 'Maximum RMS roughness (m)', .1],
  ['mastHeight', 'Observer height (m)', .1], ['minSunPercent', 'Minimum clear Sun samples (%)', 1],
  ['minEarthPercent', 'Minimum clear Earth samples (%)', 1], ['maxSurfacePeak', 'Maximum modeled peak (K, 0 disables)', 1],
]
const OBJECTIVE_LABELS = ['Terrain', 'Sun clearance', 'Earth clearance', 'Cold-trap proximity']
const EPHEMERIS_FIRST = Date.parse('2026-01-01T00:00Z')
const EPHEMERIS_LAST = Date.parse('2029-01-01T00:00Z')
const dateInput = (time: number) => new Date(time).toISOString().slice(0, 16)
const utc = (time: number) => dateInput(time).replace('T', ' ') + ' UTC'

function LandingDetails({ option, onLocate, onPower, onSimulate, onReport }: { option: LandingOption; onLocate: (option: LandingOption) => void; onPower: (option: LandingOption) => void; onSimulate: (option: LandingOption) => void; onReport: (option: LandingOption) => void }) {
  const { t } = useLanguage()
  const angle = (value: number | null) => value === null ? 'unknown' : `${value.toFixed(2)}°`
  return <>
    <div className="mission-option-meta">{formatLatitude(option.site.latitude)} · {formatLongitude(option.site.longitude)} · {utc(option.time)}</div>
    <div className="mission-metrics">
      <span>{t('Terrain')} <b>{option.slope.toFixed(1)}° / {option.roughness.toFixed(1)} m RMS</b></span>
      <span>{t('Clear Sun samples')} <b>{option.sunPercent.toFixed(0)}% ({option.sunUnknown} unknown)</b></span>
      <span>{t('Clear Earth samples')} <b>{option.earthPercent.toFixed(0)}% ({option.earthUnknown} unknown)</b></span>
      <span>{t('Arrival clearance')} <b>{t('Sun')} {angle(option.sunClearance)} / Earth {angle(option.earthClearance)}</b></span>
      <span>{t('Diviner surface peak')} <b>{option.peak === null ? 'unknown' : `${option.peak.toFixed(1)} K`} · {option.bins ?? 'unknown'} {t('source bins')}</b></span>
      <span>{t('Modeled cold trap')} <b>{option.coldDistanceKm === null ? 'None resolved within 10 km' : `${option.coldDistanceKm.toFixed(1)} km projected`}</b></span>
    </div>
    <div className="mission-actions">
      <button className="analysis-action" onClick={() => onLocate(option)}><Crosshair size={14} /> {t('Inspect arrival on map')}</button>
      <button className="analysis-action" onClick={() => onPower(option)}>{t('Estimate surface power')}</button>
      <button className="analysis-action" onClick={() => onSimulate(option)}><Rocket size={14} /> {t('Simulate descent')}</button>
      <button className="analysis-action" onClick={() => onReport(option)}>{t('Create report')}</button>
    </div>
  </>
}

interface Props {
  view: MissionView | null
  profile: MissionProfile
  onProfile: (profile: MissionProfile) => void
  onView: (view: MissionView | null) => void
  coordinates: Coordinates
  locationName?: string
  time: number
  onLocate: (option: LandingOption) => void
  onPower: (option: LandingOption, profile: MissionProfile) => void
  onCompare: (options: LandingOption[], profile: MissionProfile) => void
  onSimulate: (option: LandingOption, profile: MissionProfile, search: SearchEvidence) => void
  onReport: (input: MissionReportInput) => void
}

export function MissionPlanner({ view, profile, onProfile, onView, coordinates, locationName, time, onLocate, onPower, onCompare, onSimulate, onReport }: Props) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const worker = useRef<Worker | null>(null)
  const [saved, setSaved] = useState(readMissions)
  const [saveMessage, setSaveMessage] = useState('')
  const [date, setDate] = useState<{ first?: string; last?: string }>({})
  const [run, setRun] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<(SearchEvidence & { profile: MissionProfile }) | null>(null)
  const [error, setError] = useState('')
  const lastPossible = EPHEMERIS_LAST - profile.durationHours * HOUR
  const start = Number.isFinite(lastPossible) ? Math.max(EPHEMERIS_FIRST, Math.min(Math.floor(time / HOUR) * HOUR, lastPossible)) : EPHEMERIS_FIRST
  const firstDate = date.first ?? dateInput(start)
  const lastDate = date.last ?? dateInput(Math.min(start + 14 * 24 * HOUR, Math.max(EPHEMERIS_FIRST, lastPossible || EPHEMERIS_LAST)))
  const valid = validMission(profile)
  const weights = priorityWeights(profile.priority)

  useEffect(() => {
    const element = dialog.current
    if (view && !element?.open) element?.showModal()
    if (!view && element?.open) element.close()
  }, [view])

  useEffect(() => () => worker.current?.terminate(), [])

  function cancelRun() {
    worker.current?.terminate()
    worker.current = null
    setRun(null)
  }

  function updateProfile(next: MissionProfile) {
    cancelRun()
    setResult(null)
    setError('')
    setSaveMessage('')
    onProfile(next)
  }

  function saveProfile() {
    if (!valid) return
    const id = saved.some(p => p.id === profile.id) ? profile.id : crypto.randomUUID()
    const next = { ...profile, id, name: profile.name.trim(), spacecraft: profile.spacecraft.trim() }
    try {
      const profiles = [...saved.filter(p => p.id !== id), next]
      writeMissions(profiles)
      setSaved(profiles)
      onProfile(next)
      setSaveMessage('Profile saved in this browser.')
    } catch {
      setSaveMessage('This browser did not allow saving the profile.')
    }
  }

  function deleteProfile() {
    try {
      const profiles = saved.filter(item => item.id !== profile.id)
      writeMissions(profiles)
      setSaved(profiles)
      updateProfile(ROBOTIC)
      setSaveMessage('Saved profile removed.')
    } catch {
      setSaveMessage('This browser did not allow removing the profile.')
    }
  }

  function startSearch(event: React.FormEvent) {
    event.preventDefault()
    const first = Date.parse(firstDate + 'Z')
    const last = Date.parse(lastDate + 'Z')
    setResult(null)
    if (!valid || !Number.isFinite(first) || !Number.isFinite(last) ||
        first % HOUR !== 0 || last % HOUR !== 0 || first < EPHEMERIS_FIRST ||
        last < first || last - first > 28 * 24 * HOUR || last > lastPossible) {
      setError('Use whole UTC hours, a span up to 28 days and an arrival range whose full surface stay fits in 2026–2028 SPICE coverage.')
      return
    }
    const sites = candidateSites(coordinates, SOUTH_POLE_FEATURES)
    if (locationName) sites[0] = { ...sites[0], name: locationName }
    setError('')
    cancelRun()
    try {
      const job = new Worker(new URL('../services/science/landing.worker.ts', import.meta.url), { type: 'module' })
      worker.current = job
      setRun({ done: 0, total: sites.length })
      job.onmessage = (event: MessageEvent<LandingMessage>) => {
        if (worker.current !== job) return
        const message = event.data
        if (message.type === 'progress') setRun({ done: message.done, total: sites.length })
        else {
          cancelRun()
          if (message.type === 'result') setResult({ data: message.result, profile, first, last, sites: sites.length, from: coordinates })
          else setError(message.message)
        }
      }
      job.onerror = () => {
        if (worker.current !== job) return
        cancelRun()
        setError('Landing search stopped unexpectedly. Run the search again.')
      }
      job.postMessage({ profile, first, last, sites })
    } catch {
      cancelRun()
      setError('The browser could not start the landing search.')
    }
  }

  function details(option: LandingOption, { profile, ...search }: SearchEvidence & { profile: MissionProfile }) {
    return <LandingDetails option={option} onLocate={onLocate} onPower={() => onPower(option, profile)}
      onSimulate={() => onSimulate(option, profile, search)}
      onReport={() => onReport({ profile, search, name: option.site.name, coordinates: option.site, time: option.time, candidate: option })} />
  }

  return <dialog className="mission-dialog" ref={dialog} aria-labelledby="mission-title"
    onCancel={event => { event.preventDefault(); onView(null) }}
    onClick={event => { if (event.target === event.currentTarget) onView(null) }}>
    <div className="mission-shell">
      <header className="mission-header">
        <div><div className="location-index">{profile.artemis ? 'ARTEMIS MODE · CREWED STUDY' : 'SOUTH POLE MISSION PLANNING'}</div>
          <h2 id="mission-title">{view === 'configure' ? t('Mission Configuration') : t('Landing Optimization')}</h2></div>
        <button className="icon-button" aria-label={t('Close mission planner')} onClick={() => onView(null)}><X size={18} /></button>
      </header>
      <nav className="mission-tabs" aria-label={t('Mission planner')}>
        <button className="analysis-action" aria-pressed={view === 'configure'} onClick={() => onView('configure')}><Settings2 size={15} /> {t('Profiles')}</button>
        <button className="analysis-action" aria-pressed={view === 'optimize'} onClick={() => onView('optimize')}><Rocket size={15} /> {t('Landing search')}</button>
      </nav>
      {view === 'configure' && <form className="mission-body" onSubmit={event => { event.preventDefault(); saveProfile() }}>
        <div className="mission-presets">
          <button type="button" className="analysis-action" onClick={() => updateProfile(ROBOTIC)}>{t('Robotic template')}</button>
          <button type="button" className="analysis-action" onClick={() => updateProfile(ARTEMIS)}>{t('Artemis Mode')}</button>
          {saved.length > 0 && <label>{t('Saved profiles')}<select value={saved.some(item => item.id === profile.id) ? profile.id : ''}
            onChange={event => { const config = saved.find(item => item.id === event.target.value); if (config) updateProfile(config) }}>
            <option value="" disabled>{t('Load a profile')}</option>
            {saved.map(item => <option key={item.id} value={item.id}>{t(item.name)} · {t(item.spacecraft)}</option>)}
          </select></label>}
        </div>
        {profile.artemis && <p>{t('Artemis study template with conservative crewed screening targets. Vehicle values are editable study assumptions.')} <a href="https://www.nasa.gov/mission/artemis-iv/" target="_blank" rel="noreferrer">{t('NASA Artemis context ↗')}</a></p>}
        <div className="mission-fields">
          <label>{t('Mission name')}<input required maxLength={80} value={t(profile.name)} onChange={e => updateProfile({ ...profile, name: e.target.value })} /></label>
          <label>{t('Spacecraft')}<input required maxLength={80} value={t(profile.spacecraft)} onChange={e => updateProfile({ ...profile, spacecraft: e.target.value })} /></label>
          <label>{t('Mission type')}<select value={profile.type} onChange={e => {
            const type = e.target.value as MissionProfile['type']
            updateProfile({ ...profile, type, artemis: profile.artemis && type === 'Crewed landing' })
          }}>{MISSION_TYPES.map(type => <option key={type} value={type}>{t(type)}</option>)}</select></label>
          <label>{t('Priority')}<select value={profile.priority} onChange={e => updateProfile({ ...profile, priority: e.target.value as MissionProfile['priority'] })}>
            {PRIORITIES.map(priority => <option key={priority} value={priority}>{t(priority)}</option>)}
          </select></label>
          {NUMERIC_FIELDS.map(([key, label, step]) => <label key={key}>{t(label)}
            <input required type="number" min={LIMITS[key][0]} max={LIMITS[key][1]} step={step}
              value={Number.isFinite(profile[key]) ? profile[key] : ''} onChange={e => updateProfile({ ...profile, [key]: e.target.valueAsNumber })} />
          </label>)}
        </div>
        <p>{t('The regional screening square describes the area checked in LOLA terrain. Crew and mass describe the vehicle for comparison. The optimizer applies the terrain, observer, time and environmental limits.')}</p>
        <div className="mission-actions">
          <button type="submit" className="analysis-action" disabled={!valid}>{t('Save profile')}</button>
          {saved.some(item => item.id === profile.id) && <button type="button" className="analysis-action" onClick={deleteProfile}>{t('Delete saved profile')}</button>}
          <button type="button" className="analysis-action mission-primary" disabled={!valid} onClick={() => onView('optimize')}>{t('Open landing search')}</button>
        </div>
        <p role="status">{t(saveMessage)}</p>
      </form>}
      {view === 'optimize' && <div className="mission-body">
        <div className="mission-profile-line"><strong>{t(profile.name)}</strong><span>{t(profile.spacecraft)} · {profile.durationHours} {t('h surface stay ·')} {t(profile.priority)}</span></div>
        <p>{t('Score weights ·')} {weights.map((weight, index) => `${OBJECTIVE_LABELS[index]} ${Math.round(weight * 100)}%`).join(' · ')}</p>
        <form onSubmit={startSearch}>
          <div className="mission-fields mission-date">
            <label>{t('First arrival (UTC)')}<input type="datetime-local" required step={3600} value={firstDate}
              onChange={e => { setDate({ first: e.target.value, last: lastDate }); setResult(null) }} disabled={!!run} /></label>
            <label>{t('Last arrival (UTC)')}<input type="datetime-local" required step={3600} value={lastDate}
              onChange={e => { setDate({ first: firstDate, last: e.target.value }); setResult(null) }} disabled={!!run} /></label>
          </div>
          <p>Searches {locationName ?? 'the selected coordinate'}{t(', indexed landmarks and a 20 km polar grid. Arrivals are sampled every 6 h and conditions every 1 h over the planned stay.')}</p>
          <div className="mission-actions">
            <button className="analysis-action mission-primary" disabled={!valid || !!run}><Rocket size={15} /> {t('Run landing search')}</button>
            {run && <button type="button" className="analysis-action" onClick={cancelRun}>{t('Cancel search')}</button>}
          </div>
        </form>
        {!valid && <p role="alert">{t('Complete the mission profile before starting a search.')}</p>}
        {run && <div className="mission-progress" role="status"><progress value={run.done} max={run.total} /> {t('Screened')} {run.done} / {run.total} {t('locations')}</div>}
        {error && <p className="analysis-result caution" role="alert">{t(error)}</p>}
        {result && <div className="mission-results">
          <div className="mission-result-heading"><h3>{t('Landing search results')}</h3><span>{result.data.passed} / {result.data.screened} {t('arrivals meet the sampled limits ·')} {result.data.paretoCount} {t('on the Pareto front')}</span></div>
          {result.data.best.length ? <>
            <button className="analysis-action mission-primary" onClick={() => onCompare(
              [...result.data.best, ...result.data.byObjective.filter(option => option !== null)], result.profile
            )}>{t('Compare landing candidates')}</button>
            <h4>{t('Ranked options')}</h4>
            {result.data.best.map((option, index) => <details className="mission-candidate" key={option.site.id + option.time} open={index === 0 ? true : undefined}>
              <summary><strong>{index + 1}. {option.site.name}</strong><span>{utc(option.time)} · {(option.score * 100).toFixed(0)} / 100{option.pareto ? ' · Pareto' : ''}</span></summary>
              {details(option, result)}
            </details>)}
            <h4>{t('Leaders by objective')}</h4>
            {result.data.byObjective.map((option, index) => option && <details className="mission-candidate" key={OBJECTIVE_LABELS[index]}>
              <summary><strong>{t(OBJECTIVE_LABELS[index])}</strong><span>{index === 3 && option.coldDistanceKm === null ? t('No cold trap resolved') : t(option.site.name)}</span></summary>
              {details(option, result)}
            </details>)}
          </> : <><p className="analysis-result caution">{t('No arrivals meet all selected screening limits in the sampled search.')}</p>
            <button className="analysis-action" onClick={() => {
              const { profile, ...search } = result
              onReport({ profile, search, name: 'South Pole search', coordinates: search.from, time: search.first, candidate: null })
            }}>{t('Create report')}</button></>}
          {!!result.data.rejected.length && <details className="mission-candidate">
            <summary><strong>{t('Rejected locations and arrivals')}</strong><span>{result.data.screened - result.data.passed} arrivals</span></summary>
            <ul className="mission-rejections">{result.data.rejected.map(item => <li key={item.site.id + item.reason}>
              <strong>{t(item.site.name)}</strong> · {t(item.reason)} · {item.count} {t(item.count === 1 ? 'arrival' : 'arrivals')} · {t('first')} {utc(item.time)}
            </li>)}</ul>
          </details>}
          <p>{result.profile.name} used a {result.profile.footprintMeters} {t('m screening square and a')} {result.profile.durationHours} {t('h surface stay. Unknown terrain directions reduce the clear-sample counts. Geometry covers a sampled 100 km horizon. Power, radio availability, ice access and vehicle-scale hazards require separate evaluation.')}</p>
        </div>}
      </div>}
    </div>
  </dialog>
}
