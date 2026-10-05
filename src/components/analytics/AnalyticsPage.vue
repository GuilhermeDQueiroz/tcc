<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAnalyticsStore } from '../../stores/analytics'
import { areas, tabs, dimensionLabels, type Area, type Tab, type AnalyticTable } from '../../types/analytics'
import MetricCard from './MetricCard.vue'
import AnalyticTableView from './AnalyticTable.vue'
import {AnalyticChart} from './asyncChart'
import ActiveFilterChips from '../filters/ActiveFilterChips.vue'
import ForecastCalendar from '../abertos/ForecastCalendar.vue'
import OpenOverview from '../abertos/OpenOverview.vue'
import LoadingState from '../ui/LoadingState.vue'
const props = defineProps<{ area: Area }>(), store = useAnalyticsStore(), route = useRoute(), router = useRouter()
const pageInfo = computed(() => areas.find(area => area.id === props.area)!), search = ref(''), searching = ref(false), hierarchyInput = ref('')
const selectedTab = computed(() => tabs[props.area].find(tab => tab.id === route.query.tab)?.id || tabs[props.area][0]!.id)
const title = computed(() => tabs[props.area].find(tab => tab.id === selectedTab.value)?.label)
const openHelpers = ['Aging_Bucket','Mes_Grupo','Mes_Previsao','Status_Previsao','Canal']
const analysisDimensions = computed(() => Object.entries(dimensionLabels).filter(([key]) => props.area === 'abertos' ? !['FAMILIA','COR','Ano_Num'].includes(key) : ![...openHelpers,'Ano_Num'].includes(key)))
const heatmapDimensions = computed(() => [['Ano_Num','Ano'],...analysisDimensions.value.filter(([key]) => ![...openHelpers,'CLIENTE','CODIGO_PEDIDO'].includes(key))])
const today = new Date(), year = computed(() => store.year || today.getFullYear()), month = computed(() => store.month || today.getMonth()+1)
const monthLabel = computed(() => new Date(year.value,month.value-1,1).toLocaleDateString('pt-BR', {month:'long',year:'numeric'}))
const detailsTable = computed<AnalyticTable>(() => ({ id:`${props.area}-details`,title:'Pesquisa de pedidos',placeholder:!store.details,rows:store.details?.rows || [],columns:store.detailColumnsAvailable.length ? store.detailColumnsAvailable : [{key:'CODIGO_PEDIDO',label:'Pedido'},{key:'CLIENTE',label:'Cliente'}] }))
const calendarSeries = computed(() => store.dashboard?.series.find(series => /calend|forecast.daily|previsao.diari/.test(series.id)) || store.dashboard?.series.find(series => series.x === 'date' || series.x === 'data'))
const charts = computed(() => store.dashboard?.series.filter(series => selectedTab.value !== 'calendario' || series !== calendarSeries.value) || [])
watch([() => props.area, selectedTab], async ([area, tab]) => { store.setArea(area); store.tab=tab; search.value=store.filters.search || ''; await store.load() }, { immediate:true })
function changeTab(tab: Tab) { void router.replace({ query:{ ...route.query,tab } }) }
function shiftMonth(amount: number) { const date = new Date(year.value,month.value-1+amount,1); store.year=date.getFullYear(); store.month=date.getMonth()+1; void store.load() }
function changeContext() { void store.load() }
function changeOverviewBacklog(type: string) { store.backlogType=type; void store.load() }
function applyHierarchy() { store.hierarchy=hierarchyInput.value.split(',').map(value => value.trim()).filter(Boolean); void store.load() }
function searchOrders() { searching.value=true; store.applyFilters({ ...store.filters,search:search.value.trim() || undefined }); searching.value=false }
function selectDay(date: string) { store.forecastDate=date; changeTab('pesquisa') }
function detailSort(key:string,direction:'asc'|'desc') { store.sort=key; store.direction=direction; store.page=1; void store.loadDetails() }
function detailPage(page:number) { store.page=page; void store.loadDetails() }
function detailSize(size:number) { store.pageSize=size; store.page=1; void store.loadDetails() }
function detailColumns(keys:string[]) { store.columns=keys; store.page=1; void store.loadDetails() }
onBeforeUnmount(() => { searching.value=false; store.cancel() })
</script>
<template><div class="analytics-page"><nav v-if="area!=='abertos'" class="analysis-tabs" role="tablist" :aria-label="`Análises de ${pageInfo.label}`"><button v-for="tab in tabs[area]" :key="tab.id" role="tab" :aria-selected="selectedTab===tab.id" :class="{selected:selectedTab===tab.id}" @click="changeTab(tab.id)">{{ tab.label }}</button></nav><ActiveFilterChips />
<div v-if="selectedTab==='calendario'" class="panel context-controls"><div class="month-navigation"><button aria-label="Mês anterior" @click="shiftMonth(-1)">‹</button><strong data-testid="calendar-month">{{ monthLabel }}</strong><button aria-label="Próximo mês" @click="shiftMonth(1)">›</button></div><fieldset class="backlog-switch"><legend>Carteira para previsão</legend><label><input v-model="store.backlogType" type="radio" value="real" @change="changeContext">Backlog real</label><label><input v-model="store.backlogType" type="radio" value="geral" @change="changeContext">Backlog geral</label></fieldset></div>
<div v-if="selectedTab==='dimensoes' || selectedTab==='mensal' || selectedTab==='geografia' || selectedTab==='evolucao'" class="panel context-controls"><label>Dimensão<select aria-label="Dimensão" v-model="store.dimension" @change="changeContext"><option v-for="[key,label] in analysisDimensions" :key="key" :value="key">{{ label }}</option></select></label><label>Métrica<select aria-label="Métrica" v-model="store.metric" @change="changeContext"><option value="value">Valor (R$)</option><option value="weightKg">Peso (t)</option><option value="volumeM3">Volume (m³)</option><option value="quantity">Quantidade de itens</option><option value="orders">Número de pedidos</option></select></label><label v-if="selectedTab==='dimensoes'">Visualização<select aria-label="Visualização" v-model="store.chartType" @change="changeContext"><option value="table">Tabela</option><option value="barHorizontal">Barras horizontais</option><option value="bar">Barras verticais</option><option value="pie">Donut</option><option value="treemap">Treemap</option><option value="line">Evolução mensal</option></select></label><label v-if="selectedTab==='evolucao'">Cruzar mês com<select aria-label="Cruzar mês com" v-model="store.heatmapDimension" @change="changeContext"><option v-for="[key,label] in heatmapDimensions" :key="key" :value="key">{{ label }}</option></select></label><details class="hierarchy-editor"><summary>Configurar hierarquia</summary><label>Níveis da hierarquia<input v-model="hierarchyInput" placeholder="UF,CONSULTOR,GRUPO_CLIENTE"></label><button @click="applyHierarchy">Aplicar hierarquia</button></details></div>
<div v-if="selectedTab==='pesquisa'" class="panel search-panel"><form @submit.prevent="searchOrders"><label>Pesquisar pedidos<input v-model="search" placeholder="Pedido, cliente ou produto"></label><button class="primary" :disabled="searching" type="submit">Pesquisar</button></form></div>
<LoadingState :active="store.loading" screen :label="`Carregando ${pageInfo.label.toLowerCase()}…`"/><div v-if="store.error" class="error-box" role="alert"><strong>Não foi possível carregar a análise.</strong><p>{{ store.error }}</p><button @click="store.load">Tentar novamente</button></div><template v-if="store.dashboard && !store.error"><OpenOverview v-if="area==='abertos' && selectedTab==='resumo'" :payload="store.dashboard" :year="year" :month="month" @select="selectDay" @shift="shiftMonth" @backlog="changeOverviewBacklog"/><template v-else><div v-if="store.dashboard.metrics.length" class="metric-grid"><MetricCard v-for="metric in store.dashboard.metrics" :key="metric.id" :metric="metric" /></div><ForecastCalendar v-if="selectedTab==='calendario'" :year="year" :month="month" :series="calendarSeries" @select="selectDay" /><div class="charts-grid"><AnalyticChart v-for="series in charts" :key="series.id" :series="series" @drilldown="store.drillDown" /></div><AnalyticTableView v-for="table in store.dashboard.tables" :key="table.id" :table="table" :loading="store.loading" @drilldown="store.drillDown" /><p v-if="!store.dashboard.metrics.length && !store.dashboard.series.length && !store.dashboard.tables.length && selectedTab!=='pesquisa'" class="panel empty-state">Nenhum dado encontrado para os filtros selecionados.</p></template></template>
<template v-if="selectedTab==='pesquisa'"><div v-if="store.detailsError" class="error-box" role="alert">{{ store.detailsError }}<button @click="store.loadDetails">Tentar novamente</button></div><AnalyticTableView :table="detailsTable" :loading="store.detailsLoading || store.loading" loading-label="Carregando pedidos…" server :total-rows="store.details?.total" :page="store.page" :page-size="store.pageSize" :selected-keys="store.columns" :initial-sort="store.sort" :initial-direction="store.direction" @drilldown="store.drillDown" @page="detailPage" @page-size="detailSize" @sort="detailSort" @columns="detailColumns" @export="store.exportDetails" /></template>
</div></template>




