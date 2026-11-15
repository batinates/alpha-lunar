import type { Coordinates } from '../../domain/lunar.ts'
import { horizonAngles, interpolateEphemeris, type Ephemeris, type XYZ } from './ephemeris.ts'
import { LUNAR_RADIUS, polarToLatLon, samplePolarHorizon, type HeightRaster } from './lunarAssets.ts'
import { eclipseTransmission } from './lunarEvents.ts'
import { diskVisibleFraction } from './solarPower.ts'
import { buildHorizon, horizonAt, type HorizonProfile } from './terrainHorizon.ts'

const radians = Math.PI / 180
export const SKY_EYE_HEIGHT = 2
const radii = { earth: 6378.137, sun: 695700 }

export function touchdownCoordinates(x: number, z: number, reference: Coordinates): Coordinates {
  return Math.hypot(x, z) < 1e-6 ? { latitude: -90, longitude: reference.longitude } : polarToLatLon(x, z)
}

/** Moon-fixed vector to the right-handed scene axes east, up, south. */
export function lunarSkyAxes({ latitude, longitude }: Coordinates): [XYZ, XYZ, XYZ] {
  const lat = latitude * radians, lon = longitude * radians
  const sl = Math.sin(lat), cl = Math.cos(lat), so = Math.sin(lon), co = Math.cos(lon)
  return [[-so, co, 0], [cl * co, cl * so, sl], [sl * co, sl * so, -cl]]
}

export function skyDirection(azimuth: number, elevation: number): XYZ {
  const az = azimuth * radians, el = elevation * radians
  return [Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)]
}

export function touchdownHorizon(raster: HeightRaster, point: Coordinates) {
  return buildHorizon(point.latitude, point.longitude, SKY_EYE_HEIGHT, (lat, lon) => samplePolarHorizon(raster, lat, lon))
}

export function touchdownSky(data: Ephemeris, time: number, point: Coordinates, profile: HorizonProfile) {
  const { earth, sun } = interpolateEphemeris(data, time)
  const height = profile.observerElevation + profile.mastHeight
  const axes = lunarSkyAxes(point)
  const local = (v: XYZ) => axes.map(axis => axis.reduce((sum, a, i) => sum + a * v[i], 0)) as XYZ
  const observer = axes[1].map(component => component * (LUNAR_RADIUS + height) / 1000)
  const relative = (v: XYZ) => v.map((component, i) => component - observer[i]) as XYZ
  function body(name: keyof typeof radii, position: XYZ) {
    const geometry = horizonAngles(position, point.latitude, point.longitude, height)
    const radius = Math.asin(radii[name] / geometry.distance) / radians
    const terrain = horizonAt(profile, geometry.azimuth)
    const fraction = terrain ? diskVisibleFraction(geometry.elevation - terrain.elevation, radius) : null
    const covered = !!terrain && terrain.range >= profile.radiusMeters
    return { ...geometry, radius, horizon: terrain?.elevation ?? null, covered,
      visibleFraction: covered || fraction === 0 ? fraction : null,
      direction: skyDirection(geometry.azimuth, geometry.elevation) }
  }
  const sunFromEarth = local(sun.map((component, i) => component - earth[i]) as XYZ)
  return { earth: body('earth', earth), sun: body('sun', sun), sunFromEarth,
    solarTransmission: eclipseTransmission(relative(sun), relative(earth)) }
}

export type TouchdownSky = ReturnType<typeof touchdownSky>
