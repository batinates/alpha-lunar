import { Canvas, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { Suspense, useEffect, useMemo } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Matrix4, Quaternion, SRGBColorSpace, Vector3 } from 'three'
import type { Coordinates } from '../domain/lunar'
import type { XYZ } from '../services/science/ephemeris'
import type { HeightRaster } from '../services/science/lunarAssets'
import { LUNAR_RADIUS, samplePolarHorizon } from '../services/science/lunarAssets'
import { destination, type HorizonProfile } from '../services/science/terrainHorizon'
import { lunarSkyAxes, skyDirection, type TouchdownSky } from '../services/science/touchdownSky'

export type SkyCamera = { azimuth: number; elevation: number; fov: number }
type EarthRotation = [number, number, number, number]
const deg = Math.PI / 180
const earthTexture = '/lunar/earth-blue-marble.webp'
const earthDistance = 120, sunDistance = 140

function Camera({ view, height }: { view: SkyCamera; height: number }) {
  const { camera, invalidate } = useThree()
  useEffect(() => {
    camera.position.set(0, height, 0)
    camera.lookAt(new Vector3(...skyDirection(view.azimuth, view.elevation)).add(camera.position))
    if ('fov' in camera) camera.fov = view.fov
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, height, invalidate, view])
  return null
}

function terrainGeometry(raster: HeightRaster, profile: HorizonProfile) {
  const positions: number[] = [], indices: number[] = [], known: boolean[] = []
  const headings = 180, rings = 50
  for (let ring = 0; ring <= rings; ring++) {
    const distance = 160 * ring
    for (let i = 0; i < headings; i++) {
      const az = i * (360 / headings), a = az * deg
      const p = destination(profile.latitude, profile.longitude, az, distance)
      const height = ring === 0 ? profile.observerElevation : samplePolarHorizon(raster, p.latitude, p.longitude)
      const radius = LUNAR_RADIUS + (height ?? profile.observerElevation)
      const radial = radius * Math.sin(distance / LUNAR_RADIUS) / 1000
      const y = (radius * Math.cos(distance / LUNAR_RADIUS) - LUNAR_RADIUS - profile.observerElevation) / 1000
      positions.push(radial * Math.sin(a), y, -radial * Math.cos(a))
      known.push(height !== null)
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let i = 0; i < headings; i++) {
      const left = r * headings + i, right = r * headings + (i + 1) % headings
      const farLeft = left + headings, farRight = right + headings
      if (known[left] && known[right] && known[farLeft] && known[farRight]) indices.push(left, right, farLeft, right, farRight, farLeft)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function skylineGeometry(profile: HorizonProfile) {
  const positions: number[] = []
  const radius = 96, eye = profile.mastHeight / 1000
  function vertex(az: number, height: number) {
    positions.push(radius * Math.sin(az * deg), height, -radius * Math.cos(az * deg))
  }
  for (let az = 0; az < 360; az++) {
    const a = profile.elevations[az], b = profile.elevations[(az + 1) % 360]
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const h = eye + radius * Math.tan(a * deg), next = eye + radius * Math.tan(b * deg)
    vertex(az, h); vertex(az, -radius); vertex(az + 1, next)
    vertex(az, -radius); vertex(az + 1, -radius); vertex(az + 1, next)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  return geometry
}

function Ground({ raster, profile }: { raster: HeightRaster; profile: HorizonProfile }) {
  const ground = useMemo(() => terrainGeometry(raster, profile), [profile, raster])
  const skyline = useMemo(() => skylineGeometry(profile), [profile])
  useEffect(() => () => ground.dispose(), [ground])
  useEffect(() => () => skyline.dispose(), [skyline])
  return <>
    <mesh geometry={skyline}><meshBasicMaterial color="#23282d" side={DoubleSide} /></mesh>
    <mesh geometry={ground}><meshStandardMaterial color="#68625c" roughness={1} /></mesh>
  </>
}

const globeVertex = `
  varying vec2 texUv;
  varying vec3 surfaceNormal;
  void main() {
    texUv = uv;
    surfaceNormal = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const globeFragment = `
  uniform sampler2D map;
  uniform vec3 lightDirection;
  varying vec2 texUv;
  varying vec3 surfaceNormal;
  void main() {
    float lit = max(0.0, dot(normalize(surfaceNormal), lightDirection));
    vec3 day = texture2D(map, texUv).rgb;
    gl_FragColor = vec4(day * (0.015 + 1.12 * lit), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

function Earth({ position, radius, sunlight, rotation, point }: {
  position: Vector3; radius: number; sunlight: XYZ; rotation: EarthRotation; point: Coordinates
}) {
  const texture = useTexture(earthTexture)
  useEffect(() => {
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
  }, [texture])
  const [w, x, y, z] = rotation
  const axes = lunarSkyAxes(point)
  const transform = new Matrix4().set(...axes[0], 0, ...axes[1], 0, ...axes[2], 0, 0, 0, 0, 1)
  const earthPose = new Quaternion().setFromRotationMatrix(transform).multiply(new Quaternion(x, y, z, w))
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2))
  const uniforms = useMemo(() => ({
    map: { value: texture }, lightDirection: { value: new Vector3(...sunlight).normalize() },
  }), [texture, sunlight])
  return <mesh position={position} quaternion={earthPose}>
    <sphereGeometry args={[radius, 64, 32]} />
    <shaderMaterial vertexShader={globeVertex} fragmentShader={globeFragment} uniforms={uniforms} />
  </mesh>
}

function BodyPosition({ sky, profile, rotation, point }: {
  sky: TouchdownSky; profile: HorizonProfile; rotation?: EarthRotation; point: Coordinates
}) {
  const observer = new Vector3(0, profile.mastHeight / 1000, 0)
  const earth = new Vector3(...sky.earth.direction).multiplyScalar(earthDistance).add(observer)
  const sun = new Vector3(...sky.sun.direction).multiplyScalar(sunDistance).add(observer)
  const earthRadius = earthDistance * Math.sin(sky.earth.radius * deg)
  return <>
    <mesh position={sun}>
      <sphereGeometry args={[sunDistance * Math.sin(sky.sun.radius * deg), 32, 20]} />
      <meshBasicMaterial color="#fff5d9" toneMapped={false} />
    </mesh>
    {rotation ? <Suspense fallback={null}><Earth position={earth} radius={earthRadius} sunlight={sky.sunFromEarth} rotation={rotation} point={point} /></Suspense>
      : <mesh position={earth}><sphereGeometry args={[earthRadius, 48, 24]} /><meshStandardMaterial color="#438ec4" roughness={1} /></mesh>}
  </>
}

export function TouchdownSkyScene({ raster, profile, point, sky, rotation, view }: {
  raster: HeightRaster; profile: HorizonProfile; point: Coordinates
  sky: TouchdownSky; rotation?: EarthRotation; view: SkyCamera
}) {
  return <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ near: .0007, far: 190, fov: view.fov }}>
    <color attach="background" args={['#03060a']} />
    <ambientLight intensity={.41} />
    <directionalLight position={sky.sun.direction} intensity={2.3 * sky.solarTransmission} color="#fff5e9" />
    <Camera view={view} height={profile.mastHeight / 1000} />
    <Ground raster={raster} profile={profile} />
    <BodyPosition sky={sky} profile={profile} rotation={rotation} point={point} />
  </Canvas>
}
