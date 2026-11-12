<script setup lang="ts">
import { computed,useId } from 'vue'
import type { Metric, MetricDetail } from '../../types/analytics'
import { formatValue } from '../../composables/useFormatters'
import AppIcon from '../ui/AppIcon.vue'
const props = defineProps<{ metric: Metric;compact?:boolean;showUnavailable?:boolean;actionLabel?:string;actionDisabled?:boolean }>()
const emit=defineEmits<{activate:[]}>()
const displayValue=computed(()=>props.showUnavailable&&props.metric.value==null?'—':formatValue(props.metric.value,props.compact&&props.metric.format==='currency'?'currencyCompact':props.metric.format))
const backgroundIcon=computed(()=>{
 if(props.metric.id.startsWith('logistica.')){const key=props.metric.id.split('.').at(-1)||'';if(key.startsWith('cube'))return 'box';if(key.startsWith('weight'))return 'weight';if(key.startsWith('value'))return 'currency';if(['none','loads'].includes(key))return 'truck';if(key==='full')return 'check';if(key==='partial')return 'layers'}
 const key=props.metric.id.split('.').at(-1)?.toLowerCase() || ''
 const icons:Record<string,string>={value:'currency',weightkg:'weight',volumem3:'box',quantity:'layers',orders:'cart',groups:'users',servicedays:'clock',backlogreal:'hourglass',backloggeneral:'hourglass',portfoliovalue:'currency',revenuekg:'currency',revenueton:'currency',tonnage:'weight',monthlytonnage:'weight',monthlyvolume:'box',ticket:'currency',monthlyquantity:'layers',monthlyorders:'cart',monthlygroups:'users',sameMonthConversion:'target',outflow:'line',orders60:'calendar',orders30:'calendar',value60:'currency',value30:'currency',entrega:'truck',retira:'building',projection:'line',otif:'target',safraorderspercent:'cart',safravaluepercent:'currency',supervisor:'users',consultor:'user',grupo_cliente:'users'}
 if(props.showUnavailable&&props.metric.id==='posvenda.documents')return 'cart'
 if(props.showUnavailable&&props.metric.id==='posvenda.aged')return 'calendar'
 const match=Object.entries(icons).find(([id])=>key===id || key.endsWith('_'+id))
 return match?.[1] || (props.metric.format==='currency'?'currency':props.metric.format==='weight'?'weight':props.metric.format==='volume'?'box':props.metric.format==='days'?'clock':props.metric.format==='percent' || props.metric.format==='ratio'?'target':'chart')
})
const tipId=useId()
const briefDescriptions:Record<string,string>={
 'strategic.portfolioValue':'Valor pendente dos pedidos da carteira logística atual.',
 'strategic.value':'Valor total faturado no período selecionado.',
 'logistica.portfolioValue':'Valor pendente dos pedidos da carteira logística atual.',
 'logistica.backlogReal':'Dias de faturamento médio necessários para cobrir o saldo logístico.',
 'strategic.backlogReal':'Quantos dias de faturamento médio equivalem ao saldo logístico atual.',
 'strategic.serviceDays':'Tempo médio entre a emissão do pedido e o faturamento.',
 'strategic.otif':'Percentual faturado até a data prevista.',
 'strategic.sameMonthConversion':'Pedidos faturados no mesmo mês em que foram emitidos.',
 'strategic.outflow':'Faturamento dividido pela entrada de pedidos no período.',
 'strategic.monthlyTonnage':'Peso médio faturado por mês no período selecionado.',
 'strategic.monthlyVolume':'Volume médio faturado por mês no período selecionado.',
 'strategic.monthlyQuantity':'Quantidade média de itens faturados por mês.',
 'strategic.monthlyOrders':'Quantidade média de pedidos faturados por mês.',
 'strategic.monthlyGroups':'Média mensal de grupos de clientes atendidos.',
 'strategic.ticket':'Valor faturado dividido pela quantidade de itens.',
 'strategic.revenueTon':'Valor faturado dividido pelo peso em toneladas.'
}
const descriptions:Record<string,string>={value:'Soma do valor em aberto dos itens no recorte selecionado.',weightKg:'Peso total em aberto, exibido em toneladas.',volumeM3:'Volume total em aberto em metros cúbicos.',quantity:'Quantidade total de itens ainda em aberto.',orders:'Quantidade de pedidos distintos. A divisão por canal segue as regras do legacy.',groups:'Grupos de clientes distintos com pedidos em aberto.',serviceDays:'Média do nível de serviço dos registros, em dias. As médias por canal seguem o cálculo original.',backlogReal:'Valor da carteira real dividido pela média diária de faturamento dos últimos 90 dias, conforme as exclusões do legacy.',backlogGeneral:'Valor total da carteira dividido pela média diária de faturamento dos últimos 90 dias.',orders60:'Pedidos distintos com registros de nível de serviço acima de 60 dias. Participação sobre todos os pedidos.',value60:'Soma dos valores em aberto com nível de serviço acima de 60 dias. Participação sobre o valor total.',ENTREGA:'Pedidos com tipo ENTREGA: valor, peso, pedidos distintos e participação no valor total.',RETIRA:'Pedidos dos demais tipos, conforme a regra de retirada do legacy: valor, peso, pedidos distintos e participação.'}
const help=computed(()=>briefDescriptions[props.metric.id] || props.metric.help || descriptions[props.metric.id.split('.').at(-1) || ''] || `${props.metric.label}: indicador calculado para os dados e filtros atuais.`)
const comparison = computed(() => typeof props.metric.comparison === 'object' && props.metric.comparison ? props.metric.comparison : { value: props.metric.comparison, label: '' })
const comparisonNegative=computed(()=>Number(comparison.value.value)*(('betterWhenLower' in comparison.value&&comparison.value.betterWhenLower)?-1:1)<0)
const orderChannels = computed<MetricDetail[]>(() => {
 if (!props.metric.id.endsWith('.orders')) return []
 const counts = props.metric.subtitle?.match(/^(\d+) Var \| (\d+) E-com$/)
 return counts ? [{label:'Varejo',value:Number(counts[1]),format:'integer'},{label:'E-commerce',value:Number(counts[2]),format:'integer'}] : []
})
const allDetails = computed(() => [...(props.metric.comparisons || []),...(props.metric.supplementary || []),...orderChannels.value])
const isChannel=(detail:MetricDetail)=>/varejo|e[- ]?commerce/i.test(detail.label)
const channelDetails=computed(()=>allDetails.value.filter(isChannel))
const details=computed(()=>allDetails.value.filter(detail=>!isChannel(detail)))
</script>
<template><article class="metric-card" data-testid="metric-card" :data-metric-id="metric.id" :data-format="metric.format"><button v-if="actionLabel" type="button" class="metric-card-action" :aria-label="actionLabel" :disabled="actionDisabled" @click="emit('activate')"></button><AppIcon class="metric-watermark" :name="backgroundIcon"/><div class="metric-label"><span class="metric-label-title">{{ metric.label }}</span><span class="metric-tip"><button type="button" :aria-label="`Sobre ${metric.label}`" :aria-describedby="tipId"><AppIcon name="help"/></button><span :id="tipId" role="tooltip" class="metric-tip-text"><span>{{help}}</span><span v-if="compact && metric.value != null && metric.format==='currency'" class="metric-exact-value">Valor exato: {{formatValue(metric.value,metric.format)}}</span><dl v-if="channelDetails.length" class="metric-tooltip-details"><template v-for="(detail,index) in channelDetails" :key="detail.label+index"><dt>{{detail.label}}</dt><dd>{{formatValue(detail.value,detail.format || metric.format)}}<small v-if="detail.percentage != null">{{formatValue(detail.percentage,'percent')}}</small></dd></template></dl></span></span></div><slot name="value"><strong :title="compact && metric.value != null ? formatValue(metric.value,metric.format) : undefined" :style="{'--metric-characters':displayValue.length}">{{displayValue}}</strong></slot><slot name="after-value"/><div v-if="metric.subtitle && !orderChannels.length" class="metric-subtitle">{{ metric.subtitle }}</div><div v-if="comparison.value != null" class="metric-comparison" :class="{ negative: comparisonNegative }" :title="'title' in comparison ? comparison.title : undefined"><span>{{ 'arrow' in comparison && comparison.arrow ? Number(comparison.value)>=0?'↑ ':'↓ ' : '' }}{{ typeof comparison.value === 'number' ? formatValue(comparison.value, ('format' in comparison ? comparison.format : undefined) || 'percent') : comparison.value }}</span> {{ comparison.label }}</div><dl v-if="details.length" class="metric-details"><template v-for="(detail,index) in details" :key="detail.label + index"><dt>{{ detail.label }}</dt><dd>{{ formatValue(detail.value, detail.format || metric.format) }}<small v-if="detail.percentage != null" :class="{ negative:Number(detail.percentage)<0 }">{{ formatValue(detail.percentage,'percent') }}</small></dd></template></dl></article></template>

<style scoped>
.metric-card .metric-card-action{position:absolute;inset:0;z-index:1;width:100%;height:100%;border:0;padding:0;background:transparent;border-radius:inherit}
.metric-card .metric-card-action:hover{background:transparent}
.metric-card:has(.metric-card-action) .metric-tip{position:static}
.metric-card:has(.metric-card-action) .metric-tip>button{position:relative;z-index:2}
</style>
