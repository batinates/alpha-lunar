export const MISSION_TYPES = ['Crewed landing', 'Robotic landing', 'Science exploration', 'Cargo delivery', 'Infrastructure deployment', 'Rover operations', 'Long-duration mission'] as const
export const PRIORITIES = ['Balanced', 'Terrain safety', 'Solar access', 'Earth visibility', 'Cold-trap research'] as const

export interface MissionProfile {
  id: string
  name: string
  spacecraft: string
  type: typeof MISSION_TYPES[number]
  artemis: boolean
  crew: number
  massKg: number
  durationHours: number
  footprintMeters: number
  maxSlope: number
  maxRoughness: number
  mastHeight: number
  minSunPercent: number
  minEarthPercent: number
  maxSurfacePeak: number
  priority: typeof PRIORITIES[number]
}

export const LIMITS = {
  crew: [0, 20], massKg: [1, 1000000], durationHours: [1, 168],
  footprintMeters: [320, 3200], maxSlope: [1, 45], maxRoughness: [.1, 100],
  mastHeight: [0, 100], minSunPercent: [0, 100], minEarthPercent: [0, 100],
  maxSurfacePeak: [0, 500],
} as const

export const ROBOTIC: MissionProfile = {
  id: 'robotic', name: 'Robotic survey', spacecraft: 'Concept lander', type: 'Robotic landing',
  artemis: false, crew: 0, massKg: 1200, durationHours: 24, footprintMeters: 640,
  maxSlope: 12, maxRoughness: 8, mastHeight: 2, minSunPercent: 40, minEarthPercent: 40,
  maxSurfacePeak: 0, priority: 'Balanced',
}

export const ARTEMIS: MissionProfile = {
  ...ROBOTIC, id: 'artemis', name: 'Artemis crewed study', spacecraft: 'Concept crewed lander', type: 'Crewed landing',
  artemis: true, crew: 2, massKg: 15000, durationHours: 72, maxSlope: 8, maxRoughness: 5,
  mastHeight: 5, minSunPercent: 90, minEarthPercent: 90, priority: 'Terrain safety',
}

export function validMission(profile: MissionProfile) {
  return Boolean(typeof profile.id === 'string' && profile.id &&
    typeof profile.name === 'string' && profile.name.trim() &&
    typeof profile.spacecraft === 'string' && profile.spacecraft.trim() &&
    typeof profile.artemis === 'boolean' && MISSION_TYPES.includes(profile.type) && PRIORITIES.includes(profile.priority) &&
    Number.isInteger(profile.crew) && Number.isInteger(profile.durationHours) &&
    Object.entries(LIMITS).every(([key, [min, max]]) => {
      const value = profile[key as keyof typeof LIMITS]
      return Number.isFinite(value) && value >= min && value <= max
    }))
}

const PROFILE_KEY = 'alpha-lunar.missions.v1'

export function readMissions(): MissionProfile[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '[]')
    return Array.isArray(saved) ? saved.filter(profile => profile && validMission(profile)) : []
  } catch {
    return []
  }
}

export function writeMissions(profiles: MissionProfile[]) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles))
}
