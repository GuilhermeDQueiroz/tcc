<script setup lang="ts">
import { computed } from 'vue'
import type { Row, Series } from '../../types/analytics'
import { formatValue,toCsv } from '../../composables/useFormatters'
import {saveBlob} from '../../api/client'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import AppIcon from '../ui/AppIcon.vue'
const props = defineProps<{ year: number; month: number; series?: Series; title?:string;documentLabel?:string;measureLabel?:string }>()
const emit = defineEmits<{ select: [date: string] }>()
const cells = computed(() => {
  const first = new Date(props.year, props.month-1,1).getDay(), length = new Date(props.year,props.month,0).getDate()
  const rows = new Map<string, Row>(); for (const row of props.series?.rows || []) { const date = String(row[props.series?.x || 'date'] || row.date || row.data || '').slice(0,10); rows.set(date,row) }
  return [...Array.from({ length: first }, () => null), ...Array.from({ length },(_,index) => { const date = `${props.year}-${String(props.month).padStart(2,'0')}-${String(index+1).padStart(2,'0')}`; return { date,day:index+1,row: rows.get(date) } })]
})
const measureKey=computed(()=>(Array.isArray(props.series?.y)?props.series.y[0]:props.series?.y)||'value')
function dayValue(row:Row|undefined){
 if(!row)return null
 const key=measureKey.value
 const value=Object.hasOwn(row,key)?row[key]:row.value??row.Valor
 return value==null?null:Number(value)
}
const maximum=computed(()=>Math.max(0,...(props.series?.rows || []).map(row=>dayValue(row)??0)))
function color(row:Row|undefined){const value=dayValue(row)??0,ratio=maximum.value?value/maximum.value:0;return value<=0?{background:'#FFFFFF',color:'#94A3B8'}:ratio<=.25?{background:'#E2F2D9',color:'#006A3A'}:ratio<=.5?{background:'#B5D596',color:'#006A3A'}:ratio<=.75?{background:'#8BC53F',color:'#1A1A1A'}:{background:'#006A3A',color:'#FFFFFF'}}
function measure(row: Row | undefined) {
 const value=dayValue(row)
 return value==null||(!props.series?.metricOptions&&value===0)?'—':formatValue(value,props.series?.format || 'currency')
}
function exportCalendar(){const columns=[{key:'date',label:'Data'},{key:measureKey.value,label:props.measureLabel||'Valor'}];saveBlob(new Blob([toCsv(props.series?.rows || [],columns)],{type:'text/csv;charset=utf-8'}),'previsao-diaria.csv')}
</script>
<template><AnalysisFrame class="forecast-calendar" :title="title || 'Previsão diária de faturamento'" icon="calendar"><template #controls><slot name="controls"/></template><template #config><slot name="config"/><div class="config-actions"><button @click="exportCalendar"><AppIcon name="download"/>Exportar CSV</button></div></template><div class="calendar-grid"><span v-for="day in ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']" :key="day" class="weekday">{{ day }}</span><template v-for="(cell,index) in cells" :key="index"><div v-if="!cell" class="calendar-padding"></div><button v-else :aria-label="`Detalhar previsão de ${cell.date}`" :disabled="!cell.row" :style="color(cell.row)" @click="emit('select',cell.date)"><span class="calendar-day">{{ cell.day }}</span><strong>{{ measure(cell.row) }}</strong><small v-if="cell.row && measureKey!=='documents' && (cell.row.orders != null || cell.row.pedidos != null || cell.row.documents != null)">{{ cell.row.orders ?? cell.row.pedidos ?? cell.row.documents }} {{documentLabel || 'pedidos'}}</small></button></template></div></AnalysisFrame></template>
