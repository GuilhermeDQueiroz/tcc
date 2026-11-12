<script setup lang="ts">
import {strategicDefaultPeriod} from '../../../shared/strategic-period.js'
import {ref,watch,computed} from 'vue'
import {useStrategicStore} from '../../stores/strategic'
import type {Filters} from '../../types/analytics'
import MultiSelect from './MultiSelect.vue'
import AppIcon from '../ui/AppIcon.vue'
import FilterDialog from './FilterDialog.vue'
import FilterTabs from './FilterTabs.vue'

const store=useStrategicStore(),draft=ref<Filters>({}),error=ref(''),selectedTab=ref('period')
const billing=ref<[string,string]>(['','']),emission=ref<[string,string]>(['',''])
const categories=[['UF','Estado (UF)'],['CIDADE','Cidade'],['TIPO_ENTREGA','Entrega / retirada']] as const
const tabs=computed(()=>[
 {id:'period',label:'Período',icon:'calendar',count:Number(billing.value.some(Boolean))+Number(emission.value.some(Boolean))},
 {id:'location',label:'Localização',icon:'pin',count:Object.values(draft.value.dimensions||{}).filter(values=>values.length).length}
])
watch(()=>store.filtersOpen,open=>{
 if(open){
  const defaultPeriod=strategicDefaultPeriod()
  draft.value=JSON.parse(JSON.stringify(store.filters));draft.value.dimensions??={}
  billing.value=[...(draft.value.billingRange||[defaultPeriod.start,defaultPeriod.end])];emission.value=[...(draft.value.emissionRange||['',''])];error.value='';selectedTab.value='period'
 }
})
function close(){store.filtersOpen=false}
function apply(){
 error.value=''
 const value:Filters={dimensions:{...draft.value.dimensions}}
 for(const [key,range] of [['billingRange',billing.value],['emissionRange',emission.value]] as const){
  if(!range[0]&&!range[1])continue
  if(!range[0]||!range[1]||range[0]>range[1]){selectedTab.value='period';error.value='Preencha as duas datas com o início anterior ou igual ao fim.';return}
  for(const date of range){const parsed=new Date(date+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date){error.value='Informe datas válidas.';return}}
  value[key]=[range[0],range[1]]
 }
 store.applyFilters(value);close()
}
</script>
<template>
 <FilterDialog :open="store.filtersOpen" label="Filtros · Visão estratégica" :section="selectedTab" @close="close" @apply="apply">
  <template #tabs><FilterTabs v-model="selectedTab" :tabs="tabs" prefix="strategic-filter-tab" panel-id="strategic-filter-panel"/></template>
  <div id="strategic-filter-panel" class="filter-tab-panel" role="tabpanel" :aria-labelledby="'strategic-filter-tab-'+selectedTab">
   <div v-if="selectedTab==='location'" class="strategic-filter-locations"><MultiSelect v-for="[field,label] in categories" :key="field" :label="label" :options="store.dashboard?.options[field]||[]" :model-value="draft.dimensions?.[field]||[]" @update:model-value="draft.dimensions![field]=$event"/></div>
   <div v-else class="period-tab-content">
    <fieldset class="strategic-period-fields"><legend>Faturamento · gráficos e desempenho</legend><div><label>De<input v-model="billing[0]" type="date" class="filter-control-input" aria-label="Faturamento inicial"></label><label>Até<input v-model="billing[1]" type="date" class="filter-control-input" aria-label="Faturamento final"></label></div></fieldset>
    <fieldset class="strategic-period-fields"><legend>Emissão do pedido · carteira e histórico</legend><div><label>De<input v-model="emission[0]" type="date" class="filter-control-input" aria-label="Emissão inicial"></label><label>Até<input v-model="emission[1]" type="date" class="filter-control-input" aria-label="Emissão final"></label></div></fieldset>
   </div>
  </div>
  <p v-if="error" role="alert" class="filter-feedback is-error">{{error}}</p>
  <template #footer><button type="button" class="modal-footer-btn btn-clear-all" @click="store.reset();close()"><AppIcon name="trash"/>Limpar filtros</button><button type="button" class="modal-footer-btn btn-cancel" @click="close">Cancelar</button><button type="button" class="modal-footer-btn btn-apply-filters" @click="apply"><AppIcon name="check"/>Aplicar filtros</button></template>
 </FilterDialog>
</template>
<style scoped>
.strategic-filter-locations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:24px}
.strategic-period-fields{border:0;border-top:1px solid #e0e8dd;margin:20px 0 0;padding:18px 0 0;min-width:0}
.strategic-period-fields legend{font-size:13px;font-weight:600;padding:0 8px 0 0;color:#31563e}
.strategic-period-fields>div{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.strategic-period-fields label{font-size:12px;color:#64748b;display:grid;gap:6px;min-width:0}
@media(max-width:600px){.strategic-filter-locations{grid-template-columns:1fr}.strategic-period-fields>div{gap:8px}.filter-modal-header h2{font-size:14px}}
</style>
