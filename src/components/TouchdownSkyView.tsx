import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Earth, Minus, Plus, Sun } from 'lucide-react'
import { useLanguage } from '../lib/i18n'
import type { Coordinates } from '../domain/lunar'
import { loadDsnOrientation, orientationAt, type DsnOrientation } from '../services/science/dsn'
import type { Ephemeris } from '../services/science/ephemeris'
import type { HeightRaster } from '../services/science/lunarAssets'
import { SKY_EYE_HEIGHT, touchdownHorizon, touchdownSky, type TouchdownSky } from '../services/science/touchdownSky'
import { SceneBoundary } from './SceneBoundary'
import type { SkyCamera } from './TouchdownSkyScene'
import './touchdown-sky.css'

const SkyScene = lazy(() => import('./TouchdownSkyScene').then(module => ({ default: module.TouchdownSkyScene })))
const minute = 60_000
const angle = (value: number) => `${value.toFixed(2)}°`
const utc = (time: number) => new Date(time).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'
const clamp = (value: number, lower: number, upper: number) => Math.min(upper, Math.max(lower, value))
type Body = TouchdownSky['earth']

function BodyDetails({ body, name, onLook }: { body: Body; name: 'Earth' | 'Sun'; onLook: () => void }) {
  const { t } = useLanguage()
  const status = body.visibleFraction === null ? 'Incomplete horizon coverage'
    : body.visibleFraction === 0 ? 'Hidden by terrain'
    : body.visibleFraction < 1 ? 'Partly above terrain' : 'Above terrain'
  return <article className="touchdown-body">
    <div><strong>{t(name)}</strong><span>{t(status)}</span></div>
    <dl>
      <dt>{t('Azimuth')}</dt><dd>{angle(body.azimuth)}</dd>
      <dt>{t('Elevation')}</dt><dd>{angle(body.elevation)}</dd>
      <dt>{t('Local terrain horizon')}</dt><dd>{body.horizon === null ? t('Unknown') : angle(body.horizon)}</dd>
      <dt>{t('Angular diameter')}</dt><dd>{angle(body.radius * 2)}</dd>
    </dl>
    <button type="button" className="analysis-action" onClick={onLook}>
      {name === 'Earth' ? <Earth size={15} /> : <Sun size={15} />}{t(name === 'Earth' ? 'Look at Earth' : 'Look at Sun')}
    </button>
  </article>
}

