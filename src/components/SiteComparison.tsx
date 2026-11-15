import { useLanguage } from '../lib/i18n'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { coordinateKey, DEFAULT_LINK, type CompareSite } from '../services/science/siteComparison'
import { HOUR, LINK_FIELDS, validLink } from '../services/science/earthLink'
import { DEFAULT_POWER, POWER_FIELDS, validPower } from '../services/science/solarPower'
import type { ComparisonMessage, ComparisonRequest, ComparisonResult } from '../services/science/comparison.worker'
import { ARTEMIS_DATA_SOURCES, regions2024, type ArtemisSurfaceMission } from '../data/artemis'

const firstTime = Date.parse('2026-01-01T00:00Z'), lastTime = Date.parse('2029-01-01T00:00Z')
const utc = (t: number) => new Date(t).toISOString().slice(0, 16)
const fmt = (n: number | null, unit = '', digits = 1) => n === null ? 'Unavailable' : n.toLocaleString(undefined, { maximumFractionDigits: digits }) + unit
const linkColors: Record<string, string> = { 'Meets modeled limits': '#7ac6a6', 'Blocked by terrain': '#ce846f', 'Below sensitivity': '#e8bf79', 'Unknown terrain': '#566977' }
const stationColors = { ...linkColors, 'Blocked by lunar terrain': '#ce846f', 'Below station mask': '#527fa4', 'Unknown lunar terrain': '#566977' }
type Result = Extract<ComparisonResult, { result: unknown }>['result']
export type ComparisonSeed = { options: CompareSite[]; selection: string[]; time: number; hours: number; height: number; artemis?: { mission: ArtemisSurfaceMission; lander: string } }

function HorizonChart({ result, index, lo, hi }: { result: Result; index: number; lo: number; hi: number }) {
  const { t } = useLanguage()
  const { horizon, rows } = result, active = rows[index]
  const y = (e: number) => 8 + 76 * (hi - e) / (hi - lo)
  return <figure className="compare-figure"><figcaption>{t('Terrain horizon · elevation')} {lo}° to {hi}°</figcaption>
    <svg viewBox="0 0 360 93" role="img" aria-label={`Terrain horizon, elevation ${lo} to ${hi} degrees; Sun and Earth at the selected time`}>
      <path d={`M0,${y(0)}H360`} stroke="#35505c" strokeDasharray="4 4" />
      {horizon.elevations.map((value, az) => {
        const next = (az + 1) % 360, edge = horizon.elevations[next]
        return Number.isFinite(value) && Number.isFinite(edge) && <path key={az} d={`M${az},${y(value)}L${az + 1},${y(edge)}`}
          stroke={Math.min(horizon.distances[az], horizon.distances[next]) + horizon.stepMeters > horizon.radiusMeters ? '#8eb3cb' : '#657884'} strokeWidth="1.8" />
      })}
      <circle cx={active.sun.azimuth} cy={y(active.sun.elevation)} r="4" fill="#efc781" />
      <circle cx={active.radio.azimuth} cy={y(active.radio.elevation)} r="4" fill="#77c6f0" />
    </svg>
    <div className="compare-labels"><span>0° N</span><span>90° E</span><span>180° S</span><span>270° W</span><span>360° N</span></div>
    <div className="compare-labels"><span>{t('Sun')} {fmt(active.sun.elevation, '°', 2)} el.</span><span>{t('Earth')} {fmt(active.radio.elevation, '°', 2)} el.</span></div>
  </figure>
}

