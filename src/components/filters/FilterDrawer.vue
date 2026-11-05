<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAnalyticsStore } from '../../stores/analytics'
import { useFilterDraft, type FilterPeriod } from '../../composables/useFilterDraft'
import LoadingState from '../ui/LoadingState.vue'
import AppIcon from '../ui/AppIcon.vue'
import MultiSelect from './MultiSelect.vue'
import FilterDialog from './FilterDialog.vue'
import FilterTabs from './FilterTabs.vue'
const props=defineProps<{open:boolean}>()
const emit=defineEmits<{close:[]}>()
const store=useAnalyticsStore()
const {draft,emission,billing,valueInput,quantityInput,valueOp,quantityOp,currentYear,
 feedback,feedbackKind,message,reset,compiled,quickPeriod:applyQuickPeriod,clearPeriod,getDimensionValues,setDimensionValues,counts}=useFilterDraft()
// Open/issued DW contracts contain emission dates; billed orders contain both.
const supportsBilling=computed(()=>store.area==='faturados')
const shortcutTarget=ref<'emission'|'billing'>('emission')
function initializeDraft(filters:Parameters<typeof reset>[0]={}){
 reset(filters)
 if(!supportsBilling.value)billing.value=['','']
 shortcutTarget.value=supportsBilling.value ? 'billing' : 'emission'
}
function quickPeriod(period:FilterPeriod){applyQuickPeriod(period,shortcutTarget.value)}
const selectedTab=ref('period'),presetName=ref(''),presetId=ref('')
const saving=ref(false),deleting=ref(false)
const currentPresets=computed(()=>store.presets.filter(entry=>entry.area===store.area))
const groups=computed(()=>store.dimensions?.dimensions?.GRUPO_CLIENTE || [])
const operators=[{value:'',label:'Nenhum'},{value:'>',label:'Maior que (>)'},
 {value:'>=',label:'Maior ou igual (>=)'},{value:'<',label:'Menor que (<)'},
 {value:'<=',label:'Menor ou igual (<=)'},{value:'==',label:'Igual (==)'},{value:'!=',label:'Diferente (!=)'}]
const tabsConfig=computed(()=>[
 {id:'period',label:'Período',icon:'calendar',count:counts.value.period,ariaLabel:'Período'},
 {id:'location',label:'Localização',icon:'pin',count:counts.value.location,ariaLabel:'Localização'},
 {id:'commercial',label:'Comercial',icon:'building',count:counts.value.commercial,ariaLabel:'Comercial'},
 {id:'product',label:'Produto',icon:'box',count:counts.value.product,ariaLabel:'Produto'},
 {id:'numeric',label:'Valores',icon:'currency',count:counts.value.numeric,ariaLabel:'Valores e quantidade'}
])
watch(()=>props.open,open=>{
 if(!open)return
 initializeDraft(store.filters);presetId.value='';presetName.value=''
 void store.loadDimensions()
 store.loadSettings().catch(cause=>{if(props.open)message(cause instanceof Error?cause.message:String(cause),'error')})
})
watch(()=>store.area,()=>{selectedTab.value='period'})
function apply(){const result=compiled();if(result){store.applyFilters(result);emit('close')}}
function clear(){reset();store.applyFilters({});emit('close')}
function usePreset(){const preset=currentPresets.value.find(entry=>entry.id===presetId.value);if(preset){initializeDraft(preset.filters);message(`Preset '${preset.name}' carregado. Clique em Aplicar filtros para usá-lo.`)}}
async function savePreset(){
 if(saving.value)return
 const result=compiled();if(!result || !presetName.value.trim())return
 saving.value=true
 try{await store.savePreset(presetName.value.trim(),result);presetName.value='';message('Preset salvo com sucesso.')}
 catch(cause){message(cause instanceof Error ? cause.message : String(cause),'error')}
 finally{saving.value=false}
}
async function deletePreset(){
 if(deleting.value || !currentPresets.value.some(entry=>entry.id===presetId.value))return
 deleting.value=true
 try{await store.deletePreset(presetId.value);presetId.value='';message('Preset excluído com sucesso.')}
 catch(cause){message(cause instanceof Error ? cause.message : String(cause),'error')}
 finally{deleting.value=false}
}
</script>

