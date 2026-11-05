<script setup lang="ts">
import {computed,ref,watch,onMounted,nextTick} from 'vue'
import type {CohortAnalysis,CohortWindow} from '../../types/cohorts'
import type {Metric,Series,Format} from '../../types/analytics'
import MetricCard from './MetricCard.vue'
import {AnalyticChart} from './asyncChart'
import AppIcon from '../ui/AppIcon.vue'
import {formatValue} from '../../composables/useFormatters'

const props=defineProps<{data:CohortAnalysis;loading?:boolean}>()
onMounted(async()=>{
 if(window.location.hash!=='#conversao-safra')return
 await nextTick()
 document.getElementById('conversao-safra')?.scrollIntoView({block:'start'})
})
type Measure='value'|'weightKg'|'volumeM3'|'orders'
const measures:Record<Measure,{label:string;percent:keyof CohortWindow;billed:keyof CohortWindow;format:Format}>={
 value:{label:'Valor',percent:'valuePercent',billed:'billedValue',format:'currency'},
 weightKg:{label:'Peso',percent:'weightPercent',billed:'billedWeightKg',format:'weight64'},
 volumeM3:{label:'Cubagem',percent:'volumePercent',billed:'billedVolumeM3',format:'volume'},
 orders:{label:'Pedidos',percent:'ordersPercent',billed:'billedOrders',format:'integer'},
}
const measure=ref<Measure>('value'),month=ref('')
watch(()=>props.data.rows,rows=>{
 if(rows.some(row=>row.month===month.value))return
 month.value=[...rows].reverse().find(row=>row.windows.every(window=>window.mature))?.month||rows.at(-1)?.month||''
},{immediate:true})
const selected=computed(()=>props.data.rows.find(row=>row.month===month.value))
const definition=computed(()=>measures[measure.value])
const display=(value:unknown,format:Format)=>value==null?'—':formatValue(value,format)
const cards=computed<Metric[]>(()=>selected.value?.windows.map(window=>({
 id:'cohort.'+window.days,label:'Faturado em até '+window.days+' dias',value:window[definition.value.percent] as number|null,format:'percent',
 subtitle:!window.mature?'Em acompanhamento':window[definition.value.percent]==null?'Base indisponível':`${display(window[definition.value.billed],definition.value.format)} / ${display(selected.value![measure.value],definition.value.format)}`,
 supplementary:Object.entries(measures).filter(([key])=>key!==measure.value).map(([,spec])=>({label:spec.label,value:window[spec.percent] as number|null,format:'percent'})),
 help:window.mature?`${definition.value.label} faturado até ${window.days} dias corridos após a emissão de cada pedido ÷ ${definition.value.label.toLowerCase()} emitido na safra × 100. Pedidos conta a primeira ocorrência de algum faturamento, inclusive parcial; não confirma atendimento integral nem entrega. Valores acima de 100% exigem conciliação.`:`Janela completa a partir de ${formatValue(window.availableOn,'date')}, quando todos os pedidos desse mês tiverem ${window.days} dias de observação.`,
}))||[])
const series=computed<Series>(()=>({
 id:'cohort.evolution',title:'Conversão por mês de emissão · '+definition.value.label,type:'line',x:'month',y:['7 dias','15 dias','30 dias'],format:'percent',
 rows:props.data.rows.map(row=>({month:formatValue(row.month,'month'),...Object.fromEntries(row.windows.map(window=>[window.days+' dias',window[definition.value.percent]]))})),
}))
const qualityCount=computed(()=>Object.values(props.data.quality).reduce((total,value)=>total+value,0))
const exceedsBase=computed(()=>selected.value?.windows.some(window=>window.exceedsBase))
</script>

