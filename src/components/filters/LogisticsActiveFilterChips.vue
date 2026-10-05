<script setup lang="ts">
import {computed} from 'vue'
import {useLogisticsStore} from '../../stores/logistics'
import {cloneLogisticsFilters,logisticsFilterLabels,logisticsStatusLabels,logisticsForecastLabels,type LogisticsFilters,type LogisticsCategory} from '../../domain/logistics/filters'
import {formatValue} from '../../composables/useFormatters'
const store=useLogisticsStore()
const chips=computed(()=>Object.entries(store.filters).flatMap(([key,value])=>(Array.isArray(value)?value:[value]).filter(entry=>entry.trim()).map(entry=>{
 const text=key==='status'?logisticsStatusLabels[entry]||entry:key==='forecastStatus'?logisticsForecastLabels[entry]||entry:key.endsWith('Start')||key.endsWith('End')?formatValue(entry,'date'):key.endsWith('Min')?entry.replace('.',','):entry
 return {key:key as keyof LogisticsFilters,value:entry,label:`${logisticsFilterLabels[key as keyof LogisticsFilters]}: ${text}`}
})))
function remove(key:keyof LogisticsFilters,value:string){const next=cloneLogisticsFilters(store.filters),current=next[key];if(Array.isArray(current))next[key as LogisticsCategory]=current.filter(entry=>entry!==value);else next[key]='';store.applyFilters(next)}
</script>
<template><div v-if="chips.length" class="filter-chips" aria-label="Filtros ativos"><button v-for="chip in chips" :key="chip.key+chip.value" :disabled="store.loading" :aria-label="`Remover filtro ${chip.label}`" @click="remove(chip.key,chip.value)">{{chip.label}} <span aria-hidden="true">×</span></button><button class="clear-chips" :disabled="store.loading" @click="store.reset">Limpar todos</button></div></template>
