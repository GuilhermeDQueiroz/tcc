<script setup lang="ts">
import {ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useStrategicStore} from '../../stores/strategic'
import type {Filters} from '../../types/analytics'
import MultiSelect from './MultiSelect.vue'
import AppIcon from '../ui/AppIcon.vue'

const store=useStrategicStore(),panel=ref<HTMLElement>(),draft=ref<Filters>({}),error=ref('')
const billing=ref<[string,string]>(['','']),emission=ref<[string,string]>(['',''])
let focus:HTMLElement|null=null,overflow=''
const categories=[['UF','Estado (UF)'],['CIDADE','Cidade'],['TIPO_ENTREGA','Entrega / retirada']] as const
watch(()=>store.filtersOpen,async open=>{
 if(open){
  draft.value=JSON.parse(JSON.stringify(store.filters));draft.value.dimensions??={}
  billing.value=[...(draft.value.billingRange||['',''])];emission.value=[...(draft.value.emissionRange||['',''])];error.value=''
  focus=document.activeElement instanceof HTMLElement?document.activeElement:null;overflow=document.body.style.overflow;document.body.style.overflow='hidden'
  await nextTick();if(store.filtersOpen)panel.value?.focus()
 }else{document.body.style.overflow=overflow;await nextTick();if(focus?.isConnected)focus.focus({preventScroll:true})}
})
onBeforeUnmount(()=>{if(store.filtersOpen)document.body.style.overflow=overflow;store.filtersOpen=false})
function close(){store.filtersOpen=false}
function key(event:KeyboardEvent){
 if(event.key==='Escape'){event.preventDefault();close()}
 if(event.key!=='Tab')return
 const items=Array.from(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')||[]).filter(element=>element.getClientRects().length)
 const first=items[0],last=items.at(-1)
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.value)){event.preventDefault();last?.focus()}
 else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.value)){event.preventDefault();first?.focus()}
}
function apply(){
 error.value=''
 const value:Filters={dimensions:{...draft.value.dimensions}}
 for(const [key,range] of [['billingRange',billing.value],['emissionRange',emission.value]] as const){
  if(!range[0]&&!range[1])continue
  if(!range[0]||!range[1]||range[0]>range[1]){error.value='Preencha as duas datas com o início anterior ou igual ao fim.';return}
  for(const date of range){const parsed=new Date(date+'T00:00:00Z');if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date){error.value='Informe datas válidas.';return}}
  if(key==='billingRange'&&range[0]>(store.dashboard?.meta.publications.logistics.referenceDate||'9999-12-31')){error.value='O início do faturamento deve estar dentro do período publicado.';return}
  value[key]=[range[0],range[1]]
 }
 store.applyFilters(value);close()
}
</script>
<template>
 <Teleport to="body"><div v-if="store.filtersOpen" class="filter-modal-overlay" @click.self="close">
  <section ref="panel" class="filter-modal-dialog strategic-filter-modal" role="dialog" aria-modal="true" aria-label="Filtros · Visão Estratégica" tabindex="-1" @keydown="key">
   <header class="filter-modal-header"><h2><AppIcon name="filter"/>Filtros · Visão Estratégica</h2><button class="icon-button" aria-label="Fechar filtros" @click="close"><AppIcon name="close"/></button></header>
   <div class="filter-modal-body">
    <div class="strategic-filter-locations"><MultiSelect v-for="[field,label] in categories" :key="field" :label="label" :options="store.dashboard?.options[field]||[]" :model-value="draft.dimensions?.[field]||[]" @update:model-value="draft.dimensions![field]=$event"/></div>
    <fieldset class="strategic-period-fields"><legend>Faturamento · gráficos e desempenho</legend><div><label>De<input v-model="billing[0]" type="date" class="filter-control-input" aria-label="Faturamento inicial"></label><label>Até<input v-model="billing[1]" type="date" class="filter-control-input" aria-label="Faturamento final"></label></div><p>Sem período selecionado, exibe os últimos 12 meses publicados. A carteira aberta mantém sua referência atual.</p></fieldset>
    <fieldset class="strategic-period-fields"><legend>Emissão do pedido · carteira e histórico</legend><div><label>De<input v-model="emission[0]" type="date" class="filter-control-input" aria-label="Emissão inicial"></label><label>Até<input v-model="emission[1]" type="date" class="filter-control-input" aria-label="Emissão final"></label></div></fieldset>
    <p v-if="error" role="alert" class="error-state">{{error}}</p>
   </div>
   <footer class="filter-modal-footer"><button class="modal-footer-btn" @click="store.reset();close()">Limpar filtros</button><button class="modal-footer-btn primary" @click="apply">Aplicar filtros</button></footer>
  </section>
 </div></Teleport>
</template>
<style scoped>
.strategic-filter-modal{width:min(760px,calc(100vw - 24px));max-height:calc(100dvh - 24px)}
.strategic-filter-locations{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:24px}
.strategic-period-fields{border:0;border-top:1px solid #e0e8dd;margin:20px 0 0;padding:18px 0 0;min-width:0}
.strategic-period-fields legend{font-size:13px;font-weight:600;padding:0 8px 0 0;color:#31563e}
.strategic-period-fields>div{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.strategic-period-fields label{font-size:12px;color:#64748b;display:grid;gap:6px;min-width:0}
.strategic-period-fields p{font-size:12px;line-height:1.6;color:#64748b;margin:10px 0 0}
.filter-modal-header h2{display:flex;align-items:center;gap:10px;font-size:17px}
.filter-modal-header .app-icon{width:20px}
@media(max-width:600px){.strategic-filter-locations{grid-template-columns:1fr}.strategic-period-fields>div{gap:8px}.filter-modal-header h2{font-size:14px}}
</style>
