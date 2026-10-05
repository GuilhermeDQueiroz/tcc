<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts/core'
import type { EChartsOption } from 'echarts'
import { BarChart, LineChart, PieChart, MapChart, ScatterChart, TreemapChart, HeatmapChart, GaugeChart, FunnelChart } from 'echarts/charts'
import { GeoComponent,GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, DataZoomComponent, ToolboxComponent,GraphicComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Series, Row, Column } from '../../types/analytics'
import { formatValue, inferFormat,compactAxisValue, toCsv } from '../../composables/useFormatters'
import { saveBlob } from '../../api/client'
import {ensureBrazilMap} from '../../charts/brazilMap'
import AnalysisFrame from '../ui/AnalysisFrame.vue'
import AppIcon from '../ui/AppIcon.vue'
const props = defineProps<{ series: Series; loading?:boolean; variant?: string; selectedMetric?: string;embedded?:boolean;displayLimit?:string;displayOrder?:string }>()
const emit = defineEmits<{ drilldown: [dimension: string, value: unknown] }>()
const host = ref<HTMLElement>(), failed = ref(''), measure = ref(''); let chart: echarts.ECharts | undefined, observer: ResizeObserver | undefined
const rendering=ref(false)
const visualization=ref(''),limit=ref('all'),ordering=ref('default')
watch(()=>props.displayLimit,value=>{limit.value=value || 'all'},{immediate:true})
watch(()=>props.displayOrder,value=>{ordering.value=value || 'default'},{immediate:true})
const palette = ['#006a3a','#73ac36','#a6c96a','#2c795b','#b8d8c7','#64748b','#e3a744','#87afa3']
echarts.use([BarChart, LineChart, PieChart, MapChart, ScatterChart, TreemapChart, HeatmapChart, GaugeChart, FunnelChart, GeoComponent,GridComponent, LegendComponent, TooltipComponent, VisualMapComponent, DataZoomComponent, ToolboxComponent,GraphicComponent, CanvasRenderer])
const ufNames: Record<string,string> = { AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins' }
const x = computed(() => props.series.x || Object.keys(props.series.rows[0] || {}).find(key => typeof props.series.rows[0]?.[key] === 'string') || 'label')
const metricOptions = computed(() => props.series.metricOptions && typeof props.series.metricOptions === 'object' ? props.series.metricOptions as Record<string,string> : {})
const ys = computed(() => { if (measure.value && metricOptions.value[measure.value]) return [metricOptions.value[measure.value]!]; const specified = props.series.y; if (typeof specified === 'string') return [specified]; if (specified?.length) return specified; return Object.keys(props.series.rows[0] || {}).filter(key => typeof props.series.rows[0]?.[key] === 'number' && key !== x.value).slice(0, 1) })
const type = computed(() => visualization.value || (props.variant && props.variant !== 'table' ? props.variant : props.series.type))
const chartIcon=computed(()=>String(props.series.icon || (props.series.type==='map'?'map':props.series.type==='line'?'line':props.series.type==='pie'?'donut':'chart')))
const activeMeasure=computed(()=>measure.value || Object.entries(metricOptions.value).find(([,key])=>key===ys.value[0])?.[0] || '')
const measureChoice=computed({get:()=>activeMeasure.value,set:value=>{measure.value=value}})
const viewChoice=computed({get:()=>visualization.value || (props.series.compactDonut?'donut':props.series.type),set:value=>{visualization.value=value}})
const metricFormat=computed(()=>measure.value ? inferFormat(ys.value[0] || 'value') : props.series.format || inferFormat(ys.value[0] || 'value'))
const displayRows=computed(()=>{
 const key=ys.value[0] || 'value';let rows=[...(limit.value==='all'?props.series.rows:(props.series.availableRows as Row[] || props.series.rows))]
 if(limit.value!=='all'){const count=parseInt(limit.value),ranked=[...rows].sort((a,b)=>Number(b[key] || 0)-Number(a[key] || 0));rows=ranked.slice(0,count);if(limit.value.endsWith('others')&&ranked.length>count){const rest=ranked.slice(count);rows.push({[x.value]:'Outros',[key]:rest.reduce((total,row)=>total+Number(row[key] || 0),0),Part:rest.reduce((total,row)=>total+Number(row.Part || row['% Part'] || 0),0),_others:true})}}
 if(ordering.value!=='default')rows.sort((a,b)=>(ordering.value==='desc'?-1:1)*(Number(a[key] || 0)-Number(b[key] || 0)))
 return rows
})
const tableColumns=computed<Column[]>(()=>{
 const columns:Column[]=[{key:x.value,label:props.series.labels?.[x.value] || x.value,format:'text'}]
 const category=typeof props.series.category==='string'?props.series.category:undefined
 if(category&&category!==x.value)columns.push({key:category,label:props.series.labels?.[category] || category,format:'text'})
 const labels:Record<string,string>={value:'Valor (R$)',weightKg:'Peso (t)',volumeM3:'Volume (m³)',quantity:'Qtd itens',orders:'Qtd pedidos'}
 const formats:Record<string,string>={value:'currency',weightKg:'weight',volumeM3:'volume',quantity:'integer',orders:'integer'}
 for(const [metric,key] of Object.entries(metricOptions.value))if(displayRows.value.some(row=>key in row))columns.push({key,label:labels[metric] || props.series.labels?.[key] || key,format:formats[metric] || inferFormat(key)})
 for(const key of ys.value)if(!columns.some(column=>column.key===key))columns.push({key,label:props.series.labels?.[key] || key,format:metricFormat.value})
 for(const column of [{key:'% Part',label:'Participação',format:'ratio'},{key:'NS',label:'Nível de serviço',format:'days'},{key:'Ticket Medio',label:'Ticket médio',format:'currency'},{key:'R$/Ton',label:'R$/Ton',format:'currency'},{key:'Grupos_Atendidos',label:'Grupos atendidos',format:'integer'}])if(!columns.some(item=>item.key===column.key)&&displayRows.value.some(row=>column.key in row))columns.push(column)
 return columns
})
function restore(){visualization.value='';limit.value='all';ordering.value='default';measure.value='';void render()}
function saveImage(){if(!chart)return;const link=document.createElement('a');link.href=chart.getDataURL({type:'png',pixelRatio:2,backgroundColor:'#F4F6F4'});link.download=props.series.id+'.png';link.click()}
function numeric(row: Row, key: string) { return row[key] == null ? null : Number(row[key]) }
function monthOrder(value: string) {
  if (/^\d{4}-\d{2}/.test(value)) return Number(value.slice(0,4))*12+Number(value.slice(5,7))
  const [month,year] = value.toLowerCase().split('/'), index = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'].indexOf(month || '')
  return index >= 0 ? (Number(year)+2000)*12+index : Number.MAX_SAFE_INTEGER
}
function heatmapTooltip(parameters:unknown,xLabels:string[],yLabels:string[],format:string) {
  const item=Array.isArray(parameters)?parameters[0]:parameters
  const row=item && typeof item==='object' ? item as {value?:unknown} : undefined
  const coordinates=Array.isArray(row?.value)?row.value:[0,0,row?.value]
  return `${yLabels[Number(coordinates[1])] || ''} · ${xLabels[Number(coordinates[0])] || ''}\n${formatValue(coordinates[2],format)}`
}
const option = computed<EChartsOption>(() => {
  const rows = displayRows.value, values = ys.value, dimension = x.value, chartType = type.value
  const format = measure.value ? inferFormat(values[0] || 'value') : props.series.format || inferFormat(values[0] || 'value')
  const base: EChartsOption = { color: palette, animationDuration: 220, textStyle: { fontFamily: 'Inter, Segoe UI, sans-serif', fontSize:12, color: '#475569' }, tooltip: { trigger: ['pie','donut','treemap','map','gauge'].includes(chartType) ? 'item' : 'axis', renderMode: 'richText', valueFormatter: value => formatValue(value,format) } }
  if(chartType==='donut'||(chartType==='pie'&&props.series.compactDonut&&!visualization.value)){
    const colors=props.series.colorMap as Record<string,string>|undefined
    const centers=props.series.centerTexts as Record<string,string>|undefined
    return {...base,legend:{bottom:0,type:'scroll',textStyle:{fontSize:12}},graphic:{type:'text',left:'center',top:'41%',style:{text:String(centers?.[measure.value] || props.series.centerText || ''),textAlign:'center',fontSize:12,fontWeight:700,fill:'#1A1A1A'}},series:[{type:'pie',radius:['44%','70%'],center:['50%','45%'],label:{position:'inside',formatter:'{d}%',fontSize:12,color:'#fff'},data:rows.map(row=>({name:String(row[dimension]??''),value:numeric(row,values[0] || 'value')??undefined,itemStyle:{color:colors?.[String(row[dimension])],borderColor:'#F4F6F4',borderWidth:2}}))}]}
  }
  if (chartType === 'pie' || chartType === 'donut') return { ...base, legend: { bottom: 0, type: 'scroll' }, series: [{ type: 'pie', radius: chartType==='pie' ? [0,'67%'] : ['40%','67%'], center: ['50%','43%'], label: { formatter: '{b}\n{d}%', overflow: 'truncate', width: 95 }, data: rows.map(row => ({ name: String(row[dimension] ?? ''), value: numeric(row,values[0] || 'value') ?? undefined })) }] }
  if (chartType === 'treemap') return { ...base, series: [{ type: 'treemap', leafDepth: 1, roam: false, nodeClick: false, breadcrumb: { show: false }, label: { show: true, formatter: '{b}' }, data: rows.map(row => ({ name: String(row[dimension] ?? ''), value: numeric(row,values[0] || 'value') ?? undefined })) }] }
  if (chartType === 'funnel') return { ...base, legend: { bottom:0,type:'scroll' }, series:[{type:'funnel',left:'15%',top:35,bottom:45,width:'70%',sort:'none',label:{formatter:'{b}: {c}'},data:rows.map(row=>({name:String(row[dimension] ?? ''),value:numeric(row,values[0] || 'value') ?? undefined}))}] }
  if (chartType === 'gauge') return { ...base, series: [{ type: 'gauge', min: Number(props.series.min ?? 0), max: Number(props.series.max ?? rows[0]?.max ?? 100), splitNumber:5, progress: { show: true, width: 16 }, axisLine: { lineStyle: { width: 16 } }, axisLabel:{fontSize:12,distance:12,formatter:value=>compactAxisValue(value,format)}, detail: { valueAnimation: true, formatter: value => formatValue(value,format), fontSize: 20 }, data: [{ name: String(rows[0]?.[dimension] || ''), value: numeric(rows[0] || {}, values[0] || 'value') ?? undefined }] }] }
  if (chartType === 'map') {
    if(props.series.detailedMap){
     const points=(props.series.points||[]) as Row[]
     return {...base,tooltip:{trigger:'item',renderMode:'richText',formatter:parameters=>{
      const parameter=Array.isArray(parameters)?parameters[0]:parameters,data=parameter?.data as Row|undefined
      if(data?.pedido_id)return `${data.name}\n${data.cliente}\n${data.cidade} · ${data.uf}\nValor aberto: ${formatValue(data.valor_aberto,'currency')}\nPeso: ${formatValue(data.peso_aberto,'weight64')}\nEm carga: ${formatValue(data.cubagem_em_carga,'volume')}\nSem carga: ${formatValue(data.cubagem_sem_carga,'volume')}`
      const row=rows.find(row=>(ufNames[String(row.UF)]||row.UF)===parameter?.name)
      return row?`${parameter?.name}\nPedidos: ${formatValue(row.orders,'integer')}\nCidades: ${row.cities}\nValor aberto: ${formatValue(row.value,'currency')}\nPeso: ${formatValue(row.weightKg,'weight64')}\nCubagem: ${formatValue(row.volumeM3,'volume')}`:`${parameter?.name}\nSem pedidos no recorte`
     }},geo:{map:'brazil',roam:true,scaleLimit:{min:.7,max:12},layoutCenter:['50%','44%'],layoutSize:'100%',itemStyle:{areaColor:'#f0f4ef',borderColor:'#bbcfc0',borderWidth:.7},emphasis:{label:{show:true},itemStyle:{areaColor:'#d5eaaa'}},selectedMode:false},visualMap:{seriesIndex:0,min:0,max:Math.max(...rows.map(row=>Number(row[values[0]||'volumeM3'])||0),1),orient:'horizontal',left:'center',bottom:10,inRange:{color:['#ecf5e8','#8bc53f','#006a3a']},formatter:value=>compactAxisValue(value,format)},series:[{type:'map',geoIndex:0,data:rows.map(row=>({name:ufNames[String(row.UF)]||String(row.UF),value:numeric(row,values[0]||'volumeM3')??undefined}))},{type:'scatter',coordinateSystem:'geo',symbolSize:9,itemStyle:{color:'#164d35',borderColor:'#fff',borderWidth:1,opacity:.85},emphasis:{scale:1.8},data:points.map(row=>({...row,name:String(row.name),value:[Number(row.longitude),Number(row.latitude),Number(row.quantidade_aberta)]}))}]}
    }
    if(props.series.overviewStyle)return {...base,visualMap:{min:0,max:Math.max(...rows.map(row=>numeric(row,values[0] || 'value') || 0),1),orient:'horizontal',left:'center',bottom:0,itemWidth:12,itemHeight:200,text:['Valor em Aberto',''],inRange:{color:['#ecf5e8','#8bc53f','#006a3a']},calculable:true,formatter:value=>compactAxisValue(value,format)},series:[{type:'map',map:'brazil',roam:true,layoutCenter:['50%','43%'],layoutSize:'90%',nameProperty:'name',itemStyle:{areaColor:'#eef2ef',borderColor:'#fff',borderWidth:1},data:rows.map(row=>({name:ufNames[String(row[dimension])] || String(row[dimension]),value:numeric(row,values[0] || 'value')??undefined}))}]}
    return { ...base, tooltip: { trigger: 'item', renderMode: 'richText', valueFormatter: value => formatValue(value,format) }, visualMap: { min: 0, max: Math.max(...rows.map(row => numeric(row,values[0] || 'value') || 0),1), left: 5, bottom: 5, inRange: { color: ['#ecf5e8','#8bc53f','#006a3a'] }, calculable: true, formatter: value => formatValue(value,format) }, series: [{ type: 'map', map: 'brazil', roam: true, scaleLimit: { min: 0.7, max: 6 }, nameProperty: 'name', emphasis: { label: { show: true }, itemStyle: { areaColor: '#d5eaaa' } }, itemStyle: { areaColor: '#eef2ef', borderColor: '#fff', borderWidth: 1 }, data: rows.map(row => ({ name: ufNames[String(row[dimension] || row.UF || row.uf)] || String(row[dimension] || row.UF || row.uf), value: numeric(row, values[0] || 'value') ?? undefined })) }] }
  }
  if (chartType === 'heatmap') {
    if (values.length > 1) {
      const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
      const xLabels = values.map(key => props.series.labels?.[key] || (/^month_\d+$/.test(key) ? months[Number(key.slice(6))-1]! : key)), yLabels = rows.map(row => String(row[dimension] ?? ''))
      const data = rows.flatMap((row,index) => values.map((key,column) => [column,index,numeric(row,key)]))
      return { ...base, tooltip:{position:'top',renderMode:'richText',formatter:parameters=>heatmapTooltip(parameters,xLabels,yLabels,format)},grid:{top:35,left:120,right:22,bottom:70},xAxis:{type:'category',data:xLabels,splitArea:{show:true}},yAxis:{type:'category',data:yLabels,axisLabel:{width:110,overflow:'truncate'},splitArea:{show:true}},visualMap:{min:0,max:Math.max(...data.map(cell=>Number(cell[2]) || 0),1),calculable:true,orient:'horizontal',left:'center',bottom:0,formatter:value=>compactAxisValue(value,format),inRange:{color:['#f2f7ed','#90be65','#006a3a']}},series:[{type:'heatmap',data,label:{show:data.length<70,formatter:parameters=>formatValue(Array.isArray(parameters.value)?parameters.value[2]:parameters.value,format)}}] }
    }
    const yKey = typeof props.series.category === 'string' ? props.series.category : typeof props.series.yDimension === 'string' ? props.series.yDimension : Object.keys(rows[0] || {}).find(key => key !== dimension && typeof rows[0]?.[key] === 'string') || 'dimension'
    const xLabels = [...new Set(rows.map(row => String(row[dimension])))], yLabels = [...new Set(rows.map(row => String(row[yKey])))], data = rows.map(row => [xLabels.indexOf(String(row[dimension])), yLabels.indexOf(String(row[yKey])), numeric(row,values[0] || 'value')])
    return { ...base, tooltip: { position: 'top', renderMode: 'richText',formatter:parameters=>heatmapTooltip(parameters,xLabels,yLabels,format) }, grid: { top: 35, left: 120, right: 22, bottom: 75 }, xAxis: { type: 'category', data: xLabels, splitArea: { show: true } }, yAxis: { type: 'category', data: yLabels, axisLabel: { width: 110, overflow: 'truncate' }, splitArea: { show: true } }, visualMap: { min: 0, max: Math.max(...rows.map(row => numeric(row,values[0] || 'value') || 0),1), calculable: true, orient: 'horizontal', left: 'center', bottom: 0,formatter:value=>compactAxisValue(value,format), inRange: { color: ['#f2f7ed','#90be65','#006a3a'] } }, series: [{ type: 'heatmap', data, label: { show: rows.length < 70, formatter: parameters => formatValue(Array.isArray(parameters.value) ? parameters.value[2] : parameters.value,format) } }] }
  }
  const horizontal = chartType === 'barHorizontal' || props.series.horizontal, line = chartType === 'line' || chartType === 'evolution'
  if(props.series.overviewStyle&&horizontal){
    const key=values[0] || 'value',maximum=Math.max(...rows.map(row=>numeric(row,key) || 0),1)
    return {...base,grid:{left:'36%',right:16,top:16,bottom:16},xAxis:{type:'value',max:maximum*1.65,axisLabel:{show:false},splitLine:{lineStyle:{color:'#e5e7e6'}}},yAxis:{type:'category',data:rows.map(row=>String(row[dimension])),axisLabel:{fontSize:12,width:160,overflow:'truncate'},axisLine:{show:false},axisTick:{show:false}},series:[{type:'bar',barMaxWidth:34,data:rows.map(row=>{const ratio=(numeric(row,key)||0)/maximum;return {value:numeric(row,key),itemStyle:{color:ratio>.75?'#006A3A':ratio>.4?'#4E9D2D':'#8BC53F'},label:{show:true,position:'right',fontSize:12,formatter:()=>`${formatValue(row[key],format)} (${formatValue(Number(row.Part || 0)*100,'percent')})`}}})}]}
  }
  const groupColumn = typeof props.series.category === 'string' ? props.series.category : undefined
  const categories = groupColumn ? [...new Set(rows.map(row => String(row[dimension] ?? '')))].sort((a,b) => monthOrder(a)-monthOrder(b)) : rows.map(row => String(row[dimension] ?? ''))
  const measureAxis = { type: 'value' as const, axisLabel: { formatter: (value: number) => compactAxisValue(value,format) }, splitLine: { lineStyle: { color: '#edf1ee' } } }
  const categoryAxis = { type: 'category' as const, data: categories, axisLabel: { rotate: !horizontal && categories.length>12 ? 35 : 0, width: horizontal ? 110 : 90, overflow: 'truncate' as const }, axisLine: { lineStyle: { color: '#dce5de' } } }
  const chartSeries = groupColumn ? [...new Set(rows.map(row => String(row[groupColumn])))].map(group => ({ name:group,type:line?'line' as const:'bar' as const,connectNulls:false,barMaxWidth:35,symbolSize:5,data:categories.map(category=>{const row=rows.find(row=>String(row[dimension])===category && String(row[groupColumn])===group);return row?numeric(row,values[0] || 'value'):null}),emphasis:{focus:'series' as const} })) : values.map(key => ({ name: props.series.labels?.[key] || key, type: line ? 'line' as const : 'bar' as const, smooth: false, connectNulls: false, barMaxWidth: 35, symbolSize: 5, stack: props.series.stack ? String(props.series.stack) : undefined, data: rows.map(row => numeric(row,key)), emphasis: { focus: 'series' as const } }))
  const presentedSeries=props.series.overviewStyle ? chartSeries.map(series=>({...series,itemStyle:{color:groupColumn ? (series.name==='ENTREGA'?'#8BC53F':'#4E9D2D'):'#8BC53F'},...(line?{lineStyle:{color:'#8BC53F',width:2.5},areaStyle:{color:'rgba(139,197,63,0.15)'}}:{})})) : chartSeries
  return { ...base, legend: { bottom: 0, type: 'scroll' }, grid: { left: horizontal ? 125 : 70, right: 24, top: 42, bottom: categories.length>18 ? 90 : 68 }, xAxis: horizontal ? measureAxis : categoryAxis, yAxis: horizontal ? categoryAxis : measureAxis, dataZoom: categories.length>18 ? [{ type: 'slider', xAxisIndex: horizontal ? undefined : 0, yAxisIndex: horizontal ? 0 : undefined, bottom: 24, height: 15 }, { type: 'inside' }] : undefined, series: presentedSeries }
})
async function render() { await nextTick(); if (!host.value || type.value==='table') return; try { if (type.value === 'map') { rendering.value=true; await ensureBrazilMap() }; if (!host.value || type.value==='table') return; if (!chart) { chart = echarts.init(host.value); chart.on('click', event => { const point=event.data as Row|undefined;if(props.series.detailedMap&&point?.pedido_id){emit('drilldown','CODIGO_PEDIDO',point.pedido_id);return}; const dimension = props.series.dimension || (props.series.type === 'map' ? 'UF' : ''); const row=displayRows.value.find(row=>String(row[x.value])===event.name);if(row?._others)return; let value: unknown = row?.[dimension] ?? row?._value ?? event.name; if (props.series.type === 'map') value = Object.entries(ufNames).find(([,name]) => name === event.name)?.[0] || event.name; if (dimension) emit('drilldown',dimension,value) }) }; chart.setOption(option.value, true); failed.value = '' } catch (cause) { failed.value = cause instanceof Error ? cause.message : 'Falha ao exibir gráfico.' } finally{rendering.value=false} }
let resizeFrame=0
function resizeChart() {
 if(resizeFrame)return
 resizeFrame=requestAnimationFrame(()=>{
  resizeFrame=0
  const element=host.value
  if(!element || !element.clientWidth || !element.clientHeight || type.value==='table' || !props.series.rows.length || chart?.isDisposed())return
  chart?.resize({width:element.clientWidth,height:element.clientHeight})
 })
}
onMounted(() => { void render(); observer = new ResizeObserver(resizeChart); if (host.value) observer.observe(host.value) })
watch(option, async () => {
 await render()
 const scope=host.value?.closest('.analysis-frame')
 if(scope)window.dispatchEvent(new CustomEvent('dashboard:content-ready',{detail:scope}))
})
onBeforeUnmount(() => { observer?.disconnect(); cancelAnimationFrame(resizeFrame); chart?.dispose() })
function exportSeries() { const keys = Object.keys(displayRows.value[0] || {}).filter(key=>!key.startsWith('_')); saveBlob(new Blob([toCsv(displayRows.value,keys.map(key => ({ key,label: props.series.labels?.[key] || key })))], {type:'text/csv;charset=utf-8'}), `${props.series.id}.csv`) }
function zoomMap(factor:number){const geo=chart?.getOption().geo as {zoom?:number}[]|undefined;chart?.setOption({geo:{zoom:Math.max(.7,Math.min(12,(geo?.[0]?.zoom||1)*factor))}})}
function resetMap(){chart?.setOption({geo:{zoom:1,center:null}})}
defineExpose({exportSeries,saveImage,restore})
</script>
<template>
<AnalysisFrame class="analytic-chart" :class="{'analysis-embedded':embedded}" :data-series-id="series.id" :title="series.title" :icon="chartIcon" :loading="loading || rendering" loading-label="Carregando visualização…">
 <template #controls><div v-if="series.detailedMap && type==='map'" class="map-navigation"><button aria-label="Aproximar mapa" title="Aproximar" @click="zoomMap(1.4)">+</button><button aria-label="Afastar mapa" title="Afastar" @click="zoomMap(1/1.4)">−</button><button aria-label="Restaurar mapa" title="Restaurar mapa" @click="resetMap"><AppIcon name="refresh"/></button></div><div v-if="series.metricButtons" class="metric-buttons" aria-label="Medida de entrega"><button v-for="(field,key) in metricOptions" :key="key" :class="{selected:activeMeasure===key}" :aria-pressed="activeMeasure===key" @click="measure=String(key)">{{key==='weightKg'?'KG':key==='value'?'R$':field}}</button></div></template>
 <template #config>
  <fieldset v-if="Object.keys(metricOptions).length"><legend>Tipo de análise</legend><label v-for="(field,key) in metricOptions" :key="key"><input v-model="measureChoice" type="radio" :name="series.id+'-measure'" :value="key">{{key==='value'?'Valor (R$)':key==='orders'?'Quantidade de pedidos':key==='weightKg'?'Peso':key==='volumeM3'?'Volume (m³)':key==='quantity'?'Quantidade de itens':field}}</label></fieldset>
  <fieldset v-if="!['gauge','heatmap'].includes(series.type)"><legend>Visualização</legend><label v-for="[key,label] in [['table','Tabela'],['barHorizontal','Barra horizontal'],['bar','Barra vertical'],['pie','Pizza'],['donut','Donut'],['line','Evolução mensal'],['treemap','Treemap'],...(series.type==='map'?[['map','Mapa']]:[])]" :key="key"><input v-model="viewChoice" type="radio" :name="series.id+'-view'" :value="key">{{label}}</label></fieldset>
  <template v-if="!series.category && !['gauge','heatmap'].includes(series.type)"><label>Quantidade exibida<select aria-label="Quantidade exibida" v-model="limit"><option value="all">Todos</option><option value="10">Top 10</option><option value="10others">Top 10 + Outros</option><option value="20">Top 20</option><option value="20others">Top 20 + Outros</option></select></label><label>Ordenação<select aria-label="Ordenação" v-model="ordering"><option value="default">Padrão</option><option value="desc">Maior → Menor</option><option value="asc">Menor → Maior</option></select></label></template>
  <div class="config-actions"><button @click="exportSeries"><AppIcon name="download"/>Exportar CSV</button><button :disabled="type==='table' || !series.rows.length" @click="saveImage"><AppIcon name="download"/>Salvar imagem</button><button @click="restore"><AppIcon name="refresh"/>Restaurar configuração</button></div>
 </template>
 <p v-if="!series.rows.length && !loading && type!=='table'" class="empty-state">Sem dados para este gráfico com os filtros selecionados.</p>
 <div class="visualization-viewport"><div v-if="type==='table'" class="table-scroll"><table><thead><tr><th v-for="column in tableColumns" :key="column.key">{{column.label}}</th></tr></thead><tbody><tr v-for="(row,index) in displayRows" :key="index"><td v-for="column in tableColumns" :key="column.key">{{formatValue(row[column.key],column.format)}}</td></tr><tr v-if="!displayRows.length && !loading"><td :colspan="tableColumns.length" class="empty-table">Nenhum registro encontrado para este recorte.</td></tr></tbody></table></div>
 <div v-show="series.rows.length && type!=='table'" ref="host" class="chart-host" role="img" :aria-label="series.title"></div></div>
 <p v-if="failed" role="alert">{{failed}}</p>
 <div v-if="series.type==='gauge' && series.rows[0]" class="gauge-summary"><span>Realizado <b>{{formatValue(series.rows[0].value,series.format)}}</b></span><span>Meta acumulada <b>{{formatValue(series.rows[0].accumulated,series.format)}}</b><small>{{formatValue(series.rows[0].accumulatedPercent,'percent')}}</small></span><span>Meta do mês <b>{{formatValue(series.rows[0].total,series.format)}}</b><small>{{formatValue(series.rows[0].totalPercent,'percent')}}</small></span></div>
</AnalysisFrame>
</template>

<style scoped>.map-navigation{display:flex;gap:3px}.map-navigation button{width:28px;height:28px;padding:3px;font-size:17px}.map-navigation .app-icon{width:14px;height:14px}</style>
