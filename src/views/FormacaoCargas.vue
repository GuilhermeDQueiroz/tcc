<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {useLogisticsStore} from '../stores/logistics'
import LogisticsFilterDrawer from '../components/filters/LogisticsFilterDrawer.vue'
import LogisticsActiveFilterChips from '../components/filters/LogisticsActiveFilterChips.vue'
import MetricCard from '../components/analytics/MetricCard.vue'
import {AnalyticChart} from '../components/analytics/asyncChart'
import AnalyticTable from '../components/analytics/AnalyticTable.vue'
import LoadingState from '../components/ui/LoadingState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import {formatValue} from '../composables/useFormatters'
import type {AnalyticTable as Table,Row} from '../types/analytics'
import {formationTables,destinationSeries,destinationTable,type FormationSelection} from '../domain/logistics/formation'
const store=useLogisticsStore(),selection=ref<FormationSelection>(null),destinationUf=ref('')
const emptyTables:Table[]=[{id:'logistica-pedidos',title:'Pedidos e saldo para formação de cargas',placeholder:true,rows:[],columns:[{key:'identificacao',label:'Pedido / item'},{key:'quantidade_aberta',label:'Qtd. aberta'},{key:'quantidade_alocada',label:'Qtd. em carga'},{key:'quantidade_sem_carga',label:'Qtd. sem carga'}]},
 {id:'logistica-cargas',title:'Cargas e pedidos vinculados',placeholder:true,rows:[],columns:[{key:'identificacao',label:'Carga / pedido / item'},{key:'quantidade_alocada',label:'Qtd. aberta em carga'}]}]
const tables=computed(()=>store.dashboard?.tables||emptyTables)
const tableLabels:Record<string,string>={descricao:'Descrição',pedidos:'Pedidos',quantidade_alocada:'Em carga',quantidade_sem_carga:'Sem carga',peso_em_carga:'Peso (t)',cubagem_em_carga:'m³ em carga',cubagem_sem_carga:'m³ sem carga',valor_em_carga:'Valor (R$)',valor_aberto:'Valor (R$)',previsao:'Prev. faturamento',etapa:'Etapa',empresa:'Emp.'}
const linkedTables=computed(()=>{
 const value=formationTables(tables.value,selection.value)
 const columns=(table:Table)=>table.columns.map(column=>({...column,label:tableLabels[column.key]||column.label}))
 return {orders:{...value.orders,title:'Pedidos e itens',columns:columns(value.orders)},loads:{...value.loads,title:'Cargas',columns:columns(value.loads)}}
})
const columnWidths={identificacao:185,descricao:160,pedidos:80,quantidade_aberta:95,quantidade_alocada:105,quantidade_sem_carga:105,peso_em_carga:100,cubagem_em_carga:115,cubagem_sem_carga:115,valor_em_carga:145,valor_aberto:145,previsao:125,etapa:160,empresa:75,cliente:165,cidade:170,uf:50,situacao:150,cargas:105}

