<script setup lang="ts">
import {computed,ref,watch} from 'vue'
import {useStrategicStore} from '../../stores/strategic'
import type {Series} from '../../types/analytics'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import AppIcon from '../ui/AppIcon.vue'
import AnalyticTable from './AnalyticTable.vue'
import {AnalyticChart} from './asyncChart'
const store=useStrategicStore(),view=ref('table'),measure=ref('value'),monthlyTab=ref(true),table=ref<InstanceType<typeof AnalyticTable>>(),monthlyTable=ref<InstanceType<typeof AnalyticTable>>(),chart=ref<InstanceType<typeof AnalyticChart>>()
const analysis=computed(()=>store.dashboard!.analysis)
const crossDimension=computed(()=>['UF','CIDADE','TIPO_ENTREGA'].includes(store.dimension)?store.dimension:undefined)
const displayTable=computed(()=>({...analysis.value.table,dimension:crossDimension.value,columns:analysis.value.table.columns.map(column=>({...column,label:column.key==='difference'?'Variação anual':column.key==='tonnes'?'Peso (t)':column.key==='revenueKg'?'R$/KG':column.label}))}))
const defaultColumns=['label','value','difference','share','service','ticket','revenueTon','orders','quantity','tonnes','volume','groups','otif','conversion','outflow']
const widths=computed(()=>Object.fromEntries(analysis.value.table.columns.map((column,index)=>[column.key,index===0?260:column.key==='share'?145:column.format==='currency'?165:140])))
const monthlyWidths={label:140,value:165,share:115,difference:220,ticket:140,revenueTon:140,orders:120,quantity:125,tonnes:135,volume:145,groups:150,service:145,otif:115,revenueKg:140,conversion:140,outflow:140}
const series=computed<Series>(()=>({id:'strategic.dimensions.chart',title:analysis.value.table.title.toUpperCase(),type:view.value,x:'label',y:[measure.value],dimension:crossDimension.value,
 rows:analysis.value.table.rows,overviewStyle:true,format:analysis.value.measures[measure.value]?.format,
 labels:Object.fromEntries(Object.entries(analysis.value.measures).map(([key,value])=>[key,value.label])),
 metricOptions:Object.fromEntries(Object.keys(analysis.value.measures).map(key=>[key,key])),metricLabels:Object.fromEntries(Object.entries(analysis.value.measures).map(([key,value])=>[key,value.label])),
 metricFormats:Object.fromEntries(Object.entries(analysis.value.measures).map(([key,value])=>[key,value.format])),nonAdditiveMetrics:['revenueKg','revenueTon','ticket','orders','groups','ordersMonthly','groupsMonthly','service','otif','conversion','outflow'],color:'#006A3A'}))
