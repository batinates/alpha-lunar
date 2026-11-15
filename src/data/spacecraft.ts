import type { Coordinates } from '../domain/lunar'

export type LanderModel = 'apollo' | 'rocket'
export const APOLLO_SOURCE = 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html'
export const APOLLO_MODEL_SOURCE = 'https://science.nasa.gov/3d-resources/apollo-lunar-module/'
export const APOLLO_SITES: (Coordinates & { id: string; name: string; module: string; region: string; date: string })[] = [
  { id: '11', name: 'Apollo 11', module: 'Eagle', region: 'Mare Tranquillitatis', date: '1969-07-20', latitude: 0.67416, longitude: 23.47314 },
  { id: '12', name: 'Apollo 12', module: 'Intrepid', region: 'Oceanus Procellarum', date: '1969-11-19', latitude: -3.0128, longitude: -23.4219 },
  { id: '14', name: 'Apollo 14', module: 'Antares', region: 'Fra Mauro', date: '1971-02-05', latitude: -3.64589, longitude: -17.47194 },
  { id: '15', name: 'Apollo 15', module: 'Falcon', region: 'Hadley–Apennine', date: '1971-07-30', latitude: 26.13239, longitude: 3.63330 },
  { id: '16', name: 'Apollo 16', module: 'Orion', region: 'Descartes Highlands', date: '1972-04-21', latitude: -8.9734, longitude: 15.5011 },
  { id: '17', name: 'Apollo 17', module: 'Challenger', region: 'Taurus–Littrow', date: '1972-12-11', latitude: 20.1911, longitude: 30.7723 },
]

export const ORBITERS = {
  lro: {
    name: 'Lunar Reconnaissance Orbiter',
    short: 'LRO',
    color: '#74d8e9',
    model: '/spacecraft/lro.glb',
    modelSource: 'https://science.nasa.gov/3d-resources/lunar-reconnaissance-orbiter-a/',
    missionSource: 'https://science.nasa.gov/mission/lro/about/',
    description: 'NASA’s lunar mapping orbiter. The displayed path represents a low polar orbit.',
    launched: '2009-06-18',
    operator: 'NASA / Goddard Space Flight Center',
    instruments: 'LROC, LOLA, Diviner, LAMP, LEND, CRaTER, Mini-RF',
    purpose: 'Maps lunar terrain, images landing sites and measures surface temperatures.',
    orbit: { radius: 1.11, inclination: Math.PI / 2, node: .4, speed: .17 },
  },
  ladee: {
    name: 'Lunar Atmosphere and Dust Environment Explorer',
    short: 'LADEE',
    color: '#f3bb75',
    model: '/spacecraft/ladee.glb',
    modelSource: 'https://science.nasa.gov/3d-resources/lunar-atmosphere-and-dust-environment-explorer-ladee/',
    missionSource: 'https://science.nasa.gov/mission/ladee/',
    description: 'A historical orbiter that studied the Moon’s exosphere and dust. Its mission ended in 2014.',
    launched: '2013-09-07',
    operator: 'NASA / Ames Research Center',
    instruments: 'NMS, UVS, LDEX, LLCD',
    purpose: 'Measured the Moon’s thin exosphere and dust. It also tested laser communications.',
    orbit: { radius: 1.18, inclination: .38, node: -.6, speed: .13 },
  },
} as const

export type OrbiterId = keyof typeof ORBITERS
