import {defineStore} from 'pinia'
import {computed,ref,shallowRef} from 'vue'
import {request,download} from '../api/client'
import type {Metric,Series,AnalyticTable} from '../types/analytics'
export type AftersalesArea='assistencias'|'cancelamentos'|'devolucoes'
export const aftersalesTitles:Record<AftersalesArea,string>={assistencias:'Assistências',cancelamentos:'Cancelamentos de venda',devolucoes:'Devoluções'}
export interface AftersalesDashboard {
 dataVersion:string;referenceDate:string;meta:{publishedAt:string;start:string;end:string;sourceStart:string;granularity:string};metrics:Metric[];series:Series[];table:AnalyticTable;
 analysis:{selected:string;options:{id:string;label:string}[];table:AnalyticTable;hierarchy:string[];evolution:Series;coverage:{weightMissing:number;volumeMissing:number;commercialConflicts:number}};assistance?:{aging:Series;forecast:Series;forecastStatus:Series;types:Series;status:Series};
 options:Record<string,string[]>;total:number;page:number;pageSize:number;quality:{missingValues:number;missingLeadTime?:number}
}
type AftersalesDetails=Pick<AftersalesDashboard,'dataVersion'|'referenceDate'|'total'|'table'|'page'|'pageSize'>
export const useAftersalesStore=defineStore('aftersales',()=>{
 const area=ref<AftersalesArea>('assistencias'),view=ref('abertas'),dashboard=shallowRef<AftersalesDashboard|null>(null),loading=ref(false),error=ref(''),filtersOpen=ref(false)
 const analysisLoading=ref(false),detailsLoading=ref(false),analysisError=ref(''),detailsError=ref('')
 const filters=ref<Record<string,string>>({}),scopeKind=ref(''),page=ref(1),pageSize=ref(20),sort=ref('data'),direction=ref<'asc'|'desc'>('desc')
 const dimension=ref('month'),metric=ref('value'),hierarchy=ref(''),granularity=ref<'month'|'week'|'day'>('month')
 const filterCount=computed(()=>Object.values(filters.value).filter(Boolean).length)
 let sequence=0,controller:AbortController|undefined
 function params(){return new URLSearchParams({...Object.fromEntries(Object.entries(filters.value).filter(([,value])=>value)),...(scopeKind.value?{kind:scopeKind.value}:{}),...(area.value==='assistencias'?{view:view.value}:{}),dimension:dimension.value,metric:metric.value,...(hierarchy.value?{hierarchy:hierarchy.value}:{}),granularity:granularity.value,page:String(page.value),pageSize:String(pageSize.value),sort:sort.value,direction:direction.value})}
 async function loadDashboard(mode:'dashboard'|'details'|'analysis'){
  const current=++sequence;controller?.abort();controller=new AbortController()
  const partial=mode!=='dashboard'&&!!dashboard.value
  loading.value=!partial;analysisLoading.value=partial&&mode==='analysis';detailsLoading.value=partial&&mode==='details'
  error.value='';analysisError.value='';detailsError.value=''
  const query=params()
  if(partial&&mode==='details')query.set('section','details')
  try{
   const data=await request<AftersalesDashboard|AftersalesDetails>('/posvenda/'+area.value+'?'+query,{signal:controller.signal})
   if(current===sequence){
    if(partial){
     if(dashboard.value?.dataVersion!==data.dataVersion){void load();return}
     // Local interactions preserve the rest of the visible dashboard.
     dashboard.value=mode==='analysis'
      ? {...dashboard.value,analysis:(data as AftersalesDashboard).analysis}
      : {...dashboard.value,...data}
    }else dashboard.value=data as AftersalesDashboard
   }
  }
  catch(cause){if(current===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError')){
   const message=cause instanceof Error?cause.message:'Não foi possível carregar o painel.'
   if(partial&&mode==='analysis')analysisError.value=message
   else if(partial)detailsError.value=message
   else {dashboard.value=null;error.value=message}
  }}
  finally{if(current===sequence){loading.value=false;analysisLoading.value=false;detailsLoading.value=false}}
 }
 async function load(){await loadDashboard('dashboard')}
 function select(next:AftersalesArea,selectedView='abertas',kind=''){cancel();area.value=next;view.value=selectedView;scopeKind.value=next==='devolucoes'||next==='cancelamentos'?kind:'';filters.value={};error.value='';page.value=1;sort.value='data';direction.value='desc';dimension.value='month';metric.value='value';hierarchy.value='';granularity.value='month';dashboard.value=null;void load()}
 function apply(value:Record<string,string>){filters.value={...value};page.value=1;void load()}
 function drillDown(key:string,value:unknown){
  if(loading.value||!['uf','city','reason','product','kind'].includes(key)||value==null)return
  const selected=String(value)
  if(!selected||selected==='Outros')return
  const next={...filters.value}
  if(next[key]===selected)delete next[key];else next[key]=selected
  apply(next)
 }
 function setView(value:string){view.value=value;if(value==='abertas'&&metric.value==='orders')metric.value='value';page.value=1;void load()}
 function setPage(value:number){page.value=value;void loadDashboard('details')}
 function setSize(value:number){pageSize.value=value;page.value=1;void loadDashboard('details')}
 function setSort(key:string,value:'asc'|'desc'){sort.value=key;direction.value=value;page.value=1;void loadDashboard('details')}
 function setDimension(value:string){if(value===dimension.value&&dashboard.value?.analysis.selected===value&&!analysisError.value)return;dimension.value=value;hierarchy.value='';void loadDashboard('analysis')}
 function setMetric(value:string){metric.value=value;void loadDashboard('analysis')}
 function setHierarchy(value:string){hierarchy.value=value;void loadDashboard('analysis')}
 function loadAnalysis(){return loadDashboard('analysis')}
 function loadDetails(){return loadDashboard('details')}
 function setGranularity(value:'month'|'week'|'day'){if(value===granularity.value)return;granularity.value=value;void load()}
 async function exportCsv(){try{await download('/posvenda/'+area.value+'?'+params()+'&export=csv',area.value+(scopeKind.value?'-'+(scopeKind.value==='Venda'?'venda':'assistencia'):'')+'.csv')}catch(cause){error.value=cause instanceof Error?cause.message:'Falha na exportação.'}}
 function cancel(){sequence++;controller?.abort();loading.value=false;analysisLoading.value=false;detailsLoading.value=false;filtersOpen.value=false}
 return {area,view,dashboard,loading,analysisLoading,detailsLoading,error,analysisError,detailsError,filtersOpen,filters,scopeKind,filterCount,page,pageSize,sort,direction,dimension,metric,hierarchy,granularity,load,loadAnalysis,loadDetails,select,apply,drillDown,setView,setPage,setSize,setSort,setDimension,setMetric,setHierarchy,setGranularity,exportCsv,cancel}
})
