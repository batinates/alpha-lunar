import { useLanguage } from '../lib/i18n'
import { Database, RotateCw, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Coordinates } from '../domain/lunar'
import { formatLatitude, formatLongitude } from '../lib/lunarCoordinates'
import { latLonToPolar, type HeightRaster } from '../services/science/lunarAssets'
import {
  COLD_TRAP_K, DIVINER_SOURCE, ENVIRONMENT_MANIFEST, LCROSS_IMPACT, sampleEnvironment, SHADOW_SOURCE,
} from '../services/science/polarEnvironment'
import { screenTerrain, thermalExceedances } from '../services/science/siteScreening'

export type PolarAnalysis = 'terrain' | 'thermal' | 'ice'

export const POLAR_ANALYSES = {
  terrain: { title: 'Terrain Intelligence', short: 'Slope & roughness' },
  thermal: { title: 'Thermal Analysis', short: 'Diviner surface temperature' },
  ice: { title: 'Water Ice & Resources', short: 'Cold traps, shadow & evidence' },
}

interface Props {
  analysis: PolarAnalysis
  coordinates: Coordinates
  raster: HeightRaster | null
  environment: DataView | null
  failed: boolean
  onRetry: () => void
  onClose: () => void
  onSelectImpact: () => void
}

export function PolarAnalysisPanel({
  analysis, coordinates, raster, environment, failed, onRetry, onClose, onSelectImpact,
}: Props) {
  const { t } = useLanguage()
  const [span, setSpan] = useState(640)
  const [slopeLimit, setSlopeLimit] = useState('10')
  const [roughnessLimit, setRoughnessLimit] = useState('5')
  const [lower, setLower] = useState('100')
  const [upper, setUpper] = useState('300')
  const { x, z } = latLonToPolar(coordinates.latitude, coordinates.longitude)
  const terrain = useMemo(
    () => analysis === 'terrain' && raster ? screenTerrain(raster, x, z, span) : null,
    [analysis, raster, x, z, span],
  )
  const cell = environment ? sampleEnvironment(environment, x, z) : null
  const slope = Number(slopeLimit)
  const roughness = Number(roughnessLimit)
  const terrainLimitsValid = slopeLimit !== '' && roughnessLimit !== '' && slope >= 0 && slope <= 90 && roughness >= 0
  const thermalStatus = cell?.peak == null || upper === '' ? null : thermalExceedances(cell.peak, Number(lower), Number(upper))
  const impactSelected = coordinates.latitude === LCROSS_IMPACT.latitude && coordinates.longitude === LCROSS_IMPACT.longitude

  return <aside className="right-panel polar-analysis" aria-label={POLAR_ANALYSES[analysis].title}>
    <div className="panel-topline"><span>{t('SOUTH POLE ANALYSIS')}</span><button onClick={onClose} aria-label={t('Close polar analysis')}><X size={16} /></button></div>
    <div className="polar-analysis__body">
      <div className="location-index">{formatLatitude(coordinates.latitude)} / {formatLongitude(coordinates.longitude)}</div>
      <h2>{POLAR_ANALYSES[analysis].title}</h2>
      <p>{t('Select a point on the terrain or a named landmark.')}</p>
      {failed && <div className="analysis-result caution" role="alert">
        {t('Scientific grid could not be loaded.')}
        <button className="analysis-action" onClick={onRetry}><RotateCw size={13} /> {t('Retry')}</button>
      </div>}
      {!failed && (analysis === 'terrain' ? !raster : !environment) && <p role="status">{t('Loading scientific grid…')}</p>}

      {analysis === 'terrain' && <>
        <div className="analysis-controls">
          <label>{t('Screening square')}<select value={span} onChange={e => setSpan(Number(e.target.value))}>
            {[320, 640, 1280, 2560].map(size => <option key={size} value={size}>{size} × {size} m</option>)}
          </select></label>
          <label>{t('Max slope (°)')}<input type="number" min="0" max="90" step="0.1" value={slopeLimit} onChange={e => setSlopeLimit(e.target.value)} /></label>
          <label>{t('Max RMS roughness (m)')}<input type="number" min="0" step="0.1" value={roughnessLimit} onChange={e => setRoughnessLimit(e.target.value)} /></label>
        </div>
        {terrain ? <>
          <dl className="analysis-metrics">
            <div><dt>{t('Elevation')}</dt><dd>{terrain.height.toFixed(0)} m</dd></div>
            <div><dt>{t('Center slope')}</dt><dd>{terrain.centerSlope.toFixed(1)}°</dd></div>
            <div><dt>{t('Max sampled slope')}</dt><dd>{terrain.maxSlope.toFixed(1)}°</dd></div>
            <div><dt>{t('Max sampled RMS')}</dt><dd>{terrain.maxRoughness.toFixed(2)} m</dd></div>
          </dl>
          <div className={`analysis-result ${terrainLimitsValid && (terrain.maxSlope > slope || terrain.maxRoughness > roughness) ? 'caution' : ''}`} role="status">
            {!terrainLimitsValid ? 'Enter valid slope and roughness limits.' :
              terrain.maxSlope > slope || terrain.maxRoughness > roughness ?
                `Limit exceeded: ${[terrain.maxSlope > slope && 'slope', terrain.maxRoughness > roughness && 'roughness'].filter(Boolean).join(' and ')}.` :
                'Sampled terrain is within the entered limits.'}
            <small>{terrain.sampleCount} {t('evaluation points · regional screening only')}</small>
          </div>
        </> : raster && <p role="status">{t('The screening square extends beyond usable DEM coverage.')}</p>}
        <div className="analysis-source">
          <strong><Database size={14} /> {t('Derived from interpolated altimetry')}</strong>
          <p>{t('LOLA 40 m source, averaged to 160 m. Slope uses a 320 m baseline. RMS is relative to a fitted plane over 3 × 3 samples. Boulder density, footprint-scale obstacles and approach hazards remain unknown.')}</p>
          <a href="/lunar/manifest.json" target="_blank" rel="noreferrer">{t('LOLA provenance ↗')}</a>
        </div>
      </>}

      {analysis === 'thermal' && <>
        <dl className="analysis-metrics">
          <div><dt>{t('Modeled surface peak')}</dt><dd>{cell?.peak == null ? '—' : `${cell.peak.toFixed(1)} K`}</dd></div>
          <div><dt>{t('Modeled surface mean')}</dt><dd>{cell?.mean == null ? '—' : `${cell.mean.toFixed(1)} K`}</dd></div>
          <div><dt>{t('Source sampling')}</dt><dd>{cell?.bins == null ? '—' : `${cell.bins} bins`}</dd></div>
        </dl>
        <div className="analysis-controls">
          <label>{t('Lower surface limit (K)')}<input type="number" min="1" step="1" value={lower} onChange={e => setLower(e.target.value)} /></label>
          <label>{t('Upper surface limit (K)')}<input type="number" min="1" step="1" value={upper} onChange={e => setUpper(e.target.value)} /></label>
        </div>
        {environment && <div className="analysis-result" role="status">
          {cell?.peak == null ? 'Surface peak unavailable at this location.' : thermalStatus ?? 'Enter a valid temperature range.'}
          <small>{t('Peak-only screening cannot establish minima, duration or hardware temperature.')}</small>
        </div>}
        <div className="analysis-source">
          <strong><Database size={14} /> {t('Observation-derived thermal model')}</strong>
          <p>{t('The 480 m grid aggregates Diviner-derived 240 m cells. Sampling shows the lowest populated-bin count in the source stencil. Results are climatological summaries and include interpolation.')}</p>
          <a href={DIVINER_SOURCE} target="_blank" rel="noreferrer">{t('Diviner dataset ↗')}</a>
        </div>
      </>}

      {analysis === 'ice' && <>
        <dl className="analysis-metrics">
          <div><dt>{t('Thermal cold-trap screen')}</dt><dd>{cell?.peak == null ? t('Unknown') : cell.peak < COLD_TRAP_K ? 'Below 110 K' : '110 K or above'}</dd></div>
          <div><dt>{t('Modeled permanent shadow')}</dt><dd>{cell?.shadowFraction == null ? t('Unknown') : `${(cell.shadowFraction * 100).toFixed(1)}%`}</dd></div>
        </dl>
        <div className="analysis-source">
          <strong><Database size={14} /> {t('Evidence at the selected location')}</strong>
          <p>{impactSelected ? 'LCROSS detected water in ejecta from the Cabeus impact. This is a localized observation.' : 'Direct ice evidence at this coordinate is unknown in the loaded data. Cold-trap and shadow values describe environmental conditions.'}</p>
          <button className="analysis-action" onClick={onSelectImpact}>{t('Locate LCROSS impact ↗')}</button>
          <a href={LCROSS_IMPACT.scienceUrl} target="_blank" rel="noreferrer">{t('NASA LCROSS evidence ↗')}</a>
          {impactSelected && <a href={LCROSS_IMPACT.locationUrl} target="_blank" rel="noreferrer">{t('Impact location and uncertainty ↗')}</a>}
        </div>
        <div className="analysis-source">
          <strong><Database size={14} /> {t('Modeled cold-trap and shadow layers')}</strong>
          <p>Peak &lt;110 K is a thermal screening threshold. Shadow is the fraction of a 480 m cell flagged by the LOLA illumination model at 60 m. Ice concentration, depth and recoverability remain unknown.</p>
          <a href={SHADOW_SOURCE} target="_blank" rel="noreferrer">{t('NASA shadow model ↗')}</a>
          <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6130389/" target="_blank" rel="noreferrer">{t('Published M³ observations ↗')}</a>
        </div>
      </>}
      <a className="analysis-manifest" href={ENVIRONMENT_MANIFEST} target="_blank" rel="noreferrer">{t('METHODS, SOURCES & CHECKSUMS ↗')}</a>
    </div>
  </aside>
}

export function PolarAnalysisLegend({ analysis }: { analysis: PolarAnalysis }) {
  const { t } = useLanguage()
  return <div className={`elevation-legend polar-legend polar-legend--${analysis}`}>
    {analysis === 'terrain' ? <><span>{t('LOLA SLOPE / °')}</span><i /><div><b>0°</b><b>10°</b><b>30°+</b></div></> :
      analysis === 'thermal' ? <><span>{t('DIVINER PEAK / K')}</span><i /><div><b>40 K</b><b>110 K</b><b>260 K</b></div></> :
        <><span>{t('WATER ICE EVIDENCE')}</span><ul><li>Cold-trap screen &lt;110 K</li><li>{t('Modeled shadow')}</li><li>{t('Both modeled conditions')}</li><li>{t('LCROSS observation')}</li></ul></>}
    <small>{analysis === 'ice' ? 'Gray · neither condition or unavailable. Select a cell to inspect coverage.' : 'Gray · no data'}</small>
  </div>
}
