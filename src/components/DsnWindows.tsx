import { useLanguage } from '../lib/i18n'
import { useEffect, useMemo, useState } from 'react'
import type { Coordinates } from '../domain/lunar'
import type { Ephemeris } from '../services/science/ephemeris'
import type { HorizonProfile } from '../services/science/terrainHorizon'
import { DSN_STATIONS, dsnAt, loadDsnOrientation, type DsnOrientation } from '../services/science/dsn'
import { LINK_FIELDS, type LinkInputs } from '../services/science/earthLink'

const STEP = 600_000
const BOLTZMANN_DBW_PER_K_HZ = -228.599167
const utc = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ')
const statuses: Record<string, string> = {
  'Meets modeled limits': '#7ac6a6',
  'Below sensitivity': '#e8bf79',
  'Blocked by lunar terrain': '#ce846f',
  'Below station mask': '#527fa4',
  'Unknown lunar terrain': '#647783',
}

export function DsnWindows({ data, coordinates, profile, height, time, first, end, radio }: {
  data: Ephemeris; coordinates: Coordinates; profile: HorizonProfile | null; height: number
  time: number; first: number; end: number; radio: LinkInputs
}) {
  const { t } = useLanguage()
  const [orientation, setOrientation] = useState<DsnOrientation | null>(null)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState('')
  const [mask, setMask] = useState(10)
  const [noiseTemperature, setNoiseTemperature] = useState(100)
  const [requiredEbN0, setRequiredEbN0] = useState(6)
  const [rateLimit, setRateLimit] = useState(1000)
  const [gain, setGain] = useState<Record<string, number>>({})
  useEffect(() => {
    const controller = new AbortController()
    loadDsnOrientation(controller.signal).then(value => {
      if (!controller.signal.aborted) setOrientation(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError('Station orientation data could not be loaded.')
    })
    return () => controller.abort()
  }, [retry])
  const valid = mask >= 0 && mask <= 90 && Object.values(gain).every(value => value >= LINK_FIELDS.receiveGain.min && value <= LINK_FIELDS.receiveGain.max)
  const rateValid = noiseTemperature >= 1 && noiseTemperature <= 10000 && requiredEbN0 >= 0 && requiredEbN0 <= 40 && rateLimit >= 1 && rateLimit <= 1000000
  const covers = !!orientation && first >= orientation.start && time >= orientation.start &&
    Math.max(end, time) <= orientation.start + (orientation.values.length / 4 - 1) * orientation.stepMs
  const results = useMemo(() => {
    if (!orientation || !valid || !covers) return []
    return DSN_STATIONS.map(station => {
      const receiveGain = gain[station.id] ?? radio.receiveGain
      const at = (t: number) => {
        const sample = dsnAt(data, orientation, t, coordinates, profile, height, station, mask, { ...radio, receiveGain })
        const noise = BOLTZMANN_DBW_PER_K_HZ + 10 * Math.log10(noiseTemperature)
        const rate = rateValid && sample.status === 'Meets modeled limits' ?
          Math.min(rateLimit * 1000, 10 ** ((sample.received - 30 - noise - requiredEbN0) / 10)) : null
        return { ...sample, rate }
      }
      const rows = Array.from({ length: Math.ceil((end - first) / STEP) }, (_, index) => {
        const from = first + index * STEP
        const to = Math.min(end, from + STEP)
        return { from, to, ...at((from + to) / 2) }
      })
      const windows: { from: number; to: number; status: string }[] = []
      let geometryMs = 0, linkMs = 0, bits = 0
      for (const row of rows) {
        const last = windows.at(-1)
        if (last?.status === row.status) last.to = row.to
        else windows.push({ from: row.from, to: row.to, status: row.status })
        if (row.geometry === 'Clear geometry') geometryMs += row.to - row.from
        if (row.status === 'Meets modeled limits') linkMs += row.to - row.from
        bits += (row.rate ?? 0) * (row.to - row.from) / 1000
      }
      return { station, receiveGain, rows, windows, current: at(time), geometryMs, linkMs, bits }
    })
  }, [orientation, covers, valid, data, coordinates.latitude, coordinates.longitude, profile, height, mask, gain, radio, first, end, time,
    noiseTemperature, requiredEbN0, rateLimit, rateValid])

  function download() {
    const heading = 'station,from_utc,to_utc,latitude_deg,longitude_deg,mast_m,station_elevation_deg,minimum_station_elevation_deg,lunar_azimuth_deg,lunar_elevation_deg,lunar_clearance_deg,distance_km,margin_db,geometry,status,allocation,frequency_ghz,tx_w,tx_gain_dbi,rx_gain_dbi,losses_db,sensitivity_dbm,modeled_bps,noise_temperature_k,required_eb_n0_db,radio_limit_kbps'
    const rows = results.flatMap(({ station, rows, receiveGain }) => rows.map(row => [
      station.id, new Date(row.from).toISOString(), new Date(row.to).toISOString(), coordinates.latitude, coordinates.longitude,
      height, row.stationElevation, mask, row.azimuth, row.elevation, row.clearance, row.distance, row.margin, row.geometry, row.status, 'unverified',
      radio.frequency, radio.power, radio.transmitGain, receiveGain, radio.losses, radio.sensitivity, row.rate,
      rateValid ? noiseTemperature : '', rateValid ? requiredEbN0 : '', rateValid ? rateLimit : '',
    ].join(',')))
    const url = URL.createObjectURL(new Blob([[heading, ...rows].join('\n')], { type: 'text/csv' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'alpha-lunar-dsn-windows.csv'
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <div className="dsn-windows">
    <h3>{t('DSN station windows')}</h3>
    <p>{t('Geometry uses both the lunar terrain horizon and the station’s minimum elevation. Antenna allocation is unverified for every window.')}</p>
    <p>{utc(first)} → {utc(end)} {t('UTC · 10-minute samples')}</p>
    <div className="mission-fields mission-date">
      <label>{t('Minimum station elevation (°)')}<input type="number" min="0" max="90" step=".1" value={Number.isFinite(mask) ? mask : ''} onChange={e => setMask(e.target.valueAsNumber)} /></label>
      {DSN_STATIONS.map(station => {
        const value = gain[station.id] ?? radio.receiveGain
        return <label key={station.id}>{station.name} {t('receive gain (dBi)')}<input type="number" min="-20" max="100" step=".1"
          value={Number.isFinite(value) ? value : ''} onChange={e => setGain(old => ({ ...old, [station.id]: e.target.valueAsNumber }))} /></label>
      })}
    </div>
    <details className="mission-candidate"><summary>{t('Data rate assumptions')}</summary><div className="mission-fields mission-date">
      <label>{t('Receiver system temperature (K)')}<input type="number" min="1" max="10000" value={Number.isFinite(noiseTemperature) ? noiseTemperature : ''} onChange={e => setNoiseTemperature(e.target.valueAsNumber)} /></label>
      <label>{t('Required Eb/N₀ (dB)')}<input type="number" min="0" max="40" value={Number.isFinite(requiredEbN0) ? requiredEbN0 : ''} onChange={e => setRequiredEbN0(e.target.valueAsNumber)} /></label>
      <label>{t('Radio rate limit (kbps)')}<input type="number" min="1" max="1000000" value={Number.isFinite(rateLimit) ? rateLimit : ''} onChange={e => setRateLimit(e.target.valueAsNumber)} /></label>
    </div>{!rateValid && <p>{t('Enter data rate assumptions within their displayed ranges.')}</p>}</details>
    {error && <p role="alert">{t(error)} <button onClick={() => { setError(''); setRetry(n => n + 1) }}>{t('Retry')}</button></p>}
    {!orientation && !error && <p role="status">{t('Loading Earth orientation…')}</p>}
    {orientation && !covers && <p role="alert">{t('The selected time falls outside the station orientation asset.')}</p>}
    {!valid && <p role="alert">{t('Enter elevation and receive gain within their field ranges.')}</p>}
    {results.map(({ station, current, windows, geometryMs, linkMs, bits }) => <article className="dsn-card" key={station.id}>
      <h4>{station.name} <small>{station.id}</small></h4>
      <p>{t(current.status)} {t('· station elevation')} {current.stationElevation.toFixed(2)}{t('° · modeled margin')} {current.margin.toFixed(1)} dB</p>
      <div className="mission-metrics">
        <span>{t('Known clear geometry')} <b>{(geometryMs / 3_600_000).toFixed(1)} h</b></span>
        <span>{t('Meets link limits')} <b>{(linkMs / 3_600_000).toFixed(1)} h</b></span>
        <span>{t('Modeled rate at epoch')} <b>{current.rate === null ? '—' : (current.rate / 1000).toFixed(1) + ' kbps'}</b></span>
        <span>{t('Potential transfer in modeled windows')} <b>{rateValid ? (bits / 8e6).toFixed(1) + ' MB' : '—'}</b></span>
      </div>
      <div className="dsn-strip" aria-hidden="true">{windows.map(window => <i key={window.from} style={{
        width: 100 * (window.to - window.from) / (end - first) + '%', background: statuses[window.status],
      }} />)}</div>
      <details><summary>{t('Station windows (UTC)')}</summary><ul className="mission-rejections compare-windows">
        {windows.map(window => <li key={window.from}>{utc(window.from)} → {utc(window.to)} · {t(window.status)}</li>)}
      </ul></details>
    </article>)}
    {!!results.length && <>
      <ul className="link-legend">{Object.entries(statuses).map(([label, color]) => <li key={label}><i style={{ background: color }} />{label}</li>)}</ul>
      <button onClick={download}>{t('Download station CSV')}</button>
    </>}
    <p className="time-note">{t('Earth orientation uses NAIF observations and predictions. The 10° initial mask and receive gains are editable study inputs. The free-space margin uses the selected radio settings.')}</p>
  </div>
}
