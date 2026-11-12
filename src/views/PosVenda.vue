<script setup lang="ts">
import {ref,watch,nextTick,onBeforeUnmount,computed} from 'vue'
import {useRoute} from 'vue-router'
import {useAftersalesStore,aftersalesTitles,type AftersalesArea} from '../stores/posvenda'
import MetricCard from '../components/analytics/MetricCard.vue'
import {AnalyticChart} from '../components/analytics/asyncChart'
import AnalyticTable from '../components/analytics/AnalyticTable.vue'
import AnalysisFrame from '../components/ui/AnalysisFrame.vue'
import LoadingState from '../components/ui/LoadingState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import ForecastCalendar from '../components/abertos/ForecastCalendar.vue'
import type {Series} from '../types/analytics'
import {formatValue} from '../composables/useFormatters'
import AftersalesFilterDrawer from '../components/filters/AftersalesFilterDrawer.vue'
import sharedDimensions from '../../shared/analysis-dimensions.json'
import aftersalesMeasures from '../../shared/aftersales-measures.json'

const store=useAftersalesStore(),route=useRoute()
const labels:Record<string,string>={start:'Data inicial',end:'Data final',uf:'Estado (UF)',city:'Cidade',reason:'Motivo',product:'Produto',kind:'Tipo',search:'Pesquisar',forecastDate:'Previsão'}
const dimensionIcons:Record<string,string>={...Object.fromEntries(sharedDimensions.map(entry=>[entry.id,entry.icon])),client:'users',reason:'help',kind:'layers',company:'building',forecastStatus:'calendar'}
const isOpen=computed(()=>store.area==='assistencias'&&store.view==='abertas')
const isBilledAssistance=computed(()=>store.area==='assistencias'&&store.view==='faturadas')
const isCancellation=computed(()=>store.area==='cancelamentos')
const isReturn=computed(()=>store.area==='devolucoes')
const hasMeasureControls=computed(()=>isOpen.value||isBilledAssistance.value||isCancellation.value||isReturn.value)
const metrics=computed(()=>(store.dashboard?.metrics||[]).map(metric=>metric.format==='currencyCompact'?{...metric,format:'currency'}:metric))

