import {emptyLogisticsFilters} from './filters.ts'
import type {Filters} from '../../types/analytics'

export type StrategicPriority = 'all' | 'free' | 'overdue' | 'undated'

// Billing dates describe historical events; they cannot reconstruct an open balance.
export function strategicFormationFilters(filters:Filters,priority:StrategicPriority='all'){
 const result=emptyLogisticsFilters()
 result.uf=[...(filters.dimensions?.UF||[])]
 result.city=[...(filters.dimensions?.CIDADE||[])]
 result.delivery=(filters.dimensions?.TIPO_ENTREGA||[]).map(value=>{
  const type=value.trim().toLocaleUpperCase('pt-BR')
  return type==='ENTREGA'?'Entrega':['RETIRA','RETIRADA'].includes(type)?'Retirada':value
 })
 result.emissionStart=filters.emissionRange?.[0]||''
 result.emissionEnd=filters.emissionRange?.[1]||''
 if(priority==='free')result.freeQuantityMin='0.000001'
 if(priority==='overdue'||priority==='undated')result.forecastStatus=priority
 return result
}
