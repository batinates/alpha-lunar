import { useEffect, useState } from 'react'
import { useLanguage } from '../lib/i18n'
import { ARCHIVE_ROOT, archiveFetch } from '../services/science/siteArchive'
import contextManifest from '../../public/lunar/site-archive/context/manifest.json'

type Month = [coverageHours: number, sunDisk: number, solarEnergy: number, sunOutage: number, earthDisk: number, earthOutage: number]
type Event = [utc: string, body: 'sun' | 'earth', kind: 'rise' | 'set', azimuth: number, sensitivity: number | null]
type Reference = {
  schema: number
  id: string
  terrain: { product: string; elevation: number; slope: number; aspect: number; meanSlope: number; maxSlope: number; baselineMeters: number
    map: { pixelMeters: number; x: number; y: number } }
  months: Record<string, Month>
  events: Record<string, Event[]>
}
const root = ARCHIVE_ROOT + 'context/'
export const hasArchiveContext = (id: string) => Object.hasOwn(contextManifest.sites, id)

export function ArchiveContext({ id, epoch, onMonth }: { id: string; epoch: number; onMonth: (value: number) => void }) {
  const { t, language } = useLanguage()
  const [reference, setReference] = useState<Reference | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    archiveFetch(`context/${id}.json`, controller.signal).then(response => response.json()).then((value: Reference) => {
      if (value.schema !== 1 || value.id !== id || !value.terrain || !value.months || !value.events) throw new Error('Invalid archive reference')
      if (!controller.signal.aborted) setReference(value)
    }).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [id, attempt])

  if (error) return <p role="alert">{t('Archive reference data could not be loaded.')} <button className="analysis-action"
    onClick={() => { setError(false); setAttempt(value => value + 1) }}>{t('Retry')}</button></p>
  if (!reference) return <p role="status">{t('Loading archive reference…')}</p>

  const { terrain } = reference
  const month = new Date(epoch).toISOString().slice(0, 7)
  const monthly = reference.months[month]
  const events = reference.events[month] ?? []
  const date = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC' })
  const monthLabel = new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', timeZone: 'UTC' })
  const number = new Intl.NumberFormat(language, { maximumFractionDigits: 2 })
  const fmt = (value: number, unit: string) => `${number.format(value)} ${unit}`
  const product = terrain.product.startsWith('P104') ? 104 : 90

  return <div className="archive-context">
    <h4>{t('Near-site terrain')}</h4>
    <div className="archive-context-terrain">
      <figure>
        <div className="archive-slope-map">
          <img src={root + id + '-slope.webp'} loading="lazy" alt={t('Local slope map centered on the archive coordinates')} />
          <span className="archive-map-target" style={{ left: `${terrain.map.x * 100}%`, top: `${terrain.map.y * 100}%` }} aria-hidden="true">+</span>
        </div>
        <figcaption>{t('Slope · 2 km map')} <span className="archive-slope-key">0° <i /> ≥30°</span></figcaption>
      </figure>
      <div>
        <div className="mission-metrics">
          <span>{t('Elevation')} <b>{fmt(terrain.elevation, 'm')}</b></span>
          <span>{t('Slope and aspect at the site')} <b>{fmt(terrain.slope, '°')} / {fmt(terrain.aspect, '°')}</b></span>
          <span>{t('Mean and maximum slope within 100 m')} <b>{fmt(terrain.meanSlope, '°')} / {fmt(terrain.maxSlope, '°')}</b></span>
          <span>{t('Pixel spacing / slope baseline')} <b>{fmt(terrain.map.pixelMeters, 'm')} / {fmt(terrain.baselineMeters, 'm')}</b></span>
        </div>
        <p><a href={`https://pgda.gsfc.nasa.gov/products/${product}`} target="_blank" rel="noreferrer">NASA PGDA {product}</a> · {terrain.product}</p>
      </div>
    </div>
    <h4>{t('Monthly illumination and visibility')}</h4>
    <label>{t('Reference month (UTC)')} <select value={month} onChange={event => onMonth(Date.parse(event.target.value + '-01T00:00:00Z'))}>
      {Object.keys(reference.months).map(value => <option key={value} value={value}>{monthLabel.format(new Date(value + '-01T00:00:00Z'))}</option>)}
    </select></label>
    {monthly && <div className="mission-metrics">
      <span>{t('Hours in the source data')} <b>{fmt(monthly[0], t('h'))}</b></span>
      <span>{t('Average visible Sun disk')} <b>{fmt(monthly[1], '%')}</b></span>
      <span>{t('Incident solar energy')} <b>{fmt(monthly[2], 'kWh/m²')}</b></span>
      <span>{t('Longest interval without Sun')} <b>{fmt(monthly[3], t('h'))}</b></span>
      <span>{t('Average visible Earth disk')} <b>{fmt(monthly[4], '%')}</b></span>
      <span>{t('Longest interval without Earth visibility')} <b>{fmt(monthly[5], t('h'))}</b></span>
    </div>}
    <p>{t('Navigator reference model · 2 m observer · 2023–2029 UTC. Solar energy is incident on a Sun-facing panel before efficiency. Earth disk visibility describes geometry; it does not predict a radio link.')}</p>
    <details>
      <summary>{t('Rise and set events')} · {events.length}</summary>
      <p>{t('The event is the first or last visible edge of the disk. Sensitivity shows the modeled time shift for a 0.1° change in the terrain horizon.')}</p>
      {events.length ? <div className="risk-table-wrap"><table className="risk-table">
        <thead><tr><th scope="col">UTC</th><th scope="col">{t('Event')}</th><th scope="col">{t('Azimuth')}</th><th scope="col">{t('Time sensitivity')}</th></tr></thead>
        <tbody>{events.map(([time, body, kind, az, sensitivity]) => <tr key={time + body + kind}>
          <td>{date.format(new Date(time))}</td><td>{t(body === 'sun' ? 'Sun' : 'Earth')} · {t(kind === 'rise' ? 'Rise' : 'Set')}</td>
          <td>{fmt(az, '°')}</td><td>{sensitivity === null ? t('Unavailable') : fmt(sensitivity, t('min'))}</td>
        </tr>)}</tbody>
      </table></div> : <p>{t('No rise or set events in this month.')}</p>}
    </details>
    <a href={root + 'manifest.json'} target="_blank" rel="noreferrer">{t('Reference data provenance ↗')}</a>
  </div>
}
