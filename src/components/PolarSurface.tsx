import { useTexture } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { Color } from 'three'

export const polarSurfaceColor = [.32, .31, .29] as const
export const polarBackground = '#03070b'
const lunarGray = new Color(...polarSurfaceColor)

export function PolarSurfaceMaterial({ vertexColors = false, relief = 1 }: { vertexColors?: boolean; relief?: number }) {
  const normalMap = useTexture('/lunar/south-pole-normal.webp')
  const { gl } = useThree()
  normalMap.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
  return <meshStandardMaterial vertexColors={vertexColors} color={vertexColors ? 'white' : lunarGray}
    normalMap={normalMap} normalScale={[relief, relief]} roughness={1} metalness={0} />
}

export function PolarSurfaceLighting({ angle, scale = 1 }: { angle: number; scale?: number }) {
  const radians = angle * Math.PI / 180
  return <>
    <ambientLight intensity={.24} />
    <directionalLight position={[-Math.cos(radians) * 8 * scale, 3.2 * scale, Math.sin(radians) * 8 * scale]}
      intensity={3.7} color="#fffaf1" castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-6 * scale} shadow-camera-right={6 * scale} shadow-camera-top={6 * scale} shadow-camera-bottom={-6 * scale}
      shadow-camera-near={.1 * scale} shadow-camera-far={30 * scale} shadow-bias={-.0003} shadow-normalBias={.012 * scale} />
  </>
}
