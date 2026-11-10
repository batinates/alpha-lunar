import { Vector3 } from 'three'
import type { Coordinates } from '../domain/lunar'

export function latLonToVector3(latitude: number, longitude: number, radius = 1): Vector3 {
  const lat = (latitude * Math.PI) / 180
  const lon = (longitude * Math.PI) / 180
  return new Vector3(
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.cos(lon),
  )
}

export function vector3ToLatLon(point: Vector3): Coordinates {
  const normalized = point.clone().normalize()
  const latitude = Math.asin(normalized.y) * (180 / Math.PI)
  const longitude = Math.atan2(normalized.x, normalized.z) * (180 / Math.PI)
  return { latitude, longitude }
}

export function formatLatitude(value: number): string {
  return `${Math.abs(value).toFixed(2)}°${value < 0 ? 'S' : 'N'}`
}

export function formatLongitude(value: number): string {
  return `${Math.abs(value).toFixed(2)}°${value < 0 ? 'W' : 'E'}`
}