const mappedOrders=computed(()=>selection.value?.kind==='order'?tables.value[0]!.rows.filter(row=>String(row.pedido_id)===selection.value!.id):linkedTables.value.orders.rows)
const mapSeries=computed(()=>destinationSeries(mappedOrders.value))
const cityTable=computed(()=>destinationTable(mappedOrders.value,destinationUf.value))
const mappedCount=computed(()=>((mapSeries.value.points||[]) as Row[]).length)
const cepCount=computed(()=>((mapSeries.value.points||[]) as Row[]).filter(row=>row.geo_origin==='CEP').length)
const selectionLabel=computed(()=>selection.value?(selection.value.kind==='load'?'Carga ':'Pedido ')+selection.value.id:'')
const orderColumns=['identificacao','cliente','cidade','uf','quantidade_aberta','quantidade_alocada','quantidade_sem_carga','cubagem_em_carga','cubagem_sem_carga','valor_aberto','cargas','previsao','situacao','empresa']
const loadColumns=['identificacao','descricao','pedidos','quantidade_alocada','peso_em_carga','cubagem_em_carga','valor_em_carga','previsao','etapa','empresa']
function clearSelection(){selection.value=null;destinationUf.value=''}
function choose(kind:'load'|'order',id:unknown){if(!id||store.loading)return;const value=String(id);selection.value=selection.value?.kind===kind&&selection.value.id===value?null:{kind,id:value};destinationUf.value=''}
function selectOrder(row:Row){choose('order',row.pedido_id)}
function selectLoad(row:Row){if(row.pedido_id)choose('order',row.pedido_id);else choose('load',row.carga_id)}
function geography(dimension:string,value:unknown){if(dimension==='CODIGO_PEDIDO')choose('order',value);else if(dimension==='UF'&&typeof value==='string'&&/^[A-Z]{2}$/.test(value))destinationUf.value=destinationUf.value===value?'':value}
function selectCity(row:Row){if(store.loading)return;clearSelection();store.extraFilters.uf=String(row.uf||'');store.extraFilters.city=row.cidade?String(row.cidade):'';void store.load()}
watch(()=>store.dashboard,clearSelection)
onMounted(()=>void store.load());onBeforeUnmount(()=>store.cancel())
</script>
<template>
 <div class="analytics-page logistics-page">
  <LoadingState :active="store.loading" screen label="Carregando formação de cargas…"/>
  <div v-if="store.error" class="logistics-error" role="alert">{{store.error}} <button @click="store.load">Tentar novamente</button></div>
  <LogisticsFilterDrawer/>
  <LogisticsActiveFilterChips/>
  <div v-if="store.dashboard" class="logistics-metrics"><MetricCard v-for="metric in store.dashboard.metrics" :key="metric.id" :metric="metric" compact/></div>
  <section class="logistics-workspace" aria-label="Exploração de cargas e pedidos">
   <div class="logistics-selection" :class="{'logistics-selection-empty':!selection}" role="status" aria-live="polite">
    <template v-if="selection"><AppIcon :name="selection.kind==='load'?'truck':'receipt'"/><strong>{{selectionLabel}} {{selection.kind==='load'?'selecionada':'selecionado'}}</strong><button type="button" :disabled="store.loading" aria-label="Limpar seleção" title="Limpar seleção" @click="clearSelection"><AppIcon name="close"/></button></template><span v-else>Nenhuma seleção</span>
   </div>
   <div class="logistics-workspace-grid">
    <aside class="logistics-destinations" aria-label="Destinos do recorte selecionado">
     <AnalyticChart class="logistics-map-panel" :series="mapSeries" :loading="store.loading" @drilldown="geography"/>
     <div class="logistics-map-footer"><span class="logistics-coordinate-coverage" :title="`${mappedCount-cepCount} ERP (círculos verdes) · ${cepCount} CEP aproximado (losangos azuis). Sem ponto: ${mappedOrders.length-mappedCount}; permanecem na consulta de cidades.`"><AppIcon name="pin"/>{{formatValue(mappedCount,'integer')}} / {{formatValue(mappedOrders.length,'integer')}} no mapa · {{formatValue(cepCount,'integer')}} CEP aprox.</span><button v-if="destinationUf" class="logistics-destination-filter" @click="destinationUf=''">{{destinationUf}} <AppIcon name="close"/></button><div class="logistics-tools">
   <details class="logistics-help"><summary aria-label="Ajuda da formação de cargas" title="Ajuda"><AppIcon name="help"/></summary><div class="logistics-help-content">
    <strong>Como explorar</strong><p>Selecione uma carga para conferir seus pedidos e itens. Selecione um pedido para localizar suas cargas. Clique novamente para limpar a seleção.</p>
    <strong>Recorte dos dados</strong><p>Os indicadores representam os filtros aplicados. As tabelas e o mapa acompanham a seleção. Alocação em carga não comprova faturamento, estoque disponível ou saída física.</p>
    <strong>Mapa e previsões</strong><p>Círculos verdes: coordenadas cadastradas no ERP. Losangos azuis: localização aproximada obtida pelo CEP de entrega, podendo representar o centro do município. Não indica o imóvel nem calcula rotas. A origem aparece ao passar o mouse sobre o ponto. Pedidos sem localização continuam na consulta por cidade e nos totais de estado quando têm UF válida.</p><p v-if="store.dashboard?.meta.geoWarning">{{store.dashboard.meta.geoWarning}}</p><p>As previsões são de faturamento. Para saldo em carga, usamos a previsão do vínculo, da carga ou do pedido, nessa ordem. Saldos sem data ficam fora dos gráficos.</p>
    <span v-if="store.dashboard">Referência: {{formatValue(store.dashboard.referenceDate,'date')}} · Emissão desde {{formatValue(store.dashboard.meta.startDate,'date')}}</span>
   </div></details>
  </div></div>
    </aside>
    <div class="logistics-linked-tables">
     <AnalyticTable class="logistics-loads" :table="linkedTables.loads" :loading="store.loading" initial-sort="identificacao" initial-direction="asc" :pagination="false" hide-title :selected-keys="loadColumns" :column-widths="columnWidths" fit selectable :selected-row-id="selection?.kind==='load'?'carga-'+selection.id:undefined" :auto-expand="selection?.kind==='order'" @select="selectLoad"></AnalyticTable>
     <AnalyticTable class="logistics-orders" :table="linkedTables.orders" :loading="store.loading" initial-sort="identificacao" initial-direction="asc" :pagination="false" hide-title :selected-keys="orderColumns" :column-widths="columnWidths" fit selectable :selected-row-id="selection?.kind==='order'?'pedido-'+selection.id:undefined" :auto-expand="selection?.kind==='load'" @select="selectOrder"></AnalyticTable>
    </div>
   </div>
   <section class="logistics-city-details" aria-label="Destinos por UF e cidade">
    <AnalyticTable class="logistics-cities" :table="cityTable" :loading="store.loading" :pagination="false" initial-sort="pedidos" :column-widths="{...columnWidths,localidade:300}" selectable @select="selectCity"/>
   </section>
  </section>
  <section v-if="store.dashboard?.series && store.dashboard.meta.forecast" class="logistics-planning" aria-label="Planejamento operacional">
   <div class="logistics-chart-grid"><AnalyticChart v-for="series in store.dashboard.series.slice(0,2)" :key="series.id" :series="series" :loading="store.loading"/></div>
   <AnalyticTable v-for="table in store.dashboard.operationalTables" :key="table.id" :table="table" :loading="store.loading" :page-size="15" initial-sort="pedidos"/>
  </section>
 </div>
</template>
<style scoped src="./formacao-cargas.css"></style>