function HistoryChart({ result, settings, index, maxPower }: { result: Result; settings: ComparisonRequest; index: number; maxPower: number }) {
  const { t } = useLanguage()
  const x = (t: number) => 360 * (t - settings.first) / (settings.end - settings.first)
  const watts = (n: number) => 5 + 38 * (1 - n / maxPower)
  const charge = (n: number) => 53 + 40 * (1 - n / 100)
  const row = result.rows[index]
  const { batteryPath, powerPath, visibilityPaths } = useMemo(() => {
    let previous = settings.power.initial
    const visibilityPaths = { sun: '', earth: '', unknown: '' }
    for (const sample of result.rows) {
      const left = x(sample.from), right = x(sample.to)
      if (sample.visible === null) visibilityPaths.unknown += `M${left},103.5H${right}`
      else if (sample.visible > 0) visibilityPaths.sun += `M${left},103.5H${right}`
      if (sample.radio.clearance === null) visibilityPaths.unknown += `M${left},117.5H${right}`
      else if (sample.radio.clearance > 0) visibilityPaths.earth += `M${left},117.5H${right}`
    }
    return {
      visibilityPaths,
      batteryPath: result.rows.flatMap(r => {
        if (r.batteryPercent === null) return []
        const segment = `M${x(r.from)},${charge(previous)}L${x(r.to)},${charge(r.batteryPercent)}`
        previous = r.batteryPercent
        return [segment]
      }).join(' '),
      powerPath: result.rows.flatMap(r => r.power === null ? [] : [`M${x(r.from)},${watts(r.power)}H${x(r.to)}`]).join(' '),
    }
  }, [result, settings, maxPower])
  return <figure className="compare-figure"><figcaption>{t('Panel output (0–')}{fmt(maxPower, ' W', 0)}{t(') · Battery (0–100%) · Sun · Earth · Radio')}</figcaption>
    <svg viewBox="0 0 360 139" role="img" aria-label={t('Shared UTC timeline for panel output, battery charge, solar disk visibility, geometric Earth-center visibility and radio link. Dashed line is load.')}>
      <path d={`M0,${watts(settings.power.load)}H360 M0,93H360`} stroke="#7f9aa7" strokeDasharray="4 4" />
      <path fill="none" stroke="#efc781" strokeWidth="1.6" d={powerPath} />
      <path fill="none" stroke="#76d4d8" strokeWidth="1.6" d={batteryPath} />
      <g fill="none" strokeWidth="9">
        <path d="M0,103.5H360 M0,117.5H360" stroke="#1e303c" />
        <path d={visibilityPaths.sun} stroke="#efc781" />
        <path d={visibilityPaths.earth} stroke="#77c6f0" />
        <path d={visibilityPaths.unknown} stroke="#566977" />
      </g>
      {result.windows.map(w => <rect key={w.from} x={x(w.from)} width={x(w.to) - x(w.from)} y="127" height="9" fill={linkColors[w.status]} />)}
      <path d={`M${x((row.from + row.to) / 2)},0V138`} stroke="#f7f5ee" opacity=".8" />
    </svg>
    <div className="compare-labels"><span>{t('Solar disk')} {fmt(row.visible === null ? null : row.visible * 100, '%')}</span><span>{t('Panel')} {fmt(row.power, ' W')}</span><span>{t('End charge')} {fmt(row.batteryPercent, '%')}</span></div>
    <div className="compare-labels"><span>{t('Geometric Earth center ·')} {row.radio.clearance === null ? t('Unavailable') : row.radio.clearance > 0 ? t('Above terrain') : t('Below terrain')}</span></div>
    <p className="compare-status" style={{ color: linkColors[row.radio.status] }}>{t('Modeled radio ·')} {t(row.radio.status)} · {fmt(row.radio.margin, ' dB')}</p>
    {result.stationTime.map(({ station, hours }, index) => {
      const segments: { from: number; to: number; status: string }[] = []
      for (const r of result.rows) {
        const status = r.stations[index].status
        const prior = segments.at(-1)
        if (prior?.status === status) prior.to = r.to
        else segments.push({ from: r.from, to: r.to, status })
      }
      return <div key={station.id}>
        <div className="compare-labels"><strong>{station.name}</strong><span>{fmt(hours, ' h')} {t('within link limits')}</span></div>
        <div className="dsn-strip" aria-hidden="true">{segments.map(segment =>
          <i key={segment.from} style={{ width: (x(segment.to) - x(segment.from)) / 3.6 + '%', background: stationColors[segment.status as keyof typeof stationColors] }} />
        )}</div>
        <p className="compare-status">{t(row.stations[index].status)} · {fmt(row.stations[index].margin, ' dB')}</p>
      </div>
    })}
    {result.networkHours !== null && <p>{fmt(result.networkHours, ' h')} {t('with at least one station within modeled limits. Antenna allocation unverified.')}</p>}
    {result.networkHours === null && <p>{t('DSN orientation unavailable. Run the comparison again to retry.')}</p>}
  </figure>
}

