import {defineStore} from 'pinia'
import {computed,ref,shallowRef} from 'vue'
import {request} from '../api/client'
import type {Metric,AnalyticTable,Series} from '../types/analytics'
import {emptyLogisticsFilters,type LogisticsFilters} from '../domain/logistics/filters'
export interface LogisticsDashboard {
 dataVersion:string;referenceDate:string;metrics:Metric[];tables:AnalyticTable[];companies:string[];
 series:Series[];operationalTables:AnalyticTable[];options:{ufs:string[];cities:string[];statuses:string[];clients:string[];products:string[];loadStages:string[]};
 meta:{publishedAt:string;startDate:string;source:string;selectedItems:number;unpricedItems:number;allocationQuantity:number;openQuantity:number;freeQuantity:number;ordersMultipleLoads:number;missingGeographyOrders:number;forecast:{withoutDateQuantity:number;overdueQuantity:number;scheduledQuantity:number};measures:Record<string,{value:number;missing:number}>}
}
export const useLogisticsStore=defineStore('logistics',()=>{
 const dashboard=shallowRef<LogisticsDashboard|null>(null),loading=ref(false),error=ref(''),filtersOpen=ref(false)
 const company=ref(''),status=ref(''),search=ref('')
 const {company:initialCompany,status:initialStatus,search:initialSearch,...initialExtra}=emptyLogisticsFilters()
 const extraFilters=ref(initialExtra)
 const filters=computed<LogisticsFilters>(()=>({company:company.value,status:status.value,search:search.value,...extraFilters.value}))
 const filterCount=computed(()=>Object.entries(filters.value).filter(([key,value])=>!['emissionStart','emissionEnd','forecastStart','forecastEnd'].includes(key)&&(Array.isArray(value)?value.length:!!value.trim())).length+Number(!!(extraFilters.value.emissionStart||extraFilters.value.emissionEnd))+Number(!!(extraFilters.value.forecastStart||extraFilters.value.forecastEnd)))
 let sequence=0,controller:AbortController|undefined
 async function load(){
  const current=++sequence;controller?.abort();controller=new AbortController();loading.value=true;error.value=''
  const params=new URLSearchParams()
  for(const [key,value] of Object.entries(filters.value))for(const entry of Array.isArray(value)?value:[value.trim()])if(entry)params.append(key,entry)
  try{const data=await request<LogisticsDashboard>('/logistica/formacao?'+params,{signal:controller.signal});if(current===sequence)dashboard.value=data}
  catch(cause){if(current===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError'))error.value=cause instanceof Error?cause.message:'Não foi possível carregar a formação de cargas.'}
  finally{if(current===sequence)loading.value=false}
 }
 function applyFilters(value:LogisticsFilters){const {company:nextCompany,status:nextStatus,search:nextSearch,...extra}=value;company.value=nextCompany;status.value=nextStatus;search.value=nextSearch;extraFilters.value=extra;void load()}
 function reset(){applyFilters(emptyLogisticsFilters())}
 function cancel(){sequence++;controller?.abort();loading.value=false}
 return {dashboard,loading,error,filtersOpen,company,status,search,extraFilters,filters,filterCount,applyFilters,load,reset,cancel}
})
