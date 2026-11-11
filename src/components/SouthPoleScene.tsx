import { OrbitControls, useTexture } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, Group, PerspectiveCamera, Vector2, Vector3 } from 'three'
import type { Coordinates, LunarFeature, SurfaceStyle } from '../domain/lunar'
import { SOUTH_POLE_FEATURES } from '../data/lunarFeatures'
import { createLabelTexture } from '../lib/labelTexture'
import { elevationColor } from '../lib/elevationColor'
import { loadHeightRaster, latLonToPolar, polarHeight, polarToLatLon, POLAR_HALF_EXTENT, TERRAIN_SCALE, type HeightRaster } from '../services/science/lunarAssets'

interface Props {selected:LunarFeature|null;onSelect:(f:LunarFeature)=>void;active?:boolean;labelsVisible:boolean;lightAngle:number;exaggeration:number;resetKey:number;onReady:()=>void;onSelectCoordinates:(c:Coordinates)=>void;surfaceStyle:SurfaceStyle}

function TerrainCamera({selected,raster,exaggeration,resetKey}:Props&{raster:HeightRaster}){
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null),{camera}=useThree()
  const flight=useRef<{position:Vector3;target:Vector3}|null>(null)
  const previousReset=useRef(-1)
  useEffect(()=>{
    const resetting=previousReset.current!==resetKey
    previousReset.current=resetKey
    if(!selected&&!resetting)return
    const p=selected&&selected.latitude<=-85?latLonToPolar(selected.latitude,selected.longitude):{x:0,z:0}
    const y=(polarHeight(raster,p.x,p.z)??0)/TERRAIN_SCALE*exaggeration
    const target=new Vector3(p.x/TERRAIN_SCALE,y,p.z/TERRAIN_SCALE)
    flight.current={position:target.clone().add(new Vector3(1.8,1.5,2.5)),target}
  },[selected,raster,exaggeration,resetKey])
  useFrame((_,dt)=>{
    if(!flight.current||!controls.current)return
    const a=1-Math.exp(-Math.min(dt,.05)*3)
    camera.position.lerp(flight.current.position,a);controls.current.target.lerp(flight.current.target,a)
    if(camera.position.distanceTo(flight.current.position)<.008)flight.current=null
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.08} minDistance={.4} maxDistance={16} maxPolarAngle={Math.PI*.48} onStart={()=>{flight.current=null}}/>
}

function Marker({feature,active,raster,exaggeration,onSelect}:{feature:LunarFeature;active:boolean;raster:HeightRaster;exaggeration:number;onSelect:()=>void}){
  const texture=useMemo(()=>createLabelTexture(feature.name,'',active),[feature.name,active])
  useEffect(()=>()=>texture.dispose(),[texture])
  const p=latLonToPolar(feature.latitude,feature.longitude),height=polarHeight(raster,p.x,p.z)
  const group=useRef<Group>(null),{camera,size}=useThree()
  useFrame(()=>{if(group.current){const pos=new Vector3();group.current.getWorldPosition(pos);const scale=2*Math.tan((camera as PerspectiveCamera).fov*Math.PI/360)*camera.position.distanceTo(pos)/size.height*160;group.current.scale.setScalar(scale)}})
  if(height===null)return null
  return <group ref={group} position={[p.x/TERRAIN_SCALE,height/TERRAIN_SCALE*exaggeration+.018,p.z/TERRAIN_SCALE]}>
    <mesh onClick={e=>{e.stopPropagation();onSelect()}}><sphereGeometry args={[active?.02:.014,12,12]}/><meshBasicMaterial color={active?'#f4c778':'#8ad7dd'} toneMapped={false}/></mesh>
    <sprite center={[-.04,.4]} scale={[1,.14,1]} renderOrder={6} onClick={e=>{e.stopPropagation();onSelect()}}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false}/></sprite>
  </group>
}

function Terrain(props:Props){
  const raster=use(loadHeightRaster('south-pole')),normal=useTexture('/lunar/south-pole-normal.webp')
  const {gl}=useThree();normal.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy())
  const geometry=useMemo(()=>{
    const segments=640,n=segments+1,geo=new BufferGeometry()
    const pos=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),colors=new Float32Array(n*n*3),indices=new Uint32Array(segments*segments*6)
    const color=new Color()
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const u=i/segments,v=j/segments,x=(u*2-1)*POLAR_HALF_EXTENT,z=(v*2-1)*POLAR_HALF_EXTENT,k=j*n+i
      const h=polarHeight(raster,x,z)??0
      pos.set([x/TERRAIN_SCALE,h/TERRAIN_SCALE*props.exaggeration,z/TERRAIN_SCALE],k*3);uv.set([u,1-v],k*2)
      if(props.surfaceStyle==='elevation')elevationColor(h,color);else color.setRGB(.32,.31,.29)
      colors.set([color.r,color.g,color.b],k*3)
    }
    let idx=0
    for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){
      const a=j*n+i,b=a+1,c=a+n,d=c+1;indices.set([a,c,b,b,c,d],idx);idx+=6
    }
    geo.setAttribute('position',new BufferAttribute(pos,3));geo.setAttribute('uv',new BufferAttribute(uv,2));geo.setAttribute('color',new BufferAttribute(colors,3));geo.setIndex(new BufferAttribute(indices,1));geo.computeVertexNormals();geo.computeBoundingSphere();return geo
  },[raster,props.exaggeration,props.surfaceStyle])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useEffect(()=>props.onReady(),[props.onReady])
  return <>
    <mesh geometry={geometry} receiveShadow castShadow onClick={e=>{if(e.delta>4)return;e.stopPropagation();props.onSelectCoordinates(polarToLatLon(e.point.x*TERRAIN_SCALE,e.point.z*TERRAIN_SCALE))}}>
      <meshStandardMaterial vertexColors normalMap={normal} normalScale={new Vector2(props.exaggeration,props.exaggeration)} roughness={1} metalness={0}/>
    </mesh>
    {props.labelsVisible&&SOUTH_POLE_FEATURES.map(f=><Marker key={f.id} feature={f} active={f.id===props.selected?.id} raster={raster} exaggeration={props.exaggeration} onSelect={()=>props.onSelect(f)}/>)}
    <TerrainCamera {...props} raster={raster}/>
  </>
}
export function SouthPoleScene(props:Props){
  const angle=props.lightAngle*Math.PI/180
  return <Canvas frameloop={props.active===false?'never':'always'} dpr={[1,1.5]} shadows camera={{position:[2,2.8,4.8],fov:42,near:.01,far:90}} gl={{antialias:true,powerPreference:'high-performance'}}>
    <color attach="background" args={['#03070b']}/><ambientLight intensity={.24}/>
    <directionalLight position={[-Math.cos(angle)*8,3.2,Math.sin(angle)*8]} intensity={3.7} color="#fffaf1" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-camera-near={.1} shadow-camera-far={30} shadow-bias={-.0003} shadow-normalBias={.012}/>
    <Suspense fallback={null}><Terrain {...props}/></Suspense>
  </Canvas>
}
