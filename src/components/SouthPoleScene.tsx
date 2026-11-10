import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three'
import type { LunarFeature } from '../domain/lunar'
import { SOUTH_POLE_FEATURES } from '../data/lunarFeatures'
import { createLabelTexture } from '../lib/labelTexture'

function noise2d(x: number, z: number): number {
  return Math.sin(x * 1.7 + Math.cos(z * 0.9)) * 0.32 + Math.sin(z * 2.2 - x * 0.65) * 0.18 + Math.sin((x + z) * 4.8) * 0.055
}

const VISUAL_CRATERS = [
  { x: 0.2, z: 0.1, radius: 1.75, depth: 0.5 },
  { x: -2.2, z: -0.7, radius: 1.15, depth: 0.31 },
  { x: 2.3, z: -1.5, radius: 0.95, depth: 0.25 },
  { x: 1.4, z: 2.2, radius: 0.7, depth: 0.2 },
  { x: -1.1, z: 2.55, radius: 0.55, depth: 0.15 },
  { x: -3.1, z: 1.8, radius: 0.62, depth: 0.17 },
]

function terrainHeight(x: number, z: number): number {
  let height = noise2d(x, z) * 0.17 + Math.sin(x * 0.42) * 0.12 + Math.cos(z * 0.36) * 0.11
  for (const crater of VISUAL_CRATERS) {
    const d = Math.hypot(x - crater.x, z - crater.z)
    const normalized = d / crater.radius
    if (normalized < 1) height -= crater.depth * Math.pow(1 - normalized * normalized, 2)
    const rim = Math.exp(-Math.pow((normalized - 1.04) * 8, 2)) * crater.depth * 0.34
    height += rim
  }
  return height
}

function createTerrainGeometry() {
  const segments = 150
  const size = 9
  const geometry = new BufferGeometry()
  const vertices: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const color = new Color()

  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = (xIndex / segments - 0.5) * size
      const z = (zIndex / segments - 0.5) * size
      const y = terrainHeight(x, z)
      vertices.push(x, y, z)
      const shade = Math.min(0.72, Math.max(0.22, 0.43 + y * 0.75 + noise2d(x * 2, z * 2) * 0.06))
      color.setRGB(shade * 0.91, shade * 0.95, shade)
      colors.push(color.r, color.g, color.b)
    }
  }
  for (let z = 0; z < segments; z += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = z * (segments + 1) + x
      const b = a + 1
      const c = a + segments + 1
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const MARKERS = [
  { id: 'shackleton', x: 0.2, z: 0.1 },
  { id: 'de-gerlache', x: -2.2, z: -0.7 },
  { id: 'haworth', x: 1.4, z: 2.2 },
  { id: 'shoemaker', x: 2.3, z: -1.5 },
  { id: 'faustini', x: -1.1, z: 2.55 },
  { id: 'mons-malapert', x: -3.1, z: 1.8 },
]

function TerrainMarker({ feature, active, x, z, onSelect }: { feature: LunarFeature; active: boolean; x: number; z: number; onSelect: () => void }) {
  const texture = useMemo(() => createLabelTexture(feature.name, `${Math.abs(feature.latitude).toFixed(2)}°S`, active), [feature.name, feature.latitude, active])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <group position={[x, terrainHeight(x, z) + 0.08, z]}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <sphereGeometry args={[active ? 0.075 : 0.047, 16, 16]} />
        <meshBasicMaterial color={active ? '#f4c778' : '#74dcfa'} toneMapped={false} />
      </mesh>
      <sprite position={[0.62, 0.18, 0]} scale={[2.15, 0.302, 1]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <spriteMaterial map={texture} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

function Terrain({ selected, onSelect }: { selected: LunarFeature | null; onSelect: (feature: LunarFeature) => void }) {
  const geometry = useMemo(() => createTerrainGeometry(), [])
  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={0.97} metalness={0.01} side={DoubleSide} />
      </mesh>
      <gridHelper args={[9, 18, '#2c7895', '#173342']} position={[0, 0.16, 0]} />
      {MARKERS.map((marker) => {
        const feature = SOUTH_POLE_FEATURES.find((item) => item.id === marker.id)
        if (!feature) return null
        const active = selected?.id === feature.id
        return <TerrainMarker key={marker.id} feature={feature} active={active} x={marker.x} z={marker.z} onSelect={() => onSelect(feature)} />
      })}
    </group>
  )
}

export function SouthPoleScene({ selected, onSelect, active = true }: { selected: LunarFeature | null; onSelect: (feature: LunarFeature) => void; active?: boolean }) {
  return (
    <Canvas frameloop={active ? 'always' : 'never'} dpr={[1, 1.65]} shadows camera={{ position: [4.9, 3.7, 5.2], fov: 39 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#020406']} />
      <fog attach="fog" args={['#020406', 7.5, 15]} />
      <ambientLight intensity={0.055} />
      <directionalLight position={[-7, 1.2, -4]} intensity={4.3} color="#e8f3ff" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <pointLight position={[4, 2, 4]} intensity={0.12} color="#44c9ff" />
      <Stars radius={40} depth={24} count={500} factor={1.3} fade />
      <Terrain selected={selected} onSelect={onSelect} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.06} minDistance={2.2} maxDistance={11} maxPolarAngle={Math.PI / 2.04} target={[0, -0.08, 0]} />
    </Canvas>
  )
}
