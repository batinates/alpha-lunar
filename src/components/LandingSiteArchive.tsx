import { useLanguage } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Crosshair, X } from 'lucide-react'
import { archiveFetch, archiveRow, archivedHorizonAt, ARCHIVE_ROOT, loadArchiveSeries, type ArchiveManifest, type ArchiveSite } from '../services/science/siteArchive'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { latLonToPolar, POLAR_HALF_EXTENT } from '../services/science/lunarAssets'
import { ArchiveContext, hasArchiveContext } from './ArchiveContext'

const utc = (value: number) => new Date(value).toISOString().slice(0, 16)
const point = (lat: number, lon: number) => `${formatLatitude(lat)} · ${formatLongitude(lon)}`

function Outline({ site }: { site: ArchiveSite }) {
  const { t } = useLanguage()
  if (!site.polygon || site.lat === null || site.lon === null) return null
  const center = latLonToPolar(site.lat, site.lon)
  const vertices = site.polygon.map(([lon, lat]) => latLonToPolar(lat, lon))
  const extent = Math.max(...vertices.map(p => Math.max(Math.abs(p.x - center.x), Math.abs(p.z - center.z))), 1)
  const coords = vertices.map(p => `${120 + (p.x - center.x) / extent * 76},${96 + (p.z - center.z) / extent * 76}`).join(' ')
  return <svg className="archive-chart" viewBox="0 0 240 192" role="img" aria-label={t('Supplied candidate area outline in south polar projection')}>
    <path d="M120 8V184 M24 96H216" stroke="#355362" strokeDasharray="4 5" />
    <polygon points={coords} fill="#46b9cf30" stroke="#77cdda" strokeWidth="2" />
    <circle cx="120" cy="96" r="4" fill="#e9be7e" />
    <text x="8" y="18" fill="#a8c9d6" fontSize="10">{t('SUPPLIED OUTLINE')}</text>
  </svg>
}

