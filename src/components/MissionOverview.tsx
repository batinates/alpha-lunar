import { useLanguage } from '../lib/i18n'
import { useEffect, useRef } from 'react'
import { ArrowRight, X } from 'lucide-react'
import type { Coordinates } from '../domain/lunar'
import type { MissionProfile } from '../domain/mission'
import type { MissionReport } from '../domain/missionReport'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'

export function MissionOverview({ open, profile, coordinates, time, reports, onClose, onNavigate }: {
  open: boolean; profile: MissionProfile; coordinates: Coordinates; time: number; reports: MissionReport[]
  onClose: () => void; onNavigate: (target: 'configure' | 'optimize' | 'simulation' | 'reports' | 'communication' | 'power' | 'compare') => void
}) {
  const { t } = useLanguage()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (open && !ref.current?.open) ref.current?.showModal()
    if (!open && ref.current?.open) ref.current.close()
  }, [open])
  const steps = [
    ['configure', 'Configure mission', 'Edit the vehicle, mission limits and priority.'],
    ['optimize', 'Screen arrivals', 'Compare locations and times against the active profile.'],
    ['communication', 'Check Earth link', 'Compare terrain clearance and received power.'],
    ['power', 'Estimate surface power', 'Study solar generation, battery charge and energy deficits.'],
    ['compare', 'Compare sites', 'Compare terrain, power and radio over a shared UTC window.'],
    ['simulation', 'Simulate descent', 'Preview the approach and compare touchdown dispersion.'],
    ['reports', 'Open reports', `${reports.length} saved in this browser.`],
  ] as const
  return <dialog className="mission-dialog" ref={ref} aria-labelledby="overview-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="mission-shell">
      <header className="mission-header"><h2 id="overview-title">{t('Mission Overview')}</h2><button className="icon-button" aria-label={t('Close mission overview')} onClick={onClose}><X size={18} /></button></header>
      <div className="mission-body">
        <div className="mission-profile-line"><strong>{profile.name || 'Unnamed mission'}{profile.artemis ? ' · Artemis study' : ''}</strong><span>{profile.spacecraft} · {profile.type} · {profile.priority}</span></div>
        <div className="mission-metrics">
          <span>{t('Selected location')} <b>{formatLatitude(coordinates.latitude)} · {formatLongitude(coordinates.longitude)}</b></span>
          <span>{t('Selected epoch')} <b>{new Date(time).toISOString().slice(0,16).replace('T',' ')} UTC</b></span>
          <span>{t('Terrain thresholds')} <b>{profile.maxSlope || '—'}° slope · {profile.maxRoughness || '—'} m RMS</b></span>
          <span>{t('Surface stay')} <b>{profile.durationHours || '—'} h · Sun {profile.minSunPercent}% / Earth {profile.minEarthPercent}{t('% clear samples')}</b></span>
        </div>
        <div className="overview-steps">{steps.map(([target, title, detail]) => <button key={target} className="analysis-action" onClick={() => onNavigate(target)}><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16} /></button>)}</div>
      </div>
    </div>
  </dialog>
}
