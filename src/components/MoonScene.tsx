import { OrbitControls, Stars, useTexture } from '@react-three/drei'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, Color, DirectionalLight, Group, PerspectiveCamera, Quaternion, SphereGeometry, SRGBColorSpace, Vector3 } from 'three'
import type { Coordinates, LunarFeature, SurfaceStyle } from '../domain/lunar'
import { LUNAR_FEATURES } from '../data/lunarFeatures'
import { latLonToVector3, vector3ToLatLon } from '../lib/lunarCoordinates'
import { createLabelTexture } from '../lib/labelTexture'
import { elevationColor } from '../lib/elevationColor'
import { loadHeightRaster, LUNAR_RADIUS, sampleRaster } from '../services/science/lunarAssets'

export interface MoonSceneProps {
  active?:boolean; selected:LunarFeature|null; coordinates:Coordinates; surfaceStyle:SurfaceStyle
  labelsVisible:boolean; gridVisible:boolean; lightAngle:number; resetKey:number
  onSelectFeature:(feature:LunarFeature)=>void; onSelectCoordinates:(coordinates:Coordinates)=>void; onReady:()=>void
}
function CameraRig({selected,resetKey,lightAngle}:Pick<MoonSceneProps,'selected'|'resetKey'|'lightAngle'>){
  const {camera,size}=useThree()
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null), light=useRef<DirectionalLight>(null)
  const flight=useRef<{from:Vector3;to:Vector3;elapsed:number}|null>(null)
  const previousReset=useRef(-1)
  const distance=Math.max(3.7,3.7/Math.min(size.width/size.height,1))
  useEffect(()=>{
    const resetting=previousReset.current!==resetKey
    previousReset.current=resetKey
    if(!selected&&!resetting)return
    const target=selected?latLonToVector3(selected.latitude,selected.longitude):latLonToVector3(7,-12)
    flight.current={from:camera.position.clone(),to:target.multiplyScalar(distance),elapsed:0}
  },[selected,resetKey,distance,camera])
  useFrame((_,delta)=>{
    if(flight.current){
      const f=flight.current;f.elapsed+=Math.min(delta,.05)
      const t=Math.min(f.elapsed/1.4,1),s=t*t*(3-2*t)
      const q=new Quaternion().setFromUnitVectors(f.from.clone().normalize(),f.to.clone().normalize())
      camera.position.copy(f.from).normalize().applyQuaternion(new Quaternion().slerp(q,s)).multiplyScalar(f.from.length()+(f.to.length()-f.from.length())*s)
      controls.current?.target.set(0,0,0);camera.lookAt(0,0,0)
      if(t===1)flight.current=null
    }
    light.current?.position.set(-Math.sin(lightAngle*Math.PI/180)*8,2.4,Math.cos(lightAngle*Math.PI/180)*8).applyQuaternion(camera.quaternion)
  })
  return <><directionalLight ref={light} intensity={3.15} color="#fffaf1"/><OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.075} minDistance={1.22} maxDistance={12} rotateSpeed={.45} zoomSpeed={.7} enablePan={false} onStart={()=>{flight.current=null}}/></>
}
function SurfaceGrid(){return <group>
  {[-60,-30,0,30,60].map(lat=><mesh key={lat} position={[0,Math.sin(lat*Math.PI/180)*1.008,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[Math.cos(lat*Math.PI/180)*1.008,.0006,3,160]}/><meshBasicMaterial color="#74c5d6" transparent opacity={.22}/></mesh>)}
  {Array.from({length:6},(_,i)=><mesh key={i} rotation={[0,i*Math.PI/6,0]}><torusGeometry args={[1.008,.0006,3,160]}/><meshBasicMaterial color="#74c5d6" transparent opacity={.18}/></mesh>)}
  </group>}
function Markers({selected,onSelect}:{selected:LunarFeature|null;onSelect:(f:LunarFeature)=>void}){
  const {camera,size}=useThree(),groups=useRef<(Group|null)[]>([])
  const textures=useMemo(()=>LUNAR_FEATURES.map(f=>createLabelTexture(f.name,'',f.id===selected?.id)),[selected])
  useEffect(()=>()=>textures.forEach(t=>t.dispose()),[textures])
  const anchors=useMemo(()=>LUNAR_FEATURES.map(f=>latLonToVector3(f.latitude,f.longitude,1.012)),[])
  useFrame(()=>{
    const occupied:{x:number;y:number}[]=[]
    const order=LUNAR_FEATURES.map((f,i)=>({f,i})).sort((a,b)=>(b.f.id===selected?.id?10:0)-(a.f.id===selected?.id?10:0)||a.f.priority-b.f.priority)
    for(const {i} of order){
      const g=groups.current[i];if(!g)continue
      const p=anchors[i].clone().project(camera),x=(p.x+1)*size.width/2,y=(1-p.y)*size.height/2
      const facing=anchors[i].clone().normalize().dot(camera.position.clone().normalize())>1.03/camera.position.length()
      const visible=facing&&Math.abs(p.x)<.92&&Math.abs(p.y)<.88&&!occupied.some(o=>Math.abs(o.x-x)<135&&Math.abs(o.y-y)<30)
      g.visible=visible;if(visible)occupied.push({x,y})
      const factor=2*Math.tan((camera as PerspectiveCamera).fov*Math.PI/360)*camera.position.distanceTo(anchors[i])/size.height
      g.scale.setScalar(factor*160)
    }
  })
  return <>{LUNAR_FEATURES.map((f,i)=><group key={f.id} ref={el=>{groups.current[i]=el}} position={anchors[i]}>
    <mesh onClick={e=>{e.stopPropagation();onSelect(f)}}><sphereGeometry args={[.018,8,8]}/><meshBasicMaterial color={f.id===selected?.id?'#e8bc79':'#9bd8e0'} toneMapped={false}/></mesh>
    <sprite center={[-.04,.4]} scale={[1,.14,1]} renderOrder={5} onClick={e=>{e.stopPropagation();onSelect(f)}}><spriteMaterial map={textures[i]} transparent depthTest={false} depthWrite={false} toneMapped={false}/></sprite>
  </group>)}</>
}
function Moon(props:MoonSceneProps){
  const raster=use(loadHeightRaster('global'))
  const [color,bump]=useTexture(['/lunar/albedo-8k.webp','/lunar/global-height.png'])
  const {gl}=useThree();color.colorSpace=SRGBColorSpace;color.anisotropy=Math.min(8,gl.capabilities.getMaxAnisotropy());bump.anisotropy=color.anisotropy
  const geometry=useMemo(()=>{
    // Set physical positions from the original UVs: seam is exactly -180/+180.
    const geo=new SphereGeometry(1,384,256),positions=geo.attributes.position,uv=geo.attributes.uv
    const colors=new Float32Array(positions.count*3),c=new Color()
    for(let i=0;i<positions.count;i++){
      const u=Math.max(0,Math.min(1,uv.getX(i))),v=uv.getY(i)
      const h=sampleRaster(raster,u,1-v,true),p=latLonToVector3(v*180-90,u*360-180,1+h/LUNAR_RADIUS)
      elevationColor(h,c);colors.set([c.r,c.g,c.b],i*3)
      positions.setXYZ(i,p.x,p.y,p.z);uv.setXY(i,u,v)
    }
    geo.setAttribute('color',new BufferAttribute(colors,3));geo.computeVertexNormals();geo.computeBoundingSphere();return geo
  },[raster])
  useEffect(()=>{props.onReady()},[props.onReady])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  function pick(e:ThreeEvent<MouseEvent>){if(e.delta>4)return;e.stopPropagation();props.onSelectCoordinates(vector3ToLatLon(e.point))}
  return <>
    <mesh geometry={geometry} onClick={pick}><meshStandardMaterial key={props.surfaceStyle} vertexColors={props.surfaceStyle==='elevation'} map={props.surfaceStyle==='surface'?color:null} color={props.surfaceStyle==='relief'?'#a9a9a5':'#ffffff'} bumpMap={bump} bumpScale={props.surfaceStyle==='relief'?.028:24000/LUNAR_RADIUS} roughness={1} metalness={0}/></mesh>
    {props.gridVisible&&<SurfaceGrid/>}{props.labelsVisible&&<Markers selected={props.selected} onSelect={props.onSelectFeature}/>}
  </>
}
export function MoonScene(props:MoonSceneProps){return <Canvas frameloop={props.active===false?'never':'always'} dpr={[1,1.75]} camera={{position:[-.7,.3,4.2],fov:38,near:.01,far:150}} gl={{antialias:true,powerPreference:'high-performance'}}>
  <color attach="background" args={['#03070b']}/><ambientLight intensity={.11}/><Stars radius={65} depth={35} count={550} factor={.65} saturation={0} fade speed={0}/>
  <Suspense fallback={null}><Moon {...props}/></Suspense><CameraRig selected={props.selected} resetKey={props.resetKey} lightAngle={props.lightAngle}/>
  </Canvas>}
