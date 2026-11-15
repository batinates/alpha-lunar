import { useLanguage } from '../lib/i18n'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Compass, Pause, Play, X } from 'lucide-react'
import { APOLLO_MODEL_SOURCE, type LanderModel } from '../data/spacecraft'
import type { Coordinates } from '../domain/lunar'
import type { MissionProfile } from '../domain/mission'
import { descentEvidence, type MissionReportInput, type SearchEvidence } from '../domain/missionReport'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { loadHeightRaster, type HeightRaster } from '../services/science/lunarAssets'
import type { Ephemeris } from '../services/science/ephemeris'
import { touchdownCoordinates } from '../services/science/touchdownSky'
import { DEFAULT_DESCENT, DESCENT_FIELDS, GRAVITY, validDescent, type DescentRequest, type DescentScenario, type DescentSettings } from '../services/science/descent'
import type { LandingOption } from '../services/science/landingOptimization'
import { SceneBoundary } from './SceneBoundary'
import { TouchdownSkyView } from './TouchdownSkyView'

export type DescentView = 'simulation' | 'risk'
const DescentScene = lazy(() => import('./DescentScene').then(module => ({ default: module.DescentScene })))
const percent = (count: number, total: number) => `${(100 * count / total).toFixed(1)}%`

interface Props {
  view: DescentView | null
  coordinates: Coordinates
  name: string
  time: number
  ephemeris: Ephemeris | null
  ephemerisError: string
  lightAngle: number
  profile: MissionProfile
  candidate: LandingOption | null
  search?: SearchEvidence
  onReport: (input: MissionReportInput) => void
  onView: (view: DescentView | null) => void
  seed?: { settings: DescentSettings; scenarios: DescentScenario[]; vehicle: LanderModel }
}

function RiskRegister({ scenario, candidate, profile }: {
  scenario: DescentScenario; candidate: LandingOption | null; profile: MissionProfile
}) {
  const { t } = useLanguage()
  const counts = scenario.counts
  const sampleTotal = scenario.points.length
  const register = [
    ['Terrain contact', percent(counts.terrain, sampleTotal), 'High', 'Coarse terrain sampling', 'Review the approach corridor using higher-resolution terrain.'],
    ['Touchdown slope / roughness', `${percent(counts.slope, sampleTotal)} / ${percent(counts.roughness, sampleTotal)}`, 'High', 'Regional LOLA estimates', 'Inspect the touchdown region for unresolved obstacles.'],
    ['Landing geometry', percent(counts.footprint, sampleTotal), 'High', 'Assumed navigation dispersion', 'Compare a smaller dispersion assumption or a different site.'],
    ['Thrust demand', percent(counts.thrust, sampleTotal), 'High', 'Constant-mass model', 'Check thrust margin with a vehicle-specific trajectory model.'],
    ['Illumination', candidate ? `${candidate.sunPercent.toFixed(0)}% clear samples` : 'Unknown', 'Mission-dependent', 'Sampled Sun center geometry', 'Evaluate power, storage and eclipse exposure.'],
    ['Earth visibility', candidate ? `${candidate.earthPercent.toFixed(0)}% clear samples` : 'Unknown', 'Mission-dependent', 'Sampled Earth center geometry', 'Validate the communications link and relay coverage.'],
    ['Thermal exposure', candidate?.peak == null ? 'Unknown' : `${candidate.peak.toFixed(1)} K surface peak`, 'Mission-dependent', 'Diviner climatology', profile.maxSurfacePeak ? `Compare model peak with ${profile.maxSurfacePeak} K screening limit and assess hardware temperatures.` : 'Define a thermal limit and assess hardware temperatures.'],
    ['Data uncertainty', percent(counts.unknown, sampleTotal), 'High', 'Unresolved trials without a known failure', 'Use local terrain and independently verified navigation inputs.'],
    ['Resource access', candidate?.coldDistanceKm == null ? 'Unknown' : `${candidate.coldDistanceKm.toFixed(1)} km to modeled cold trap`, 'Objective-dependent', 'Modeled proximity', 'Verify traversability and surface evidence.'],
  ]
  return <section aria-labelledby="risk-register">
    <h3 id="risk-register">{t('Risk register')}</h3>
    <p>{t('Observed rates apply to the selected scenario model. Risk categories may overlap. Environmental entries reflect the original screened arrival and stay.')}</p>
    <div className="risk-table-wrap"><table className="risk-table">
      <thead><tr><th scope="col">{t('Risk')}</th><th scope="col">{t('Model evidence')}</th><th scope="col">{t('Consequence severity')}</th><th scope="col">{t('Evidence quality')}</th><th scope="col">{t('Mitigation')}</th></tr></thead>
      <tbody>{register.map(([name, evidence, severity, quality, mitigation]) =>
        <tr key={name}><th scope="row">{t(name)}</th><td>{t(evidence)}</td><td>{t(severity)}</td><td>{t(quality)}</td><td>{t(mitigation)}</td></tr>)}</tbody>
    </table></div>
  </section>
}

