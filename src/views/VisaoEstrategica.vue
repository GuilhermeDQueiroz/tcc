<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount} from 'vue'
import {useRouter} from 'vue-router'
import {useStrategicStore} from '../stores/strategic'
import {useLogisticsStore} from '../stores/logistics'
import MetricCard from '../components/analytics/MetricCard.vue'
import {AnalyticChart} from '../components/analytics/asyncChart'
import LoadingState from '../components/ui/LoadingState.vue'
import AppIcon from '../components/ui/AppIcon.vue'
import StrategicFilterDrawer from '../components/filters/StrategicFilterDrawer.vue'
import {formatValue} from '../composables/useFormatters'
import {strategicFormationFilters,type StrategicPriority} from '../domain/logistics/strategic'

const store=useStrategicStore(),logistics=useLogisticsStore(),router=useRouter()
const period=computed(()=>store.dashboard?.meta.history)
const priorityActions:Record<string,StrategicPriority>={valueFree:'free',freeOrders:'free',overdueOrders:'overdue',undatedOrders:'undated'}
function openFormation(priority:StrategicPriority='all'){
 const {company,status,search,...extra}=strategicFormationFilters(store.filters,priority)
 logistics.company=company;logistics.status=status;logistics.search=search;logistics.extraFilters=extra
 void router.push('/cargas')
}
const labels:Record<string,string>={UF:'UF',CIDADE:'Cidade',TIPO_ENTREGA:'Entrega / retirada'}
const activeFilters=computed(()=>[
 ...Object.entries(store.filters.dimensions||{}).filter(([,values])=>values.length).map(([key,values])=>({key,label:labels[key]+': '+values.join(', ')})),
 ...(['billingRange','emissionRange'] as const).filter(key=>store.filters[key]).map(key=>({key,label:(key==='billingRange'?'Faturamento':'Emissão')+': '+store.filters[key]!.map(date=>formatValue(date,'date')).join(' – ')})),
])
function removeFilter(key:string){const filters=JSON.parse(JSON.stringify(store.filters));if(key==='billingRange'||key==='emissionRange')delete filters[key];else delete filters.dimensions?.[key];store.applyFilters(filters)}
const placeholders=['Cargas em aberto','Valor em carga','Peso em aberto','Backlog','Pedidos > 30 dias','Nível de serviço','OTIF']
onMounted(()=>void store.load())
onBeforeUnmount(()=>store.cancel())
</script>
<template>
 <div class="analytics-page strategic-dashboard" :aria-busy="store.loading">
  <LoadingState :active="store.loading" screen label="Carregando visão estratégica…"/>
  <div v-if="store.error" role="alert" class="error-state strategic-error"><span>{{store.error}}</span><button @click="store.load()">Tentar novamente</button></div>
  <div class="strategic-metrics">
   <template v-if="store.dashboard"><MetricCard v-for="metric in store.dashboard.metrics" :key="metric.id" :metric="metric" compact/></template>
   <article v-else v-for="(label,index) in placeholders" :key="index" class="metric-card strategic-placeholder"><span class="metric-label">{{label}}</span><strong>—</strong></article>
  </div>
  <div class="strategic-context"><span><AppIcon name="calendar"/><template v-if="period">{{formatValue(period.start,'date')}} – {{formatValue(period.end,'date')}}<small v-if="period.partialMonth">Mês parcial</small></template><template v-else>Últimos 12 meses</template></span><span class="strategic-source" v-if="store.dashboard">Carteira · {{formatValue(store.dashboard.referenceDate,'date')}}</span></div>
  <div v-if="activeFilters.length" class="strategic-active-filters" aria-label="Filtros aplicados"><button v-for="filter in activeFilters" :key="filter.key" @click="removeFilter(filter.key)" :aria-label="'Remover filtro '+filter.label">{{filter.label}} <AppIcon name="close"/></button><button @click="store.reset()">Limpar todos</button></div>
  <div v-if="store.dashboard" class="strategic-charts">
   <div v-for="series in store.dashboard.series" :key="series.id" class="strategic-chart-slot" :class="series.id.split('.').at(-1)">
    <div v-if="series.id==='strategic.tonnage'" class="strategic-grain" role="group" aria-label="Detalhamento de toneladas"><button v-for="[grain,label] in [['month','Meses'],['week','Semanas'],['day','Dias']]" :key="grain" :aria-pressed="store.granularity===grain" :class="{selected:store.granularity===grain}" @click="store.setGranularity(grain as 'month'|'week'|'day')">{{label}}</button></div>
    <AnalyticChart :series="series" :loading="store.loading"/>
   </div>
  </div>
  <section v-if="store.dashboard" class="strategic-priorities" aria-labelledby="strategic-priorities-title">
   <header><div><h2 id="strategic-priorities-title"><AppIcon name="truck"/>Prioridades da carteira</h2><p>Saldo atual · {{formatValue(store.dashboard.referenceDate,'date')}}</p></div><button class="strategic-detail-button" @click="openFormation()">Consultar pedidos e cargas <AppIcon name="arrow"/></button></header>
   <div class="strategic-priority-grid">
    <div v-for="metric in store.dashboard.operationalMetrics" :key="metric.id" class="strategic-priority">
     <MetricCard :metric="metric" compact/>
     <button @click="openFormation(priorityActions[metric.id.split('.').at(-1)!])" :aria-label="'Analisar '+metric.label">Analisar pedidos <AppIcon name="arrow"/></button>
    </div>
   </div>
  </section>
  <div v-if="store.dashboard" class="strategic-definitions" aria-label="Definição dos indicadores">
   <p><strong>OTIF · faturamento no prazo.</strong> Percentual por registro faturado, segundo a previsão de faturamento. Não comprova entrega ao cliente nem atendimento integral. Sem previsão é contado como fora do prazo na regra atual.</p>
   <p><strong>Previsão informada:</strong> {{store.dashboard.meta.history.forecastCoverage==null?'indisponível':formatValue(store.dashboard.meta.history.forecastCoverage,'percent')}} dos registros do histórico. <strong>Nível de serviço (Lead Time):</strong> tempo médio entre emissão e faturamento. <strong>R$/kg:</strong> valor faturado por massa dos produtos.</p>
  </div>
  <StrategicFilterDrawer/>
 </div>
