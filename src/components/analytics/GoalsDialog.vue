<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAnalyticsStore } from '../../stores/analytics'
import type { Goals } from '../../types/analytics'
const props = defineProps<{ open: boolean }>(), emit = defineEmits<{ close: [] }>(), store = useAnalyticsStore()
const draft = ref<Goals>({}), period = ref(''), error = ref(''), saving = ref(false)
const fields: Record<string,string> = { financeira:'Faturamento diário (R$)', peso:'Peso diário faturado (kg)', emissao_financeira:'Emissão diária (R$)', emissao_peso:'Peso diário emitido (kg)' }
watch(() => props.open, async open => { if (!open) return; error.value=''; try { await store.loadSettings(); draft.value = JSON.parse(JSON.stringify(store.goals)) } catch(cause) { error.value = cause instanceof Error ? cause.message : String(cause) } })
function addPeriod() { if (!/^\d{4}-\d{2}$/.test(period.value)) return; if (!draft.value[period.value]) draft.value[period.value] = { ...(draft.value.default || {}) }; period.value='' }
async function save() { saving.value=true; try { await store.saveGoals(draft.value); emit('close') } catch(cause) { error.value=cause instanceof Error ? cause.message : String(cause) } finally { saving.value=false } }
</script>
<template><Teleport to="body"><div v-if="open" class="drawer-overlay" @click.self="emit('close')" @keydown.esc="emit('close')"><section class="goals-dialog" role="dialog" aria-modal="true" aria-label="Configurar metas"><header><h2>Configurar metas</h2><button aria-label="Fechar metas" @click="emit('close')">×</button></header><div class="drawer-body"><p class="muted">Metas diárias de emissão e faturamento por período.</p><div class="inline-controls"><label>Novo período<input v-model="period" type="month"></label><button @click="addPeriod">Adicionar período</button></div><fieldset v-for="(values,key) in draft" :key="key"><legend>{{ key==='default' ? 'Padrão' : key }}</legend><label v-for="(label,field) in fields" :key="field">{{ label }}<input v-model.number="values[field]" type="number" min="0" step="0.01"></label></fieldset><p v-if="error" role="alert" class="error-box">{{ error }}</p></div><footer><button @click="emit('close')">Cancelar</button><button class="primary" :disabled="saving" @click="save">Salvar metas</button></footer></section></div></Teleport></template>