<template>
 <section id="conversao-safra" class="cohort-panel" aria-labelledby="cohort-title">
  <header class="cohort-header">
   <div><h2 id="cohort-title"><AppIcon name="chart"/>Conversão da safra de pedidos</h2><p>Do pedido emitido ao faturamento · janelas de 7, 15 e 30 dias corridos</p></div>
   <label v-if="data.rows.length" class="cohort-selector">Safra de emissão<select v-model="month" :disabled="loading"><option v-for="row in data.rows" :key="row.month" :value="row.month">{{formatValue(row.month,'month')}}</option></select></label>
  </header>
  <p class="cohort-context">Emissões de {{formatValue(data.start,'date')}} a {{formatValue(data.end,'date')}} · Faturamento observado até {{formatValue(data.observedThrough,'date')}}</p>
  <p v-if="data.billingRangeIgnored" class="cohort-notice">O filtro de faturamento aplica-se aos gráficos anteriores. Aqui, os filtros de emissão e localização definem a safra; os faturamentos posteriores desses pedidos continuam no cálculo.</p>
  <p v-if="!data.rows.length" class="cohort-empty">Nenhum pedido emitido na publicação para este recorte.</p>
  <template v-else>
   <div class="cohort-measures" role="group" aria-label="Medida da conversão"><button v-for="(spec,key) in measures" :key="key" :aria-pressed="measure===key" :class="{selected:measure===key}" :disabled="loading" @click="measure=key">{{spec.label}}</button></div>
   <dl v-if="selected" class="cohort-base" aria-label="Base emitida da safra selecionada"><div v-for="(spec,key) in measures" :key="key"><dt>{{key==='volumeM3'?'Cubagem emitida':spec.label+' emitido'+(key==='orders'?'s':'')}}</dt><dd>{{display(selected[key],spec.format)}}</dd></div></dl>
   <div class="cohort-cards"><MetricCard v-for="card in cards" :key="card.id" :metric="card" compact/></div>
   <p v-if="exceedsBase" class="cohort-notice">Há faturamento acima da base emitida. Confira alterações do pedido e a conciliação das medidas; o percentual foi preservado.</p>
   <AnalyticChart :series="series" :loading="loading"/>
   <div class="cohort-table-scroll" tabindex="0" aria-label="Comparação das safras por mês">
    <table><caption>Comparação por safra · {{definition.label}}</caption><thead><tr><th scope="col">Safra</th><th scope="col">Base emitida</th><th v-for="days in [7,15,30]" :key="days" scope="col">Até {{days}} dias</th></tr></thead>
     <tbody><tr v-for="row in data.rows" :key="row.month" :class="{'cohort-selected':row.month===month}"><th scope="row"><button :aria-pressed="row.month===month" @click="month=row.month">{{formatValue(row.month,'month')}}</button></th><td>{{display(row[measure],definition.format)}}</td><td v-for="window in row.windows" :key="window.days"><span v-if="window.mature">{{display(window[definition.percent],'percent')}}</span><span v-else class="cohort-pending" :title="'Janela completa em '+formatValue(window.availableOn,'date')">Em acompanhamento<small>{{formatValue(window.availableOn,'date')}}</small></span></td></tr></tbody>
    </table>
   </div>
  </template>
  <p class="cohort-definition">Base: todos os pedidos emitidos da safra no recorte, inclusive sem faturamento. Valor, peso e cubagem medem parcelas faturadas; pedidos mede a ocorrência de algum faturamento, inclusive parcial. Não comprova entrega nem atendimento integral. Cada janela só apresenta percentual após o fim do mês de emissão + seu prazo.</p>
  <details v-if="qualityCount" class="cohort-quality"><summary>Registros excluídos por inconsistência</summary><p>{{data.quality.invalidEmissionRows}} registros de emissão sem data ou pedido válido; {{data.quality.conflictingOrders}} pedidos com datas de emissão conflitantes; {{data.quality.invalidBillingRows}} registros faturados com data inválida, anterior ou divergente da emissão do pedido.</p></details>
 </section>
</template>

<style scoped>
.cohort-panel { scroll-margin-top:90px; }
.cohort-panel{min-width:0;border-top:1px solid #dfe7df;margin-top:24px;padding-top:18px}
.cohort-header{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.cohort-header h2{display:flex;align-items:center;gap:9px;font-size:14px;color:#31563e;margin:0}.cohort-header .app-icon{width:18px;height:18px}
.cohort-header p,.cohort-context{font-size:11px;color:#6d8173;margin:5px 0 10px}.cohort-selector{display:flex;align-items:center;gap:8px;font-size:12px;color:#31563e}.cohort-selector select{border:1px solid #d5e1d0;background:#fff;border-radius:7px;padding:7px 12px;min-width:105px}
.cohort-measures{display:flex;gap:4px;flex-wrap:wrap;margin:12px 0}.cohort-measures button{border:1px solid #d5e1d0;border-radius:7px;background:transparent;padding:7px 16px;color:#526b5d;font-size:12px}.cohort-measures button.selected{background:#e6f1df;color:#006a3a;border-color:#abc997}
.cohort-base{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;background:#edf4e8;border-radius:10px;padding:12px 16px;margin:0 0 14px}.cohort-base div{min-width:0}.cohort-base dt{font-size:11px;color:#6d8173}.cohort-base dd{font-size:14px;color:#31563e;margin:4px 0 0;overflow-wrap:anywhere;font-weight:600}
.cohort-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.cohort-cards :deep(.metric-card){min-width:0;min-height:175px;padding:16px;border-radius:12px}.cohort-cards :deep(.metric-card>strong){font-size:28px}.cohort-cards :deep(.metric-subtitle){font-size:11px}
.cohort-panel :deep(.analytic-chart){--analysis-height:270px;margin-top:18px;background:transparent;box-shadow:none;border:0;padding:0}
.cohort-panel :deep(.panel-heading h2){font-size:12px;color:#526b5d}
.cohort-table-scroll{overflow:auto;max-width:100%;margin-top:12px;border:1px solid #dfe7df;border-radius:9px}.cohort-table-scroll:focus-visible{outline:2px solid #006a3a;outline-offset:2px}
table{width:100%;border-collapse:collapse;min-width:600px;font-size:12px;color:#31563e}caption{text-align:left;font-weight:600;padding:12px;background:#edf4e8}th,td{padding:10px 12px;border-top:1px solid #dfe7df;text-align:right}th:first-child{text-align:left}thead{background:#f4f6f4}tbody th button{border:0;background:transparent;color:#006a3a;text-decoration:underline;padding:0;font-size:12px}.cohort-selected{background:#eaf2e6}.cohort-pending{font-size:10px;color:#7b8174;display:inline-block}.cohort-pending small{display:block;font-size:10px;margin-top:3px}
.cohort-definition,.cohort-quality,.cohort-notice,.cohort-empty{font-size:11px;line-height:1.7;color:#6d8173}.cohort-definition{margin:12px 0 0}.cohort-notice{padding:9px 12px;border-left:3px solid #dba648;background:#fbf7ec;color:#76602e;border-radius:4px}.cohort-empty{padding:20px 0}.cohort-quality{margin-top:8px}
@media(max-width:767px){.cohort-base{grid-template-columns:repeat(2,minmax(0,1fr))}.cohort-cards{grid-template-columns:1fr}.cohort-selector{width:100%;justify-content:space-between}.cohort-measures button{flex:1;padding:7px 10px}.cohort-cards :deep(.metric-card){min-height:150px}.cohort-panel :deep(.analytic-chart){--analysis-height:240px}}
</style>
