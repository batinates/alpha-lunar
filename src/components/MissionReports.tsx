import { useLanguage } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Download, Printer, Trash2, X } from 'lucide-react'
import { reportSources, type MissionReport } from '../domain/missionReport'
import { priorityWeights } from '../services/science/landingOptimization'

const utc = (ms: number) => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
const format = (value: number | null, unit: string) => value === null ? 'Unavailable' : `${value.toFixed(2)} ${unit}`
const rate = (count: number, total: number) => `${(100 * count / total).toFixed(1)}%`

function downloadReport(report: MissionReport) {
  const sources = reportSources.map(source => ({ ...source, href: new URL(source.href, location.origin).href }))
  const { coordinates, time, profile, ...record } = report
  const context = report.artemisReview ? {} : { coordinates, time, profile }
  const payload = { ...record, ...context, sources: report.artemisReview?.sources.map(source => ({ ...source, href: new URL(source.href, location.origin).href })) ?? sources,
    methodology: report.artemisReview ? 'Published NASA plan and optional ALPHA LUNAR surface comparison' : 'Phase 7 using Phase 5 screening and Phase 6 descent models' }
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `alpha-lunar-${report.id}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function MissionReports({ open, reports, activeId, onSelect, onRemove, onClose, message }: {
  open: boolean
  reports: MissionReport[]
  activeId: string | null
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onClose: () => void
  message: string
}) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const report = reports.find(item => item.id === activeId) ?? reports[0]
  useEffect(() => {
    const element = dialog.current
    if (open && !element?.open) element?.showModal()
    if (!open && element?.open) {
      element.close()
      setConfirmRemove(null)
    }
  }, [open])
  const candidate = report?.candidate
  const profile = report?.profile
  const search = report?.search
  const weights = profile ? priorityWeights(profile.priority) : null

  return <dialog className="mission-dialog reports-dialog" ref={dialog} aria-labelledby="reports-title"
    onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="mission-shell">
      <header className="mission-header"><h2 id="reports-title">{t('Mission Reports')}</h2>
        <button className="icon-button" aria-label={t('Close mission reports')} onClick={onClose}><X size={18} /></button>
      </header>
      <div className="mission-body">
        <p role="status" className="report-controls">{t(message)}</p>
        {!report || !profile ? <p>{t('Open an option in Landing Optimization or run Landing Simulation, then choose Create report.')}</p> : <>
          <div className="mission-actions report-controls">
            <label className="descent-select">{t('Saved reports')} <select value={report.id} onChange={event => { setConfirmRemove(null); onSelect(event.target.value) }}>
              {reports.map(item => <option key={item.id} value={item.id}>{t(item.profile.name)} · {t(item.name)} · {utc(Date.parse(item.createdAt))}</option>)}
            </select></label>
            <button className="analysis-action mission-primary" onClick={() => window.print()}><Printer size={15} /> {t('Print / Save PDF')}</button>
            <button className="analysis-action" onClick={() => downloadReport(report)}><Download size={15} /> {t('Download JSON')}</button>
            {confirmRemove === report.id ? <>
              <button className="analysis-action" onClick={() => { onRemove(report.id); setConfirmRemove(null) }}>{t('Delete report')}</button>
              <button className="analysis-action" onClick={() => setConfirmRemove(null)}>{t('Cancel')}</button>
            </> : <button className="analysis-action" aria-label={t('Remove saved report')} onClick={() => setConfirmRemove(report.id)}><Trash2 size={15} /></button>}
          </div>
          <article className="report-document">
            <div className="location-index">{t('ALPHA LUNAR · MISSION REPORT')}</div>
            <h2>{profile.name}</h2>
            <p>{report.artemisReview ? report.artemisReview.title : `${report.name} · ${report.coordinates.latitude.toFixed(6)}°, ${report.coordinates.longitude.toFixed(6)}° · ${utc(report.time)}`}</p>
            <p>{t('Created')} {utc(Date.parse(report.createdAt))} · {report.id}</p>
            {report.artemisReview ? <ArtemisReview report={report.artemisReview} /> : <>
            <section><h3>{t('Mission and vehicle')}</h3>
              <div className="mission-metrics">
                <span>{t('Mission type')} <b>{t(profile.type)}{profile.artemis ? ' · ' + t('Artemis study') : ''}</b></span>
                <span>{t('Vehicle')} <b>{profile.spacecraft} · {profile.crew} crew · {profile.massKg} kg</b></span>
                <span>{t('Surface stay and priority')} <b>{profile.durationHours} {t('h')} · {t(profile.priority)}</b></span>
                <span>{t('Terrain thresholds')} <b>{profile.footprintMeters} m square · {profile.maxSlope}° slope · {profile.maxRoughness} m RMS</b></span>
                <span>{t('Geometry thresholds')} <b>{profile.mastHeight} {t('m observer · Sun')} {profile.minSunPercent}% · Earth {profile.minEarthPercent}%</b></span>
                <span>{t('Surface peak threshold')} <b>{profile.maxSurfacePeak || 'Disabled'}{profile.maxSurfacePeak ? ' K' : ''}</b></span>
              </div>
            </section>
            <section><h3>{t('Landing screening')}</h3>
              {search && <p>{utc(search.first)} to {utc(search.last)} · {search.sites} locations · {search.data.passed}/{search.data.screened} {t('arrivals within sampled limits ·')} {search.data.paretoCount} {t('on the Pareto front')}</p>}
              {candidate && weights && <p>{t('Ranking weights · terrain')} {Math.round(weights[0] * 100)}%, Sun {Math.round(weights[1] * 100)}%, Earth {Math.round(weights[2] * 100)}{t('%, cold-trap proximity')} {Math.round(weights[3] * 100)}%.</p>}
              {candidate ? <div className="mission-metrics">
                <span>{t('Selected score')} <b>{(candidate.score * 100).toFixed(1)} / 100{candidate.pareto ? ' · Pareto front' : ''}</b></span>
                <span>{t('Sampled terrain max')} <b>{candidate.slope.toFixed(1)}° · {candidate.roughness.toFixed(1)} m RMS</b></span>
                <span>{t('Sun')} <b>{candidate.sunPercent.toFixed(1)}{t('% clear samples ·')} {candidate.sunUnknown} {t('unknown · arrival')} {format(candidate.sunClearance, '°')}</b></span>
                <span>{t('Earth')} <b>{candidate.earthPercent.toFixed(1)}{t('% clear samples ·')} {candidate.earthUnknown} {t('unknown · arrival')} {format(candidate.earthClearance, '°')}</b></span>
                <span>{t('Surface peak')} <b>{format(candidate.peak, 'K')} · {candidate.bins ?? 'Unknown'} {t('source bins')}</b></span>
                <span>{t('Modeled cold trap')} <b>{format(candidate.coldDistanceKm, 'km')}</b></span>
              </div> : <p>{search ? 'No candidate met the sampled screening limits.' : 'Environmental arrival evidence is unavailable for this map selection.'}</p>}
              {!!search?.data.best.length && <div className="risk-table-wrap"><table className="risk-table">
                <caption>{t('Ranked alternatives')}</caption>
                <thead><tr><th scope="col">{t('Site')}</th><th scope="col">{t('Arrival UTC')}</th><th scope="col">{t('Score / 100')}</th></tr></thead>
                <tbody>{search.data.best.map(item => <tr key={item.site.id + item.time}><th scope="row">{item.site.name}</th><td>{utc(item.time)}</td><td>{(item.score * 100).toFixed(1)}</td></tr>)}</tbody>
              </table></div>}
              {!!search?.data.rejected.length && <p>{t('Rejections by reason and location are included in the JSON export.')}</p>}
            </section>
            <section><h3>{t('Descent and risk')}</h3>
              {report.descent ? <>
                <p>{t('Reviewed scenario ·')} {report.descent.selected}</p>
                <div className="risk-table-wrap"><table className="risk-table">
                  <thead><tr><th scope="col">{t('Scenario')}</th><th scope="col">{t('Within modeled limits')}</th><th scope="col">{t('Exceeded')}</th><th scope="col">{t('Unresolved')}</th></tr></thead>
                  <tbody>{report.descent.scenarios.map(item => <tr key={item.name}><th scope="row">{item.name}</th>
                    <td>{rate(item.counts.within, item.settings.trials)}</td><td>{rate(item.counts.exceeded, item.settings.trials)}</td><td>{rate(item.counts.unknown, item.settings.trials)}</td>
                  </tr>)}</tbody>
                </table></div>
                {report.descent.scenarios.filter(item => item.name === report.descent?.selected).map(item => <div key={item.name}>
                  <p>{t('Entry')} {item.settings.altitude} m · {item.settings.speed} m/s · {item.settings.angle}{t('° descent angle ·')} {item.settings.bearing}{t('° heading. Dispersion 1σ')} {item.settings.alongSigma} {t('m along track,')} {item.settings.acrossSigma} {t('m across track,')} {item.settings.speedSigma}{t('% entry speed.')} {item.settings.trials} draws · seed {item.settings.seed}.</p>
                  <p>{t('Duration')} {item.nominal.duration.toFixed(1)} {t('s · required / available thrust')} {item.nominal.thrustKN.toFixed(2)} / {item.settings.thrustKN} {t('kN · approach clearance')} {format(item.nominal.clearance, 'm')} {t('· touchdown slope')} {format(item.nominal.touchdownSlope, '°')}.</p>
                  <p>{t('Trials exceeding each limit · terrain')} {item.counts.terrain} · slope {item.counts.slope} · roughness {item.counts.roughness} {t('· screening square')} {item.counts.footprint} · thrust {item.counts.thrust}{t('. Categories may overlap.')}</p>
                </div>)}
              </> : <p>{t('This report captures landing screening. Add descent evidence by creating a report from Landing Simulation or Risk Assessment.')}</p>}
            </section>
            <section><h3>{t('Data, assumptions and limits')}</h3>
              <p>{t('Regional screening uses a 160 m LOLA derivative. Sun and Earth center clearance is sampled geometry. Diviner values describe climatological surface conditions. Descent uses constant mass and braking with assumed independent navigation errors. Results support comparative screening.')}</p>
              <ul>{reportSources.map(source => <li key={source.href}><a href={source.href} target="_blank" rel="noreferrer">{t(source.name)}</a></li>)}</ul>
              <p>{t('Asset checksums are included in the JSON export.')}</p>
            </section>
            </>}
          </article>
        </>}
      </div>
    </div>
  </dialog>
}

function ArtemisReview({ report }: { report: NonNullable<MissionReport['artemisReview']> }) {
  const { t } = useLanguage()
  const study = report.comparison
  return <>
    <section><h3>{t('Published mission plan')}</h3><p>Artemis {report.mission} · {t(report.target)} {t('· NASA update')} {report.updated}</p></section>
    {report.vehicles && <section><h3>{t('Vehicle Overview')}</h3><dl>{report.vehicles.map(([label, value]) =>
      <div key={label}><dt>{t(label)}</dt><dd>{t(value)}</dd></div>)}</dl></section>}
    {report.timeline && <section><h3>{t('Illustrative mission sequence')}</h3><ol>{report.timeline.map(([label, value]) =>
      <li key={label}><strong>{t(label)}</strong> · {t(value)}</li>)}</ol></section>}
    {study && <>
      <section><h3>{t('Study assumption')}</h3>
        <p>{t(report.lander ?? 'Unavailable')} {t('· Historical NASA study areas · 2024')}</p>
        <p>{utc(study.settings.first)} to {utc(study.settings.end)} · {study.settings.height} m observer · {study.settings.radius / 1000} km horizon</p>
        <p>{study.settings.power.orientation} panel · {study.settings.power.area} m² · {study.settings.power.efficiency}{t('% conversion ·')} {study.settings.power.capacity} Wh battery · {study.settings.power.load} W load. Radio {study.settings.link.frequency} GHz · {study.settings.link.power} {t('W transmit power ·')} {study.settings.stationMask}{t('° station mask. Full settings are included in JSON.')}</p>
      </section>
      <section><h3>{t('Modeled result')}</h3>
        {study.sites.map(site => <div key={site.name}><h4>{site.name} · {site.latitude.toFixed(5)}°, {site.longitude.toFixed(5)}°</h4>
          <p>{t('Elevation')} {format(site.environment?.elevation ?? null, 'm')} · slope {format(site.environment?.slope ?? null, '°')} {t('· climatological mean / peak')} {format(site.environment?.thermal?.mean ?? null, 'K')} / {format(site.environment?.thermal?.peak ?? null, 'K')} {t('· permanent shadow fraction')} {format(site.environment?.thermal?.shadowFraction == null ? null : site.environment.thermal.shadowFraction * 100, '%')}</p>
          <p>{t('Known solar disk visibility')} {format(site.sunHours, 'h')} {t('· generation')} {format(site.generatedWh, 'Wh')} {t('· minimum charge')} {format(site.lowestCharge, '%')} {t('· known Earth-center visibility')} {format(site.earthHours, 'h')} {t('· modeled radio link')} {format(site.radioHours, 'h')}</p>
        </div>)}
      </section>
    </>}
    <section><h3>{t('Sources and coverage')}</h3><ul>{report.sources.map(source => <li key={source.name}>
      <a href={source.href} target="_blank" rel="noreferrer">{t(source.name)}</a> · {t(source.label)} · {t(source.detail)}
    </li>)}</ul></section>
  </>
}
