import type { Coordinates } from './lunar.ts'
import type { MissionProfile } from './mission.ts'
import type { LandingOption, SearchResult } from '../services/science/landingOptimization.ts'
import type { DescentScenario } from '../services/science/descent.ts'
import lunarManifest from '../../public/lunar/manifest.json'
import ephemerisManifest from '../../public/lunar/ephemeris-provenance.json'
import environmentManifest from '../../public/lunar/polar-environment.json'
import type { ArtemisMission } from '../data/artemis'
import type { ComparisonRequest, ComparisonResult } from '../services/science/comparison.worker'

export interface SearchEvidence {
  first: number
  last: number
  sites: number
  from: Coordinates
  data: SearchResult
}

export interface MissionReportInput {
  profile: MissionProfile
  name: string
  coordinates: Coordinates
  time: number
  candidate: LandingOption | null
  artemisReview?: {
    mission: ArtemisMission; target: string; updated: string; source: string; title: string
    sources: { label: string; name: string; detail: string; href: string }[]
    vehicles?: [string, string][]
    timeline?: readonly (readonly [string, string])[]
    lander?: string
    comparison?: { settings: ComparisonRequest; sites: {
      name: string; latitude: number; longitude: number; environment?: Extract<ComparisonResult, { result: unknown }>['environment']
      generatedWh: number | null; lowestCharge: number | null; sunHours: number | null; earthHours: number | null; radioHours: number | null
    }[] }
  }
  search?: SearchEvidence
  descent?: {
    selected: string
    scenarios: Pick<DescentScenario, 'name' | 'settings' | 'nominal' | 'counts'>[]
  }
}

export interface MissionReport extends MissionReportInput {
  schema: 1
  id: string
  createdAt: string
  assets: typeof reportProvenance
}

const storageKey = 'alpha-lunar.reports.v1'

export function readReports(): MissionReport[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]')
    return Array.isArray(value) ? value.filter(item => item?.schema === 1 && item.id && item.profile && item.coordinates && item.assets &&
      Number.isFinite(item.time) && Number.isFinite(Date.parse(item.createdAt))) : []
  } catch {
    return []
  }
}

export function writeReports(reports: MissionReport[]) {
  localStorage.setItem(storageKey, JSON.stringify(reports))
}

export function descentEvidence(scenarios: DescentScenario[], selected: string) {
  return { selected, scenarios: scenarios.map(({ name, settings, nominal, counts }) => ({ name, settings, nominal, counts })) }
}

export const reportSources = [
  { name: 'NASA PDS LOLA product label', href: '/lunar/ldem_85s_40m.lbl' },
  { name: 'LOLA lineage and asset checksums', href: '/lunar/manifest.json' },
  { name: 'Diviner and polar environment provenance', href: '/lunar/polar-environment.json' },
  { name: 'NAIF SPICE kernels and interpolation check', href: '/lunar/ephemeris-provenance.json' },
  { name: 'NASA Moon surface gravity reference', href: 'https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/moon/' },
] as const

export const reportProvenance = {
  terrain: lunarManifest.outputs.find(asset => asset.file === 'south-pole-height.f32'),
  ephemeris: { file: 'ephemeris.json', sha256: ephemerisManifest.sha256, frame: ephemerisManifest.frame },
  environment: environmentManifest.output,
}
