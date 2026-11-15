import { useLanguage } from '../lib/i18n'
import { Html, OrbitControls, Line } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, Quaternion, Vector3 } from 'three'
import { latLonToPolar, LUNAR_RADIUS, POLAR_HALF_EXTENT, polarHeight, type HeightRaster } from '../services/science/lunarAssets'
import { SOUTH_POLE_FEATURES } from '../data/lunarFeatures'
import type { DescentScenario } from '../services/science/descent'
import type { LanderModel } from '../data/spacecraft'
import { NasaSpacecraft, RocketLander } from './SpacecraftModels'
import { polarBackground, PolarSurfaceLighting, PolarSurfaceMaterial } from './PolarSurface'

const SCALE = 1000
const POINT_COLORS = { within: '#79d6b2', exceeded: '#f2ad75', unknown: '#acb6d7' }

function DescentTerrain({ scenario, raster, frame, square, vehicle, cameraMode, magnified, siteName, relief }: {
  scenario: DescentScenario; raster: HeightRaster; frame: number; square: number
  vehicle: LanderModel; cameraMode: 'overview' | 'follow'; magnified: boolean; lightAngle: number; siteName: string; relief: number
}) {
  const { t } = useLanguage()
  const target = scenario.path.at(-1)!
  const entry = scenario.path[0]
  const approachRadius = Math.max(2400, Math.hypot(entry.x - target.x, entry.z - target.z) + 600, square)
  const radius = Math.max(46000, approachRadius + 21000)
  const scenePoint = useMemo(() => (x: number, y: number, z: number) => {
    const dx = x - target.x, dz = z - target.z
    const distance = Math.hypot(dx, dz)
    const curvatureDrop = 2 * LUNAR_RADIUS * Math.sin(distance / (2 * LUNAR_RADIUS)) ** 2
    return new Vector3(dx / SCALE, ((y - target.y) * relief - curvatureDrop) / SCALE, dz / SCALE)
  }, [target, relief])
  const terrain = useMemo(() => {
    const geometry = new BufferGeometry()
    const n = 225
    const positions = new Float32Array(n * n * 3)
    const uv = new Float32Array(n * n * 2)
    const indices: number[] = []
    const known = new Uint8Array(n * n)
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const yAxis = row / (n - 1) * 2 - 1, xAxis = col / (n - 1) * 2 - 1
        const x = target.x + radius * (.12 * xAxis + .88 * xAxis ** 3)
        const z = target.z + radius * (.12 * yAxis + .88 * yAxis ** 3)
        const ground = polarHeight(raster, x, z)
        const index = row * n + col
        uv.set([.5 + x / (2 * POLAR_HALF_EXTENT), .5 - z / (2 * POLAR_HALF_EXTENT)], index * 2)
        if (ground !== null) {
          scenePoint(x, ground, z).toArray(positions, index * 3)
          known[index] = 1
        }
        if (row && col && [index, index - 1, index - n, index - n - 1].every(i => known[i])) {
          indices.push(index - n - 1, index - 1, index - n, index - n, index - 1, index)
        }
      }
    }
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('uv', new BufferAttribute(uv, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }, [raster, target, radius, scenePoint])
  const scatter = useMemo(() => {
    const positions = [], colors = []
    for (const point of scenario.points) {
      if (point.y === null) continue
      positions.push(...scenePoint(point.x, point.y + 12, point.z).toArray())
      const color = new Color(POINT_COLORS[point.outcome])
      colors.push(color.r, color.g, color.b)
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    return geometry
  }, [scenario, scenePoint])
  useEffect(() => () => terrain.dispose(), [terrain])
  useEffect(() => () => scatter.dispose(), [scatter])
  const lines = useMemo(() => {
    const edge = Array.from({ length: 65 }, (_, i) => {
      const side = Math.min(3, Math.floor(i / 16)), t = i / 16 - side
      const offsets = [[t - .5, -.5], [.5, t - .5], [.5 - t, .5], [-.5, .5 - t]][side]
      const x = target.x + offsets[0] * square, z = target.z + offsets[1] * square
      return { x, z, y: polarHeight(raster, x, z) }
    })
    const segments = (points: typeof edge) => points.flatMap((point, i) => {
      const next = points[i + 1]
      return point.y === null || next?.y == null ? [] : [
        scenePoint(point.x, point.y + 15, point.z), scenePoint(next.x, next.y + 15, next.z),
      ]
    })
    return { trajectory: scenario.path.map(p => scenePoint(p.x, p.y, p.z)), ellipse: segments(scenario.ellipse), edge: segments(edge) }
  }, [scenario, target, raster, square, scenePoint])
  const landmarks = useMemo(() => SOUTH_POLE_FEATURES.flatMap(feature => {
    const { x, z } = latLonToPolar(feature.latitude, feature.longitude)
    const height = polarHeight(raster, x, z)
    const distance = Math.hypot(x - target.x, z - target.z)
    return height === null || distance < 500 || distance > Math.min(radius, 36000) ? [] :
      [{ name: feature.name, position: scenePoint(x, height + 160, z), distance }]
  }).sort((a, b) => a.distance - b.distance).slice(0, 5), [raster, target, radius, scenePoint])
  const lander = scenario.path[frame]
  const position = scenePoint(lander.x, lander.y, lander.z)
  const travel = new Vector3(target.x - entry.x, 0, target.z - entry.z)
  const accelerationScale = 2 / scenario.nominal.duration ** 2
  const up = new Vector3(0, 1.62 + (entry.y - target.y) * accelerationScale, 0).addScaledVector(travel, -accelerationScale).normalize()
  const landed = frame === scenario.path.length - 1
  const pose = landed ? new Quaternion() : new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), up)
  const size = (vehicle === 'apollo' ? 9.4 : 7.6) / SCALE * (magnified ? 8 : 1)
  const clearance = lander.ground === null ? Infinity : lander.y - lander.ground
  return <>
    <mesh geometry={terrain} receiveShadow castShadow><PolarSurfaceMaterial /></mesh>
    <mesh position={[0, .035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={cameraMode === 'overview' ? [.095, .145, 48] : [.015, .021, 48]} />
      <meshBasicMaterial color="#ffd47d" depthTest={false} toneMapped={false} />
    </mesh>
    {(cameraMode === 'overview' || clearance < 180) && <Html center position={[0, cameraMode === 'overview' ? .21 : .05, 0]} style={{ pointerEvents: 'none' }}>
      <span className="descent-map-label is-target">{t('Touchdown target')} · {siteName}</span>
    </Html>}
    {cameraMode === 'overview' && landmarks.map(landmark => <Html key={landmark.name} center position={landmark.position} occlude style={{ pointerEvents: 'none' }}>
      <span className="descent-map-label">{landmark.name}</span>
    </Html>)}
    {cameraMode === 'overview' && <>
      <points geometry={scatter}><pointsMaterial vertexColors size={.026} toneMapped={false} /></points>
      <Line points={lines.trajectory} color="#70dbf2" lineWidth={2.6} />
      {lines.ellipse.length > 0 && <Line segments points={lines.ellipse} color="#f5c97c" lineWidth={1.6} />}
      {lines.edge.length > 0 && <Line segments points={lines.edge} color="#bfd1dc" lineWidth={1.6} />}
    </>}
    {cameraMode === 'follow' && clearance < 70 && lander.ground !== null && <mesh
      position={scenePoint(lander.x + 2, lander.ground + .12, lander.z - 1)}
      rotation={[-Math.PI / 2, 0, 0]} scale={[1.2, .8, 1]}>
      <circleGeometry args={[size * .42, 32]} />
      <meshBasicMaterial color="#121b24" transparent opacity={.42 * Math.max(0, 1 - clearance / 70)} depthWrite={false} />
    </mesh>}
    <group position={position} quaternion={pose}>
      {vehicle === 'apollo'
        ? <Suspense fallback={null}><NasaSpacecraft url="/spacecraft/apollo-lm.glb" size={size} grounded /></Suspense>
        : <RocketLander size={size} />}
      {!landed && <mesh position={[0, -size * .18, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[size * .07, size * .36, 20]} /><meshBasicMaterial color="#8ddfff" transparent opacity={.68} depthWrite={false} />
      </mesh>}
    </group>
    <DescentCamera position={position} mode={cameraMode} size={size} radius={Math.max(7, approachRadius * 1.1 / SCALE)} />
  </>
}

function DescentCamera({ position, mode, size, radius }: { position: Vector3; mode: 'overview' | 'follow'; size: number; radius: number }) {
  const { camera, invalidate } = useThree()
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null)
  const previous = useRef<{ mode: typeof mode; size: number; position: Vector3 } | null>(null)
  useEffect(() => {
    const control = controls.current
    if (!control) return
    const prior = previous.current
    if (!prior || prior.mode !== mode || (mode === 'follow' && prior.size !== size)) {
      const distance = mode === 'follow' ? size * 1.35 : Math.max(2.8, radius)
      control.target.copy(mode === 'follow' ? position : new Vector3())
      camera.position.copy(control.target).add(new Vector3(distance, distance * .72, distance * 1.2))
    } else if (mode === 'follow') {
      camera.position.add(position.clone().sub(prior.position))
      control.target.copy(position)
    }
    previous.current = { mode, size, position: position.clone() }
    control.update()
    invalidate()
  }, [camera, invalidate, mode, position, radius, size])
  return <OrbitControls ref={controls} enableDamping enablePan={mode === 'overview'} minDistance={mode === 'follow' ? .006 : .4} maxDistance={mode === 'follow' ? 3 : 65} maxPolarAngle={Math.PI / 2} />
}

export function DescentScene(props: Parameters<typeof DescentTerrain>[0]) {
  const { t } = useLanguage()
  const reach = Math.max(2.8, props.scenario.path[0].y / SCALE - props.scenario.path.at(-1)!.y / SCALE,
    Math.hypot(props.scenario.path[0].x - props.scenario.path.at(-1)!.x, props.scenario.path[0].z - props.scenario.path.at(-1)!.z) / SCALE)
  return <div className="descent-scene" aria-label={t('Interactive 3D descent trajectory and touchdown dispersion')}>
    <Canvas key={reach} frameloop="demand" shadows dpr={[1, 1.5]} camera={{ position: [reach, reach * .88, reach * 1.22], near: .0003, far: 150 }}>
      <color attach="background" args={[polarBackground]} />
      <PolarSurfaceLighting angle={props.lightAngle} scale={Math.max(1, reach / 3)} />
      <Suspense fallback={null}><DescentTerrain {...props} /></Suspense>
    </Canvas>
  </div>
}
