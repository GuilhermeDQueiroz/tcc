<script setup lang="ts">
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue'
import {useLogisticsStore} from '../../stores/logistics'
import {useFilterDraft,type FilterPeriod} from '../../composables/useFilterDraft'
import {emptyLogisticsFilters,cloneLogisticsFilters,categoryValues,logisticsCategories,logisticsFilterLabels,logisticsForecastLabels,type LogisticsCategory,type LogisticsFilters} from '../../domain/logistics/filters'
import AppIcon from '../ui/AppIcon.vue'
import MultiSelect from './MultiSelect.vue'

const store=useLogisticsStore(),panel=ref<HTMLElement>(),feedback=ref(''),feedbackKind=ref<'success'|'error'>('success')
const draft=ref(emptyLogisticsFilters()),selectedTab=ref('period'),shortcutTarget=ref<'emission'|'forecast'>('forecast')
const {emission,billing,quickPeriod:periodShortcut,currentYear}=useFilterDraft()
const presetName=ref(''),presetId=ref(''),presets=ref<{id:string;name:string;filters:LogisticsFilters}[]>([])
const presetKey='tcc.logistics.filter-presets.v1'
let previousFocus:HTMLElement|null=null,previousOverflow=''
const active=(keys:(keyof LogisticsFilters)[])=>keys.filter(key=>{const value=draft.value[key];return Array.isArray(value)?value.length:!!value.trim()}).length
const tabs=computed(()=>[
 {id:'period',label:'Período',icon:'calendar',count:Number(!!(draft.value.emissionStart||draft.value.emissionEnd))+Number(!!(draft.value.forecastStart||draft.value.forecastEnd))+active(['forecastStatus','ageMin'])},
 {id:'location',label:'Localização',icon:'pin',count:active(['uf','city'])},
 {id:'orders',label:'Pedidos',icon:'receipt',count:active(['search','company','client','erpStatus','product'])},
 {id:'loads',label:'Cargas',icon:'truck',count:active(['status','delivery','loadStage'])},
 {id:'numeric',label:'Valores',icon:'currency',count:active(['freeQuantityMin','freeVolumeMin','freeWeightMin','orderValueMin'])}
])
watch(selectedTab,()=>nextTick(()=>panel.value?.querySelector('.filter-modal-body')?.scrollTo({top:0})))
function message(text:string,kind:'success'|'error'='success'){feedback.value=text;feedbackKind.value=kind}
function visible(element:HTMLElement|null|undefined){if(!element?.isConnected)return false;const box=element.getBoundingClientRect();return box.width>0&&box.height>0&&box.right>0&&box.left<innerWidth&&box.bottom>0&&box.top<innerHeight}
watch(()=>store.filtersOpen,async open=>{
 if(open){
  draft.value=cloneLogisticsFilters(store.filters);feedback.value='';selectedTab.value='period';shortcutTarget.value='forecast';presetId.value='';presetName.value=''
  try{const saved:unknown=JSON.parse(localStorage.getItem(presetKey)||'[]');presets.value=Array.isArray(saved)?saved.filter(entry=>entry&&typeof entry.id==='string'&&typeof entry.name==='string'&&entry.filters&&typeof entry.filters==='object').map(entry=>({...entry,filters:cloneLogisticsFilters(entry.filters)})):[]}
  catch{presets.value=[];message('Não foi possível carregar os presets deste navegador.','error')}
  previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
  previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden'
  await nextTick();if(store.filtersOpen)panel.value?.focus()
 }else{
  document.body.style.overflow=previousOverflow;await nextTick()
  const target=visible(previousFocus)?previousFocus:document.querySelector<HTMLElement>('.header-filter-btn')
  if(visible(target))target?.focus({preventScroll:true})
 }
})
onBeforeUnmount(()=>{if(store.filtersOpen)document.body.style.overflow=previousOverflow;store.filtersOpen=false})
function close(){store.filtersOpen=false}
function compiled(){
 feedback.value=''
 for(const key of logisticsCategories){const values=categoryValues(draft.value[key]);if(values.length>100||values.some(value=>value.length>150)){selectedTab.value=['uf','city'].includes(key)?'location':key==='delivery'?'loads':'orders';message(logisticsFilterLabels[key]+': selecione até 100 opções, com até 150 caracteres cada.','error');return}}
 for(const [start,end,label] of [[draft.value.emissionStart,draft.value.emissionEnd,'emissão'],[draft.value.forecastStart,draft.value.forecastEnd,'previsão']]){
  for(const value of [start,end])if(value){const date=new Date(value+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==value){message('Informe uma data válida de '+label+'.','error');return}}
  if(start&&end&&start>end){selectedTab.value='period';message('A data inicial deve ser anterior ou igual à data final.','error');return}
 }
 for(const key of ['ageMin','freeQuantityMin','freeVolumeMin','freeWeightMin','orderValueMin'] as const){const value=draft.value[key];if(value&&(!Number.isFinite(Number(value))||Number(value)<0||(key==='ageMin'&&(!Number.isInteger(Number(value))||Number(value)>10000)))){selectedTab.value=key==='ageMin'?'period':'numeric';message('Informe valores mínimos válidos, maiores ou iguais a zero.','error');return}}
 return cloneLogisticsFilters(draft.value)
}
function apply(){const value=compiled();if(value){store.applyFilters(value);close()}}
function clear(){store.reset();close()}
function quickPeriod(period:FilterPeriod){periodShortcut(period,shortcutTarget.value==='emission'?'emission':'billing');const range=shortcutTarget.value==='emission'?emission.value:billing.value;if(shortcutTarget.value==='emission'){draft.value.emissionStart=range[0]!;draft.value.emissionEnd=range[1]!}else{draft.value.forecastStart=range[0]!;draft.value.forecastEnd=range[1]!;draft.value.forecastStatus=''}feedback.value=''}
function clearPeriod(){for(const key of ['emissionStart','emissionEnd','forecastStart','forecastEnd','forecastStatus','ageMin'] as const)draft.value[key]='';feedback.value=''}
function forecastChanged(){if(draft.value.forecastStatus==='undated'){draft.value.forecastStart='';draft.value.forecastEnd=''}}
function setCategory(key:LogisticsCategory,values:string[]){draft.value[key]=values}
function usePreset(){const preset=presets.value.find(entry=>entry.id===presetId.value);if(preset){draft.value=cloneLogisticsFilters(preset.filters);message("Preset '"+preset.name+"' carregado. Clique em Aplicar filtros para usá-lo.")}}
function savePreset(){const value=compiled(),name=presetName.value.trim();if(!value||!name)return;const entries=[...presets.value,{id:crypto.randomUUID(),name,filters:value}];try{localStorage.setItem(presetKey,JSON.stringify(entries));presets.value=entries;presetName.value='';message('Preset salvo neste navegador.')}catch{message('Não foi possível salvar o preset neste navegador.','error')}}
function deletePreset(){const entries=presets.value.filter(entry=>entry.id!==presetId.value);try{localStorage.setItem(presetKey,JSON.stringify(entries));presets.value=entries;presetId.value='';message('Preset excluído.')}catch{message('Não foi possível excluir o preset neste navegador.','error')}}
function trap(event:KeyboardEvent){
 if(event.key!=='Tab')return
 const items=[...(panel.value?.querySelectorAll<HTMLElement>('button,input,select,[tabindex="0"]')||[])].filter(el=>!el.hasAttribute('disabled')&&el.tabIndex>=0&&el.getClientRects().length)
 const first=items[0],last=items.at(-1)
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.value)){event.preventDefault();last?.focus()}
 else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
}
function tabKey(event:KeyboardEvent,index:number){if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?0:event.key==='End'?tabs.value.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.value.length)%tabs.value.length;selectedTab.value=tabs.value[target]!.id;nextTick(()=>panel.value?.querySelector<HTMLElement>('#logistics-filter-tab-'+selectedTab.value)?.focus())}
</script>
<template>
 <Teleport to="body"><div v-if="store.filtersOpen" class="filter-modal-overlay" @click.self="close" @keydown.esc="close">
  <form ref="panel" class="filter-modal-dialog" role="dialog" aria-modal="true" aria-label="Filtros de formação de cargas" tabindex="-1" @keydown="trap" @submit.prevent="apply" novalidate>
   <header class="filter-modal-header"><div class="filter-modal-heading"><span class="filter-modal-heading-icon"><AppIcon name="filter"/></span><div><h2 class="filter-modal-title">Configuração de Filtros Avançados</h2><p class="filter-modal-subtitle">Formação de cargas · selecione os filtros nas abas ou utilize um preset deste navegador.</p></div></div><button type="button" class="filter-modal-close" aria-label="Fechar filtros" title="Fechar filtros" @click="close"><AppIcon name="close"/></button></header>
   <div class="filter-modal-presets">
    <div><label class="sr-only" for="logistics-preset">Presets</label><select id="logistics-preset" v-model="presetId" class="filter-control-select" @change="usePreset"><option value="">-- Presets Salvos --</option><option v-for="preset in presets" :key="preset.id" :value="preset.id">{{preset.name}}</option></select></div>
    <div><label class="sr-only" for="logistics-preset-name">Novo preset</label><input id="logistics-preset-name" v-model="presetName" class="filter-control-input" maxlength="80" placeholder="Nome do preset..."></div>
    <div><button type="button" class="filter-preset-action filter-preset-save" aria-label="Salvar preset" :disabled="!presetName.trim()" @click="savePreset"><AppIcon name="bookmark"/>Salvar</button></div>
    <div v-if="presetId"><button type="button" class="filter-preset-action filter-preset-delete" aria-label="Excluir preset" @click="deletePreset"><AppIcon name="trash"/>Excluir</button></div>
   </div>
   <hr class="filter-modal-divider">
   <nav class="filter-modal-tabs" role="tablist" aria-label="Categorias de filtros"><button v-for="(tab,index) in tabs" :id="'logistics-filter-tab-'+tab.id" :key="tab.id" type="button" class="filter-tab-button" :class="{'is-active':selectedTab===tab.id}" role="tab" :aria-label="tab.label" :aria-selected="selectedTab===tab.id" aria-controls="logistics-filter-panel" :tabindex="selectedTab===tab.id?0:-1" @keydown="tabKey($event,index)" @click="selectedTab=tab.id"><AppIcon :name="tab.icon"/><span>{{tab.label}}</span><span v-if="tab.count" class="filter-tab-badge">({{tab.count}})</span></button></nav>
   <div class="filter-modal-body">
    <div id="logistics-filter-panel" :key="selectedTab" class="filter-tab-panel" role="tabpanel" :aria-labelledby="'logistics-filter-tab-'+selectedTab">
     <div v-if="selectedTab==='period'" class="period-tab-content">
      <div><div class="period-shortcuts-heading"><p class="period-shortcuts-title">Atalhos de {{shortcutTarget==='forecast'?'previsão de faturamento':'emissão do pedido'}}</p><label class="period-shortcut-target">Aplicar atalhos em<select v-model="shortcutTarget" class="filter-control-select" aria-label="Aplicar atalhos em"><option value="forecast">Previsão de faturamento</option><option value="emission">Emissão do pedido</option></select></label></div><div class="period-shortcuts-grid"><button type="button" class="period-shortcut-btn" @click="quickPeriod('today')">Hoje</button><button type="button" class="period-shortcut-btn" @click="quickPeriod('month')">Este Mês</button><button type="button" class="period-shortcut-btn" @click="quickPeriod('previous')">Mês Passado</button><button type="button" class="period-shortcut-btn" @click="quickPeriod('year')">Ano {{currentYear}}</button><button type="button" class="period-shortcut-btn" @click="clearPeriod">Limpar Período</button></div></div>
      <hr class="filter-modal-divider">
      <div class="period-date-grids"><div class="period-date-col"><p class="section-title">Emissão do pedido</p><div class="period-inputs-row"><label class="date-field-label">De<input v-model="draft.emissionStart" class="filter-control-input" type="date" aria-label="Emissão inicial"></label><label class="date-field-label">Até<input v-model="draft.emissionEnd" class="filter-control-input" type="date" aria-label="Emissão final"></label></div></div><div class="period-date-col"><p class="section-title">Previsão de faturamento do pedido</p><div class="period-inputs-row"><label class="date-field-label">De<input v-model="draft.forecastStart" :disabled="draft.forecastStatus==='undated'" class="filter-control-input" type="date" aria-label="Previsão inicial"></label><label class="date-field-label">Até<input v-model="draft.forecastEnd" :disabled="draft.forecastStatus==='undated'" class="filter-control-input" type="date" aria-label="Previsão final"></label></div></div></div>
      <div class="location-grid"><label class="date-field-label">Situação da previsão<select v-model="draft.forecastStatus" class="filter-control-select" aria-label="Situação da previsão" @change="forecastChanged"><option value="">Todas as previsões</option><option v-for="(label,key) in logisticsForecastLabels" :key="key" :value="key">{{label}}</option></select></label><label class="date-field-label">Tempo mínimo em aberto (dias)<input :value="draft.ageMin" @input="draft.ageMin = ($event.target as HTMLInputElement).value" type="number" min="0" max="10000" step="1" class="filter-control-input" aria-label="Tempo mínimo em aberto (dias)" placeholder="Sem limite mínimo"></label></div>
      <p class="logistics-filter-hint">A situação da previsão considera a referência da publicação: {{store.dashboard?.referenceDate.split('-').reverse().join('/')}}. É possível preencher apenas a data inicial ou final.</p>
     </div>
     <div v-else-if="selectedTab==='location'" class="location-grid"><MultiSelect label="Estado (UF)" :options="store.dashboard?.options?.ufs||[]" :model-value="categoryValues(draft.uf)" @update:model-value="setCategory('uf',$event)"/><MultiSelect label="Cidade" :options="store.dashboard?.options?.cities||[]" :model-value="categoryValues(draft.city)" @update:model-value="setCategory('city',$event)"/></div>
     <div v-else-if="selectedTab==='orders'" class="commercial-tab-content">
      <div class="location-grid"><label class="date-field-label">Buscar pedido, carga ou item<input v-model="draft.search" class="filter-control-input" aria-label="Buscar pedido, carga ou item" maxlength="100" placeholder="Código de pedido, carga, item, produto ou cliente"></label><label class="date-field-label">Empresa<select v-model="draft.company" class="filter-control-select" aria-label="Empresa"><option value="">Todas as empresas</option><option v-for="company in store.dashboard?.companies||[]" :key="company" :value="company">Empresa {{company}}</option></select></label></div>
      <div class="commercial-clients-grid"><MultiSelect label="Cliente" :options="store.dashboard?.options?.clients||[]" :model-value="categoryValues(draft.client)" @update:model-value="setCategory('client',$event)"/><MultiSelect label="Status do ERP" :options="store.dashboard?.options?.statuses||[]" :model-value="categoryValues(draft.erpStatus)" @update:model-value="setCategory('erpStatus',$event)"/><MultiSelect label="Código do produto" :options="store.dashboard?.options?.products||[]" :model-value="categoryValues(draft.product)" @update:model-value="setCategory('product',$event)"/></div>
      <p class="logistics-filter-hint">O filtro de produto seleciona pedidos que contêm os códigos escolhidos e mantém todos os itens e saldos desses pedidos.</p>
     </div>
     <div v-else-if="selectedTab==='loads'" class="commercial-tab-content"><div class="location-grid">
      <label class="date-field-label">Situação de alocação<select v-model="draft.status" class="filter-control-select" aria-label="Situação de alocação"><option value="">Todas as situações</option><option value="none">Sem carga</option><option value="partial">Parcialmente alocado</option><option value="full">Totalmente alocado</option></select></label>
      <label class="date-field-label">Etapa da carga vinculada<select v-model="draft.loadStage" class="filter-control-select" aria-label="Etapa da carga vinculada"><option value="">Todas as etapas</option><option v-for="value in store.dashboard?.options?.loadStages||[]" :key="value" :value="value">{{value}}</option></select></label>
      <MultiSelect label="Entregar / retirar" :options="['Entrega','Retirada','Não informado']" :model-value="categoryValues(draft.delivery)" @update:model-value="setCategory('delivery',$event)"/>
      </div><p class="logistics-filter-hint">A etapa seleciona pedidos com saldo em uma carga nessa etapa. Todas as cargas vinculadas a esses pedidos permanecem visíveis para preservar seus saldos.</p></div>
     <div v-else-if="selectedTab==='numeric'" class="commercial-tab-content"><div class="numeric-grid">
      <label class="numeric-field-label">Quantidade mínima sem carga<input :value="draft.freeQuantityMin" @input="draft.freeQuantityMin = ($event.target as HTMLInputElement).value" type="number" min="0" step="any" class="filter-control-input" aria-label="Quantidade mínima sem carga" placeholder="Sem limite mínimo"></label>
      <label class="numeric-field-label">Valor mínimo do pedido (R$)<input :value="draft.orderValueMin" @input="draft.orderValueMin = ($event.target as HTMLInputElement).value" type="number" min="0" step="0.01" class="filter-control-input" aria-label="Valor mínimo do pedido (R$)" placeholder="Sem limite mínimo"></label>
      <label class="numeric-field-label">Cubagem mínima sem carga (m³)<input :value="draft.freeVolumeMin" @input="draft.freeVolumeMin = ($event.target as HTMLInputElement).value" type="number" min="0" step="any" class="filter-control-input" aria-label="Cubagem mínima sem carga (m³)" placeholder="Sem limite mínimo"></label>
      <label class="numeric-field-label">Peso mínimo sem carga (kg)<input :value="draft.freeWeightMin" @input="draft.freeWeightMin = ($event.target as HTMLInputElement).value" type="number" min="0" step="any" class="filter-control-input" aria-label="Peso mínimo sem carga (kg)" placeholder="Sem limite mínimo"></label>
      </div><p class="logistics-filter-hint">Os mínimos são comparados ao saldo do pedido. Pedidos com medidas indisponíveis ficam fora da comparação correspondente. Saldo sem carga não representa estoque disponível.</p></div>
    </div>
    <p v-if="feedback" class="filter-feedback" :class="{'is-error':feedbackKind==='error'}" :role="feedbackKind==='error'?'alert':'status'">{{feedback}}</p>
   </div>
   <footer class="filter-modal-footer"><button type="button" class="modal-footer-btn btn-cancel" @click="close">Cancelar</button><button type="button" class="modal-footer-btn btn-clear-all" aria-label="Limpar filtros" :disabled="store.loading" @click="clear"><AppIcon name="trash"/>Limpar Todos</button><button type="submit" class="modal-footer-btn btn-apply-filters" aria-label="Aplicar filtros" :disabled="store.loading"><AppIcon name="check"/>Aplicar Filtros</button></footer>
  </form>
 </div></Teleport>
</template>
<style scoped>
.logistics-filter-hint{margin:0;color:var(--filter-muted);font-size:12px;line-height:1.6}
</style>


