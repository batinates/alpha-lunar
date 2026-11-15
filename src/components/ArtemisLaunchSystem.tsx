import { useLanguage } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { architecture, artemisVehicles, ARTEMIS_DATA_SOURCES, ARTEMIS_MISSIONS, ARTEMIS_TIMELINE, hardwareIII, landers, operationsIII, regions2024, type ArtemisMission, type ArtemisSurfaceMission } from '../data/artemis'
import './artemis.css'

export function ArtemisLaunchSystem({ onClose, onStudy, onTime, onReport }: {
  onClose: () => void; onStudy: (id: ArtemisSurfaceMission, lander: string) => void
  onTime: (id: ArtemisSurfaceMission) => void; onReport: (id: ArtemisMission) => void
}) {
  const { t } = useLanguage()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [mission, setMission] = useState<ArtemisMission>('III')
  const [lander, setLander] = useState('Starship HLS')
  const plan = ARTEMIS_MISSIONS[mission]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog className="mission-dialog artemis-dialog" ref={dialogRef} aria-labelledby="artemis-title"
      onCancel={event => { event.preventDefault(); onClose() }}>
      <div className="mission-shell">
        <header className="mission-header">
          <div>
            <h2 id="artemis-title">{t('Artemis Launch System')}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={t('Close Artemis launch system')}><X size={18} /></button>
        </header>
        <nav className="mission-tabs artemis-missions" aria-label={t('Artemis missions')}>
          {(Object.keys(ARTEMIS_MISSIONS) as ArtemisMission[]).map(id => <button key={id} className="analysis-action"
            aria-pressed={mission === id} onClick={() => setMission(id)}>Artemis {id} · {t(ARTEMIS_MISSIONS[id].target)}</button>)}
        </nav>
        <div className="mission-body">
          <section className="artemis-details" aria-label={`Artemis ${mission} mission review`}>
            <div className="artemis-kicker">{t('Published mission plan ·')} {plan.updated}</div>
            <h3>Artemis {mission} · {t(plan.target)}</h3>
            <p>{t(plan.title)}</p>
            <div className="artemis-links">
              <a href={plan.source} target="_blank" rel="noreferrer">{t('NASA mission page ↗')}</a>
              <a href={architecture} target="_blank" rel="noreferrer">{t('NASA architecture update · Nov 4, 2026 ↗')}</a>
            </div>
            <h3>{t('Vehicle Overview')}</h3>
            <dl className="artemis-specs">
              {artemisVehicles(mission).map(([label, value]) => <div key={label}><dt>{t(label)}</dt><dd>{t(value)}</dd></div>)}
            </dl>
            {mission === 'III' && <p className="artemis-links"><a href={hardwareIII} target="_blank" rel="noreferrer">{t('NASA rocket hardware update · Aug 5, 2026 ↗')}</a></p>}
            <div className="artemis-context">
              {mission === 'III' ? <>
                <h3>{t('Mission Timeline')}</h3>
                <p>{t('Illustrative mission sequence · mission trajectory file: Unavailable')}</p>
                <ol className="artemis-timeline">{ARTEMIS_TIMELINE.map(([title, description]) => <li key={title}>
                  <strong>{t(title)}</strong>
                  <p>{t(description)}</p>
                </li>)}</ol>
                <p><a href={operationsIII} target="_blank" rel="noreferrer">{t('NASA mission operations · Oct 23, 2026 ↗')}</a></p>
              </> : <>
                <h3>{t('Lunar Surface Study')}</h3>
                {mission === 'IV' ? <>
                  <label className="descent-select">{t('Lander scenario')}<select value={lander} onChange={event => setLander(event.target.value)}><option>Starship HLS</option><option>Blue Moon Mark 2</option></select></label>
                    <p>{t('Provider selection pending.')} {lander === 'Starship HLS' ? t('The published concept connects Orion and Starship in Earth orbit before lunar transfer.') : t('The published concept sends Blue Moon ahead to an elliptical polar lunar orbit for rendezvous with Orion.')}</p>
                </> : <p>{t('NASA expects Moon base work to begin with Artemis V. Final upper stage and lander selection are Not announced.')}</p>}
                <p><a href={landers} target="_blank" rel="noreferrer">{t('NASA lander concepts · Oct 23, 2026 ↗')}</a></p>
                <p>{t('Study assumption ·')} {mission === 'IV' ? t('February 1') : t('November 15')}{t(', 2028 UTC · 72 h · 5 m observer · editable concept vehicle and radio settings.')}</p>
                <div className="mission-actions">
                  <button className="analysis-action mission-primary" onClick={() => onStudy(mission, mission === 'IV' ? lander : 'Concept lander')}>{t('Compare historical study areas')} <ArrowRight size={16} /></button>
                  <button className="analysis-action" onClick={() => onTime(mission)}>{t('Open Time Explorer')}</button>
                </div>
                <p><a href={regions2024} target="_blank" rel="noreferrer">{t('Historical NASA study areas · 2024 ↗')}</a></p>
                <details><summary>{t('Data sources and coverage')}</summary><ul>{ARTEMIS_DATA_SOURCES.map(source => <li key={source.name}><a href={source.href}>{t(source.name)}</a><p>{t(source.label)} · {t(source.detail)}</p></li>)}</ul></details>
              </>}
              <button className="analysis-action" onClick={() => onReport(mission)}>{t('Save mission review')}</button>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  )
}
