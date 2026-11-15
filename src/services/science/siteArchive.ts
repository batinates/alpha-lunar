export interface ArchivePoint { lat: number; lon: number }
export interface ArchiveSite {
  id: string; name: string; lat: number | null; lon: number | null
  target: ArchivePoint | null; actual: ArchivePoint | null
  aliases: string[]; category: string; outcome: string; confidence: string
  coord_method: string; source: string | null; actual_date: string | null; date_precision: string | null
  polygon: [number, number][] | null; area_km2: number | null; reported_elev_m: number | null
  series?: string
}
export interface ArchiveManifest {
  schema: number; start: string; count: number; stepMs: number
  sites: ArchiveSite[]; series: Record<string, { bytes: number; sha256: string }>
  referenceComparison: { epochsAcrossSites: number; absoluteMaxDegrees: number[] }
}
export interface ArchiveHorizon {
  az_step_deg: number; observer_height_m: number; el_deg: number[]; dist_km: number[]
}
export const ARCHIVE_ROOT = '/lunar/site-archive/'

export function archiveRow(data: DataView, index: number) {
  const base = index * 8
  return {
    sunAz: data.getUint16(base, true) / 100, sunEl: data.getInt16(base + 2, true) / 100,
    earthAz: data.getUint16(base + 4, true) / 100, earthEl: data.getInt16(base + 6, true) / 100,
  }
}

export function archivedHorizonAt(profile: ArchiveHorizon, azimuth: number) {
  const offset = ((azimuth % 360 + 360) % 360) / profile.az_step_deg
  const index = Math.floor(offset)
  const next = (index + 1) % profile.el_deg.length
  return profile.el_deg[index] + (profile.el_deg[next] - profile.el_deg[index]) * (offset - index)
}

export async function archiveFetch(file: string, signal: AbortSignal) {
  const response = await fetch(ARCHIVE_ROOT + file, { signal })
  if (!response.ok) throw new Error('Archive file unavailable')
  return response
}

export async function loadArchiveSeries(manifest: ArchiveManifest, id: string, signal: AbortSignal) {
  const [buffer, horizon] = await Promise.all([
    archiveFetch(id + '.i16', signal).then(response => response.arrayBuffer()),
    archiveFetch(id + '-horizon.json', signal).then(response => response.json() as Promise<ArchiveHorizon>),
  ])
  if (buffer.byteLength !== manifest.count * 8 || manifest.series[id]?.bytes !== buffer.byteLength ||
      horizon.az_step_deg !== .25 || horizon.observer_height_m !== 2 ||
      horizon.el_deg.length !== 1440 || horizon.dist_km.length !== 1440) throw new Error('Invalid archive series')
  return { data: new DataView(buffer), horizon }
}
