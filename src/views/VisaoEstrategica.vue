<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount} from 'vue'
import {useStrategicStore} from '../stores/strategic'
import MetricCard from '../components/analytics/MetricCard.vue'
import CohortPanel from '../components/analytics/CohortPanel.vue'
import StrategicDimensions from '../components/analytics/StrategicDimensions.vue'
import {AnalyticChart} from '../components/analytics/asyncChart'
import LoadingState from '../components/ui/LoadingState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import StrategicFilterDrawer from '../components/filters/StrategicFilterDrawer.vue'
import {formatValue} from '../composables/useFormatters'
import type {Series} from '../types/analytics'

const store=useStrategicStore()
const labels:Record<string,string>={UF:'UF',CIDADE:'Cidade',TIPO_ENTREGA:'Entrega / retirada'}
const activeFilters=computed(()=>[
 ...Object.entries(store.filters.dimensions||{}).filter(([,values])=>values.length).map(([key,values])=>({key,label:labels[key]+': '+values.join(', ')})),

])
function removeFilter(key:string){const filters=JSON.parse(JSON.stringify(store.filters));if(key==='billingRange'||key==='emissionRange')delete filters[key];else delete filters.dimensions?.[key];store.applyFilters(filters)}
const cardOrder=[
 ['value','Valor'],['monthlyTonnage','Peso'],['monthlyVolume','Volume'],
 ['monthlyQuantity','Qtd itens'],['monthlyOrders','Qtd pedidos'],['monthlyGroups','Grupos atendidos'],
 ['serviceDays','Nível de serviço'],
 ['ticket','Ticket médio'],['revenueTon','R$/TON'],['otif','OTIF'],
 ['sameMonthConversion','Conversão'],['outflow','Escoamento'],
] as const
const placeholders=cardOrder.map(([,label])=>label)
const orderedMetrics=computed(()=>{
 const positions=new Map<string,number>(cardOrder.map(([id],index)=>['strategic.'+id,index]))
 return [...(store.dashboard?.metrics||[])].filter(metric=>positions.has(metric.id)).sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity))
})
// Annual comparisons lead the chart area; the remaining evolutions follow their cards.
const orderedAnalyses=computed(()=>{
 const series=store.dashboard?.series||[]
 const related:Record<string,string>={monthlyTonnage:'tonnage',monthlyQuantity:'quantity',monthlyOrders:'orders',monthlyGroups:'groups',serviceDays:'service',ticket:'ticket',otif:'otif',sameMonthConversion:'cohort',outflow:'outflow',revenueTon:'revenueTon'}
 const annual=series.filter(item=>item.id.startsWith('strategic.annual'))
 const used=new Set<string>(annual.map(item=>item.id)),result:Series[]=[]
 for(const [card] of cardOrder){
  const id=related[card];if(!id)continue
  if(id==='cohort'){result.push({id:'cohort.evolution',title:'',type:'line',rows:[]});continue}
  const chart=series.find(item=>item.id==='strategic.'+id)
  if(chart){result.push(id==='tonnage'&&store.granularity==='month'?{...chart,type:'line'}:chart);used.add(chart.id)}
 }
 return [...annual,...result,...series.filter(item=>!used.has(item.id)&&item.id!=='strategic.delivery')]
})
const deliverySeries=computed(()=>store.dashboard?.series.find(item=>item.id==='strategic.delivery'))
const comparison=computed(()=>store.dashboard?.financial.comparison)
onMounted(()=>void store.load())
onBeforeUnmount(()=>store.cancel())
</script>
<template>
 <div class="analytics-page strategic-dashboard" :aria-busy="store.loading">
  <LoadingState :active="store.loading" screen label="Carregando visão estratégica…"/>
  <div v-if="store.error" role="alert" class="error-state strategic-error"><span>{{store.error}}</span><button @click="store.load()">Tentar novamente</button></div>
  <div class="strategic-metrics overview-metrics">
   <template v-if="store.dashboard"><MetricCard v-for="metric in orderedMetrics" :key="metric.id" :metric="metric" show-unavailable/></template>
   <article v-else v-for="(label,index) in placeholders" :key="index" class="metric-card strategic-placeholder"><span class="metric-label">{{label}}</span><strong>—</strong></article>
  </div>

  <div v-if="activeFilters.length" class="strategic-active-filters" aria-label="Filtros aplicados"><button v-for="filter in activeFilters" :key="filter.key" @click="removeFilter(filter.key)" :aria-label="'Remover filtro '+filter.label">{{filter.label}} <AppIcon name="close"/></button><button @click="store.reset()">Limpar todos</button></div>
  <div v-if="store.dashboard" class="strategic-charts">
   <div v-for="series in orderedAnalyses" :key="series.id" class="strategic-chart-slot" :class="series.id.split('.').at(-1)">
    <CohortPanel v-if="series.id==='cohort.evolution'" :data="store.dashboard.cohorts" :loading="store.loading"/>
    <template v-else>
    <p v-if="(series.id==='strategic.annualCumulative'&&comparison?.revenueChange!=null)||(series.id==='strategic.annualRevenueTon'&&comparison?.revenueTonChange!=null)" class="strategic-comparison-context"><span v-if="series.id==='strategic.annualCumulative'" class="strategic-change" :class="{negative:comparison!.revenueChange!<0}">Variação acumulada: {{formatValue(comparison!.revenueChange,'percent')}} · {{formatValue(comparison!.revenueDifference,'currency')}}</span><span v-else class="strategic-change" :class="{negative:comparison!.revenueTonChange!<0}">Variação acumulada: {{formatValue(comparison!.revenueTonChange,'percent')}}</span></p>
    <AnalyticChart :series="series" :loading="store.loading" @drilldown="store.drillDown">
     <template v-if="series.id==='strategic.tonnage'" #config><fieldset><legend>Tipo de análise</legend><label v-for="[grain,label] in [['month','Meses'],['week','Semanas'],['day','Dias']]" :key="grain"><input type="radio" name="tonnage-granularity" :value="grain" :checked="store.granularity===grain" :disabled="store.loading" @change="store.setGranularity(grain as 'month'|'week'|'day')">{{label}}</label></fieldset></template>
    </AnalyticChart>
    </template>
   </div>
   <div v-if="deliverySeries" class="strategic-delivery-map">
    <div class="strategic-chart-slot delivery"><AnalyticChart :series="deliverySeries" :loading="store.loading" @drilldown="store.drillDown"/></div>
    <div class="strategic-chart-slot geography"><AnalyticChart :series="store.dashboard.financial.geography" :loading="store.loading" @drilldown="store.drillDown"/></div>
   </div>
  </div>
  <StrategicDimensions v-if="store.dashboard"/>
  <StrategicFilterDrawer/>
 </div>