<template>
 <FilterDialog :open="open" label="Filtros da análise" :subtitle="(store.area==='abertos'?'Pedidos em aberto':store.area==='faturados'?'Pedidos faturados':'Pedidos emitidos')+' · combine as categorias e aplique os filtros.'" :section="selectedTab" :busy="store.dimensionsLoading" @close="emit('close')" @apply="apply">
  <template #presets><div class="filter-modal-presets">
          <div>
            <label class="sr-only" for="preset-select">Presets</label>
            <select
              id="preset-select"
              aria-label="Presets"
              v-model="presetId"
              class="filter-control-select"
              @change="usePreset"
            >
              <option value="">-- Presets Salvos --</option>
              <option v-for="preset in currentPresets" :key="preset.id" :value="preset.id">
                {{ preset.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="sr-only" for="preset-name-input">Novo preset</label>
            <input
              id="preset-name-input"
              aria-label="Novo preset"
              v-model="presetName"
              @keydown.enter.prevent.stop="savePreset"
              placeholder="Nome do preset..."
              class="filter-control-input"
            />
          </div>

          <div>
            <button
              class="filter-preset-action filter-preset-save"
              aria-label="Salvar preset"
              :disabled="saving || deleting || !presetName.trim()"
              @click="savePreset"
            >
              <AppIcon name="bookmark" />
              <span>{{ saving ? 'Salvando...' : 'Salvar' }}</span>
            </button>
          </div>

          <div v-if="presetId">
            <button
              class="filter-preset-action filter-preset-delete"
              aria-label="Excluir preset"
              :disabled="deleting || saving"
              @click="deletePreset"
            >
              <AppIcon name="trash" />
              <span>{{deleting ? 'Excluindo…' : 'Excluir'}}</span>
            </button>
          </div>
        </div>

        <hr class="filter-modal-divider" /></template>
  <template #tabs><FilterTabs v-model="selectedTab" :tabs="tabsConfig" prefix="filter-tab" panel-id="filter-active-panel"/></template>
  <LoadingState
            :active="store.dimensionsLoading"
            overlay
            label="Carregando opções dos filtros…"
          />

          <div :key="selectedTab" id="filter-active-panel" class="filter-tab-panel" role="tabpanel" :aria-labelledby="`filter-tab-${selectedTab}`">
          <!-- Tab 1: Período -->
          <div v-if="selectedTab === 'period'" class="period-tab-content">
            <div>
              <div class="period-shortcuts-heading">
              <p class="period-shortcuts-title">Atalhos de {{shortcutTarget==='billing' ? 'faturamento' : 'emissão do pedido'}}</p>
              <label v-if="supportsBilling" class="period-shortcut-target">Aplicar atalhos em
                <select v-model="shortcutTarget" class="filter-control-select" aria-label="Aplicar atalhos em"><option value="billing">Faturamento</option><option value="emission">Emissão do pedido</option></select>
              </label>
              </div>
              <div class="period-shortcuts-grid">
                <button type="button" class="period-shortcut-btn" @click="quickPeriod('today')">
                  Hoje
                </button>
                <button type="button" class="period-shortcut-btn" @click="quickPeriod('month')">
                  Este Mês
                </button>
                <button type="button" class="period-shortcut-btn" @click="quickPeriod('previous')">
                  Mês Anterior
                </button>
                <button type="button" class="period-shortcut-btn" @click="quickPeriod('year')">
                  Ano {{currentYear}}
                </button>
                <button
                  type="button"
                  class="period-shortcut-btn"
                  @click="clearPeriod"
                >
                  Limpar Período
                </button>
              </div>
            </div>

            <hr class="filter-modal-divider" />

            <div class="period-date-grids">
              <div class="period-date-col">
                <p class="section-title">Emissão do Pedido</p>
                <div class="period-inputs-row">
                  <label class="date-field-label">
                    Emissão de
                    <input
                      v-model="emission[0]"
                      type="date"
                      aria-label="Emissão de"
                      class="filter-control-input"
                    />
                  </label>
                  <label class="date-field-label">
                    Emissão até
                    <input
                      v-model="emission[1]"
                      type="date"
                      aria-label="Emissão até"
                      class="filter-control-input"
                    />
                  </label>
                </div>
              </div>

              <div v-if="supportsBilling" class="period-date-col">
                <p class="section-title">Data da Fatura</p>
                <div class="period-inputs-row">
                  <label class="date-field-label">
                    Faturamento de
                    <input
                      v-model="billing[0]"
                      type="date"
                      aria-label="Faturamento de"
                      class="filter-control-input"
                    />
                  </label>
                  <label class="date-field-label">
                    Faturamento até
                    <input
                      v-model="billing[1]"
                      type="date"
                      aria-label="Faturamento até"
                      class="filter-control-input"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 2: Localização -->
          <div v-else-if="selectedTab === 'location'" class="location-grid">
            <MultiSelect
              label="Estado (UF)"
              :options="store.dimensions?.dimensions?.UF || []"
              :modelValue="getDimensionValues('UF')"
              @update:modelValue="setDimensionValues('UF', $event)"
            />
            <MultiSelect
              label="Região"
              :options="store.dimensions?.dimensions?.REGIAO_UF || []"
              :modelValue="getDimensionValues('REGIAO_UF')"
              @update:modelValue="setDimensionValues('REGIAO_UF', $event)"
            />
            <MultiSelect
              label="Cidade"
              :options="store.dimensions?.dimensions?.CIDADE || []"
              :modelValue="getDimensionValues('CIDADE')"
              @update:modelValue="setDimensionValues('CIDADE', $event)"
            />
            <MultiSelect
              label="Microregião"
              :options="store.dimensions?.dimensions?.MICRO_REGIAO || []"
              :modelValue="getDimensionValues('MICRO_REGIAO')"
              @update:modelValue="setDimensionValues('MICRO_REGIAO', $event)"
            />
          </div>

          <!-- Tab 3: Comercial -->
          <div v-else-if="selectedTab === 'commercial'" class="commercial-tab-content">
            <div class="commercial-grid">
              <MultiSelect
                label="Supervisor"
                :options="store.dimensions?.dimensions?.SUPERVISOR || []"
                :modelValue="getDimensionValues('SUPERVISOR')"
                @update:modelValue="setDimensionValues('SUPERVISOR', $event)"
              />
              <MultiSelect
                label="Consultor"
                :options="store.dimensions?.dimensions?.CONSULTOR || []"
                :modelValue="getDimensionValues('CONSULTOR')"
                @update:modelValue="setDimensionValues('CONSULTOR', $event)"
              />
              <MultiSelect
                label="Tipo Entrega"
                :options="store.dimensions?.dimensions?.TIPO_ENTREGA || []"
                :modelValue="getDimensionValues('TIPO_ENTREGA')"
                @update:modelValue="setDimensionValues('TIPO_ENTREGA', $event)"
              />
              <MultiSelect
                label="Classificação"
                :options="store.dimensions?.dimensions?.CLASSIFICACAO || []"
                :modelValue="getDimensionValues('CLASSIFICACAO')"
                @update:modelValue="setDimensionValues('CLASSIFICACAO', $event)"
              />
              <MultiSelect
                label="Status"
                :options="store.dimensions?.dimensions?.STATUS || []"
                :modelValue="getDimensionValues('STATUS')"
                @update:modelValue="setDimensionValues('STATUS', $event)"
              />
            </div>

            <hr class="filter-modal-divider" />

            <div class="commercial-clients-grid">
              <MultiSelect
                label="Incluir Grupo de Cliente"
                :options="groups"
                :modelValue="draft.includeGroups || []"
                @update:modelValue="draft.includeGroups = $event.length ? $event : undefined"
              />
              <MultiSelect
                label="Excluir Grupo de Cliente"
                :options="groups"
                :modelValue="draft.excludeGroups || []"
                @update:modelValue="draft.excludeGroups = $event.length ? $event : undefined"
              />
            </div>
          </div>

          <!-- Tab 4: Produto -->
          <div v-else-if="selectedTab === 'product'" class="product-grid">
            <MultiSelect
              label="Grupo Item"
              :options="store.dimensions?.dimensions?.GRUPO_ITEM || []"
              :modelValue="getDimensionValues('GRUPO_ITEM')"
              @update:modelValue="setDimensionValues('GRUPO_ITEM', $event)"
            />
            <MultiSelect
              label="Linha"
              :options="store.dimensions?.dimensions?.LINHA || []"
              :modelValue="getDimensionValues('LINHA')"
              @update:modelValue="setDimensionValues('LINHA', $event)"
            />
            <MultiSelect
              label="Subgrupo"
              :options="store.dimensions?.dimensions?.SUBGRUPO || []"
              :modelValue="getDimensionValues('SUBGRUPO')"
              @update:modelValue="setDimensionValues('SUBGRUPO', $event)"
            />
            <MultiSelect
              label="Tipo"
              :options="store.dimensions?.dimensions?.TIPO || []"
              :modelValue="getDimensionValues('TIPO')"
              @update:modelValue="setDimensionValues('TIPO', $event)"
            />
            <MultiSelect
              label="Coleção"
              :options="store.dimensions?.dimensions?.COLECAO || []"
              :modelValue="getDimensionValues('COLECAO')"
              @update:modelValue="setDimensionValues('COLECAO', $event)"
            />
          </div>

          <!-- Tab 5: Valores -->
          <div v-else-if="selectedTab === 'numeric'" class="numeric-grid">
            <div class="numeric-col">
              <p class="section-title">Valor Financeiro (R$)</p>
              <div class="numeric-inputs-row">
                <label class="numeric-field-label">
                  Operador
                  <select
                    aria-label="Operador do valor"
                    v-model="valueOp"
                    class="filter-control-select"
                  >
                    <option v-for="op in operators" :key="op.value" :value="op.value">
                      {{ op.label }}
                    </option>
                  </select>
                </label>
                <label class="numeric-field-label">
                  Valor
                  <input
                    aria-label="Valor do pedido"
                    :value="valueInput"
                    @input="valueInput = ($event.target as HTMLInputElement).value; if (!valueOp && valueInput) valueOp = '>='"
                    type="number"
                    step="0.01"
                    placeholder="Sem comparação"
                    class="filter-control-input"
                  />
                </label>
              </div>
            </div>

            <div class="numeric-col">
              <p class="section-title">Quantidade de Itens</p>
              <div class="numeric-inputs-row">
                <label class="numeric-field-label">
                  Operador
                  <select
                    aria-label="Operador da quantidade"
                    v-model="quantityOp"
                    class="filter-control-select"
                  >
                    <option v-for="op in operators" :key="op.value" :value="op.value">
                      {{ op.label }}
                    </option>
                  </select>
                </label>
                <label class="numeric-field-label">
                  Quantidade
                  <input
                    aria-label="Quantidade de itens"
                    :value="quantityInput"
                    @input="quantityInput = ($event.target as HTMLInputElement).value; if (!quantityOp && quantityInput) quantityOp = '>='"
                    type="number"
                    step="any"
                    placeholder="Sem comparação"
                    class="filter-control-input"
                  />
                </label>
              </div>
            </div>
          </div>

          </div>
          <p v-if="feedback" :role="feedbackKind==='error' ? 'alert' : 'status'" class="filter-feedback" :class="{'is-error':feedbackKind==='error'}">
            {{ feedback }}
          </p>
  <template #footer><button type="button" class="modal-footer-btn btn-cancel" @click="emit('close')">
            Cancelar
          </button>
          <button
            type="button"
            class="modal-footer-btn btn-clear-all"
            aria-label="Limpar filtros"
            @click="clear"
          >
            <AppIcon name="trash" />
            <span>Limpar filtros</span>
          </button>
          <button
            type="button"
            class="modal-footer-btn btn-apply-filters"
            aria-label="Aplicar filtros"
            @click="apply"
          >
            <AppIcon name="check" />
            <span>Aplicar filtros</span>
          </button></template>
 </FilterDialog>
</template>
