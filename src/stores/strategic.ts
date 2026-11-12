import {strategicDefaultPeriod} from '../../shared/strategic-period.js'
import {defineStore} from 'pinia'
import {computed,ref,shallowRef} from 'vue'
import {request} from '../api/client'
import {toggleCrossFilter} from '../../shared/cross-filter.js'
import type {Metric,Series,Filters,AnalyticTable} from '../types/analytics'
import type {CohortAnalysis} from '../types/cohorts'

export interface StrategicDashboard {
 dataVersion:string;referenceDate:string;metrics:Metric[];operationalMetrics:Metric[];series:Series[];options:Record<string,string[]>;cohorts:CohortAnalysis;
 analysis:{dimension:string;options:{id:string;label:string;icon:string}[];measures:Record<string,{label:string;format:string}>;table:AnalyticTable;deferred?:boolean};
 portfolio:{referenceDate:string;rateStart:string;rateEnd:string;table:AnalyticTable};
 financial:{cardSummary:AnalyticTable;geography:Series & {unmapped:{records:number;value:number|null}};monthlyTable:AnalyticTable;heatmap:Series;heatmapOptions:{dimensions:{id:string;label:string}[];measures:Record<string,{label:string;format:string}>};comparison:{available:boolean;start:string|null;end:string|null;previousStart:string|null;previousEnd:string|null;currentLabel:string;previousLabel:string;revenueChange:number|null;revenueDifference:number|null;revenueTonChange:number|null}};
 meta:{publishedAt:string;history:{start:string;end:string;records:number;withForecast:number;forecastCoverage:number|null;partialMonth:boolean};publications:{logistics:{version:string;referenceDate:string;publishedAt:string};billing:{version:string;publishedAt:string;lastBillingDate:string|null}}}
}
export const useStrategicStore=defineStore('strategic',()=>{
 const dashboard=shallowRef<StrategicDashboard|null>(null),loading=ref(false),error=ref(''),filtersOpen=ref(false)
 const analysisLoading=ref(false),analysisError=ref('')
 let automaticPeriod=strategicDefaultPeriod()
 const defaultFilters=():Filters=>{automaticPeriod=strategicDefaultPeriod();return {billingRange:[automaticPeriod.start,automaticPeriod.end]}}
 const filters=ref<Filters>(defaultFilters()),granularity=ref<'month'|'week'|'day'>('month'),dimension=ref('UF')
 const heatmapDimension=ref('year'),heatmapMetric=ref('value')
 const filterCount=computed(()=>Object.values(filters.value.dimensions||{}).filter(values=>values.length).length+Number(!!filters.value.billingRange&&(filters.value.billingRange[0]!==automaticPeriod.start||filters.value.billingRange[1]!==automaticPeriod.end))+Number(!!filters.value.emissionRange))
 let sequence=0,controller:AbortController|undefined,analysisSequence=0,analysisController:AbortController|undefined
 function cancelAnalysis(){analysisSequence++;analysisController?.abort();analysisLoading.value=false;analysisError.value=''}
 async function load(){
  const range=filters.value.billingRange
  if(!range||(range[0]===automaticPeriod.start&&range[1]===automaticPeriod.end))filters.value={...filters.value,...defaultFilters()}
  cancelAnalysis()
  const current=++sequence;controller?.abort();controller=new AbortController();loading.value=true;error.value=''
  const params=new URLSearchParams({filters:JSON.stringify(filters.value),granularity:granularity.value,dimension:dimension.value,heatmapDimension:heatmapDimension.value,heatmapMetric:heatmapMetric.value,section:'overview'})
  try{const data=await request<StrategicDashboard>('/logistica/estrategico?'+params,{signal:controller.signal});if(current===sequence)dashboard.value=data}
  catch(cause){if(current===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError')){dashboard.value=null;error.value=cause instanceof Error?cause.message:'Não foi possível carregar a visão estratégica.'}}
  finally{if(current===sequence)loading.value=false}
 }
 function applyFilters(value:Filters){filters.value={...defaultFilters(),...JSON.parse(JSON.stringify(value))};void load()}
 function drillDown(dimension:string,value:unknown){
  if(!['UF','CIDADE','TIPO_ENTREGA'].includes(dimension))return
  const next=toggleCrossFilter(filters.value,dimension,value)
  if(next!==filters.value)applyFilters(next)
 }
 function reset(){applyFilters({})}
 function setGranularity(value:'month'|'week'|'day'){if(granularity.value===value)return;granularity.value=value;void load()}
 async function loadAnalysis(){
  if(!dashboard.value||loading.value)return
  const current=++analysisSequence,context=sequence,version=dashboard.value.dataVersion
  analysisController?.abort();analysisController=new AbortController();analysisLoading.value=true;analysisError.value=''
  const params=new URLSearchParams({filters:JSON.stringify(filters.value),dimension:dimension.value,section:'analysis'})
  try{
   const data=await request<Pick<StrategicDashboard,'dataVersion'|'referenceDate'|'analysis'>>('/logistica/estrategico?'+params,{signal:analysisController.signal})
   if(current!==analysisSequence||context!==sequence||!dashboard.value)return
   if(data.dataVersion!==version||data.referenceDate!==dashboard.value.referenceDate){analysisError.value='A publicação mudou. Atualize os dados do painel para continuar.';return}
   dashboard.value={...dashboard.value,analysis:data.analysis}
  }catch(cause){if(current===analysisSequence&&context===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError'))analysisError.value=cause instanceof Error?cause.message:'Não foi possível carregar a dimensão.'}
  finally{if(current===analysisSequence)analysisLoading.value=false}
 }
 function setDimension(value:string){if(loading.value||dimension.value===value&&!analysisError.value&&!dashboard.value?.analysis.deferred)return;dimension.value=value;void loadAnalysis()}
 function setHeatmap(){void load()}
 function cancel(){sequence++;controller?.abort();cancelAnalysis();loading.value=false}
 return {dashboard,loading,error,analysisLoading,analysisError,loadAnalysis,filtersOpen,filters,granularity,dimension,heatmapDimension,heatmapMetric,filterCount,load,applyFilters,drillDown,reset,setGranularity,setDimension,setHeatmap,cancel}
})
