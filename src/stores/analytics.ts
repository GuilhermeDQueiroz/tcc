import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { request, download } from '../api/client'
import { tabs, type Area, type Tab, type Filters, type DashboardPayload, type DimensionsPayload, type DetailsPayload, type Column, type Preset, type Goals } from '../types/analytics'

export const useAnalyticsStore = defineStore('analytics', () => {
  const area = ref<Area>('abertos'), tab = ref<Tab>('resumo')
  const filters = ref<Filters>({}), dashboard = shallowRef<DashboardPayload | null>(null), dimensions = shallowRef<DimensionsPayload | null>(null), details = shallowRef<DetailsPayload | null>(null)
  const loading = ref(false), detailsLoading = ref(false), dimensionsLoading=ref(false), error = ref(''), detailsError = ref(''), notice = ref('')
  const referenceDate = ref(''), forecastDate = ref(''), year = ref<number>(), month = ref<number>(), backlogType = ref('real'), dimension = ref('UF'), hierarchy = ref<string[]>([])
  const metric = ref('value'), chartType = ref('table'), heatmapDimension = ref('CONSULTOR')
  const openDimension=ref('Mes_Grupo')
  const page = ref(1), pageSize = ref(20), sort = ref(''), direction = ref<'asc'|'desc'>('desc'), columns = ref<string[]>([])
  const detailColumnsAvailable = ref<Column[]>([])
  const presets = ref<Preset[]>([]), goals = ref<Goals>({})
  let sequence = 0, detailSequence = 0, dimensionsSequence = 0, abort: AbortController | undefined, detailAbort: AbortController | undefined
  const dimensionRequests = new Map<string,Promise<DimensionsPayload>>()
  const filterCount = computed(() => Object.values(filters.value.dimensions || {}).reduce((sum, selected) => sum + selected.length, 0) + Object.keys(filters.value).filter(key => key !== 'dimensions').length + (forecastDate.value ? 1 : 0))
  function query(extra: Record<string, unknown> = {}) {
    const values: Record<string, unknown> = { filters: JSON.stringify(filters.value), referenceDate: referenceDate.value, forecastDate: forecastDate.value, year: year.value, month: month.value, backlogType: backlogType.value, dimension: dimension.value, hierarchy: hierarchy.value.join(','), metric: metric.value, chartType: chartType.value, heatmapDimension: heatmapDimension.value, ...extra }
    return new URLSearchParams(Object.entries(values).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString()
  }
  function resetDetails(clearColumns=false) { detailSequence++; detailAbort?.abort(); details.value = null; detailsError.value = ''; detailsLoading.value = false; page.value = 1; if (clearColumns) { columns.value=[]; detailColumnsAvailable.value=[]; sort.value='' } }
  function cancel(){
    sequence++; detailSequence++; dimensionsSequence++
    abort?.abort(); detailAbort?.abort()
    loading.value=false; detailsLoading.value=false; dimensionsLoading.value=false
  }
  async function load() {
    const current = ++sequence; abort?.abort(); abort = new AbortController()
    loading.value = true; error.value = ''; if (dashboard.value?.area !== area.value || dashboard.value?.tab !== tab.value) { dashboard.value = null; resetDetails() }
    try {
      const payload = await request<DashboardPayload>(`/bi/${area.value}/${tab.value}?${query()}`, { signal: abort.signal })
      if (current !== sequence) return
      dashboard.value = payload
      const latest = String(payload.meta?.lastDate || payload.meta?.latestDate || payload.referenceDate || '')
      if (!year.value && latest) { year.value = Number(latest.slice(0, 4)); month.value = Number(latest.slice(5, 7)) }
      if (dimensions.value?.dataVersion !== payload.dataVersion) { dimensions.value=null; void loadDimensions() }
      if (tab.value === 'pesquisa') await loadDetails()
    } catch (cause) { if (current === sequence && !(cause instanceof DOMException && cause.name === 'AbortError')) error.value = cause instanceof Error ? cause.message : 'Não foi possível carregar a análise.' }
    finally { if (current === sequence) loading.value = false }
  }
  async function loadDimensions(attempt=0) {
    dimensionsLoading.value=true
    const current = ++dimensionsSequence; const selectedArea = area.value
    const expectedVersion=dashboard.value?.area===selectedArea ? dashboard.value.dataVersion : ''
    const params=new URLSearchParams({filters:JSON.stringify(filters.value),...(referenceDate.value ? {referenceDate:referenceDate.value} : {})})
    const path=`/bi/${selectedArea}/filtros?${params}`
    const key=path+'|'+expectedVersion
    let pending=dimensionRequests.get(key)
    if(!pending) {
      pending=request<DimensionsPayload>(path); dimensionRequests.set(key,pending)
      void pending.finally(()=>{if(dimensionRequests.get(key)===pending)dimensionRequests.delete(key)}).catch(()=>undefined)
    }
    try {
      const payload = await pending
      if(current!==dimensionsSequence || selectedArea!==area.value)return
      const activeVersion=dashboard.value?.area===selectedArea ? dashboard.value.dataVersion : expectedVersion
      if(activeVersion && payload.dataVersion!==activeVersion) {
        dimensions.value=null
        if(attempt<1)await loadDimensions(attempt+1)
        else notice.value='A carga mudou durante a consulta. Atualize os dados para sincronizar os filtros.'
        return
      }
      dimensions.value=payload
    }
    catch (cause) { if (current === dimensionsSequence) notice.value = cause instanceof Error ? cause.message : 'Não foi possível carregar opções dos filtros.' }
    finally{if(current===dimensionsSequence)dimensionsLoading.value=false}
  }
  async function loadDetails() {
    const current = ++detailSequence; detailAbort?.abort(); detailAbort = new AbortController(); detailsLoading.value = true; detailsError.value = ''
    try {
      const payload = await request<DetailsPayload>(`/bi/${area.value}/detalhes?${query({ page: page.value, pageSize: pageSize.value, sort: sort.value, direction: direction.value, columns: columns.value.join(',') })}`, { signal: detailAbort.signal })
      if (current !== detailSequence) return
      if (dashboard.value && dashboard.value.dataVersion !== payload.dataVersion) { void load(); return }
      details.value = payload
      const known = new Map(detailColumnsAvailable.value.map(column => [column.key,column])); for (const column of payload.columns) known.set(column.key,column); detailColumnsAvailable.value=[...known.values()]
    } catch (cause) { if (current === detailSequence && !(cause instanceof DOMException && cause.name === 'AbortError')) detailsError.value = cause instanceof Error ? cause.message : 'Não foi possível carregar pedidos.' }
    finally { if (current === detailSequence) detailsLoading.value = false }
  }
  function setArea(value: Area) { if (area.value === value) return; area.value = value; tab.value = tabs[value][0]!.id; filters.value = {}; forecastDate.value = ''; year.value = undefined; month.value = undefined; dimensions.value = null; dimension.value = 'UF'; hierarchy.value=[]; resetDetails(true) }
  function applyFilters(value: Filters) { filters.value = JSON.parse(JSON.stringify(value)); page.value = 1; void load() }
  function drillDown(key: string, value: unknown) { if (!key || value == null) return; applyFilters({ ...filters.value, dimensions: { ...filters.value.dimensions, [key]: [String(value)] } }) }
  async function exportDetails() { try { await download(`/bi/${area.value}/detalhes?${query({ export: 'csv', sort: sort.value, direction: direction.value, columns: columns.value.join(',') })}`, `${area.value}-pedidos.csv`) } catch (cause) { detailsError.value = String(cause instanceof Error ? cause.message : cause) } }
  async function loadSettings() { const [savedPresets, savedGoals] = await Promise.all([request<Preset[] | { presets: Preset[] }>('/settings/presets'), request<Goals>('/settings/metas')]); presets.value = Array.isArray(savedPresets) ? savedPresets : savedPresets.presets; goals.value = savedGoals }
  async function savePreset(name: string, presetFilters: Filters = filters.value) { await request('/settings/presets', { method: 'POST', body: JSON.stringify({ name, area: area.value, filters: presetFilters }) }); await loadSettings() }
  async function deletePreset(id: string) { await request(`/settings/presets/${encodeURIComponent(id)}`, { method: 'DELETE' }); await loadSettings() }
  async function saveGoals(value: Goals) { await request('/settings/metas', { method: 'PUT', body: JSON.stringify(value) }); goals.value = value; await load() }
  return { area, tab, filters, dashboard, dimensions, details, loading, detailsLoading, dimensionsLoading, error, detailsError, notice, referenceDate, forecastDate, year, month, backlogType, dimension, hierarchy, metric, chartType, heatmapDimension, openDimension, page, pageSize, sort, direction, columns, detailColumnsAvailable, presets, goals, filterCount, query, load, loadDetails, loadDimensions, cancel, setArea, applyFilters, drillDown, exportDetails, loadSettings, savePreset, deletePreset, saveGoals }
})
