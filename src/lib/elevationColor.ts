import {Color} from 'three'
const stops=['#20345e','#347f91','#97b8a4','#c4ab78','#eee1c1'].map(c=>new Color(c))
/** Display scale in meters above the 1,737.4 km lunar reference sphere. */
export function elevationColor(height:number,target=new Color()){
  const t=Math.max(0,Math.min(.999999,(height+10000)/22000))*4,index=Math.floor(t)
  return target.copy(stops[index]).lerp(stops[index+1],t-index)
}
