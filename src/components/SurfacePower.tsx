import { useLanguage } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Coordinates } from '../domain/lunar'
import type { Ephemeris } from '../services/science/ephemeris'
import { REGIONAL_STUDY_SITES } from '../data/regionalStudySites'
import { DEFAULT_POWER, POWER_FIELDS, surfacePower, validPower, type PowerInputs } from '../services/science/solarPower'
import type { HorizonProfile } from '../services/science/terrainHorizon'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'

const sites = REGIONAL_STUDY_SITES
const utcInput = (value: number) => new Date(value).toISOString().slice(0, 16)
const fmt = (value: number, decimals = 1) => value.toLocaleString(undefined, { maximumFractionDigits: decimals })
const HOUR = 3_600_000

function PowerChart({ rows, load, initial }: { rows: ReturnType<typeof surfacePower>['rows']; load: number; initial: number }) {
  const width = 600, top = 10, height = 63
  const begin = rows[0].from, span = rows.at(-1)!.to - begin
  const x = (time: number) => width * (time - begin) / span
  const max = Math.max(load, ...rows.map(row => row.power ?? 0))
  const y = (power: number) => top + height * (1 - power / max)
  const soc = (value: number) => 90 + height * (1 - value / 100)
  let previous = initial
  const powerPath = rows.flatMap(row => row.power === null ? [] : [`M${x(row.from)},${y(row.power)}H${x(row.to)}`]).join(' ')
  const batteryPath = rows.flatMap(row => {
    if (row.batteryPercent === null) return []
    const segment = `M${x(row.from)},${soc(previous)}L${x(row.to)},${soc(row.batteryPercent)}`
    previous = row.batteryPercent
    return [segment]
  }).join(' ')
  return <figure className="power-chart">
    <figcaption><span><i /> Panel output (0–{fmt(max)} W) · dashed: load</span><span><i /> Battery (0–100%)</span></figcaption>
    <svg viewBox="0 0 600 163" role="img" aria-label="Panel output versus constant load, and estimated battery charge over the study interval. Missing segments have insufficient terrain data.">
      <path d="M0 73H600 M0 153H600" stroke="#263e49" fill="none" />
      <path d={`M0 ${y(load)} H600`} stroke="#adc4ce" strokeDasharray="5 5" opacity=".65" fill="none" />
      <path d={powerPath} stroke="#efc781" strokeWidth="1.6" fill="none" />
      <path d={batteryPath} stroke="#76d4d8" strokeWidth="1.6" fill="none" />
    </svg>
    <div className="power-ticks"><span>{utcInput(begin).replace('T', ' ')} UTC</span><span>{utcInput(begin + span).replace('T', ' ')} UTC</span></div>
  </figure>
}