export function TouchdownSkyView({ raster, point, time, ephemeris, ephemerisError, onReturn }: {
  raster: HeightRaster; point: Coordinates; time: number; ephemeris: Ephemeris | null; ephemerisError: string
  onReturn: () => void
}) {
  const { t } = useLanguage()
  const [minutes, setMinutes] = useState(0)
  const [orientation, setOrientation] = useState<DsnOrientation>()
  const [view, setView] = useState<SkyCamera | null>(null)
  const drag = useRef<{ pointer: number; x: number; y: number } | null>(null)
  const profile = useMemo(() => {
    try { return touchdownHorizon(raster, point) } catch { return null }
  }, [raster, point.latitude, point.longitude])

  useEffect(() => {
    const controller = new AbortController()
    loadDsnOrientation(controller.signal).then(data => {
      if (!controller.signal.aborted) setOrientation(data)
    }).catch(() => {})
    return () => controller.abort()
  }, [])

  const start = ephemeris ? Date.parse(ephemeris.start) : NaN
  const end = ephemeris ? start + ephemeris.stepMs * (ephemeris.rows.length - 1) : NaN
  const maxOffset = ephemeris ? Math.max(0, Math.min(72 * 60, Math.floor((end - time) / minute))) : 0
  const elapsed = Math.min(minutes, maxOffset)
  const observation = time + elapsed * minute
  const sky = ephemeris && profile && observation >= start && observation <= end ? touchdownSky(ephemeris, observation, point, profile) : null
  let rotation
  if (orientation && sky) {
    try { rotation = orientationAt(orientation, observation) } catch { /* The geometric globe remains available. */ }
  }
  const initial = sky?.earth.visibleFraction === 0 && sky.sun.visibleFraction !== 0 ? sky.sun : sky?.earth
  const camera = view ?? { azimuth: initial?.azimuth ?? 0, elevation: clamp(initial?.elevation ?? 0, -12, 25), fov: 36 }

  function aim(body: Body, fov: number) {
    setView({ azimuth: body.azimuth, elevation: clamp(body.elevation, -89.8, 89.8), fov })
  }
  function move(dx: number, dy: number) {
    setView(previous => {
      const current = previous ?? camera
      return { ...current, azimuth: (current.azimuth + dx + 360) % 360, elevation: clamp(current.elevation + dy, -89.8, 89.8) }
    })
  }

  return <section className="touchdown-sky" aria-label={t('Touchdown sky')}>
    <div className="touchdown-sky-heading">
      <div><h3>{t('Touchdown sky')}</h3><p>{point.latitude.toFixed(6)}°, {point.longitude.toFixed(6)}° · {SKY_EYE_HEIGHT} m {t('above touchdown terrain')}</p></div>
      <time dateTime={new Date(observation).toISOString()}>{utc(observation)}</time>
      <button type="button" className="analysis-action" onClick={onReturn}>{t('Return to trajectory')}</button>
    </div>
    {!profile && <p role="status">{t('Touchdown terrain is unavailable.')}</p>}
    {profile && !ephemeris && <p role="status">{t(ephemerisError || 'Loading touchdown ephemeris…')}</p>}
    {profile && ephemeris && !sky && <p role="status">{t('Touchdown is outside ephemeris coverage.')}</p>}
    {profile && sky && <>
      <div className="touchdown-sky-canvas descent-scene" role="group" tabIndex={0} aria-label={t('3D sky from the touchdown point')}
        onPointerDown={event => {
          if (event.button !== 0 || drag.current) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
        }}
        onPointerMove={event => {
          const last = drag.current
          if (!last || event.pointerId !== last.pointer) return
          const factor = camera.fov / Math.max(1, event.currentTarget.clientHeight)
          move((last.x - event.clientX) * factor, (event.clientY - last.y) * factor)
          drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
        }}
        onLostPointerCapture={() => { drag.current = null }}
        onKeyDown={event => {
          const offsets: Record<string, [number, number]> = { ArrowLeft: [-4, 0], ArrowRight: [4, 0], ArrowUp: [0, 4], ArrowDown: [0, -4] }
          const shift = offsets[event.key]
          if (shift) { event.preventDefault(); move(...shift) }
        }}>
        <SceneBoundary><Suspense fallback={null}><SkyScene raster={raster} profile={profile} point={point} sky={sky} rotation={rotation} view={camera} /></Suspense></SceneBoundary>
        <span className="touchdown-compass"><Compass size={15} /> {angle(camera.azimuth)} / {angle(camera.elevation)} · {camera.fov}° {t('FOV')}</span>
      </div>
      <div className="touchdown-sky-controls">
        <p>{t('Drag or use arrow keys to look around.')}</p>
        <button type="button" className="analysis-action" aria-label={t('Zoom out')} disabled={camera.fov >= 70}
          onClick={() => setView({ ...camera, fov: Math.min(70, camera.fov + 6) })}><Minus size={15} /></button>
        <button type="button" className="analysis-action" aria-label={t('Zoom in')} disabled={camera.fov <= 10}
          onClick={() => setView({ ...camera, fov: Math.max(10, camera.fov - 6) })}><Plus size={15} /></button>
      </div>
      <label className="touchdown-sky-time">
        <span>{t('Time since touchdown')} <b>{Math.floor(elapsed / 60)} {t('h')} {elapsed % 60} {t('min')}</b></span>
        <input type="range" min={0} max={maxOffset} step={1} disabled={maxOffset === 0} value={elapsed}
          onChange={event => setMinutes(event.currentTarget.valueAsNumber)} />
      </label>
      <div className="touchdown-sky-bodies">
        <BodyDetails body={sky.earth} name="Earth" onLook={() => aim(sky.earth, 22)} />
        <BodyDetails body={sky.sun} name="Sun" onLook={() => aim(sky.sun, 13)} />
      </div>
      {sky.solarTransmission < 1 && <p>{t('Sun disk unobscured by Earth')} · {(sky.solarTransmission * 100).toFixed(1)}%</p>}
      {!rotation && <p>{t('Earth orientation unavailable; globe appearance is illustrative.')}</p>}
      <p className="touchdown-sky-source">
        {t('Geometric directions and angular sizes. LOLA horizon sampled to 100 km at 160 m spacing.')}
        {' '}<a href="/lunar/ephemeris-provenance.json" target="_blank" rel="noreferrer">SPICE / DE421</a>
        {' · '}<a href="/lunar/dsn-orientation.json" target="_blank" rel="noreferrer">JPL / ITRF93</a>
        {' · '}<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/" target="_blank" rel="noreferrer">NASA Blue Marble</a>
      </p>
    </>}
  </section>
}