export function SiteComparison({ seed, onClose, onReport }: { seed: ComparisonSeed; onClose: () => void;
  onReport: (settings: ComparisonRequest, results: ComparisonResult[]) => void
}) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const job = useRef<Worker | null>(null)
  const serial = useRef(0)
  const [selected, setSelected] = useState(seed.selection)
  const [start, setStart] = useState(utc(Math.max(firstTime, Math.min(seed.time, lastTime - seed.hours * HOUR))))
  const [hours, setHours] = useState(seed.hours)
  const [height, setHeight] = useState(seed.height)
  const [power, setPower] = useState(DEFAULT_POWER)
  const [link, setLink] = useState(DEFAULT_LINK)
  const [stationMask, setStationMask] = useState(10)
  const [radius, setRadius] = useState(150000)
  const [study, setStudy] = useState<{ settings: ComparisonRequest; results: ComparisonResult[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState(0)
  const first = Date.parse(start + 'Z'), end = first + hours * HOUR
  const sites = selected.flatMap(id => seed.options.filter(site => site.id === id))
  const valid = sites.length >= 2 && sites.length <= 3 && new Set(sites.map(coordinateKey)).size === sites.length &&
    Number.isFinite(first) && first >= firstTime && end <= lastTime && Number.isInteger(hours) && hours >= 1 && hours <= 672 &&
    Number.isFinite(height) && height >= 0 && height <= 100 && validPower(power) && validLink(link) && stationMask >= 0 && stationMask <= 90
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
    return () => { job.current?.terminate(); job.current = null }
  }, [])
  function run(event: React.FormEvent) {
    event.preventDefault()
    if (!valid || busy) return
    setError('')
    setStudy(null)
    setBusy(true)
    const settings = { id: ++serial.current, sites, height, first, end, power, link, stationMask, radius }
    try {
      if (!job.current) job.current = new Worker(new URL('../services/science/comparison.worker.ts', import.meta.url), { type: 'module' })
      const worker = job.current
      worker.onmessage = ({ data }: MessageEvent<ComparisonMessage>) => {
        if (data.id !== serial.current) return
        setBusy(false)
        if ('error' in data) setError(data.error)
        else { setStudy({ settings, results: data.results }); setCursor(0) }
      }
      worker.onerror = () => {
        worker.terminate(); job.current = null; setBusy(false); setError('Comparison stopped. Run it again to retry.')
      }
      worker.postMessage(settings)
    } catch { setBusy(false); setError('Could not start the comparison.') }
  }
  const successful = useMemo(() => study?.results.flatMap(entry => 'result' in entry ? [entry.result] : []) ?? [], [study])
  const sample = successful[0]?.rows[cursor]
  const { maxPower, lo, hi } = useMemo(() => {
    const maxPower = successful.reduce((max, item) => item.rows.reduce((m, r) => Math.max(m, r.power ?? 0), max), study?.settings.power.load ?? 0)
    const elevations = successful.flatMap(r => [...r.horizon.elevations.filter(Number.isFinite), ...r.rows.flatMap(s => [s.sun.elevation, s.radio.elevation])])
    const lo = Math.floor(Math.min(0, ...elevations))
    return { maxPower, lo, hi: Math.max(lo + 1, Math.ceil(Math.max(0, ...elevations))) }
  }, [successful, study])
  const csv = () => {
    if (!study || !successful.length) return
    const { settings } = study
    const evidence = seed.artemis ? ARTEMIS_DATA_SOURCES.map(source => `${source.label} · ${source.name} · ${source.detail} · ${new URL(source.href, location.origin).href}`).join(' | ') : ''
    const powerFields = Object.keys(POWER_FIELDS) as (keyof typeof POWER_FIELDS)[]
    const linkFields = Object.keys(LINK_FIELDS) as (keyof typeof LINK_FIELDS)[]
    const rows = [['site', 'latitude_deg', 'longitude_deg', 'from_utc', 'to_utc', 'panel_w', 'solar_disk_fraction', 'end_charge_pct',
      'link_status', 'margin_db', 'sun_az_deg', 'sun_el_deg', 'earth_az_deg', 'earth_el_deg', 'observer_height_m', 'orientation',
      ...powerFields.map(key => 'power_' + key), ...linkFields.map(key => 'radio_' + key), 'horizon_radius_m', 'station_mask_deg',
      'dss14_status', 'dss14_margin_db', 'dss63_status', 'dss63_margin_db', 'dss43_status', 'dss43_margin_db', 'earth_center_clearance_deg',
      ...(seed.artemis ? ['mission', 'study_assumption', 'historical_site_source', 'elevation_m', 'slope_deg', 'diviner_mean_k', 'diviner_peak_k', 'modeled_shadow_fraction', 'sources_and_coverage'] : [])],
      ...study.results.flatMap(entry => {
        if ('error' in entry) return []
        const { result: r, environment } = entry
        const surfaceEvidence = seed.artemis ? [seed.artemis.mission, seed.artemis.lander, regions2024,
          environment?.elevation ?? 'Unavailable', environment?.slope ?? 'Unavailable', environment?.thermal?.mean ?? 'Unavailable',
          environment?.thermal?.peak ?? 'Unavailable', environment?.thermal?.shadowFraction ?? 'Unavailable', evidence] : []
        return r.rows.map(row => [r.site.name, r.site.latitude, r.site.longitude, new Date(row.from).toISOString(), new Date(row.to).toISOString(),
        row.power, row.visible, row.batteryPercent, row.radio.status, row.radio.margin, row.sun.azimuth, row.sun.elevation,
        row.radio.azimuth, row.radio.elevation, settings.height, settings.power.orientation,
        ...powerFields.map(key => key === 'azimuth' && settings.power.orientation !== 'vertical' ? '' : settings.power[key]),
        ...linkFields.map(key => settings.link[key]), r.horizon.radiusMeters, settings.stationMask,
        ...[0, 1, 2].flatMap(index => [row.stations[index]?.status, row.stations[index]?.margin]), row.radio.clearance ?? 'Unavailable',
        ...surfaceEvidence])
      })]
    const contents = rows.map(r => r.map(v => typeof v === 'string' ? '"' + v.replaceAll('"', '""') + '"' : v ?? '').join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'alpha-lunar-site-comparison.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <dialog ref={dialog} className="mission-dialog compare-dialog" aria-labelledby="compare-title" onCancel={e => { e.preventDefault(); onClose() }}>
    <header className="mission-header"><div><div className="location-index">{t('SURFACE TRADE STUDY')}</div><h2 id="compare-title">{t('Site Comparison')}</h2></div>
      <button className="icon-button" aria-label={t('Close Site Comparison')} onClick={onClose}><X size={18} /></button></header>
    <div className="mission-body">
      <p>{t('Compare')} {seed.artemis ? t('two') : t('two or three')} {t('distinct locations over one UTC window with shared power and radio settings.')}</p>
      {seed.artemis && <p><strong>Artemis {seed.artemis.mission} {t('· Historical NASA study areas · 2024')}</strong><br />
        {t('Study assumption ·')} {t(seed.artemis.lander)} {t('· Region centroids and editable UTC arrival, battery and radio settings.')}</p>}
      <form onSubmit={run} onChange={() => { setStudy(null); setError('') }}>
        <fieldset disabled={busy} className="compare-fields">
          <legend>{t('Common study inputs')}</legend>
          <div className="mission-fields">
            {selected.map((id, index) => <label key={index}>{t('Site')} {index + 1}<select value={id} onChange={e => setSelected(selected.map((value, n) => n === index ? e.target.value : value))}>
              {seed.options.map(site => <option key={site.id} value={site.id} disabled={sites.some((other, n) => index !== n && coordinateKey(site) === coordinateKey(other))}>
                {t(site.name)}{site.arrival === undefined ? '' : ' · ' + utc(site.arrival).replace('T', ' ')}
              </option>)}
            </select></label>)}
            <label>{t('Start (UTC)')}<input type="datetime-local" required value={start} min={utc(firstTime)} max={utc(lastTime)} onChange={e => setStart(e.target.value)} /></label>
            <label>{t('Duration (h)')}<input type="number" required min="1" max="672" value={Number.isFinite(hours) ? hours : ''} onChange={e => setHours(e.target.valueAsNumber)} /></label>
            <label>{t('Mast height (m)')}<input type="number" required min="0" max="100" step="any" value={Number.isFinite(height) ? height : ''} onChange={e => setHeight(e.target.valueAsNumber)} /></label>
            <label>{t('Horizon distance')}<select value={radius} onChange={e => setRadius(+e.target.value)}><option value={150000}>150 km</option><option value={300000}>300 km</option></select></label>
          </div>
          <div className="mission-actions">
            {!seed.artemis && (selected.length === 3 ? <button type="button" className="analysis-action" onClick={() => { setSelected(selected.slice(0, 2)); setStudy(null) }}>{t('Remove third site')}</button>
              : <button type="button" className="analysis-action" disabled={!seed.options.some(s => !sites.some(p => coordinateKey(s) === coordinateKey(p)))}
                onClick={() => { const next = seed.options.find(s => !sites.some(p => coordinateKey(s) === coordinateKey(p))); if (next) { setSelected([...selected, next.id]); setStudy(null) } }}>{t('Add third site')}</button>)}
          </div>
          <details className="mission-candidate"><summary>{t('Shared panel and battery settings')}</summary><div className="mission-fields">
            <label>{t('Panel orientation')}<select value={power.orientation} onChange={e => setPower({ ...power, orientation: e.target.value as typeof power.orientation })}>
              <option value="tracking">{t('Ideal Sun tracking')}</option><option value="horizontal">{t('Fixed horizontal')}</option><option value="vertical">{t('Fixed vertical')}</option>
            </select></label>
            {Object.entries(POWER_FIELDS).map(([raw, field]) => {
              const key = raw as keyof typeof POWER_FIELDS
              return (key !== 'azimuth' || power.orientation === 'vertical') && <label key={key}>{t(field.label)}<input type="number" min={field.min} max={field.max} step="any"
                value={Number.isFinite(power[key]) ? power[key] : ''} onChange={e => setPower({ ...power, [key]: e.target.valueAsNumber })} /></label>
            })}
          </div></details>
          <details className="mission-candidate"><summary>{t('Shared Earth radio settings')}</summary><div className="mission-fields">
            <label>{t('Minimum station elevation (°)')}<input type="number" min="0" max="90" step="any" value={Number.isFinite(stationMask) ? stationMask : ''}
              onChange={e => setStationMask(e.target.valueAsNumber)} /></label>
            {Object.entries(LINK_FIELDS).map(([raw, field]) => {
              const key = raw as keyof typeof LINK_FIELDS
              return <label key={key}>{t(field.label)}<input type="number" min={field.min} max={field.max} step="any"
                value={Number.isFinite(link[key]) ? link[key] : ''} onChange={e => setLink({ ...link, [key]: e.target.valueAsNumber })} /></label>
            })}
          </div></details>
        </fieldset>
        <button type="submit" className="analysis-action mission-primary" disabled={!valid || busy}>{t('Run site comparison')}</button>
        {!valid && <p role="status">{t('Choose distinct sites and valid settings. The full 1–672 h stay must fit within 2026–2028 SPICE coverage.')}</p>}
      </form>
      {busy && <p role="status">{t('Computing terrain and operations windows…')}</p>}
      {error && <p role="alert">{t(error)}</p>}
      {study && <section aria-label={t('Site comparison results')}>
        {sample && <div className="compare-cursor"><label>{t('Shared UTC cursor ·')} {utc((sample.from + sample.to) / 2).replace('T', ' ')} UTC
          <input className="time-slider" type="range" min="0" max={successful[0].rows.length - 1} value={cursor} onChange={e => setCursor(Number(e.target.value))} /></label>
          <button className="analysis-action" onClick={csv}>{t('Download comparison CSV')}</button>
          {seed.artemis && <button className="analysis-action" onClick={() => onReport(study.settings, study.results)}>{t('Save comparison report')}</button>}</div>}
        <div className="compare-grid" style={{ gridTemplateColumns: `repeat(${study.results.length}, minmax(250px, 1fr))` }}>
          {study.results.map(entry => <article key={entry.site.id} className="compare-card">
            <h3>{t(entry.site.name)}</h3>
            <p>{formatLatitude(entry.site.latitude)} · {formatLongitude(entry.site.longitude)}</p>
            {entry.site.arrival !== undefined && <p>{t('Search arrival:')} {utc(entry.site.arrival).replace('T', ' ')} UTC</p>}
            {'error' in entry ? <p role="alert">{t(entry.error)}</p> : <>
              <div className="mission-metrics">
                <span>{t('LOLA elevation')}<b>{fmt(entry.environment?.elevation ?? null, ' m')}</b></span>
                <span>{t('LOLA neighborhood slope')}<b>{entry.environment?.slope == null ? t('Unavailable') : fmt(entry.environment.slope, '°')}</b></span>
                <span>{t('Diviner climatological mean / peak')}<b>{fmt(entry.environment?.thermal?.mean ?? null, ' K')} / {fmt(entry.environment?.thermal?.peak ?? null, ' K')}</b></span>
                <span>{t('Modeled permanent shadow in 480 m cell')}<b>{entry.environment?.thermal?.shadowFraction == null ? t('Unavailable') : fmt(entry.environment.thermal.shadowFraction * 100, '%')}</b></span>
                <span>{t('Rays reaching target distance')}<b>{entry.result.horizon.distances.filter(d => d >= entry.result.horizon.radiusMeters).length} / 360</b></span>
                <span>{entry.result.energy.unknownHours ? t('Generation in known intervals') : t('Energy generated')}<b>{fmt(entry.result.energy.unknownHours >= (study.settings.end - study.settings.first) / HOUR - 1e-8 ? null : entry.result.energy.generatedWh, ' Wh')}</b></span>
                <span>{t('Lowest battery charge')}<b>{fmt(entry.result.energy.minimumPercent, '%')}</b></span>
                <span>{t('Unserved load')}<b>{fmt(entry.result.energy.unservedWh, ' Wh')}</b></span>
                <span>{t('Longest known load deficit')}<b>{fmt(entry.result.energy.unknownHours >= (study.settings.end - study.settings.first) / HOUR - 1e-8 ? null : entry.result.energy.longestDeficitHours, ' h')}</b></span>
                <span>{t('Modeled link time')}<b>{fmt(entry.result.linkHours, ' h')}</b></span>
                <span>{t('Geometric Earth-center visibility')}<b>{fmt(entry.result.earthClearHours, ' h')}</b></span>
                <span>{t('Known solar disk visibility')}<b>{fmt(entry.result.sunVisibleHours, ' h')}</b></span>
                <span>{t('Longest known link outage')}<b>{fmt(entry.result.linkUnknownHours >= (study.settings.end - study.settings.first) / HOUR - 1e-8 ? null : entry.result.longestOutageHours, ' h')}</b></span>
                <span>{t('Unknown terrain (power / link)')}<b>{fmt(entry.result.energy.unknownHours, ' h')} / {fmt(entry.result.linkUnknownHours, ' h')}</b></span>
              </div>
              <HorizonChart result={entry.result} index={cursor} lo={lo} hi={hi} />
              <HistoryChart result={entry.result} settings={study.settings} index={cursor} maxPower={maxPower} />
              <details className="mission-candidate"><summary>{t('Horizon crossings (UTC)')}</summary>
                <p>{t('Center crossings are refined inside 10-minute brackets.')} {entry.result.sensitivity === 'regional'
                  ? 'Sensitivity compares the baseline with a 20 m regional DEM within 3 km.'
                  : `Sensitivity compares ${entry.result.horizon.stepMeters} m and ${2 * entry.result.horizon.stepMeters} m ray steps.`}</p>
                <ul className="mission-rejections compare-windows">{entry.result.transitions.flatMap(({ body, events, coarseCount }) =>
                  events.length ? events.map((event, i) => <li key={body + i}>
                    {body === 'sun' ? t('Sun') : t('Earth')} {event.direction.toLowerCase()} · {utc(event.time).replace('T', ' ')} · {event.earliest === null || event.latest === null
                      ? 'Sensitivity range unresolved'
                      : `${utc(event.earliest).replace('T', ' ')} → ${utc(event.latest).replace('T', ' ')}`}
                  </li>) : [<li key={body}>{body === 'sun' ? t('Sun') : t('Earth')} {t('· No baseline crossing resolved')}{coarseCount ? ` · ${coarseCount} in alternative profile` : ''}</li>])}</ul>
              </details>
              <details className="mission-candidate"><summary>{t('Radio windows (UTC)')}</summary><ul className="mission-rejections compare-windows">
                {entry.result.windows.map(w => <li key={w.from}>{utc(w.from).replace('T', ' ')} → {utc(w.to).replace('T', ' ')} · {t(w.status)}</li>)}
              </ul></details>
            </>}
          </article>)}
        </div>
        {sample && <div className="compare-legend">{Object.entries(stationColors).map(([label, color]) => <span key={label}><i style={{ background: color }} />{t(label)}</span>)}</div>}
      </section>}
      {seed.artemis && <details className="mission-candidate"><summary>{t('Sources and coverage')}</summary><ul>
        {ARTEMIS_DATA_SOURCES.map(source => <li key={source.name}><a href={source.href} target="_blank" rel="noreferrer">{t(source.name)}</a> · {t(source.label)} · {t(source.detail)}</li>)}
      </ul></details>}
      <p className="time-note">{t('10-minute SPICE screening. The selected horizon distance is a maximum. Available LOLA coverage ends at 75° latitude in each hemisphere. The southernmost grid is 160 m and extended coverage is 480 m.')}</p>
    </div>
  </dialog>
}
