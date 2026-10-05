<script setup lang="ts">
import {computed,ref,watch,onBeforeUnmount} from 'vue'
import type {DashboardPayload,Series} from '../../types/analytics'
import {dimensionLabels} from '../../types/analytics'
import {useAnalyticsStore} from '../../stores/analytics'
import {request} from '../../api/client'
import {formatValue,compactAxisValue} from '../../composables/useFormatters'
import MetricCard from '../analytics/MetricCard.vue'
import AnalyticTable from '../analytics/AnalyticTable.vue'
import ForecastCalendar from './ForecastCalendar.vue'
import OpenOrders from './OpenOrders.vue'
import LoadingState from '../ui/LoadingState.vue'
import AppIcon from '../ui/AppIcon.vue'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import {AnalyticChart} from '../analytics/asyncChart'
const props=defineProps<{payload:DashboardPayload;year:number;month:number}>()
const emit=defineEmits<{select:[date:string];shift:[amount:number];backlog:[type:string]}>()
const store=useAnalyticsStore(),selectedDimension=computed({get:()=>store.openDimension,set:value=>{store.openDimension=value}}),visualization=ref('table'),selectedMetric=ref('value'),hierarchy=ref('')
const tableRef=ref<InstanceType<typeof AnalyticTable>>(),chartRef=ref<InstanceType<typeof AnalyticChart>>(),researchDate=ref(''),displayLimit=ref('all'),displayOrder=ref('default')
const dimensionIcons:Record<string,string>={Mes_Grupo:'line',Mes_Previsao:'calendar',UF:'map',REGIAO_UF:'pin',TIPO_ENTREGA:'truck',STATUS:'status',SUPERVISOR:'users',CONSULTOR:'user',GRUPO_CLIENTE:'users',GRUPO_ITEM:'box',SUBGRUPO:'grid',LINHA:'layers',TIPO:'arrow',COLECAO:'tag',DESCRICAO_ITEM:'box',CLASSIFICACAO:'star',ORIGEM:'arrow',ORGAO:'building',Aging_Bucket:'clock',CIDADE:'building',MICRO_REGIAO:'pin',pesquisa:'search'}
const dimensionPayload=ref<DashboardPayload>(),dimensionError=ref(''),dimensionLoading=ref(false)
let sequence=0,abort:AbortController|undefined
const metric=(id:string)=>props.payload.metrics.find(m=>m.id==='abertos.resumo.'+id)!
const series=(id:string)=>props.payload.series.find(s=>s.id==='abertos.resumo.'+id)!
const firstMetrics=computed(()=>props.payload.metrics.slice(0,5))
const secondMetrics=computed(()=>['groups','serviceDays','orders60','value60'].map(metric))
const deliveries=computed(()=>props.payload.metrics.filter(m=>m.id.includes('.entrega.')))
const currentMonth=computed(()=>new Date(props.year,props.month-1,1).toLocaleDateString('pt-BR',{month:'short',year:'numeric'}))
const dimensionItems=[['Mes_Grupo','Resumo Mensal'],['Mes_Previsao','Previsão de Faturamento'],['UF','UF'],['REGIAO_UF','Região da UF'],['TIPO_ENTREGA','Tipo de Entrega'],['STATUS','Status do Pedido'],['SUPERVISOR','Supervisor'],['CONSULTOR','Consultor'],['GRUPO_CLIENTE','Grupo de Cliente'],['GRUPO_ITEM','Grupo do Item'],['SUBGRUPO','Subgrupo'],['LINHA','Linha'],['TIPO','Tipo'],['COLECAO','Coleção'],['DESCRICAO_ITEM','Produto'],['CLASSIFICACAO','Classificação'],['ORIGEM','Origem'],['ORGAO','Órgão'],['Aging_Bucket','Faixa de Tempo'],['CIDADE','Cidade'],['MICRO_REGIAO','Microregião'],['pesquisa','Pesquisa de Pedidos']]
const displayTables=computed(()=>(dimensionPayload.value?.tables || [{id:'abertos-dimensoes',placeholder:true,title:'Análise por dimensão',rows:[],columns:[{key:selectedDimension.value,label:dimensionLabels[selectedDimension.value] || selectedDimension.value},{key:'Valor',label:'Valor',format:'currency'}]}]).map(table=>({...table,title:dimensionItems.find(([key])=>key===selectedDimension.value)?.[1] || table.title,columns:table.columns.map(column=>column.key==='NS'?{...column,format:'serviceDecimal'}:column.key===selectedDimension.value?{...column,label:selectedDimension.value==='Mes_Grupo'?'Mês':dimensionItems.find(([key])=>key===selectedDimension.value)?.[1] || column.label}:column)})))
const dimensionWidths=computed(()=>Object.fromEntries((displayTables.value[0]?.columns||[]).map((column,index)=>[column.key,index===0?260:column.key==='% Part'?145:column.format==='currency'?165:140])))
const dimensionSeries=computed(()=>{if(!dimensionPayload.value)return undefined;const selected=dimensionPayload.value.series[visualization.value==='line'?1:0];if(!selected)return undefined;return {...selected,type:visualization.value==='donut'?'donut':selected.type,title:dimensionItems.find(([key])=>key===selectedDimension.value)?.[1] || selected.title,availableRows:visualization.value==='line'?selected.rows:dimensionPayload.value.tables[0]?.rows,overviewStyle:true}})
function selectForecastDay(date:string){researchDate.value=date;selectedDimension.value='pesquisa'}
const topBacklog=computed(()=>String(metric('backlogReal').subtitle || '').includes('🔴')?'critical':'warning')
function chart(id:string,title?:string):Series{
 const value=series(id),colorMap=id==='aging'?{'0-15 dias':'#8BC53F','16-30 dias':'#4E9D2D','31-45 dias':'#D97706','46-60 dias':'#C62828','> 60 dias':'#C69214'}:id==='Status_Previsao'?{'Mês Vigente':'#006A3A','Meses Futuros':'#8BC53F','Previsão Vencida':'#C62828','Sem Previsão':'#94A3B8'}:id==='TIPO_ENTREGA'?{'Sim (Entrega)':'#8BC53F','Não (Retira)':'#4E9D2D'}:undefined
 const total=id==='TIPO_ENTREGA'?metric('weightKg').value:metric('value').value
 const centerTexts=Object.fromEntries(['value','weightKg','volumeM3','quantity','orders'].map(key=>[key,'Total\n'+compactAxisValue(metric(key).value,key==='value'?'currency':key==='weightKg'?(id==='TIPO_ENTREGA'?'kg':'weight'):key==='volumeM3'?'volume':'integer')]))
 return {...value,title:title || value.title,icon:id==='aging'?'clock':id==='Status_Previsao'?'calendar':id==='TIPO_ENTREGA'?'truck':id==='STATUS'?'status':id==='UF'?'map':'line',metricOptions:value.metricOptions || {value:'Valor',weightKg:'Peso',volumeM3:'Volume_M3',quantity:'Qtde',orders:'Qtd_Pedidos'},metricButtons:id==='TIPO_ENTREGA',colorMap,compactDonut:value.type==='pie',centerText:(id==='Status_Previsao'?'Total Previsto':'Total')+'\n'+compactAxisValue(total,id==='TIPO_ENTREGA'?'kg':'currency'),centerTexts,overviewStyle:true}
}
async function loadDimension(){
 if(selectedDimension.value==='pesquisa'){sequence++;abort?.abort();dimensionLoading.value=false;dimensionError.value='';return}
const current=++sequence;abort?.abort();abort=new AbortController();dimensionLoading.value=true;dimensionError.value=''
 try{
  const query=store.query({referenceDate:props.payload.referenceDate,dimension:selectedDimension.value,metric:selectedMetric.value,chartType:visualization.value==='donut'?'pie':visualization.value,hierarchy:hierarchy.value})
  const result=await request<DashboardPayload>('/bi/abertos/dimensoes?'+query,{signal:abort.signal})
  if(current!==sequence)return
  if(result.dataVersion!==props.payload.dataVersion){dimensionError.value='A publicação mudou. Atualize os dados antes de continuar.';return}
  dimensionPayload.value=result
 }catch(error){if(current===sequence&&!(error instanceof DOMException&&error.name==='AbortError'))dimensionError.value=error instanceof Error?error.message:'Não foi possível carregar a dimensão.'}
 finally{if(current===sequence)dimensionLoading.value=false}
}
watch([()=>props.payload,selectedDimension,visualization,selectedMetric],()=>{void loadDimension()},{immediate:true})
onBeforeUnmount(()=>{sequence++;abort?.abort()})
</script>
<template>
<div class="open-overview">
 <div class="overview-metrics">
  <MetricCard v-for="m in firstMetrics" :key="m.id" :metric="m"/>
  <MetricCard :metric="secondMetrics[0]!"/>
  <MetricCard class="service-summary" :metric="secondMetrics[1]!"/>
  <div class="backlog-combined" :class="topBacklog"><AppIcon class="metric-watermark" name="hourglass"/><div class="metric-label"><span class="metric-label-title">Backlog</span><span class="metric-tip"><button type="button" aria-label="Sobre Backlog" aria-describedby="backlog-overview-tip"><AppIcon name="help"/></button><span id="backlog-overview-tip" role="tooltip" class="metric-tip-text">Dias de cobertura: backlog real à esquerda e geral à direita. Ambos dividem sua carteira pela média diária de faturamento dos últimos 90 dias.</span></span></div><div class="backlog-values"><MetricCard :metric="metric('backlogReal')"/><span :title="formatValue(metric('backlogReal').value,'days')">{{formatValue(metric('backlogReal').value,'days').replace(' dias','')}}</span><span aria-hidden="true">|</span><MetricCard :metric="metric('backlogGeneral')"/><span :title="formatValue(metric('backlogGeneral').value,'days')">{{formatValue(metric('backlogGeneral').value,'days').replace(' dias','')}}</span></div><p class="backlog-status">{{metric('backlogReal').subtitle}}</p><p>Backlog real: {{formatValue((payload.meta.backlog as any)?.realValue,'currency')}}</p></div>
  <MetricCard class="late-summary" :metric="secondMetrics[2]!"/>
  <MetricCard class="late-summary" :metric="secondMetrics[3]!"/>
 </div>
 <div class="overview-row" data-section="evolution">
  <AnalyticChart :series="chart('Mes_Grupo','Evolução mensal do backlog')" @drilldown="store.drillDown"/>
  <AnalyticChart :series="chart('aging','Distribuição por faixa de atraso')" @drilldown="store.drillDown"/>
 </div>
 <div class="overview-row" data-section="forecast">
  <ForecastCalendar title="Cronograma de previsão de faturamento" :year="year" :month="month" :series="series('calendario')" @select="selectForecastDay"><template #controls><div class="forecast-controls"><button aria-label="Mês anterior no resumo" @click="emit('shift',-1)">‹</button><strong data-testid="calendar-month">{{currentMonth}}</strong><button aria-label="Próximo mês no resumo" @click="emit('shift',1)">›</button><button :class="{primary:store.backlogType==='real'}" :aria-pressed="store.backlogType==='real'" @click="emit('backlog','real')">Backlog Real</button><button :class="{primary:store.backlogType==='geral'}" :aria-pressed="store.backlogType==='geral'" @click="emit('backlog','geral')">Backlog Geral</button></div></template></ForecastCalendar>
  <AnalyticChart :series="chart('Status_Previsao','Status da previsão de faturamento')" @drilldown="store.drillDown"/>
 </div>
 <div class="overview-row" data-section="delivery"><AnalyticChart :series="{...series('entregaMensal'),overviewStyle:true,icon:'truck',metricOptions:{value:'Valor',weightKg:'Peso',volumeM3:'Volume_M3',quantity:'Qtde',orders:'Qtd_Pedidos'}}" @drilldown="store.drillDown"/><AnalyticChart :series="chart('TIPO_ENTREGA','Tipo de entrega')" @drilldown="store.drillDown"/></div>
 <div class="overview-deliveries" data-section="delivery-metrics"><MetricCard v-for="m in deliveries" :key="m.id" :metric="m"/></div>
 <div class="overview-row overview-map-row" data-section="geography"><AnalyticChart :series="chart('UF')" @drilldown="store.drillDown"/><AnalyticChart :series="chart('STATUS','Resumo por status do pedido')" @drilldown="store.drillDown"/></div>
 <AnalysisFrame class="overview-dimensions" title="Análise por dimensão" icon="grid">
  <template #toolbar><nav class="analysis-tabs dimension-tabs" aria-label="Dimensões de pedidos em aberto"><button v-for="[key,label] in dimensionItems" :key="key" :class="{selected:selectedDimension===key}" :aria-pressed="selectedDimension===key" @click="selectedDimension=key!"><AppIcon :name="dimensionIcons[key!]"/>{{label}}</button></nav></template>
  <template #config><template v-if="selectedDimension!=='pesquisa'"><fieldset><legend>Tipo de gráfico</legend><label v-for="[key,label] in [['table','Tabela'],['barHorizontal','Barras Horizontais'],['bar','Barras Verticais'],['pie','Pizza'],['donut','Donut'],['treemap','Treemap'],['line','Evolução Mensal']]" :key="key"><input v-model="visualization" type="radio" name="overview-visualization" :value="key">{{label}}</label></fieldset><fieldset><legend>Métrica</legend><label v-for="[key,label] in [['value','Valor (R$)'],['weightKg','Peso (Ton)'],['volumeM3','Volume (m³)'],['quantity','Qtd Itens'],['orders','Qtd Pedidos']]" :key="key"><input v-model="selectedMetric" type="radio" name="overview-metric" :value="key">{{label}}</label></fieldset><label>Níveis da hierarquia<input v-model="hierarchy" :placeholder="selectedDimension+',CONSULTOR,GRUPO_CLIENTE'"></label><button @click="loadDimension">Aplicar hierarquia</button><template v-if="visualization==='table' && tableRef"><fieldset><legend>Colunas exibidas</legend><label v-for="column in tableRef.availableColumns" :key="column.key"><input type="checkbox" :checked="tableRef.selectedColumns.includes(column.key)" @change="tableRef.selectColumn(column.key)">{{column.label}}</label></fieldset><div class="config-actions"><button @click="tableRef.expandAll()"><AppIcon name="layers"/>Expandir/recolher hierarquia</button><button @click="tableRef.exportRows()"><AppIcon name="download"/>Exportar CSV</button></div></template><template v-else-if="chartRef"><label>Quantidade exibida<select aria-label="Quantidade exibida" v-model="displayLimit"><option value="all">Padrão</option><option value="10">Top 10</option><option value="10others">Top 10 + Outros</option><option value="20">Top 20</option><option value="20others">Top 20 + Outros</option></select></label><label>Ordenação<select aria-label="Ordenação" v-model="displayOrder"><option value="default">Padrão</option><option value="desc">Maior → Menor</option><option value="asc">Menor → Maior</option></select></label><div class="config-actions"><button @click="chartRef.exportSeries()"><AppIcon name="download"/>Exportar CSV</button><button @click="chartRef.saveImage()"><AppIcon name="download"/>Salvar imagem</button></div></template></template><p v-else class="muted">Os filtros e as configurações da pesquisa estão na análise de pedidos abaixo.</p></template>
  <OpenOrders v-if="selectedDimension==='pesquisa'" :payload="payload" :forecast-date="researchDate" @clear-date="researchDate=''"/>
  <div v-else class="dimension-viewport"><p v-if="dimensionError" role="alert" class="error-box">{{dimensionError}}</p><AnalyticTable v-if="visualization==='table' && displayTables[0]" ref="tableRef" embedded :table="displayTables[0]" :loading="dimensionLoading || store.loading" :loading-label="`Carregando ${dimensionLabels[selectedDimension] || selectedDimension}…`" :pagination="false" fit :column-widths="dimensionWidths" @drilldown="store.drillDown"/><AnalyticChart v-else-if="dimensionSeries" ref="chartRef" embedded :series="dimensionSeries" :loading="dimensionLoading" :display-limit="displayLimit" :display-order="displayOrder" @drilldown="store.drillDown"/><LoadingState v-else-if="dimensionLoading" :label="`Carregando ${dimensionLabels[selectedDimension] || selectedDimension}…`"/></div>
 </AnalysisFrame>
</div>
</template>
