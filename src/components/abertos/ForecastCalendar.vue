<script setup lang="ts">
import { computed } from 'vue'
import type { Row, Series } from '../../types/analytics'
import { formatValue,toCsv } from '../../composables/useFormatters'
import {saveBlob} from '../../api/client'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import AppIcon from '../ui/AppIcon.vue'
const props = defineProps<{ year: number; month: number; series?: Series; title?:string }>()
const emit = defineEmits<{ select: [date: string] }>()
const cells = computed(() => {
  const first = new Date(props.year, props.month-1,1).getDay(), length = new Date(props.year,props.month,0).getDate()
  const rows = new Map<string, Row>(); for (const row of props.series?.rows || []) { const date = String(row[props.series?.x || 'date'] || row.date || row.data || '').slice(0,10); rows.set(date,row) }
  return [...Array.from({ length: first }, () => null), ...Array.from({ length },(_,index) => { const date = `${props.year}-${String(props.month).padStart(2,'0')}-${String(index+1).padStart(2,'0')}`; return { date,day:index+1,row: rows.get(date) } })]
})
function dayValue(row:Row|undefined){const key=Array.isArray(props.series?.y)?props.series.y[0]:props.series?.y || 'value';return Number(row?.[key || 'value'] ?? row?.value ?? row?.Valor ?? 0)}
const maximum=computed(()=>Math.max(0,...(props.series?.rows || []).map(dayValue)))
function color(row:Row|undefined){const value=dayValue(row),ratio=maximum.value?value/maximum.value:0;return value<=0?{background:'#FFFFFF',color:'#94A3B8'}:ratio<=.25?{background:'#E2F2D9',color:'#006A3A'}:ratio<=.5?{background:'#B5D596',color:'#006A3A'}:ratio<=.75?{background:'#8BC53F',color:'#1A1A1A'}:{background:'#006A3A',color:'#FFFFFF'}}
function measure(row: Row | undefined) { return dayValue(row)?formatValue(dayValue(row),props.series?.format || 'currency'):'—' }
function exportCalendar(){const columns=[{key:'date',label:'Data'},{key:'value',label:'Valor'}];saveBlob(new Blob([toCsv(props.series?.rows || [],columns)],{type:'text/csv;charset=utf-8'}),'previsao-diaria.csv')}
</script>
<template><AnalysisFrame class="forecast-calendar" :title="title || 'Previsão diária de faturamento'" icon="calendar"><template #controls><slot name="controls"/></template><template #config><div class="config-actions"><button @click="exportCalendar"><AppIcon name="download"/>Exportar CSV</button></div></template><div class="calendar-grid"><span v-for="day in ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']" :key="day" class="weekday">{{ day }}</span><template v-for="(cell,index) in cells" :key="index"><div v-if="!cell" class="calendar-padding"></div><button v-else :aria-label="`Detalhar previsão de ${cell.date}`" :disabled="!cell.row" :style="color(cell.row)" @click="emit('select',cell.date)"><span class="calendar-day">{{ cell.day }}</span><strong>{{ measure(cell.row) }}</strong><small v-if="cell.row && (cell.row.orders != null || cell.row.pedidos != null)">{{ cell.row.orders ?? cell.row.pedidos }} pedidos</small></button></template></div></AnalysisFrame></template>
