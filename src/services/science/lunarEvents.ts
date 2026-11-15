import { interpolateEphemeris, type Ephemeris, type XYZ } from './ephemeris.ts'

const RAD = Math.PI / 180
const dot = (a: XYZ, b: XYZ) => a.reduce((sum, value, i) => sum + value * b[i], 0)
const angle = (a: XYZ, b: XYZ) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (Math.hypot(...a) * Math.hypot(...b)))))

/** Uniform disk approximation for geometric occultation by Earth. */
export function eclipseTransmission(sun: XYZ, earth: XYZ) {
  const separation = angle(sun, earth)
  const a = Math.asin(695700 / Math.hypot(...sun))
  const b = Math.asin(6378.137 / Math.hypot(...earth))
  if (separation >= a + b) return 1
  if (separation <= Math.abs(b - a)) return b >= a ? 0 : 1 - (b / a) ** 2
  const d = separation
  const c = (d * d + a * a - b * b) / (2 * d)
  const overlap = a * a * Math.acos(c / a) + b * b * Math.acos((d - c) / b) -
    d * Math.sqrt(Math.max(0, a * a - c * c))
  return Math.max(0, Math.min(1, 1 - overlap / (Math.PI * a * a)))
}

export function lunarEvents(sun: XYZ, earth: XYZ) {
  const phase = angle(sun, earth)
  const earthRadius = Math.asin(6378.137 / Math.hypot(...earth))
  const sunRadius = Math.asin(695700 / Math.hypot(...sun))
  const lat = Math.atan2(earth[2], Math.hypot(earth[0], earth[1]))
  const lon = Math.atan2(earth[1], earth[0])
  const eclipse = phase + sunRadius <= earthRadius ? 'Total solar occultation at Moon center'
    : phase < earthRadius + sunRadius ? 'Partial solar occultation at Moon center' : 'No solar occultation at Moon center'
  return { illuminated: (1 + Math.cos(phase)) / 2, subEarthLatitude: lat / RAD, subEarthLongitude: lon / RAD, eclipse }
}

export function eclipseEntries(data: Ephemeris) {
  const start = Date.parse(data.start)
  const end = start + (data.rows.length - 1) * data.stepMs
  const state = (time: number) => {
    const { sun, earth } = interpolateEphemeris(data, time)
    return lunarEvents(sun, earth).eclipse
  }
  const entries: { start: number; end: number; total: boolean }[] = []
  for (let time = start; time <= end; time += 600_000) {
    const kind = state(time)
    if (kind.startsWith('No')) continue
    const last = entries.at(-1)
    if (last && last.end + 600_000 === time) {
      last.end = time
      last.total ||= kind.startsWith('Total')
    } else entries.push({ start: time, end: time, total: kind.startsWith('Total') })
  }
  return entries
}
