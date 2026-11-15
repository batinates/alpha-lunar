import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, use, useEffect, useMemo, useRef } from 'react'
import { BufferAttribute, BufferGeometry, Color, DataTexture, Group, NearestFilter, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three'
import type { Coordinates, LunarFeature, SurfaceStyle } from '../domain/lunar'
import { SOUTH_POLE_FEATURES } from '../data/lunarFeatures'
import { createLabelTexture } from '../lib/labelTexture'
import { elevationColor } from '../lib/elevationColor'
import { loadHeightRaster, latLonToPolar, polarHeight, polarToLatLon, POLAR_HALF_EXTENT, TERRAIN_SCALE, type HeightRaster } from '../services/science/lunarAssets'
import { COLD_TRAP_K, environmentCell, ENVIRONMENT_WIDTH, LCROSS_IMPACT } from '../services/science/polarEnvironment'
import { terrainSlope } from '../services/science/siteScreening'
import type { PolarAnalysis } from './PolarAnalysisPanel'
import { polarBackground, polarSurfaceColor, PolarSurfaceLighting, PolarSurfaceMaterial } from './PolarSurface'

interface Props {selected:LunarFeature|null;onSelect:(f:LunarFeature)=>void;active?:boolean;labelsVisible:boolean;lightAngle:number;exaggeration:number;resetKey:number;onReady:()=>void;onSelectCoordinates:(c:Coordinates)=>void;surfaceStyle:SurfaceStyle;analysis:PolarAnalysis|null;environment:DataView|null;focusCoordinates:Coordinates|null;coordinates:Coordinates}

function TerrainCamera({selected,raster,exaggeration,resetKey,focusCoordinates}:Props&{raster:HeightRaster}){
  const controls=useRef<React.ComponentRef<typeof OrbitControls>>(null),{camera}=useThree()
  const flight=useRef<{position:Vector3;target:Vector3}|null>(null)
  const previousReset=useRef(-1)
  useEffect(()=>{
    const resetting=previousReset.current!==resetKey
    previousReset.current=resetKey
    const focus = focusCoordinates ?? selected
    if(!focus&&!resetting)return
    const p=focus?latLonToPolar(focus.latitude,focus.longitude):{x:0,z:0}
    if (polarHeight(raster,p.x,p.z) === null) return
    const y=(polarHeight(raster,p.x,p.z)??0)/TERRAIN_SCALE*exaggeration
    const target=new Vector3(p.x/TERRAIN_SCALE,y,p.z/TERRAIN_SCALE)
    flight.current={position:target.clone().add(new Vector3(1.8,1.5,2.5)),target}
  },[selected,raster,exaggeration,resetKey,focusCoordinates])
  useFrame((_,dt)=>{
    if(!flight.current||!controls.current)return
    const a=1-Math.exp(-Math.min(dt,.05)*3)
    camera.position.lerp(flight.current.position,a);controls.current.target.lerp(flight.current.target,a)
    if(camera.position.distanceTo(flight.current.position)<.008)flight.current=null
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={.08} minDistance={.4} maxDistance={16} maxPolarAngle={Math.PI*.48} onStart={()=>{flight.current=null}}/>
}

function Marker({feature,active,raster,exaggeration,onSelect,evidence=false}:{feature:Coordinates&{name:string};active:boolean;raster:HeightRaster;exaggeration:number;onSelect:()=>void;evidence?:boolean}){
  const texture=useMemo(()=>createLabelTexture(feature.name,'',active),[feature.name,active])
  useEffect(()=>()=>texture.dispose(),[texture])
  const p=latLonToPolar(feature.latitude,feature.longitude),height=polarHeight(raster,p.x,p.z)
  const group=useRef<Group>(null),{camera,size}=useThree()
  useFrame(()=>{if(group.current){const pos=new Vector3();group.current.getWorldPosition(pos);const scale=2*Math.tan((camera as PerspectiveCamera).fov*Math.PI/360)*camera.position.distanceTo(pos)/size.height*160;group.current.scale.setScalar(scale)}})
  if(height===null)return null
  return <group ref={group} position={[p.x/TERRAIN_SCALE,height/TERRAIN_SCALE*exaggeration+.018,p.z/TERRAIN_SCALE]}>
    <mesh onClick={e=>{e.stopPropagation();onSelect()}}><sphereGeometry args={[active?.02:.014,12,12]}/><meshBasicMaterial color={evidence?'#f1e38c':active?'#f4c778':'#8ad7dd'} toneMapped={false}/></mesh>
    <sprite center={[-.04,.4]} scale={[1,.14,1]} renderOrder={6} onClick={e=>{e.stopPropagation();onSelect()}}><spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false}/></sprite>
  </group>
}

const lowSlope = new Color('#467687'), mediumSlope = new Color('#d9ab62'), highSlope = new Color('#ce605c')
const lowTemperature = new Color('#4e68b0'), mediumTemperature = new Color('#6cc9c4'), highTemperature = new Color('#e1a167')

function environmentTexture(grid: DataView, analysis: 'thermal' | 'ice') {
  const width = ENVIRONMENT_WIDTH
  const pixels = new Uint8Array(width * width * 4)
  const color = new Color()
  for (let row = 0; row < width; row++) {
    for (let col = 0; col < width; col++) {
      const { peak, shadowFraction } = environmentCell(grid, col, row)
      color.set('#323941')
      if (analysis === 'thermal' && peak !== null) {
        if (peak < 110) color.copy(lowTemperature).lerp(mediumTemperature, Math.max(0, (peak - 40) / 70))
        else color.copy(mediumTemperature).lerp(highTemperature, Math.min(1, (peak - 110) / 150))
      }
      if (analysis === 'ice') {
        const cold = peak !== null && peak < COLD_TRAP_K
        const shadow = shadowFraction !== null && shadowFraction > 0
        if (cold || shadow) color.set(cold && shadow ? '#7a81df' : cold ? '#65d5d8' : '#926ac0')
      }
      color.convertLinearToSRGB()
      const offset = ((width - 1 - row) * width + col) * 4
      pixels[offset] = Math.round(color.r * 255)
      pixels[offset + 1] = Math.round(color.g * 255)
      pixels[offset + 2] = Math.round(color.b * 255)
      pixels[offset + 3] = 255
    }
  }
  const texture = new DataTexture(pixels, width, width)
  texture.colorSpace = SRGBColorSpace
  texture.magFilter = NearestFilter
  texture.minFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

function Terrain(props:Props){
  const raster=use(loadHeightRaster('south-pole'))
  const {analysis, environment} = props
  const overlay = useMemo(() => environment && (analysis === 'thermal' || analysis === 'ice') ?
    environmentTexture(environment, analysis) : null, [environment, analysis])
  useEffect(() => () => overlay?.dispose(), [overlay])
  const geometry=useMemo(()=>{
    const segments=640,n=segments+1,geo=new BufferGeometry()
    const pos=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),colors=new Float32Array(n*n*3),indices=new Uint32Array(segments*segments*6)
    const color=new Color()
    for(let j=0;j<n;j++)for(let i=0;i<n;i++){
      const u=i/segments,v=j/segments,x=(u*2-1)*POLAR_HALF_EXTENT,z=(v*2-1)*POLAR_HALF_EXTENT,k=j*n+i
      const h=polarHeight(raster,x,z)??0
      pos.set([x/TERRAIN_SCALE,h/TERRAIN_SCALE*props.exaggeration,z/TERRAIN_SCALE],k*3);uv.set([u,1-v],k*2)
      if (analysis === 'terrain') {
        const slope = terrainSlope(raster, x, z)
        if (slope === null) color.set('#323941')
        else if (slope <= 10) color.copy(lowSlope).lerp(mediumSlope, slope / 10)
        else color.copy(mediumSlope).lerp(highSlope, Math.min(1, (slope - 10) / 20))
      } else if(props.surfaceStyle==='elevation')elevationColor(h,color);else color.setRGB(...polarSurfaceColor)
      colors.set([color.r,color.g,color.b],k*3)
    }
    let idx=0
    for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){
      const a=j*n+i,b=a+1,c=a+n,d=c+1;indices.set([a,c,b,b,c,d],idx);idx+=6
    }
    geo.setAttribute('position',new BufferAttribute(pos,3));geo.setAttribute('uv',new BufferAttribute(uv,2));geo.setAttribute('color',new BufferAttribute(colors,3));geo.setIndex(new BufferAttribute(indices,1));geo.computeVertexNormals();geo.computeBoundingSphere();return geo
  },[raster,props.exaggeration,props.surfaceStyle,analysis])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useEffect(()=>props.onReady(),[props.onReady])
  return <>
    <mesh geometry={geometry} receiveShadow castShadow onClick={e=>{if(e.delta>4)return;e.stopPropagation();props.onSelectCoordinates(polarToLatLon(e.point.x*TERRAIN_SCALE,e.point.z*TERRAIN_SCALE))}}>
      {analysis ? <meshBasicMaterial key={`${analysis}-${Boolean(overlay)}`} map={overlay} vertexColors={analysis === 'terrain'} color={overlay || analysis === 'terrain' ? '#ffffff' : '#323941'} toneMapped={false}/> :
        <PolarSurfaceMaterial vertexColors relief={props.exaggeration}/>}
    </mesh>
    {props.labelsVisible&&SOUTH_POLE_FEATURES.map(f=><Marker key={f.id} feature={f} active={f.id===props.selected?.id} raster={raster} exaggeration={props.exaggeration} onSelect={()=>props.onSelect(f)}/>)}
    {analysis === 'ice' && <Marker feature={LCROSS_IMPACT} active={props.coordinates.latitude === LCROSS_IMPACT.latitude && props.coordinates.longitude === LCROSS_IMPACT.longitude} raster={raster} exaggeration={props.exaggeration} evidence onSelect={() => props.onSelectCoordinates(LCROSS_IMPACT)}/>}
    {(analysis || props.focusCoordinates) && !props.selected && <SelectedPoint coordinates={props.coordinates} raster={raster} exaggeration={props.exaggeration}/>}
    <TerrainCamera {...props} raster={raster}/>
  </>
}

function SelectedPoint({ coordinates, raster, exaggeration }: { coordinates: Coordinates; raster: HeightRaster; exaggeration: number }) {
  const { x, z } = latLonToPolar(coordinates.latitude, coordinates.longitude)
  const height = polarHeight(raster, x, z)
  if (height === null) return null
  return <mesh position={[x / TERRAIN_SCALE, height / TERRAIN_SCALE * exaggeration + .018, z / TERRAIN_SCALE]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[.032, .047, 24]}/>
    <meshBasicMaterial color="#fff1ad" toneMapped={false}/>
  </mesh>
}
export function SouthPoleScene(props:Props){
  return <Canvas frameloop={props.active===false?'never':'always'} dpr={[1,1.5]} shadows camera={{position:[2,2.8,4.8],fov:42,near:.01,far:90}} gl={{antialias:true,powerPreference:'high-performance'}}>
    <color attach="background" args={[polarBackground]}/><PolarSurfaceLighting angle={props.lightAngle}/>
    <Suspense fallback={null}><Terrain {...props}/></Suspense>
  </Canvas>
}
