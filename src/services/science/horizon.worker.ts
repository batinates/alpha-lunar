import { loadHeightRaster, latLonToPolar, polarHeight, POLAR_HALF_EXTENT } from './lunarAssets'
import { buildHorizon } from './terrainHorizon'
self.onmessage=async(event:MessageEvent<{id:number;latitude:number;longitude:number;mastHeight:number}>)=>{
  const {id,latitude,longitude,mastHeight}=event.data
  try {
    const raster=await loadHeightRaster('south-pole')
    const profile=buildHorizon(latitude,longitude,mastHeight,(lat,lon)=>{
      const p=latLonToPolar(lat,lon)
      // Do not clamp outside pixel-center coverage and invent edge terrain.
      if(Math.abs(p.x)>POLAR_HALF_EXTENT-80||Math.abs(p.z)>POLAR_HALF_EXTENT-80)return null
      return polarHeight(raster,p.x,p.z)
    })
    self.postMessage({id,profile})
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'DEM horizon failed'})}
}
