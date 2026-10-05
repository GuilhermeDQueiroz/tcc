<script setup lang="ts">
import {ref,shallowRef,computed,watch,onBeforeUnmount} from 'vue'
import type {DashboardPayload,DetailsPayload,Row,Column} from '../../types/analytics'
import {request,download} from '../../api/client'
import {useAnalyticsStore} from '../../stores/analytics'
import AnalyticTable from '../analytics/AnalyticTable.vue'
const props=defineProps<{payload:DashboardPayload;forecastDate?:string}>(),emit=defineEmits<{clearDate:[]}>(),store=useAnalyticsStore()
type OrdersPayload=DetailsPayload & {grain:string;totalRow:Row;localOptions:Record<string,string[]>}
const result=shallowRef<OrdersPayload>(),loading=ref(false),error=ref(''),search=ref(''),appliedSearch=ref(''),page=ref(1),pageSize=ref(1_000_000),sort=ref('VALOR_EM_ABERTO_CLEAN'),direction=ref<'asc'|'desc'>('desc'),columns=ref<string[]>([]),available=ref<Column[]>([])
const local=ref<Record<string,string[]>>({}),options=ref<Record<string,string[]>>({})
const table=computed(()=>({id:'abertos-orders',title:'Pesquisa de pedidos',placeholder:!result.value,rows:result.value?.rows || [],columns:available.value.length?available.value:[{key:'CODIGO_PEDIDO',label:'Pedido'},{key:'CLIENTE',label:'Cliente'},{key:'VALOR_EM_ABERTO_CLEAN',label:'Valor',format:'currency'}],total:result.value?.totalRow}))
const columnWidths={CODIGO_PEDIDO:120,CODIGO_CLIENTE:140,RAZAO_SOCIAL:260,TIPO_ENTREGA:165,STATUS:190,VALOR_EM_ABERTO_CLEAN:175,PESO_EM_ABERTO_CLEAN:135,VOLUME_M3_EM_ABERTO_CLEAN:145,QTDEABERTA_DOCITEMDET_CLEAN:135,NIVEL_DE_SERVICO_CLEAN:165}
let sequence=0,abort:AbortController|undefined
function query(extra:Record<string,unknown>={}){return store.query({referenceDate:props.payload.referenceDate,forecastDate:props.forecastDate || '',grain:'order',detailFilters:JSON.stringify({dimensions:local.value,search:appliedSearch.value || undefined}),page:page.value,pageSize:pageSize.value,sort:sort.value,direction:direction.value,columns:columns.value.join(','),...extra})}
async function load(){
 const current=++sequence;abort?.abort();abort=new AbortController();loading.value=true;error.value=''
 try{const data=await request<OrdersPayload>('/bi/abertos/detalhes?'+query(),{signal:abort.signal});if(current!==sequence)return;if(data.dataVersion!==props.payload.dataVersion){error.value='A publicação mudou. Atualize os dados antes de continuar.';return}result.value=data;options.value=data.localOptions;const known=new Map(available.value.map(column=>[column.key,column]));data.columns.forEach(column=>known.set(column.key,column));available.value=[...known.values()]}
 catch(cause){if(current===sequence&&!(cause instanceof DOMException&&cause.name==='AbortError'))error.value=cause instanceof Error?cause.message:'Não foi possível carregar os pedidos.'}
 finally{if(current===sequence)loading.value=false}
}
function select(key:string,event:Event){local.value={...local.value,[key]:Array.from((event.target as HTMLSelectElement).selectedOptions,option=>option.value)};page.value=1;void load()}
function applySearch(){appliedSearch.value=search.value.trim();page.value=1;void load()}
function sortRows(key:string,value:'asc'|'desc'){sort.value=key;direction.value=value;page.value=1;void load()}
function setPage(value:number){page.value=value;void load()}
function setSize(value:number){pageSize.value=value;page.value=1;void load()}
function setColumns(value:string[]){columns.value=value;page.value=1;void load()}
async function exportRows(){loading.value=true;try{await download('/bi/abertos/detalhes?'+query({export:'csv'}),'abertos-pedidos.csv')}catch(cause){error.value=cause instanceof Error?cause.message:'Falha ao exportar.'}finally{loading.value=false}}
watch([()=>props.payload,()=>props.forecastDate],()=>{page.value=1;void load()},{immediate:true})
onBeforeUnmount(()=>{sequence++;abort?.abort()})
</script>
<template><div class="open-orders"><form class="order-search-form" @submit.prevent="applySearch"><label>Pesquisar pedidos<input v-model="search" placeholder="Pedido, cliente ou produto"></label><button class="primary" type="submit" :disabled="loading">Pesquisar</button></form><div class="order-local-filters"><label v-for="[key,label] in [['SUPERVISOR','Supervisor'],['CONSULTOR','Consultor'],['STATUS','Status do Pedido']]" :key="key">{{label}}<select :aria-label="`Filtrar pedidos por ${label}`" multiple :value="local[key!] || []" @change="select(key!,$event)"><option v-for="value in options[key!] || []" :key="value">{{value}}</option></select></label></div><div v-if="forecastDate" class="search-feedback">Previsão: {{forecastDate.split('-').reverse().join('/')}} <button @click="emit('clearDate')">Limpar data da pesquisa</button></div><div v-if="error" class="error-box" role="alert">{{error}}<button @click="load">Tentar novamente</button></div><AnalyticTable :table="table" :loading="loading" loading-label="Carregando pedidos consolidados…" :pagination="false" fit :column-widths="columnWidths" server :total-rows="result?.total" :page="page" :page-size="pageSize" :selected-keys="columns" :initial-sort="sort" :initial-direction="direction" @page="setPage" @page-size="setSize" @sort="sortRows" @columns="setColumns" @export="exportRows" @drilldown="store.drillDown"/></div></template>
