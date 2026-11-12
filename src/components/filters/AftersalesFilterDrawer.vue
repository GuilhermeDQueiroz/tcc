<script setup lang="ts">
import {ref,watch,computed} from 'vue'
import {useAftersalesStore,aftersalesTitles} from '../../stores/posvenda'
import FilterDialog from './FilterDialog.vue'
import FilterTabs from './FilterTabs.vue'
import AppIcon from '../ui/AppIcon.vue'
const store=useAftersalesStore(),draft=ref<Record<string,string>>({}),selectedTab=ref('period'),error=ref('')
const fields=computed(()=>store.scopeKind?[['reason','Motivo'],['product','Produto']] as const:[['reason','Motivo'],['product','Produto'],['kind','Tipo']] as const)
const locations=[['uf','Estado (UF)'],['city','Cidade']] as const
const count=(keys:string[])=>keys.filter(key=>!!draft.value[key]).length
const tabs=computed(()=>[
 {id:'period',label:'Período',icon:'calendar',count:Number(!!(draft.value.start||draft.value.end))+count(['forecastDate'])},
 {id:'location',label:'Localização',icon:'pin',count:count(['uf','city'])},
 {id:'records',label:'Documentos',icon:'receipt',count:count(['reason','product','kind','search'])}
])
watch(()=>store.filtersOpen,open=>{if(open){draft.value={...store.filters};selectedTab.value='period';error.value=''}})
function close(){store.filtersOpen=false}
function apply(){
 error.value=''
 for(const key of ['start','end','forecastDate'])if(draft.value[key]){
  const value=draft.value[key]!,date=new Date(value+'T00:00:00Z')
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value){selectedTab.value='period';error.value='Informe uma data válida.';return}
 }
 if(draft.value.start&&draft.value.end&&draft.value.start>draft.value.end){selectedTab.value='period';error.value='A data inicial deve ser anterior ou igual à data final.';return}
 const limit=store.dashboard?.referenceDate
 if(limit&&[draft.value.start,draft.value.end].some(value=>value&&value>limit)){selectedTab.value='period';error.value='Selecione datas dentro do período publicado.';return}
 store.apply({...draft.value});close()
}
function clear(){store.apply({});close()}
</script>
<template>
 <FilterDialog :open="store.filtersOpen" label="Filtros · Pós-venda" :subtitle="aftersalesTitles[store.area]+' · filtre por período, destino e documento.'" :section="selectedTab" @close="close" @apply="apply">
  <template #tabs><FilterTabs v-model="selectedTab" :tabs="tabs" prefix="aftersales-filter-tab" panel-id="aftersales-filter-panel"/></template>
  <div id="aftersales-filter-panel" class="filter-tab-panel" role="tabpanel" :aria-labelledby="'aftersales-filter-tab-'+selectedTab">
   <div v-if="selectedTab==='period'" class="period-tab-content">
    <p class="filter-field-hint">{{store.area==='assistencias'?'Período de emissão das assistências':'Período dos documentos de cancelamento ou devolução'}}. Referência publicada: {{store.dashboard?.referenceDate.split('-').reverse().join('/')}}.</p>
    <div class="period-inputs-row"><label class="date-field-label">Data inicial<input v-model="draft.start" class="filter-control-input" type="date" :max="store.dashboard?.referenceDate"></label><label class="date-field-label">Data final<input v-model="draft.end" class="filter-control-input" type="date" :max="store.dashboard?.referenceDate"></label></div>
    <label v-if="store.area==='assistencias'" class="date-field-label">Previsão de faturamento<input v-model="draft.forecastDate" class="filter-control-input" type="date"></label>
   </div>
   <div v-else-if="selectedTab==='location'" class="location-grid"><label v-for="[key,label] in locations" :key="key" class="date-field-label">{{label}}<select v-model="draft[key]" class="filter-control-select" :aria-label="label"><option value="">Todos</option><option v-for="value in store.dashboard?.options[key]||[]" :key="value" :value="value">{{value}}</option></select></label></div>
   <div v-else class="commercial-tab-content"><div class="commercial-grid"><label v-for="[key,label] in fields" :key="key" class="date-field-label">{{label}}<select v-model="draft[key]" class="filter-control-select" :aria-label="label"><option value="">Todos</option><option v-for="value in store.dashboard?.options[key]||[]" :key="value" :value="value">{{value}}</option></select></label></div><label class="date-field-label">Pesquisar<input v-model="draft.search" class="filter-control-input" type="search" maxlength="200" placeholder="Documento, pedido, cliente ou produto"></label></div>
  </div>
  <p v-if="error" role="alert" class="filter-feedback is-error">{{error}}</p>
  <template #footer><button type="button" class="modal-footer-btn btn-clear-all" @click="clear"><AppIcon name="trash"/>Limpar filtros</button><button type="button" class="modal-footer-btn btn-cancel" @click="close">Cancelar</button><button type="button" class="modal-footer-btn btn-apply-filters" @click="apply"><AppIcon name="check"/>Aplicar filtros</button></template>
 </FilterDialog>
</template>
