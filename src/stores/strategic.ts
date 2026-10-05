import {defineStore} from 'pinia'
import {computed,ref,shallowRef} from 'vue'
import {request} from '../api/client'
import type {Metric,Series,Filters} from '../types/analytics'

export interface StrategicDashboard {
 dataVersion:string;referenceDate:string;metrics:Metric[];operationalMetrics:Metric[];series:Series[];options:Record<string,string[]>;
 meta:{publishedAt:string;history:{start:string;end:string;records:number;withForecast:number;forecastCoverage:number|null;partialMonth:boolean};publications:{logistics:{version:string;referenceDate:string;publishedAt:string};billing:{version:string;publishedAt:string;lastBillingDate:string|null}}}
}
export const useStrategicStore=defineStore('strategic',()=>{
 const dashboard=shallowRef<StrategicDashboard|null>(null),loading=ref(false),error=ref(''),filtersOpen=ref(false)
 const filters=ref<Filters>({}),granularity=ref<'month'|'week'|'day'>('month')
 const filterCount=computed(()=>Object.values(filters.value.dimensions||{}).filter(values=>values.length).length+Number(!!filters.value.billingRange)+Number(!!filters.value.emissionRange))
 let sequence=0,controller:AbortController|undefined
 async function load(){
  const current=++sequence;controller?.abort();controller=new AbortController();loading.value=true;error.value=''
  const params=new URLSearchParams({filters:JSON.stringify(filters.value),granularity:granularity.value})
  try{const data=await request<StrategicDashboard>('/logistica/estrategico?'+params,{signal:controller.signal});if(current===sequence)dashboard.value=data}
  catch(cause){if(current===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError')){dashboard.value=null;error.value=cause instanceof Error?cause.message:'Não foi possível carregar a visão estratégica.'}}
  finally{if(current===sequence)loading.value=false}
 }
 function applyFilters(value:Filters){filters.value=JSON.parse(JSON.stringify(value));void load()}
 function reset(){applyFilters({})}
 function setGranularity(value:'month'|'week'|'day'){if(granularity.value===value)return;granularity.value=value;void load()}
 function cancel(){sequence++;controller?.abort();loading.value=false}
 return {dashboard,loading,error,filtersOpen,filters,granularity,filterCount,load,applyFilters,reset,setGranularity,cancel}
})
