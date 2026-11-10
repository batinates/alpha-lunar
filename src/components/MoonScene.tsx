import { OrbitControls, Stars } from '@react-three/drei'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, BackSide, Color, Group, Mesh, Vector3 } from 'three'
import type { Coordinates, LunarFeature, SurfaceStyle } from '../domain/lunar'
import { LUNAR_FEATURES } from '../data/lunarFeatures'
import { latLonToVector3, vector3ToLatLon } from '../lib/lunarCoordinates'
import { createMoonTexture } from '../lib/proceduralMoon'
import { createLabelTexture } from '../lib/labelTexture'

interface MoonSceneProps {
  active?: boolean
  selected: LunarFeature | null
  coordinates: Coordinates
  surfaceStyle: SurfaceStyle
  labelsVisible: boolean
  gridVisible: boolean
  onSelectFeature: (feature: LunarFeature) => void
  onSelectCoordinates: (coordinates: Coordinates) => void
}

function CameraRig({ selected }: { selected: LunarFeature | null }) {
  const { camera } = useThree()
  const controls = useRef<any>(null)
  const desired = useRef(new Vector3(0, 0.15, 3.65))
  const isFlying = useRef(false)

  useEffect(() => {
    if (!selected) return
    desired.current.copy(latLonToVector3(selected.latitude, selected.longitude, 3.65))
    isFlying.current = true
  }, [selected])

  useFrame((_, delta) => {
    if (!isFlying.current) return
    const alpha = 1 - Math.exp(-delta * 2.8)
    camera.position.lerp(desired.current, alpha)
    camera.lookAt(0, 0, 0)
    controls.current?.target.lerp(new Vector3(0, 0, 0), alpha)
    if (camera.position.distanceTo(desired.current) < 0.015) isFlying.current = false
  })

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.055}
      minDistance={1.55}
      maxDistance={7}
      rotateSpeed={0.42}
      zoomSpeed={0.7}
      panSpeed={0.25}
      enablePan={false}
    />
  )
}

function SurfaceGrid() {
  return (
    <group>
      {[-60, -30, 0, 30, 60].map((latitude) => {
        const y = Math.sin((latitude * Math.PI) / 180) * 1.007
        const radius = Math.cos((latitude * Math.PI) / 180) * 1.007
        return (
          <mesh key={`lat-${latitude}`} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[radius, 0.0015, 5, 128]} />
            <meshBasicMaterial color="#4bc4e9" transparent opacity={latitude === 0 ? 0.28 : 0.13} />
          </mesh>
        )
      })}
      {Array.from({ length: 12 }, (_, i) => i * 15).map((rotation) => (
        <mesh key={`lon-${rotation}`} rotation={[0, (rotation * Math.PI) / 180, 0]}>
          <torusGeometry args={[1.007, 0.0013, 5, 128, Math.PI]} />
          <meshBasicMaterial color="#4bc4e9" transparent opacity={0.12} />
        </mesh>
      ))}
    </group>
  )
}

function FeatureMarker({ feature, active, onSelect }: { feature: LunarFeature; active: boolean; onSelect: () => void }) {
  const anchor = useMemo(() => latLonToVector3(feature.latitude, feature.longitude, 1.032), [feature])
  const markerGroup = useRef<Group>(null)
  const { camera } = useThree()
  const labelTexture = useMemo(() => createLabelTexture(feature.name, '', active), [feature.name, active])

  useEffect(() => () => labelTexture.dispose(), [labelTexture])

  useFrame(() => {
    if (!markerGroup.current) return
    const visible = anchor.clone().normalize().dot(camera.position.clone().normalize()) > 0.18
    markerGroup.current.visible = visible
  })
  return (
    <group ref={markerGroup} position={anchor}>
      <mesh onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <sphereGeometry args={[active ? 0.016 : 0.009, 12, 12]} />
        <meshBasicMaterial color={active ? '#f4c778' : '#6ddcf9'} toneMapped={false} />
      </mesh>
      <sprite position={[0.16, 0.015, 0]} scale={[0.48, 0.0675, 1]} onClick={(event) => { event.stopPropagation(); onSelect() }}>
        <spriteMaterial map={labelTexture} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </group>
  )
}

function Moon({ selected, coordinates, surfaceStyle, labelsVisible, gridVisible, onSelectFeature, onSelectCoordinates }: MoonSceneProps) {
  const texture = useMemo(() => createMoonTexture(), [])
  const selectedPoint = useMemo(() => latLonToVector3(coordinates.latitude, coordinates.longitude, 1.025), [coordinates])
  const group = useRef<Group>(null)

  useEffect(() => () => texture.dispose(), [texture])

  function handleSurfaceClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation()
    const localPoint = event.object.worldToLocal(event.point.clone())
    onSelectCoordinates(vector3ToLatLon(localPoint))
  }

  return (
    <group ref={group}>
      <mesh castShadow receiveShadow onClick={handleSurfaceClick}>
        <sphereGeometry args={[1, 192, 128]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={texture}
          bumpScale={surfaceStyle === 'relief' ? 0.055 : 0.026}
          roughness={0.96}
          metalness={0.01}
          color={surfaceStyle === 'relief' ? new Color('#b9c4cc') : new Color('#d3d3cd')}
          emissive="#182027"
          emissiveIntensity={0.12}
        />
      </mesh>
      <mesh scale={1.018}>
        <sphereGeometry args={[1, 96, 64]} />
        <meshBasicMaterial color="#77dcff" transparent opacity={0.035} side={BackSide} blending={AdditiveBlending} />
      </mesh>
      {gridVisible && <SurfaceGrid />}
      {labelsVisible && LUNAR_FEATURES.map((feature) => (
        <FeatureMarker key={feature.id} feature={feature} active={selected?.id === feature.id} onSelect={() => onSelectFeature(feature)} />
      ))}
      <group position={selectedPoint}>
        <mesh>
          <ringGeometry args={[0.019, 0.027, 32]} />
          <meshBasicMaterial color="#f4c778" transparent opacity={0.92} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

export function MoonScene(props: MoonSceneProps) {
  return (
    <Canvas frameloop={props.active === false ? 'never' : 'always'} dpr={[1, 1.75]} camera={{ position: [0, 0.15, 3.65], fov: 33 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#020407']} />
      <ambientLight intensity={0.16} />
      <directionalLight position={[-4.5, 2.5, 5]} intensity={3.4} color="#edf6ff" castShadow />
      <pointLight position={[3, -2, -4]} intensity={0.08} color="#286989" />
      <Stars radius={70} depth={42} count={1350} factor={1.8} saturation={0.08} fade speed={0.08} />
      <Moon {...props} />
      <CameraRig selected={props.selected} />
    </Canvas>
  )
}
