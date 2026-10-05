<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsStore } from '../../stores/analytics'
import { dimensionLabels, type Filters } from '../../types/analytics'
import { formatValue } from '../../composables/useFormatters'
const store = useAnalyticsStore()
const chips = computed(() => {
  const entries: { key: string; label: string; value?: string }[] = []
  if (store.forecastDate) entries.push({ key: 'forecastDate', label: `Previsão: ${store.forecastDate.split('-').reverse().join('/')}` })
  for (const [key, values] of Object.entries(store.filters.dimensions || {})) for (const value of values) entries.push({ key, label: `${dimensionLabels[key] || key}: ${value}`, value })
  for (const [key, value] of Object.entries(store.filters)) {
    if (key === 'dimensions' || !value) continue
    const label = ({ emissionRange: 'Emissão', billingRange: 'Faturamento', includeGroups: 'Incluir grupos', excludeGroups: 'Excluir grupos', value: 'Valor', quantity: 'Quantidade', search: 'Pesquisa' } as Record<string, string>)[key] || key
    const content = Array.isArray(value) ? (key.endsWith('Range') ? value.map(date => formatValue(date,'date')).join(' a ') : value.join(', ')) : typeof value === 'object' ? `${value.operator} ${formatValue(value.value,key==='value'?'currency':'integer')}` : value
    entries.push({ key, label: `${label}: ${content}` })
  }
  return entries
})
function remove(key: string, value?: string) {
  if (key === 'forecastDate') { store.forecastDate=''; void store.load(); return }
  const filters: Filters = JSON.parse(JSON.stringify(store.filters))
  if (value !== undefined) { filters.dimensions![key] = filters.dimensions![key]!.filter(entry => entry !== value); if (!filters.dimensions![key]!.length) delete filters.dimensions![key] }
  else delete filters[key as keyof Filters]
  store.applyFilters(filters)
}
</script>
<template><div v-if="chips.length" class="filter-chips" aria-label="Filtros ativos"><button v-for="chip in chips" :key="chip.key + chip.value" :aria-label="`Remover filtro ${chip.label}`" @click="remove(chip.key, chip.value)">{{ chip.label }} <span aria-hidden="true">×</span></button><button class="clear-chips" @click="store.forecastDate='';store.applyFilters({})">Limpar todos</button></div></template>