export function SurfacePower({ data, error, coordinates, time, initialHeight, initialHours, onClose }: {
  data: Ephemeris | null; error: string; coordinates: Coordinates; time: number; initialHeight: number; initialHours: number; onClose: () => void
}) {
  const { t } = useLanguage()
  const [siteIndex, setSiteIndex] = useState(coordinates.latitude <= -85 ? -1 : 1)
  const [start, setStart] = useState(() => utcInput(Math.min(time, Date.parse('2029-01-01T00:00:00Z') - initialHours * HOUR)))
  const [hours, setHours] = useState(initialHours)
  const [height, setHeight] = useState(initialHeight)
  const [inputs, setInputs] = useState(DEFAULT_POWER)
  const [retry, setRetry] = useState(0)
  const [terrain, setTerrain] = useState<{ key: string; profile?: HorizonProfile; error?: string }>()
  const { latitude, longitude } = sites[siteIndex] ?? coordinates
  const supported = latitude >= -90 && latitude <= -85
  const validHeight = Number.isFinite(height) && height >= 0 && height <= 100
  const terrainKey = `${latitude}/${longitude}/${height}/${retry}`
  const first = Date.parse(start + 'Z'), end = first + hours * HOUR
  const minTime = data ? Date.parse(data.start) : 0
  const maxTime = data ? minTime + data.stepMs * (data.rows.length - 1) : 0
  const validRange = Number.isFinite(first) && Number.isInteger(hours) && hours >= 1 && hours <= 672 && first >= minTime && end <= maxTime
  const validInputs = validPower(inputs)
  useEffect(() => {
    if (!supported || !validHeight) return
    const failed = () => setTerrain({ key: terrainKey, error: 'Could not compute a terrain horizon here.' })
    try {
      const worker = new Worker(new URL('../services/science/horizon.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = ({ data }: MessageEvent<{ profile?: HorizonProfile; error?: string }>) =>
        setTerrain({ key: terrainKey, profile: data.profile, error: data.error })
      worker.onerror = failed
      worker.postMessage({ id: 1, latitude, longitude, mastHeight: height })
      return () => worker.terminate()
    } catch { failed() }
  }, [supported, validHeight, terrainKey, latitude, longitude, height])
  const currentTerrain = terrain?.key === terrainKey ? terrain : null
  const profile = currentTerrain?.profile
  const result = useMemo(() => data && profile && validRange && validInputs
    ? surfacePower(data, first, end, { latitude, longitude }, profile, inputs) : null,
  [data, profile, validRange, validInputs, first, end, latitude, longitude, inputs])

  function download() {
    if (!result) return
    const heading = 'from_utc,to_utc,latitude_deg,longitude_deg,mast_m,visible_solar_disk_fraction,mean_panel_w,load_w,end_charge_pct,orientation,vertical_facing_deg,panel_m2,panel_efficiency_pct,usable_battery_wh,initial_charge_pct,charge_efficiency_pct,discharge_efficiency_pct'
    const rows = result.rows.map(row => [new Date(row.from).toISOString(), new Date(row.to).toISOString(), latitude, longitude,
      height, row.visible, row.power, inputs.load, row.batteryPercent, inputs.orientation, inputs.orientation === 'vertical' ? inputs.azimuth : '',
      inputs.area, inputs.efficiency, inputs.capacity, inputs.initial, inputs.chargeEfficiency, inputs.dischargeEfficiency].join(','))
    const url = URL.createObjectURL(new Blob([[heading, ...rows].join('\n')], { type: 'text/csv' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'alpha-lunar-surface-power.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <section className="time-explorer earth-link surface-power" aria-label={t('Surface Power')}>
    <header><div><small>{t('SURFACE OPERATIONS')}</small><h2>{t('Surface Power')}</h2></div>
      <button aria-label={t('Close Surface Power')} onClick={onClose}><X size={18} /></button></header>
    <p>{t('Estimate solar generation and battery endurance for a surface stay.')}</p>
    <div className="mission-fields mission-date">
      <label>{t('Study location')}<select value={siteIndex} onChange={e => setSiteIndex(Number(e.target.value))}>
        <option value={-1}>{t('Selected map point')}</option>{sites.map((site, index) => <option key={site.name} value={index}>{t(site.name)}</option>)}
      </select></label>
      <label>{t('Start (UTC)')}<input type="datetime-local" value={start} min={data ? utcInput(minTime) : undefined} max={data ? utcInput(maxTime) : undefined} onChange={e => setStart(e.target.value)} /></label>
      <label>{t('Surface stay (h)')}<input type="number" min="1" max="672" value={Number.isFinite(hours) ? hours : ''} onChange={e => setHours(e.target.valueAsNumber)} /></label>
      <label>{t('Panel height (m)')}<input type="number" min="0" max="100" step=".1" value={Number.isFinite(height) ? height : ''} onChange={e => setHeight(e.target.valueAsNumber)} /></label>
    </div>
    <p>{formatLatitude(latitude)} · {formatLongitude(longitude)}{siteIndex >= 0 ? ' · regional study center' : ''}</p>
    <details className="mission-candidate" open>
      <summary>{t('Panel and battery settings')}</summary>
      <div className="mission-fields mission-date">
        <label>{t('Panel orientation')}<select value={inputs.orientation} onChange={e => setInputs({ ...inputs, orientation: e.target.value as PowerInputs['orientation'] })}>
          <option value="tracking">{t('Ideal Sun tracking')}</option><option value="horizontal">{t('Fixed horizontal')}</option><option value="vertical">{t('Fixed vertical')}</option>
        </select></label>
        {Object.entries(POWER_FIELDS).map(([key, field]) => (key !== 'azimuth' || inputs.orientation === 'vertical') && <label key={key}>{t(field.label)}
          <input type="number" min={field.min} max={field.max} step={field.step} value={Number.isFinite(inputs[key as keyof typeof POWER_FIELDS]) ? inputs[key as keyof typeof POWER_FIELDS] : ''}
            onChange={e => setInputs({ ...inputs, [key]: e.target.valueAsNumber })} /></label>)}
      </div>
    </details>
    {error && <p role="alert">{t(error)}</p>}
    {!data && !error && <p role="status">{t('Loading SPICE ephemeris…')}</p>}
    {!supported && <p role="status">{t('Choose a regional study center or a map point from 85°S to 90°S.')}</p>}
    {currentTerrain?.error && <p role="alert">{currentTerrain.error} <button onClick={() => setRetry(retry + 1)}>{t('Retry')}</button></p>}
    {supported && validHeight && !currentTerrain && <p role="status">{t('Computing regional terrain horizon…')}</p>}
    {(!validInputs || !validHeight) && <p role="alert">{t('Check the panel and battery settings.')}</p>}
    {data && !validRange && <p role="alert">{t('Enter a 1–672 hour stay fully within SPICE coverage.')}</p>}
    {result && <div aria-label={t('Power results')}>
      <div className="mission-metrics">
        <span>{result.unknownHours ? t('Generation in known intervals') : t('Energy generated')}<b>{result.unknownHours >= hours - 1e-8 ? t('Unknown') : `${fmt(result.generatedWh)} Wh`}</b></span>
        <span>{t('Lowest battery charge')}<b>{result.minimumPercent === null ? t('Unknown') : `${fmt(result.minimumPercent)}%`}</b></span>
        <span>{result.unknownHours ? t('Longest known load deficit') : 'Longest load deficit'}<b>{result.unknownHours >= hours - 1e-8 ? t('Unknown') : `${fmt(result.longestDeficitHours)} h`}</b></span>
        <span>{t('Unserved load energy')}<b>{result.unservedWh === null ? t('Unknown') : `${fmt(result.unservedWh)} Wh`}</b></span>
        <span>{result.unknownHours ? 'Longest known darkness' : 'Longest terrain darkness'}<b>{result.unknownHours >= hours - 1e-8 ? t('Unknown') : `${fmt(result.longestDarkHours)} h`}</b></span>
      </div>
      {result.unknownHours > 0 && <p role="status">{fmt(result.unknownHours)} {t('h of incomplete terrain coverage. Battery state is unknown after the first gap.')}</p>}
      <PowerChart rows={result.rows} load={inputs.load} initial={inputs.initial} />
      <button onClick={download}>{t('Download 10-minute CSV')}</button>
    </div>}
    <p className="time-note">{t('Screening estimate · 160 m LOLA, 100 km terrain horizon and 10-minute SPICE samples. Earth occultation reduces output using a uniform solar disk. Terrain and eclipse masks combine approximately. Temperature and battery power limits are outside this estimate.')}</p>
  </section>
}