watch(()=>analysis.value,()=>{if(!analysis.value.measures[measure.value])measure.value='value'})
watch([monthlyTab,()=>store.loading,()=>analysis.value.deferred],()=>{if(!monthlyTab.value&&!store.loading&&analysis.value.deferred&&!store.analysisLoading)void store.loadAnalysis()})
</script>
<template>
 <AnalysisFrame v-if="store.dashboard" id="strategic-dimensions" class="strategic-dimensions overview-dimensions" title="ANÁLISE POR DIMENSÃO" icon="grid" :busy="store.loading||store.analysisLoading">
  <template #toolbar><nav class="analysis-tabs dimension-tabs" aria-label="Dimensões estratégicas"><button :class="{selected:monthlyTab}" :aria-pressed="monthlyTab" @click="monthlyTab=true"><AppIcon name="calendar"/>Evolução mensal</button><button v-for="option in analysis.options" :key="option.id" :class="{selected:!monthlyTab&&store.dimension===option.id}" :aria-pressed="!monthlyTab&&store.dimension===option.id" :disabled="store.loading" @click="monthlyTab=false;store.setDimension(option.id)"><AppIcon :name="option.icon"/>{{option.label}}</button></nav></template>
  <template #config>
   <template v-if="monthlyTab&&monthlyTable"><fieldset><legend>Colunas exibidas</legend><label v-for="column in monthlyTable.availableColumns" :key="column.key"><input type="checkbox" :checked="monthlyTable.selectedColumns.includes(column.key)" @change="monthlyTable?.selectColumn(column.key)">{{column.label}}</label></fieldset><div class="config-actions"><button @click="monthlyTable?.exportRows()"><AppIcon name="download"/>Exportar CSV</button></div></template>
   <template v-else>
   <fieldset><legend>Tipo de análise</legend><label v-for="(option,key) in analysis.measures" :key="key"><input v-model="measure" type="radio" name="strategic-dimension-measure" :value="key">{{option.label}}</label></fieldset>
   <fieldset><legend>Visualização</legend><label v-for="[key,label] in [['table','Tabela'],['barHorizontal','Barra horizontal'],['bar','Barra vertical'],['pie','Pizza'],['donut','Donut'],['treemap','Treemap']]" :key="key"><input v-model="view" type="radio" name="strategic-dimension-view" :value="key">{{label}}</label></fieldset>
   <template v-if="view==='table'&&table"><fieldset><legend>Colunas exibidas</legend><label v-for="column in table.availableColumns" :key="column.key"><input type="checkbox" :checked="table.selectedColumns.includes(column.key)" @change="table?.selectColumn(column.key)">{{column.label}}</label></fieldset><div class="config-actions"><button @click="table?.exportRows()"><AppIcon name="download"/>Exportar CSV</button></div></template>
   <template v-else-if="chart"><div class="config-actions"><button @click="chart?.exportSeries()"><AppIcon name="download"/>Exportar CSV</button><button @click="chart?.saveImage()"><AppIcon name="download"/>Salvar imagem</button></div></template>
   </template>
  </template>
  <div class="dimension-viewport"><AnalyticTable v-if="monthlyTab" ref="monthlyTable" :table="store.dashboard.financial.monthlyTable" report :column-widths="monthlyWidths" :loading="store.loading" :page-size="15" initial-sort="label" initial-direction="asc" embedded fit/><div v-else-if="store.analysisError" role="alert" class="dimension-error error-box"><p>{{store.analysisError}}</p><button @click="store.loadAnalysis()">Tentar novamente</button></div><AnalyticTable v-else-if="view==='table'" ref="table" :table="displayTable" :selected-keys="defaultColumns" :pagination="false" :loading="store.loading||store.analysisLoading" embedded fit :column-widths="widths" :page-size="15" initial-sort="value" @drilldown="store.drillDown"/><AnalyticChart v-else ref="chart" :series="series" :loading="store.loading||store.analysisLoading" embedded @drilldown="store.drillDown"/></div>
 </AnalysisFrame>
</template>
<style scoped>
.strategic-dimensions :deep(.panel-heading){padding:0;min-height:40px}.strategic-dimensions :deep(.panel-heading h2){font-size:14px;color:#64748b;letter-spacing:.025em}
.dimension-tabs{display:flex;align-items:center;overflow-x:auto;flex-wrap:nowrap;background:#fff;border:1px solid #e2e8f0;border-radius:12px;max-width:100%;width:100%;padding:5px;gap:5px;box-shadow:0 2px 6px #203e2605}
.dimension-tabs button{display:flex;align-items:center;gap:8px;flex:none;font-size:12px;padding:9px 15px;border-radius:9px}.dimension-tabs button .app-icon{width:19px;height:19px}.dimension-tabs button.selected{background:#e2f2d9;color:#006a3a;box-shadow:inset 0 -3px #006a3a,0 0 0 1px #a4d675}
.dimension-viewport{min-width:0;max-width:100%;overflow:hidden}.dimension-viewport :deep(.chart-host){height:330px}.dimension-error{height:100%;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:8px}
</style>

<style>
/* AnalysisFrame forwards attributes onto a Teleport child; target its real section. */
.strategic-dimensions.overview-dimensions{margin-top:24px;background:transparent;border:0;border-top:1px solid #e5e7e6;border-radius:0;box-shadow:none;padding-top:20px;min-width:0}
</style>