</template>
<style scoped>
.strategic-dashboard{container-type:inline-size;display:block;padding:12px 18px 24px;min-width:0;background:transparent}
.strategic-metrics{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px}
.strategic-metrics :deep(.metric-card){min-height:118px;padding:16px 14px;border-radius:14px;min-width:0}
.strategic-metrics :deep(.metric-label){font-size:11px;letter-spacing:.025em;min-height:30px;align-items:flex-start}
.strategic-metrics :deep(.metric-card>strong){margin:8px 0 0;font-size:min(25px,calc(100cqi * 1.65 / var(--metric-characters,16)));white-space:nowrap}
.strategic-metrics :deep(.metric-watermark){width:50px;height:50px;right:8px;bottom:7px}
.strategic-metrics :deep([data-metric-id="strategic.orders30"]){border-left-color:#e3a744}
.strategic-context{display:flex;justify-content:space-between;align-items:center;gap:12px;color:#6d8173;font-size:11px;margin:12px 0 7px;flex-wrap:wrap}
.strategic-context>span{display:flex;gap:8px;align-items:center}.strategic-context .app-icon{width:14px;height:14px}.strategic-context small{font-size:10px;background:#eaf2e6;border-radius:4px;padding:3px 6px}
.strategic-charts{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:16px 20px}
.strategic-chart-slot{position:relative;min-width:0;border-top:1px solid #dfe7df;padding-top:8px}
.strategic-chart-slot.service{grid-column:1 / span 5;grid-row:1}.strategic-chart-slot.revenueKg{grid-column:6 / span 4;grid-row:1}.strategic-chart-slot.delivery{grid-column:10 / span 3;grid-row:1}
.strategic-chart-slot.tonnage{grid-column:1 / span 7;grid-row:2}.strategic-chart-slot.otif{grid-column:8 / span 5;grid-row:2}
.strategic-chart-slot :deep(.analytic-chart){--analysis-height:245px;background:transparent;box-shadow:none;border:0;border-radius:0;padding:0}
.strategic-chart-slot :deep(.panel-heading){padding:0 0 0 4px;min-height:40px;gap:8px}.strategic-chart-slot :deep(.panel-heading h2){font-size:12px;letter-spacing:.025em;color:#526b5d}.strategic-chart-slot :deep(.panel-heading .app-icon){width:17px;height:17px}
.strategic-chart-slot :deep(.analysis-body){padding:0;min-width:0}.strategic-chart-slot :deep(.loading-overlay){background:#f4f6f4}
.strategic-chart-slot.tonnage :deep(.analytic-chart),.strategic-chart-slot.otif :deep(.analytic-chart){--analysis-height:270px}
.strategic-grain{display:flex;gap:2px;justify-content:flex-end;margin:0 2px 2px;height:29px}.strategic-grain button{font-size:11px;border:1px solid transparent;background:transparent;padding:4px 10px;border-radius:6px;color:#64748b}.strategic-grain button.selected{background:#e6f1df;color:#006a3a;border-color:#c5dda9}.strategic-chart-slot.otif{padding-top:39px}
.strategic-active-filters{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 12px}.strategic-active-filters button{display:flex;align-items:center;gap:6px;border:1px solid #d9e5d3;background:#eaf2e6;font-size:11px;padding:5px 8px;border-radius:6px;max-width:100%;text-align:left}.strategic-active-filters .app-icon{width:12px;height:12px;flex:none}
.strategic-error{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.strategic-placeholder strong{margin-top:12px}
.strategic-priorities{border-top:1px solid #dfe7df;margin-top:22px;padding-top:18px}
.strategic-priorities>header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px}
.strategic-priorities h2{display:flex;align-items:center;gap:9px;font-size:14px;color:#31563e;margin:0}.strategic-priorities h2 .app-icon{width:18px;height:18px}
.strategic-priorities header p{font-size:11px;color:#6d8173;margin:4px 0 0 27px}
.strategic-detail-button{display:flex;align-items:center;gap:8px;background:#eaf2e6;border:1px solid #d5e1d0;color:#006a3a;padding:8px 12px;border-radius:7px;font-size:12px}
.strategic-priority-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.strategic-priority{min-width:0}.strategic-priority :deep(.metric-card){min-height:110px;padding:14px 16px;border-radius:12px 12px 0 0}.strategic-priority :deep(.metric-card>strong){font-size:24px}
.strategic-priority>button{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;background:#edf4e8;border:1px solid #dce7d6;border-radius:0 0 12px 12px;color:#31563e;padding:9px 14px;font-size:11px;text-align:left}
.strategic-priority>button:hover,.strategic-detail-button:hover{background:#dfeecf}.strategic-priority .app-icon,.strategic-detail-button .app-icon{width:15px;height:15px}
.strategic-definitions{font-size:11px;line-height:1.7;color:#6d8173;border-top:1px solid #dfe7df;margin-top:20px;padding:12px 0 0}.strategic-definitions p{margin:0 0 5px}.strategic-definitions strong{color:#526b5d}
@container(max-width:950px){.strategic-priority-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container(max-width:380px){.strategic-priority-grid{grid-template-columns:1fr}}
@container(max-width:950px){.strategic-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.strategic-chart-slot.service,.strategic-chart-slot.revenueKg,.strategic-chart-slot.delivery,.strategic-chart-slot.otif{grid-column:span 6;grid-row:auto}.strategic-chart-slot.tonnage{grid-column:span 12}.strategic-chart-slot.delivery{order:5}.strategic-chart-slot.otif{padding-top:8px;order:4}.strategic-chart-slot.tonnage{order:3}}
@container(max-width:620px){.strategic-metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.strategic-metrics :deep(.metric-card){min-height:104px;padding:12px}.strategic-chart-slot.service,.strategic-chart-slot.revenueKg,.strategic-chart-slot.delivery,.strategic-chart-slot.otif{grid-column:span 12}.strategic-chart-slot :deep(.analytic-chart){--analysis-height:240px}.strategic-context{font-size:10px}.strategic-source{display:none!important}}
@media(max-width:767px){.strategic-dashboard{padding:10px 10px 20px}.strategic-charts{gap:14px}}
</style>
