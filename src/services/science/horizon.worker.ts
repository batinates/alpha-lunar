import { loadHeightRaster, samplePolarHorizon } from './lunarAssets'
import { buildHorizon } from './terrainHorizon'
self.onmessage=async(event:MessageEvent<{id:number;latitude:number;longitude:number;mastHeight:number}>)=>{
  const {id,latitude,longitude,mastHeight}=event.data
  try {
    const raster=await loadHeightRaster('south-pole')
    const profile=buildHorizon(latitude,longitude,mastHeight,(lat,lon)=>samplePolarHorizon(raster,lat,lon))
    self.postMessage({id,profile})
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'DEM horizon failed'})}
}
