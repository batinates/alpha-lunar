import { useLanguage } from '../lib/i18n'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { Html, Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { X } from 'lucide-react'
import { Vector3, type Group } from 'three'
import { APOLLO_SITES, APOLLO_SOURCE, ORBITERS, type OrbiterId } from '../data/spacecraft'
import { formatLatitude, formatLongitude, latLonToVector3 } from '../lib/lunarCoordinates'
import { NasaSpacecraft } from './SpacecraftModels'

type MissionSelection = { apollo: string; orbiter: OrbiterId; animate: boolean }
type MissionControls = MissionSelection & { onApollo: (id: string) => void }

export function LunarMissions({ apollo, orbiter, animate, onApollo, onOrbiter, onAnimate, onClose, showDetails, onDetails }: MissionControls & {
  onOrbiter: (id: OrbiterId) => void; onAnimate: (play: boolean) => void; onClose: () => void
  showDetails: boolean; onDetails: () => void
}) {
  const { t, language } = useLanguage()
  const site = APOLLO_SITES.find(s => s.id === apollo) ?? APOLLO_SITES[0]
  const satellite = ORBITERS[orbiter]
  return <section className="time-explorer earth-link lunar-missions" aria-label={t('Lunar Missions')}>
    <header><h2>{t('Lunar Missions')}</h2><button onClick={onClose} aria-label={t('Close Lunar Missions')}><X size={18} /></button></header>
    <div className="mission-fields mission-date">
      <label>{t('Apollo landing site')}<select value={site.id} onChange={event => onApollo(event.target.value)}>
        {APOLLO_SITES.map(point => <option key={point.id} value={point.id}>{point.name} · {point.module}</option>)}
      </select></label>
      <label>{t('Lunar orbiter')}<select value={orbiter} onChange={event => onOrbiter(event.target.value as OrbiterId)}>
        {Object.entries(ORBITERS).map(([id, item]) => <option key={id} value={id}>{item.short}</option>)}
      </select></label>
    </div>
    <div className="mission-metrics">
      <span>{site.name} · {site.module}<b>{site.region}</b></span>
      <span>{t('Landing date (UTC)')}<b>{site.date}</b></span>
      <span>{t('Landing coordinates')}<b>{formatLatitude(site.latitude)} · {formatLongitude(site.longitude)}</b></span>
      <span>{t('Selected orbiter')}<b>{t(satellite.name)}</b></span>
    </div>
    <p>{t(satellite.description)}</p>
    <button className="analysis-action" aria-expanded={showDetails} aria-controls="orbiter-mission-details" onClick={onDetails}>{t('Orbiter mission details')}</button>
    {showDetails && <article id="orbiter-mission-details" className="orbiter-mission-details" aria-live="polite">
      <h3>{satellite.name} ({satellite.short})</h3>
      <p>{t(satellite.purpose)}</p>
      <dl>
        <dt>{t('Operator')}</dt><dd>{satellite.operator}</dd>
        <dt>{t('Launch date')}</dt><dd>{new Intl.DateTimeFormat(language, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(satellite.launched))}</dd>
        <dt>{t('Instruments and payloads')}</dt><dd>{satellite.instruments}</dd>
      </dl>
    </article>}
    <button onClick={() => onAnimate(!animate)}>{t(animate ? 'Pause orbit animation' : 'Play orbit animation')}</button>
    <p className="time-note">{t('Orbit motion, path height and spacecraft size are illustrated for inspection.')}</p>
    <div className="validation-downloads">
      <a href={APOLLO_SOURCE} target="_blank" rel="noreferrer">{t('NASA Apollo coordinates ↗')}</a>
      <a href={satellite.missionSource} target="_blank" rel="noreferrer">{t('NASA mission ↗')}</a>
      <a href={satellite.modelSource} target="_blank" rel="noreferrer">{t('NASA 3D model ↗')}</a>
    </div>
  </section>
}

function orbitPosition(t: number, orbit: typeof ORBITERS[OrbiterId]['orbit']) {
  const x = Math.cos(t) * orbit.radius
  const z = Math.sin(t) * orbit.radius * Math.cos(orbit.inclination)
  return new Vector3(x * Math.cos(orbit.node) + z * Math.sin(orbit.node),
    Math.sin(t) * orbit.radius * Math.sin(orbit.inclination), z * Math.cos(orbit.node) - x * Math.sin(orbit.node))
}

export function LunarMissionOverlay({ apollo, orbiter, animate, onApollo, onOrbiter }: MissionControls & { onOrbiter: (id: OrbiterId) => void }) {
  const { t } = useLanguage()
  const satellite = ORBITERS[orbiter]
  const group = useRef<Group>(null)
  const phase = useRef(.3)
  const orbit = useMemo(() => Array.from({ length: 129 }, (_, i) => orbitPosition(i / 128 * 2 * Math.PI, satellite.orbit)), [satellite])
  useEffect(() => { phase.current = .3; group.current?.position.copy(orbitPosition(.3, satellite.orbit)) }, [satellite])
  useFrame((_, dt) => {
    if (animate) {
      phase.current += Math.min(dt, .05) * satellite.orbit.speed
      group.current?.position.copy(orbitPosition(phase.current, satellite.orbit))
    }
  })
  return <>
    {APOLLO_SITES.map(site => <mesh key={site.id} position={latLonToVector3(site.latitude, site.longitude, 1.01)}
      onClick={event => { if (event.delta <= 4) { event.stopPropagation(); onApollo(site.id) } }}>
      <sphereGeometry args={[site.id === apollo ? .022 : .013, 14, 12]} />
      <meshBasicMaterial color={site.id === apollo ? '#fff3bf' : '#db9e53'} />
    </mesh>)}
    <Line points={orbit} color={satellite.color} lineWidth={1.25} transparent opacity={.65} />
    <group ref={group} onClick={event => {
      if (event.delta <= 4) { event.stopPropagation(); onOrbiter(orbiter) }
    }}>
      <mesh><sphereGeometry args={[.075, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      <Html center position={[0, .14, 0]} occlude>
        <button className="orbiter-marker" aria-label={t('Orbiter mission details') + ' · ' + satellite.name}
          onClick={() => onOrbiter(orbiter)}>{satellite.short}</button>
      </Html>
      <pointLight intensity={.55} distance={.45} color={satellite.color} position={[.1, .14, .16]} />
      <Suspense fallback={<mesh><sphereGeometry args={[.018, 12, 12]} /><meshBasicMaterial color={satellite.color} /></mesh>}>
        <NasaSpacecraft url={satellite.model} size={.14} />
      </Suspense>
    </group>
  </>
}
