<script setup lang="ts">
import {computed,ref} from 'vue'
import type {CohortAnalysis,CohortWindow} from '../../types/cohorts'
import type {Series} from '../../types/analytics'
import {AnalyticChart} from './asyncChart'
import {formatValue} from '../../composables/useFormatters'
const props=defineProps<{data:CohortAnalysis;loading?:boolean}>()
type Measure='value'|'weightKg'|'volumeM3'|'orders'
const measures:Record<Measure,{label:string;percent:keyof CohortWindow}>={
 value:{label:'Valor',percent:'valuePercent'},weightKg:{label:'Peso',percent:'weightPercent'},
 volumeM3:{label:'Cubagem',percent:'volumePercent'},orders:{label:'Pedidos',percent:'ordersPercent'},
}
const measure=ref<Measure>('value')
const series=computed<Series>(()=>({
 id:'cohort.evolution',title:'CONVERSÃO POR MÊS · '+measures[measure.value].label.toUpperCase(),type:'line',x:'month',y:['7 dias','15 dias','30 dias'],format:'percent',overviewStyle:true,colors:['#C69214','#4E9D2D','#006A3A'],fillArea:false,
 rows:props.data.rows.map(row=>({month:formatValue(row.month,'month'),...Object.fromEntries(row.windows.map(window=>[window.days+' dias',window[measures[measure.value].percent]]))})),
}))
</script>
<template>
 <section id="conversao-safra" class="cohort-panel" aria-label="Evolução da conversão por safra">
  <AnalyticChart :series="series" :loading="loading">
   <template #config><fieldset><legend>Tipo de análise</legend><label v-for="(spec,key) in measures" :key="key"><input v-model="measure" type="radio" name="cohort-measure" :value="key" :disabled="loading">{{spec.label}}</label></fieldset></template>
  </AnalyticChart>
 </section>
</template>
<style scoped>
.cohort-panel{min-width:0;border-top:1px solid #dfe7df;margin-top:20px;padding-top:8px;scroll-margin-top:90px}
.cohort-panel :deep(.analytic-chart){--analysis-height:270px;background:transparent;box-shadow:none;border:0;border-radius:0;padding:0}
.cohort-panel :deep(.panel-heading){padding:0 0 0 4px;min-height:40px;flex-wrap:wrap;gap:8px}
.cohort-panel :deep(.panel-heading h2){color:#526b5d}
@media(max-width:767px){.cohort-panel :deep(.analytic-chart){--analysis-height:240px}}
</style>