export function DescentLab({ view, coordinates, name, time, ephemeris, ephemerisError, lightAngle, profile, candidate, search, onReport, onView, seed }: Props) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const worker = useRef<Worker | null>(null)
  const [settings, setSettings] = useState(seed?.settings ?? DEFAULT_DESCENT)
  const [raster, setRaster] = useState<HeightRaster | null>(null)
  const [result, setResult] = useState<{ key: string; scenarios: DescentScenario[] } | null>(null)
  const [selected, setSelected] = useState(0)
  const [frame, setFrame] = useState(0)
  const [vehicle, setVehicle] = useState<LanderModel>(seed?.vehicle ?? 'apollo')
  const [cameraMode, setCameraMode] = useState<'overview' | 'follow'>('overview')
  const [relief, setRelief] = useState(1)
  const [magnified, setMagnified] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [surfaceSky, setSurfaceSky] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const request: DescentRequest = { coordinates, settings, massKg: profile.massKg, squareMeters: profile.footprintMeters,
    slopeLimit: profile.maxSlope, roughnessLimit: profile.maxRoughness }
  const key = JSON.stringify({ request, time })
  const scenarios = result?.key === key ? result.scenarios : result === null && !busy && settings === seed?.settings ? seed.scenarios : null
  const scenario = scenarios?.[selected]
  const touchdown = scenario?.path.at(-1)
  const landed = !!scenario && frame === scenario.path.length - 1
  const showSky = surfaceSky && landed && !!touchdown

  useEffect(() => {
    const element = dialog.current
    if (view && !element?.open) element?.showModal()
    if (!view && element?.open) element.close()
  }, [view])
  useEffect(() => () => worker.current?.terminate(), [])
  useEffect(() => {
    if (!seed) return
    let cancelled = false
    loadHeightRaster('south-pole').then(value => { if (!cancelled) setRaster(value) })
      .catch(() => { if (!cancelled) setError('Terrain could not be loaded. Run the simulation again to retry.') })
    return () => { cancelled = true }
  }, [seed])
  useEffect(() => {
    if (!playing || !scenario || view !== 'simulation') return
    const timer = window.setTimeout(() => {
      if (frame >= scenario.path.length - 1) { setPlaying(false); setSurfaceSky(true) }
      else setFrame(frame + 1)
    }, 70)
    return () => window.clearTimeout(timer)
  }, [playing, scenario, view, frame])

  function cancelRun() {
    worker.current?.terminate()
    worker.current = null
    setBusy(false)
  }

  function close() {
    if (busy) cancelRun()
    setPlaying(false)
    setSurfaceSky(false)
    onView(null)
  }

  function run(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setPlaying(false)
    setSurfaceSky(false)
    setFrame(0)
    setSelected(0)
    setResult(null)
    if (!validDescent(request)) {
      setError('Choose a coordinate between 85°S and 90°S and complete the vehicle and descent parameters.')
      return
    }
    setBusy(true)
    try {
      const job = new Worker(new URL('../services/science/descent.worker.ts', import.meta.url), { type: 'module' })
      worker.current = job
      function finish(message: string, data?: DescentScenario[]) {
        if (worker.current !== job) return
        job.terminate()
        worker.current = null
        setBusy(false)
        setError(message)
        if (data) setResult({ key, scenarios: data })
      }
      job.onmessage = async ({ data }: MessageEvent<{ error?: string; scenarios?: DescentScenario[] }>) => {
        if (data.error || !data.scenarios) return finish(data.error || 'Simulation returned no scenarios.')
        try {
          const dem = await loadHeightRaster('south-pole')
          if (worker.current !== job) return
          setRaster(dem)
          finish('', data.scenarios)
        } catch {
          finish('Terrain could not be loaded. Run the simulation again to retry.')
        }
      }
      job.onerror = () => finish('The simulation worker stopped. Run it again to retry.')
      job.postMessage(request)
    } catch {
      worker.current?.terminate()
      worker.current = null
      setBusy(false)
      setError('The browser could not start the simulation.')
    }
  }

  return <dialog className="mission-dialog descent-dialog" ref={dialog} aria-labelledby="descent-title"
    onCancel={event => { event.preventDefault(); close() }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <div className="mission-shell">
      <header className="mission-header"><div><div className="location-index">{t('SOUTH POLE · DESCENT STUDY')}</div>
        <h2 id="descent-title">{view === 'risk' ? t('Risk Assessment') : t('Landing Simulation')}</h2></div>
        <button className="icon-button" aria-label={t('Close descent lab')} onClick={close}><X size={18} /></button>
      </header>
      <nav className="mission-tabs" aria-label={t('Descent lab')}>
        <button className="analysis-action" aria-pressed={view === 'simulation'} onClick={() => onView('simulation')}>{t('Trajectory')}</button>
        <button className="analysis-action" aria-pressed={view === 'risk'} onClick={() => { setPlaying(false); onView('risk') }}>{t('Risk & scenarios')}</button>
      </nav>
      <div className="mission-body">
        <div className="mission-profile-line"><strong>{t(name)} · {t(profile.spacecraft)}</strong><span>{formatLatitude(coordinates.latitude)} / {formatLongitude(coordinates.longitude)} · {new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC · {profile.massKg} kg · {profile.footprintMeters} {t('m screening square')}</span></div>
        <p>{t('Constant-mass braking model with sampled LOLA terrain. Trajectories, scatter rates and alternatives support comparative screening.')}</p>
        {view === 'simulation' && !showSky && <div className="mission-fields spacecraft-controls">
          <label>{t('Spacecraft model')}<select value={vehicle} onChange={event => setVehicle(event.target.value as LanderModel)}>
            <option value="apollo">{t('Apollo Lunar Module')}</option><option value="rocket">{t('Concept rocket lander')}</option>
          </select></label>
          <label>{t('Camera')}<select value={cameraMode} onChange={event => setCameraMode(event.target.value as typeof cameraMode)}>
            <option value="follow">{t('Follow spacecraft')}</option><option value="overview">{t('Trajectory overview')}</option>
          </select></label>
          <label>{t('Vehicle scale')}<select value={magnified ? 'expanded' : 'relative'} onChange={event => setMagnified(event.target.value === 'expanded')}>
            <option value="relative">{t('Approximate vehicle scale')}</option><option value="expanded">{t('8× for inspection')}</option>
          </select></label>
          <label>{t('Terrain relief')}<select value={relief} onChange={event => setRelief(Number(event.target.value))}>
            <option value={1}>{t('1× actual scale')}</option><option value={2}>{t('2× relief')}</option><option value={3}>{t('3× relief')}</option>
          </select></label>
          <p>{vehicle === 'apollo' ? <a href={APOLLO_MODEL_SOURCE} target="_blank" rel="noreferrer">{t('NASA / Michael D. Carbajal model ↗')}</a> : t('Concept vehicle model')} {t('· Mission profile supplies the flight parameters.')}</p>
        </div>}
        <form onSubmit={run}>
          <details open={!scenarios || view === 'simulation'} className="mission-candidate">
            <summary><strong>{t('Descent parameters')}</strong></summary>
            <div className="mission-fields">{Object.entries(DESCENT_FIELDS).map(([field, rule]) => {
              const key = field as keyof DescentSettings
              return <label key={field}>{t(rule.label)}<input type="number" required min={rule.min} max={rule.max} step={rule.step}
                value={Number.isFinite(settings[key]) ? settings[key] : ''} disabled={busy}
                onChange={event => { setPlaying(false); setError(''); setSettings({ ...settings, [key]: event.target.valueAsNumber }) }} /></label>
            })}</div>
            {profile.massKg * GRAVITY / 1000 > settings.thrustKN && <p>{t('Available thrust is below the modeled lunar hover requirement for this mass.')}</p>}
          </details>
          <div className="mission-actions"><button className="analysis-action mission-primary" disabled={busy}>{busy ? t('Running scenarios…') : t('Run simulation')}</button>
            {busy && <button type="button" className="analysis-action" onClick={cancelRun}>{t('Cancel simulation')}</button>}</div>
        </form>
        {busy && <p role="status">{t('Sampling trajectory and touchdown variations for three scenarios.')}</p>}
        {error && <p role="alert" className="analysis-result caution">{t(error)}</p>}
        {!scenario && view === 'risk' && <p>{t('Run the simulation to populate the comparison and risk register.')}</p>}
        {scenario && scenarios && <>
          <label className="descent-select">{t('Scenario')}<select value={selected} onChange={event => {
            setSelected(Number(event.target.value)); setFrame(0); setPlaying(false); setSurfaceSky(false)
          }}>{scenarios.map((item, index) => <option key={item.name} value={index}>{t(item.name)}</option>)}</select></label>
          <button className="analysis-action" onClick={() => {
            setPlaying(false)
            onReport({ profile, candidate, search, name, time, coordinates, descent: descentEvidence(scenarios, scenario.name) })
          }}>{t('Create report')}</button>
          {view === 'simulation' && raster && <>
            {showSky && touchdown ? <TouchdownSkyView key={key + selected} raster={raster} ephemeris={ephemeris} ephemerisError={ephemerisError}
              time={time} point={touchdownCoordinates(touchdown.x, touchdown.z, coordinates)} onReturn={() => setSurfaceSky(false)} />
              : <SceneBoundary><Suspense fallback={<p role="status">{t('Loading 3D terrain…')}</p>}>
              <DescentScene scenario={scenario} raster={raster} frame={frame} square={profile.footprintMeters} vehicle={vehicle} cameraMode={cameraMode} magnified={magnified} lightAngle={lightAngle} siteName={t(name)} relief={relief} />
            </Suspense></SceneBoundary>}
            {!showSky && cameraMode === 'overview' && <div className="descent-legend"><span>{t('● Within modeled limits')}</span><span>{t('● Limit exceeded')}</span><span>{t('● Unresolved')}</span><span>{t('◯ Input 95% ellipse')}</span><span>{t('□ Screening square')}</span></div>}
            <div className="descent-transport">
              <button type="button" className="analysis-action" onClick={() => {
                if (frame >= scenario.path.length - 1) setFrame(0)
                setSurfaceSky(false)
                setPlaying(!playing)
              }}>{playing ? <Pause size={14} /> : <Play size={14} />}{playing ? t('Pause descent') : t('Play descent')}</button>
              <input aria-label={t('Descent timeline')} type="range" min={0} max={scenario.path.length - 1} value={frame} onChange={event => {
                setPlaying(false); setSurfaceSky(false); setFrame(Number(event.target.value))
              }} />
              <output>{scenario.path[frame].time.toFixed(1)} s · {scenario.path[frame].speed.toFixed(1)} m/s</output>
              <button type="button" className="analysis-action" onClick={() => {
                setPlaying(false)
                setSurfaceSky(false)
                setFrame(scenario.path.length - 1)
                setCameraMode('follow')
              }}>{t('Inspect touchdown')}</button>
              {landed && !showSky && <button type="button" className="analysis-action" onClick={() => {
                setPlaying(false)
                setSurfaceSky(true)
              }}><Compass size={15} />{t('Touchdown sky')}</button>}
            </div>
            <div className="mission-metrics">
              <span>{t('Touchdown target')} <b>{t(name)}</b></span>
              <span>{t('Exact target coordinates')} <b>{coordinates.latitude.toFixed(6)}°, {coordinates.longitude.toFixed(6)}°</b></span>
              <span>{t('Target elevation')} <b>{scenario.path.at(-1)!.y.toFixed(1)} m</b></span>
              <span>{t('Modeled duration')} <b>{scenario.nominal.duration.toFixed(1)} s</b></span>
              <span>{t('Required / available thrust')} <b>{scenario.nominal.thrustKN.toFixed(2)} / {scenario.settings.thrustKN.toFixed(2)} kN</b></span>
              <span>{t('Height above terrain at cursor')} <b>{scenario.path[frame].ground === null ? t('Unknown') : `${(scenario.path[frame].y - scenario.path[frame].ground!).toFixed(1)} m`}</b></span>
              <span>{t('Velocity at cursor')} <b>{scenario.path[frame].speed.toFixed(1)} m/s</b></span>
              <span>{t('Nominal thrust axis tilt from vertical')} <b>{(Math.atan2(
                scenario.settings.speed * Math.cos(scenario.settings.angle * Math.PI / 180) / scenario.nominal.duration,
                1.62 + scenario.settings.speed * Math.sin(scenario.settings.angle * Math.PI / 180) / scenario.nominal.duration
              ) * 180 / Math.PI).toFixed(1)}{t('° opposite travel')}</b></span>
              <span>{t('Minimum sampled approach clearance')} <b>{scenario.nominal.clearance == null ? t('Unknown') : `${scenario.nominal.clearance.toFixed(1)} m`}</b></span>
              <span>{t('Nominal touchdown slope')} <b>{scenario.nominal.touchdownSlope == null ? t('Unknown') : `${scenario.nominal.touchdownSlope.toFixed(1)}°`}</b></span>
            </div>
          </>}
          {view === 'risk' && <>
            <h3>{t('Scenario comparison')}</h3>
            <div className="risk-table-wrap"><table className="risk-table">
              <thead><tr><th scope="col">{t('Scenario')}</th><th scope="col">{t('Within modeled limits')}</th><th scope="col">{t('Exceeded')}</th><th scope="col">{t('Unresolved')}</th></tr></thead>
              <tbody>{scenarios.map(item => <tr key={item.name}><th scope="row">{t(item.name)}</th>
                <td>{percent(item.counts.within, item.points.length)}</td><td>{percent(item.counts.exceeded, item.points.length)}</td>
                <td>{percent(item.counts.unknown, item.points.length)}</td></tr>)}</tbody>
            </table></div>
            <p>{scenario.points.length} {t('trials per scenario · seed')} {scenario.settings.seed}{t('. Each case uses the same Gaussian draws to isolate the effect of the changed assumptions.')}</p>
            <RiskRegister scenario={scenario} candidate={candidate} profile={profile} />
          </>}
          <p>{t('The 160 m DEM smooths vehicle-scale obstacles. Terrain and approach are sampled. The phase omits guidance, propellant consumption, engine transients and flight validation.')}</p>
        </>}
      </div>
    </div>
  </dialog>
}
