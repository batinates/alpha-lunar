import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { Box3, Vector3 } from 'three'

export function NasaSpacecraft({ url, size, grounded = false }: { url: string; size: number; grounded?: boolean }) {
  const { scene } = useGLTF(url, '/spacecraft/draco/')
  const model = useMemo(() => {
    const copy = scene.clone()
    const box = new Box3().setFromObject(copy)
    const center = box.getCenter(new Vector3())
    const bounds = box.getSize(new Vector3())
    if (grounded) center.y = box.min.y
    return { copy, center, scale: size / Math.max(bounds.x, bounds.y, bounds.z) }
  }, [scene, size, grounded])
  return <group scale={model.scale}>
    <group position={[-model.center.x, -model.center.y, -model.center.z]}><primitive object={model.copy} /></group>
  </group>
}

export function RocketLander({ size }: { size: number }) {
  return <group scale={size / 7.6}>
    <mesh position={[0, 3.46, 0]}><cylinderGeometry args={[.94, 1.04, 5.02, 36]} /><meshStandardMaterial color="#dadcdd" metalness={.62} roughness={.42} /></mesh>
    <mesh position={[0, 6.47, 0]}><cylinderGeometry args={[.18, .94, 1, 36]} /><meshStandardMaterial color="#e2e4e6" metalness={.6} roughness={.4} /></mesh>
    <mesh position={[0, 7, 0]}><sphereGeometry args={[.18, 18, 12]} /><meshStandardMaterial color="#cbd5de" metalness={.6} roughness={.44} /></mesh>
    {[1.18, 2.06, 5.63].map(y => <mesh key={y} position={[0, y, 0]}><cylinderGeometry args={[1.02, 1.02, .13, 36]} /><meshStandardMaterial color="#3c4b56" metalness={.65} roughness={.45} /></mesh>)}
    <mesh position={[0, 5.08, .9]}><boxGeometry args={[.51, .22, .14]} /><meshStandardMaterial color="#122731" metalness={.7} roughness={.24} /></mesh>
    <mesh position={[0, .73, 0]}><cylinderGeometry args={[.37, .55, .6, 24, 1, true]} /><meshStandardMaterial color="#333e48" metalness={.72} roughness={.48} side={2} /></mesh>
    {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map(angle => <group key={angle} rotation={[0, angle, 0]}>
      <mesh position={[1.36, .8, 0]} rotation={[0, 0, .63]}><cylinderGeometry args={[.08, .10, 1.7, 10]} /><meshStandardMaterial color="#9babb5" metalness={.7} roughness={.42} /></mesh>
      <mesh position={[1.86, .08, 0]}><cylinderGeometry args={[.25, .30, .16, 18]} /><meshStandardMaterial color="#6e7c87" metalness={.55} roughness={.47} /></mesh>
    </group>)}
  </group>
}