</template>
<style scoped>
.strategic-dashboard{container:strategic/inline-size;display:block;padding:12px 18px 24px;min-width:0;background:transparent}
.strategic-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}
.strategic-context{display:flex;justify-content:space-between;align-items:center;gap:12px;color:#6d8173;font-size:11px;margin:12px 0 7px;flex-wrap:wrap}
.strategic-context>span{display:flex;gap:8px;align-items:center}.strategic-context .app-icon{width:14px;height:14px}.strategic-context small{font-size:10px;background:#eaf2e6;border-radius:4px;padding:3px 6px}
.strategic-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 26px;margin-top:20px}
.strategic-delivery-map{grid-column:1/-1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr);gap:26px;min-width:0}
.strategic-chart-slot{position:relative;min-width:0;border-top:1px solid #E5E7E6;padding-top:18px}
.strategic-chart-slot.annualMonthly,.strategic-chart-slot.annualCumulative,.strategic-chart-slot.annualRevenueTon{grid-column:1/-1}
.strategic-chart-slot :deep(.analytic-chart){--analysis-height:270px;background:transparent;box-shadow:none;border:0;border-radius:0;padding:0}
.strategic-chart-slot.delivery :deep(.analytic-chart),.strategic-chart-slot.geography :deep(.analytic-chart){--analysis-height:440px}
.strategic-chart-slot :deep(.panel-heading){padding:0 0 0 4px;min-height:40px;gap:8px}.strategic-chart-slot :deep(.panel-heading h2){letter-spacing:.05em;color:#526b5d;text-transform:uppercase}.strategic-chart-slot :deep(.panel-heading .app-icon){width:17px;height:17px}
.strategic-chart-slot :deep(.analysis-body){padding:0;min-width:0}.strategic-chart-slot :deep(.loading-overlay){background:#f4f6f4}
.strategic-active-filters{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.strategic-active-filters button{display:flex;align-items:center;gap:6px;border:1px solid #d9e5d3;background:#eaf2e6;font-size:11px;padding:5px 8px;border-radius:6px;max-width:100%;text-align:left}.strategic-active-filters .app-icon{width:12px;height:12px;flex:none}
.strategic-error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.strategic-placeholder strong{margin-top:12px}
@container strategic (min-width:1200px){
 .strategic-metrics{display:flex;flex-wrap:wrap}
 .strategic-metrics>*{flex:1 1 calc((100% - 65px)/6);min-width:0}
 .strategic-metrics>:nth-child(n+7){flex-basis:calc((100% - 78px)/7)}
 .strategic-metrics :deep(.metric-card[data-format]>strong){font-size:18px}
}
@container strategic (min-width:1400px){.strategic-metrics :deep(.metric-card[data-format]>strong){font-size:23px}}
@container(max-width:1100px){.strategic-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
@container(max-width:700px){.strategic-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.strategic-charts,.strategic-delivery-map{grid-template-columns:minmax(0,1fr)}.strategic-context{font-size:10px}.strategic-source{display:none!important}}
@media(max-width:767px){.strategic-dashboard{padding:10px 10px 20px}.strategic-charts{gap:16px}}
@media(max-width:767px){.strategic-metrics>[data-metric-id="strategic.backlogReal"]{grid-column:span 2}.strategic-metrics>[data-metric-id="strategic.revenueTon"]{grid-column:auto}}
.strategic-comparison-context{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:10px;color:#6d8173;margin:0 0 6px}.strategic-change{margin-left:auto;background:#e8f3de;color:#006a3a;border-radius:6px;padding:5px 8px;font-weight:600}.strategic-change.negative{color:#a33c31;background:#fff0ed}
.strategic-chart-slot :deep(.cohort-panel){border:0;margin:0;padding:0}

</style>
