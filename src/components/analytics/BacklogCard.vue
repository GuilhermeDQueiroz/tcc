<script setup lang="ts">
import {computed} from 'vue'
import type {Metric} from '../../types/analytics'
import {formatValue} from '../../composables/useFormatters'
import MetricCard from './MetricCard.vue'
const props=defineProps<{metric:Metric;compact?:boolean}>()
const base=computed(()=>({...props.metric,supplementary:[]}))
const balance=computed(()=>props.metric.supplementary?.find(detail=>detail.format==='currency'))
const value=computed(()=>balance.value?.value??null)
</script>
<template>
 <MetricCard class="backlog-card" :data-tone="metric.status?.tone||'neutral'" :metric="base" compact>
  <template #after-value>
   <div class="backlog-state"><span aria-hidden="true"/>{{metric.status?.label||'Indisponível'}}</div>
   <div v-if="balance" class="backlog-value" :title="value==null?'Valor da carteira indisponível':formatValue(value,'currency')">{{balance.label}}: <strong>{{value==null?'—':formatValue(value,'currency')}}</strong></div>
  </template>
 </MetricCard>
</template>
<style scoped>
.backlog-card{--backlog-color:#64748b;border-left-color:var(--backlog-color)}
.backlog-card[data-tone="critical"]{--backlog-color:#dc2626}
.backlog-card[data-tone="warning"]{--backlog-color:#c69214}
.backlog-card[data-tone="good"]{--backlog-color:#006a3a}
.backlog-state{display:flex;align-items:center;gap:6px;color:var(--backlog-color);font-size:11px;font-weight:600;margin-top:8px}
.backlog-state>span{width:8px;height:8px;border-radius:50%;background:currentColor;flex:none}
.backlog-value{font-size:11px;color:#64748b;margin-top:6px;line-height:1.5;overflow-wrap:anywhere}
.backlog-value strong{display:inline;margin:0;font-size:inherit;font-weight:600;white-space:nowrap}
</style>