export function LandingSiteArchive({ open, initialTime, initialSiteId, onClose, onLocate }: {
  open: boolean; initialTime: number; initialSiteId?: string; onClose: () => void; onLocate: (site: ArchiveSite, screen: boolean) => void
}) {
  const { t, language } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [manifest, setManifest] = useState<ArchiveManifest | null>(null)
  const [siteId, setSiteId] = useState('')
  const [filter, setFilter] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [epoch, setEpoch] = useState<number | null>(null)
  const [series, setSeries] = useState<{ id: string; value: Awaited<ReturnType<typeof loadArchiveSeries>> } | null>(null)
  const site = manifest?.sites.find(item => item.id === siteId)
  const seriesId = site?.series

  useEffect(() => {
    if (open && initialSiteId && manifest?.sites.some(item => item.id === initialSiteId)) {
      setSiteId(initialSiteId)
      setFilter('')
      setEpoch(null)
    }
  }, [initialSiteId, manifest, open])

  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal()
    if (!open && dialog.current?.open) dialog.current.close()
  }, [open])

  useEffect(() => {
    if (!open || manifest) return
    const controller = new AbortController()
    setError('')
    archiveFetch('manifest.json', controller.signal).then(response => response.json()).then((data: ArchiveManifest) => {
      if (data.schema !== 1 || data.stepMs !== 3600000 || !data.sites.length) throw new Error('Invalid archive manifest')
      if (!controller.signal.aborted) {
        setManifest(data)
        setSiteId(data.sites[0].id)
      }
    }).catch(() => { if (!controller.signal.aborted) setError('The site catalog could not be loaded.') })
    return () => controller.abort()
  }, [manifest, open, retry])

  useEffect(() => {
    if (!manifest || !open || !seriesId) return
    const controller = new AbortController()
    setError('')
    loadArchiveSeries(manifest, seriesId, controller.signal).then(value => {
      if (!controller.signal.aborted) setSeries({ id: seriesId, value })
    }).catch(() => { if (!controller.signal.aborted) setError('The selected time series could not be loaded.') })
    return () => controller.abort()
  }, [manifest, open, seriesId, retry])

  const start = manifest ? Date.parse(manifest.start) : 0
  const step = manifest?.stepMs ?? 3600000
  const count = manifest?.count ?? 1
  const index = Math.min(count - 1, Math.max(0, Math.round(((epoch ?? initialTime) - start) / step)))
  const active = series && series.id === seriesId ? series.value : null
  const current = active ? archiveRow(active.data, index) : null
  const from = Math.max(0, Math.min(index - 84, count - 169))
  const plot = active ? Array.from({ length: 169 }, (_, i) => archiveRow(active.data, from + i)) : []
  const horizon = active?.horizon
  const clearances = current && horizon ? [current.sunEl - archivedHorizonAt(horizon, current.sunAz),
    current.earthEl - archivedHorizonAt(horizon, current.earthAz)] : null
  const coords = site && site.lat !== null && site.lon !== null ? { lat: site.lat, lon: site.lon } : null
  const projected = coords ? latLonToPolar(coords.lat, coords.lon) : null
  const eligible = coords && coords.lat <= -85 && projected &&
    Math.max(Math.abs(projected.x), Math.abs(projected.z)) < POLAR_HALF_EXTENT - 160 &&
    (site?.category === 'artemis_candidate_region' || site?.category === 'artemis_2022_region_dropped')
  const search = filter.trim().toLocaleLowerCase(language)
  const matched = manifest?.sites.filter(item => [t(item.name), item.name, ...item.aliases].some(name => name.toLocaleLowerCase(language).includes(search))) ?? []
  const displayedSite = matched.find(item => item.id === siteId)

  return <dialog className="mission-dialog descent-dialog" ref={dialog} aria-labelledby="archive-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="mission-shell">
      <header className="mission-header"><h2 id="archive-title">{t('Landing Site Archive')}</h2><button className="icon-button" aria-label={t('Close landing site archive')} onClick={onClose}><X size={18} /></button></header>
      <div className="mission-body">
        {!manifest && !error && <p role="status">{t('Loading site catalog…')}</p>}
        {error && <p role="alert">{t(error)} <button className="analysis-action" onClick={() => setRetry(value => value + 1)}>{t('Retry')}</button></p>}
        {manifest && <>
          <div className="mission-fields mission-date">
            <label>{t('Search sites')}<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
            <label>{t('Archive site')}<select value={matched.some(item => item.id === siteId) ? siteId : ''} onChange={event => { setSiteId(event.target.value); setError('') }}>
              <option value="" disabled>{t(matched.length ? 'Choose a matching site' : 'No matching sites')}</option>
              {matched.map(item => <option key={item.id} value={item.id}>{t(item.name)}</option>)}
            </select></label>
          </div>
          {site && displayedSite && <>
            <div className="mission-profile-line"><strong>{t(site.name)}</strong><span>{coords ? point(coords.lat, coords.lon) : t('Coordinates unavailable')} · {t(site.category.replaceAll('_', ' '))} · {t(site.outcome.replaceAll('_', ' '))}</span></div>
            <p>{t(site.coord_method)} · {t(site.confidence)} {t('confidence as supplied.')}</p>
            {site.actual_date && <p>{t('Recorded event ·')} {site.date_precision === 'day' ? site.actual_date.slice(0, 10) : site.actual_date.replace('T', ' ').replace('Z', '')} UTC</p>}
            {site.actual && site.target && <p>{t('Target')} {point(site.target.lat, site.target.lon)} {t('· reported actual')} {point(site.actual.lat, site.actual.lon)}</p>}
            {site.reported_elev_m !== null && <p>{t('Reported elevation ·')} {site.reported_elev_m} m</p>}
            {site.polygon && <details className="mission-candidate"><summary>{t('Source region outline')}{site.area_km2 ? ` · ${site.area_km2} km² ${t('as supplied')}` : ''}</summary><Outline site={site} /></details>}
            <div className="mission-actions">
              {coords && <button className="analysis-action" onClick={() => onLocate(site, false)}><Crosshair size={14} /> {t('Locate on map')}</button>}
              {eligible && <button className="analysis-action" onClick={() => onLocate(site, true)}>{t('Screen this coordinate')}</button>}
              {site.source?.startsWith('https://') && <a href={site.source} target="_blank" rel="noreferrer">{t('Coordinate source ↗')}</a>}
            </div>
            {hasArchiveContext(site.id) && <details className="mission-candidate" open={showContext}>
              <summary onClick={event => { event.preventDefault(); setShowContext(value => !value) }}>{t('Terrain and monthly reference')}</summary>
              {showContext && <ArchiveContext key={site.id} id={site.id} epoch={start + index * step} onMonth={setEpoch} />}
            </details>}
            {!!seriesId && !active && !error && <p role="status">{t('Loading hourly angles and local horizon…')}</p>}
            {!seriesId && <p>{t('Hourly angles and horizon profile are unavailable for this record.')}</p>}
            {active && current && horizon && clearances && <>
              <h3>{t('Hourly angles · 2023–2029 UTC')}</h3>
              <div className="mission-fields mission-date">
                <label>{t('Archive epoch (UTC)')}<input type="datetime-local" step="3600" min={utc(start)} max={utc(start + (count - 1) * step)}
                  value={utc(start + index * step)} onChange={event => { const value = Date.parse(event.target.value + 'Z'); if (Number.isFinite(value)) setEpoch(value) }} /></label>
                <label>{t('Browse hours')}<input type="range" min="0" max={count - 1} value={index} onChange={event => setEpoch(start + Number(event.target.value) * step)} /></label>
              </div>
              <div className="mission-metrics">
                <span>{t('Sun center')} <b>{current.sunAz.toFixed(2)}° {t('az.')} / {current.sunEl.toFixed(2)}° {t('el.')}</b></span>
                <span>{t('Earth center')} <b>{current.earthAz.toFixed(2)}° {t('az.')} / {current.earthEl.toFixed(2)}° {t('el.')}</b></span>
                <span>{t('Sun minus supplied horizon')} <b>{clearances[0].toFixed(2)}°</b></span>
                <span>{t('Earth minus supplied horizon')} <b>{clearances[1].toFixed(2)}°</b></span>
              </div>
              <svg className="archive-chart archive-series" viewBox="0 0 640 158" role="img" aria-label={t('Sun and Earth center elevation over seven days, from minus 90 to plus 90 degrees')}>
                <path d="M20 16H620 M20 79H620 M20 142H620" stroke="#355362" strokeDasharray="4 5" />
                <path d={`M${20 + (index - from) * 600 / 168} 16v126`} stroke="#b5c3cb" />
                <text x="25" y="14">+90°</text><text x="25" y="77">0°</text><text x="25" y="155">−90°</text>
                {(['sunEl', 'earthEl'] as const).map((key, i) => <polyline key={key} fill="none" stroke={i === 0 ? '#e9be7e' : '#77cdda'} strokeWidth="2"
                  points={plot.map((row, hour) => `${20 + hour * 600 / 168},${79 - row[key] * .7}`).join(' ')} />)}
              </svg>
              <p className="archive-legend"><span>{t('Sun')}</span><span>{t('Earth')}</span> · {utc(start + from * step).replace('T', ' ')} – {utc(start + (from + 168) * step).replace('T', ' ')} UTC</p>
              <details className="mission-candidate"><summary>{t('Supplied terrain horizon · 0.25° azimuth · 2 m observer')}</summary>
                <svg className="archive-chart archive-series" viewBox="0 0 640 158" role="img" aria-label={t('Supplied terrain elevation by azimuth from north through east, south and west')}>
                  {(() => {
                    const low = Math.min(0, ...horizon.el_deg), high = Math.max(1, ...horizon.el_deg)
                    const y = (value: number) => 136 - (value - low) * 114 / (high - low)
                    return <>
                      <path d={`M20 ${y(0)}H620`} stroke="#355362" strokeDasharray="4 5" />
                      <polyline fill="none" stroke="#77cdda" strokeWidth="2" points={[...horizon.el_deg, horizon.el_deg[0]].map((value, i) => `${20 + i * 600 / 1440},${y(value)}`).join(' ')} />
                      <text x="20" y="14">{high.toFixed(1)}°</text><text x="20" y="153">{t('N')} 0°</text><text x="165" y="153">{t('E')}</text><text x="315" y="153">{t('S')}</text><text x="465" y="153">{t('W')}</text><text x="586" y="153">360°</text>
                    </>
                  })()}
                </svg>
              </details>
              <p>{t('Archive geometry was compared with SPICE over their shared dates. The supplied horizon uses a 2 m observer. Mission screening uses the application’s DEM and SPICE.')}</p>
            </>}
          </>}
          <a href={ARCHIVE_ROOT + 'manifest.json'} target="_blank" rel="noreferrer">{t('Archive metadata and checksums ↗')}</a>
        </>}
      </div>
    </div>
  </dialog>
}