const mainSeries=computed(()=>store.dashboard?.series||[])
const assistance=computed(()=>isBilledAssistance.value?undefined:store.dashboard?.assistance)
const decorate=(series:Series):Series=>({...series,overviewStyle:true,compactDonut:series.type==='pie'||series.compactDonut,visualMapLabel:'Quantidade',icon:series.type==='map'?'map':series.id.includes('aging')?'clock':series.id.includes('forecast')?'calendar':series.id.includes('product')?'box':series.id.includes('status')?'status':series.id.includes('reason')?'help':series.type==='line'?'line':'chart'})
const chartRows=computed(()=>{
 const series=mainSeries.value,extra=assistance.value
 if(extra)return [[series[0]!,extra.aging],[extra.types,series[1]!],[series[3]!,extra.status]].map(row=>row.map(decorate))
 return [series.slice(0,2),series.slice(2)].filter(row=>row.length).map(row=>row.map(decorate))
})
const forecastStatus=computed(()=>assistance.value?decorate(assistance.value.forecastStatus):undefined)
const calendarYear=ref(0),calendarMonth=ref(1),analysisTab=ref('month'),analysisView=ref('table'),analysisMetric=ref('value'),search=ref(''),hierarchyInput=ref(''),displayLimit=ref('all'),displayOrder=ref('default')
const assistanceMeasures={...aftersalesMeasures.common,...aftersalesMeasures.assistencias}
const cancellationMeasures=computed(()=>({...aftersalesMeasures.common,...aftersalesMeasures.cancelamentos,orders:store.scopeKind==='Assistência'?{...aftersalesMeasures.cancelamentos.orders,label:'Quantidade de assistências'}:aftersalesMeasures.cancelamentos.orders}))
const returnMeasures={...aftersalesMeasures.common,...aftersalesMeasures.devolucoes}
type AssistanceMeasure=keyof typeof assistanceMeasures
const calendarMetric=ref<AssistanceMeasure>('quantity')
const calendarSeries=computed(()=>{
 const forecast=assistance.value?.forecast
 if(!forecast||!isOpen.value||!forecast.metricOptions)return forecast
 return {...forecast,y:[calendarMetric.value],format:assistanceMeasures[calendarMetric.value].format}
})
const dimensionMeasureDefinitions=computed<Record<string,{label:string;format:string}>>(()=>isOpen.value||isBilledAssistance.value?assistanceMeasures:isCancellation.value?cancellationMeasures.value:isReturn.value?returnMeasures:{})
const dimensionMeasures=computed(()=>hasMeasureControls.value?Object.entries(dimensionMeasureDefinitions.value).map(([key,{label}])=>[key,label]):[
 ['value','Valor (R$)'],['weightKg','Peso (Ton)'],['volumeM3','Volume (m³)'],['quantity','Qtd Itens'],['orders','Qtd Pedidos'],['documents','Qtd Documentos']
])
const analysisTable=ref<InstanceType<typeof AnalyticTable>>()
const analysisChartRef=ref<InstanceType<typeof AnalyticChart>>()
const calendarLabel=computed(()=>new Date(calendarYear.value,calendarMonth.value-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}))
const analysisChart=computed<Series>(()=>{
 const selected=analysisMetric.value
 const measure=dimensionMeasureDefinitions.value[selected]
 const evolution=store.dashboard?.analysis.evolution
 if(analysisView.value==='line'&&evolution){
  return measure?{...evolution,format:measure.format,labels:{...evolution.labels,[selected]:measure.label}}:evolution
 }
 const labels={quantity:isOpen.value?'Quantidade pendente':'Quantidade',value:'Valor',documents:'Documentos',orders:'Pedidos',weightKg:'Peso (t)',volumeM3:'Volume (m³)'}
 const format=selected==='value'?'currency':selected==='weightKg'?'weight':selected==='volumeM3'?'volume':selected==='quantity'?'decimal':'integer'
 return {id:'posvenda.dimension',title:store.dashboard?.analysis.table.title||'Análise por dimensão',type:analysisView.value,
  x:'label',y:[selected],format:measure?.format||format,rows:store.dashboard?.analysis.table.rows||[],
  labels:measure?{...labels,[selected]:measure.label}:labels,overviewStyle:true}
})
const hierarchyPlaceholder=computed(()=>(store.dashboard?.analysis.hierarchy||[store.dimension,'client','document','item']).map(key=>sharedDimensions.find(entry=>entry.id===key)?.legacy||({client:'CLIENTE',document:'DOCUMENTO',item:'ITEM'}[key]||key)).join(','))
const dimensionWidths=computed(()=>Object.fromEntries((store.dashboard?.analysis.table.columns||[]).map((column,index)=>[column.key,index===0?340:column.key==='share'?145:column.format?.startsWith('currency')?165:140])))
const chips=computed(()=>Object.entries(store.filters).filter(([,value])=>value).map(([key,value])=>({key,label:labels[key]||key,value:['start','end','forecastDate'].includes(key)?formatValue(value,'date'):value})))
watch(()=>store.dashboard?.referenceDate,date=>{if(date&&!calendarYear.value){calendarYear.value=Number(date.slice(0,4));calendarMonth.value=Number(date.slice(5,7))}})
watch(()=>store.filters.search,value=>{search.value=value||''})
watch(isOpen,open=>{
 calendarMetric.value='quantity'
 if(open&&analysisMetric.value==='orders')analysisMetric.value='value'
})
function shiftCalendar(offset:number){const date=new Date(calendarYear.value,calendarMonth.value-1+offset,1);calendarYear.value=date.getFullYear();calendarMonth.value=date.getMonth()+1}
function chooseDimension(id:string){analysisTab.value=id;hierarchyInput.value='';if(id!=='research')store.setDimension(id)}
function changeMetric(){store.setMetric(analysisMetric.value)}
function applyHierarchy(){const aliases=Object.fromEntries(sharedDimensions.map(entry=>[entry.legacy,entry.id]));store.setHierarchy(hierarchyInput.value.split(',').map(key=>key.trim()).filter(Boolean).map(key=>aliases[key]||({CLIENTE:'client',DOCUMENTO:'document',ITEM:'item'}[key]||key)).join(','))}
function selectForecast(date:string){analysisTab.value='research';store.apply({...store.filters,forecastDate:store.filters.forecastDate===date?'':date});void nextTick(()=>document.getElementById('aftersales-analysis')?.scrollIntoView({block:'start'}))}
watch(()=>({path:route.path,kind:route.query.kind}),({path,kind})=>{if(Object.keys(aftersalesTitles).includes(path.slice(1))){analysisTab.value='month';analysisView.value='table';analysisMetric.value='value';hierarchyInput.value='';calendarYear.value=0;const scoped=['Venda','Assistência'].includes(String(kind))?String(kind):path==='/cancelamentos'?'Venda':'';store.select(path.slice(1) as AftersalesArea,path==='/assistencias'&&['emitidas','faturadas'].includes(String(route.query.view))?String(route.query.view):'abertas',scoped)}},{immediate:true})
watch(()=>route.query.view,value=>{if(route.path==='/assistencias'){const view=['emitidas','faturadas'].includes(String(value))?String(value):'abertas';if(view!==store.view)store.setView(view)}})
onBeforeUnmount(()=>store.cancel())
</script>

