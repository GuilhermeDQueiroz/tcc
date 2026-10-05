import {getMap,registerMap} from 'echarts/core'
import brazilUrl from '../assets/brazil-states.geojson?url'

let pending:Promise<void>|undefined

// ECharts owns the registered map; share the download and parsing across charts.
export function ensureBrazilMap():Promise<void>{
  if(getMap('brazil'))return Promise.resolve()
  if(!pending){
    pending=(async()=>{
      const response=await fetch(brazilUrl)
      if(!response.ok)throw new Error('Não foi possível carregar o mapa do Brasil.')
      registerMap('brazil',await response.json())
    })().finally(()=>{pending=undefined})
  }
  return pending
}