<template>
 <div class="analytics-page aftersales-page">
  <LoadingState :active="store.loading" screen :label="`Carregando ${aftersalesTitles[store.area].toLowerCase()}…`"/>
  <div v-if="chips.length" class="filter-chips aftersales-active" aria-label="Filtros ativos"><span v-for="chip in chips" :key="chip.key" class="chip">{{chip.label}}: {{chip.value}}<button :aria-label="`Remover filtro ${chip.label}: ${chip.value}`" @click="store.apply({...store.filters,[chip.key]:''})">×</button></span><button class="clear-filters" @click="store.apply({})">Limpar filtros</button></div>
  <div v-if="store.error" class="error-box" role="alert"><strong>Não foi possível carregar a análise.</strong><p>{{store.error}}</p><button @click="store.load()">Tentar novamente</button></div>
  <div v-if="store.dashboard&&!store.error" class="open-overview aftersales-dashboard">
   <div class="overview-metrics aftersales-metrics" :class="{'aftersales-overview-metrics':hasMeasureControls}" :style="{'--card-count':metrics.length}" :aria-busy="store.loading"><MetricCard v-for="metric in metrics" :key="metric.id" :metric="metric" :show-unavailable="hasMeasureControls" :class="{'late-summary':hasMeasureControls && ['posvenda.aged','posvenda.orders30','posvenda.value30'].includes(metric.id)}"/></div>
   <p v-if="store.dashboard.quality.missingValues" class="aftersales-quality" role="status"><AppIcon name="help"/>{{store.dashboard.quality.missingValues}} registros sem valor suficiente para totalização. Consulte as quantidades.</p>
   <p v-if="store.dashboard.quality.missingLeadTime" class="aftersales-quality" role="status"><AppIcon name="help"/>{{formatValue(store.dashboard.quality.missingLeadTime,'integer')}} registros com datas ausentes ou inconsistentes ficaram fora dos indicadores de prazo.</p>
   <div class="aftersales-charts">
    <template v-for="(row,index) in chartRows" :key="index">
     <div class="overview-row" :class="{'overview-map-row':row.some(series=>series.type==='map')}" :data-section="'posvenda-row-'+index">
      <AnalyticChart v-for="series in row" :key="series.id" :series="series" :loading="store.loading" @drilldown="store.drillDown"><template #controls><div v-if="series.id==='posvenda.monthly'" class="forecast-controls aftersales-grain" role="group" aria-label="Granularidade da evolução"><button v-for="[key,label] in [['month','Meses'],['week','Semanas'],['day','Dias']]" :key="key" :class="{primary:store.granularity===key}" :aria-pressed="store.granularity===key" :disabled="store.loading" @click="store.setGranularity(key as 'month'|'week'|'day')">{{label}}</button></div></template></AnalyticChart>
     </div>
     <div v-if="index===0&&assistance" class="overview-row aftersales-forecast-row" data-section="posvenda-forecast">
      <ForecastCalendar :year="calendarYear" :month="calendarMonth" :series="calendarSeries" title="Cronograma de previsão das assistências" document-label="assistências" :measure-label="isOpen ? assistanceMeasures[calendarMetric].label : 'Quantidade pendente'" :inert="store.loading||undefined" @select="selectForecast"><template v-if="isOpen" #config><fieldset><legend>Tipo de análise</legend><label v-for="(measure,key) in assistanceMeasures" :key="key"><input v-model="calendarMetric" type="radio" name="assistance-calendar-measure" :value="key">{{measure.label}}</label></fieldset></template><template #controls><div class="forecast-controls"><button aria-label="Mês anterior das assistências" @click="shiftCalendar(-1)">‹</button><strong>{{calendarLabel}}</strong><button aria-label="Próximo mês das assistências" @click="shiftCalendar(1)">›</button></div></template></ForecastCalendar>
      <AnalyticChart v-if="forecastStatus" :series="forecastStatus" :loading="store.loading"/>
     </div>
    </template>
   </div>
   <p v-if="!store.dashboard.total" class="empty-state aftersales-empty" role="status">Nenhum registro encontrado para os filtros selecionados.</p>
   <AnalysisFrame id="aftersales-analysis" class="overview-dimensions" title="Análise por dimensão" icon="grid" :busy="store.analysisLoading||store.detailsLoading">
    <template #toolbar><nav class="analysis-tabs dimension-tabs" aria-label="Dimensões de pós-venda"><button v-for="option in store.dashboard.analysis.options" :key="option.id" :class="{selected:analysisTab===option.id}" :aria-pressed="analysisTab===option.id" @click="chooseDimension(option.id)"><AppIcon :name="dimensionIcons[option.id]||'grid'"/>{{option.label}}</button><button :class="{selected:analysisTab==='research'}" :aria-pressed="analysisTab==='research'" @click="chooseDimension('research')"><AppIcon name="search"/>Pesquisa de documentos</button></nav></template>
    <template #config>
     <template v-if="analysisTab!=='research'">
      <fieldset><legend>{{hasMeasureControls ? 'Tipo de análise' : 'Métrica'}}</legend><label v-for="[key,label] in dimensionMeasures" :key="key"><input v-model="analysisMetric" type="radio" name="aftersales-metric" :value="key" @change="changeMetric">{{label}}</label></fieldset>
      <fieldset><legend>Tipo de gráfico</legend><label v-for="[key,label] in [['table','Tabela'],['barHorizontal','Barras Horizontais'],['bar','Barras Verticais'],['pie','Pizza'],['donut','Donut'],['treemap','Treemap'],['line','Evolução Mensal']]" :key="key"><input v-model="analysisView" type="radio" name="aftersales-visualization" :value="key">{{label}}</label></fieldset>
      <label>Níveis da hierarquia<input v-model="hierarchyInput" :placeholder="hierarchyPlaceholder"></label><button @click="applyHierarchy">Aplicar hierarquia</button>
      <template v-if="analysisView==='table'&&analysisTable"><fieldset><legend>Colunas exibidas</legend><label v-for="column in analysisTable.availableColumns" :key="column.key"><input type="checkbox" :checked="analysisTable.selectedColumns.includes(column.key)" @change="analysisTable?.selectColumn(column.key)">{{column.label}}</label></fieldset><div class="config-actions"><button @click="analysisTable?.expandAll()"><AppIcon name="layers"/>Expandir/recolher hierarquia</button><button @click="analysisTable?.exportRows()"><AppIcon name="download"/>Exportar CSV</button></div></template>
      <template v-else-if="analysisChartRef"><label>Quantidade exibida<select v-model="displayLimit" aria-label="Quantidade exibida"><option value="all">Padrão</option><option value="10">Top 10</option><option value="10others">Top 10 + Outros</option><option value="20">Top 20</option><option value="20others">Top 20 + Outros</option></select></label><label>Ordenação<select v-model="displayOrder" aria-label="Ordenação"><option value="default">Padrão</option><option value="desc">Maior → Menor</option><option value="asc">Menor → Maior</option></select></label><div class="config-actions"><button @click="analysisChartRef?.exportSeries()"><AppIcon name="download"/>Exportar CSV</button><button @click="analysisChartRef?.saveImage()"><AppIcon name="download"/>Salvar imagem</button></div></template>
      <p>Quantidades e valores correspondem aos eventos de pós-venda. {{isReturn ? 'O prazo vai da emissão do documento de origem à emissão da devolução no ERP.' : isCancellation ? 'O prazo é contado da emissão do pedido original até o cancelamento.' : 'Idade é contada da emissão do documento à referência.'}} Medidas sem cadastro suficiente permanecem indisponíveis. Documentos e pedidos são contados sem duplicação no total.</p>
     </template>
     <template v-else><p>Use a pesquisa e os filtros para localizar os documentos. A tabela permite ordenar, selecionar colunas e exportar os registros.</p><div class="config-actions"><button :disabled="store.loading||store.detailsLoading" @click="store.exportCsv()"><AppIcon name="download"/>Exportar CSV</button></div></template>
    </template>
    <template v-if="analysisTab==='research'">
     <form class="order-search-form aftersales-search" @submit.prevent="store.apply({...store.filters,search})"><label>Pesquisar registros<input v-model="search" type="search" placeholder="Documento, cliente ou produto" maxlength="200"></label><button class="primary" type="submit" :disabled="store.loading||store.detailsLoading">Pesquisar</button></form>
     <div v-if="store.detailsError" class="error-box" role="alert">{{store.detailsError}}<button @click="store.loadDetails()">Tentar novamente</button></div>
     <div class="dimension-viewport"><AnalyticTable :table="store.dashboard.table" :loading="store.detailsLoading||store.loading" loading-label="Carregando documentos…" embedded fit server :total-rows="store.dashboard.total" :page="store.page" :page-size="store.pageSize" :initial-sort="store.sort" :initial-direction="store.direction" @page="store.setPage" @page-size="store.setSize" @sort="store.setSort" @export="store.exportCsv"/></div>
    </template>
    <template v-else>
     <div v-if="store.analysisError" class="error-box" role="alert">{{store.analysisError}}<button @click="store.loadAnalysis()">Tentar novamente</button></div>
     <div class="dimension-viewport"><AnalyticTable v-if="analysisView==='table'" ref="analysisTable" :table="store.dashboard.analysis.table" :loading="store.analysisLoading||store.loading" loading-label="Carregando análise por dimensão…" :pagination="false" :column-widths="dimensionWidths" embedded fit/><AnalyticChart v-else ref="analysisChartRef" :series="analysisChart" :loading="store.analysisLoading||store.loading" :display-limit="displayLimit" :display-order="displayOrder" embedded/></div>
    </template>
   </AnalysisFrame>
  </div>
  <AftersalesFilterDrawer/>
 </div>
</template>
<style scoped src="./posvenda.css"></style>
