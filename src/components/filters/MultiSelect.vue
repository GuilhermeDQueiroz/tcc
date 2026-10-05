<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, useId } from 'vue'
import AppIcon from '../ui/AppIcon.vue'
import './multi-select.css'
const props=withDefaults(defineProps<{label:string;modelValue:string[];options?:string[];placeholder?:string}>(),{options:()=>[],placeholder:''})
const emit=defineEmits<{'update:modelValue':[value:string[]]}>()
const id=useId(),isOpen=ref(false),search=ref(''),highlighted=ref(-1),limit=ref(40)
const container=ref<HTMLElement>(),input=ref<HTMLInputElement>(),menu=ref<HTMLElement>()
const opensAbove=ref(false),menuHeight=ref(216)
const fold=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR')
const filtered=computed(()=>{const term=fold(search.value.trim());return term ? props.options.filter(value=>fold(value).includes(term)) : props.options})
const visible=computed(()=>filtered.value.slice(0,limit.value))
const placeholder=computed(()=>props.modelValue.length ? '' : props.placeholder || `Filtrar por ${props.label.toLocaleLowerCase('pt-BR')}…`)
watch([search,()=>props.options],()=>{highlighted.value=-1;limit.value=40;nextTick(()=>{if(menu.value)menu.value.scrollTop=0})})
function placeMenu(){
 const rect=container.value?.getBoundingClientRect();if(!rect)return
 const body=container.value?.closest('.filter-modal-body')?.getBoundingClientRect()
 const bottom=Math.min(window.innerHeight-12,body?.bottom ?? window.innerHeight-12)
 const top=Math.max(12,body?.top ?? 12),below=bottom-rect.bottom-6,above=rect.top-top-6
 opensAbove.value=below<150 && above>below
 menuHeight.value=Math.min(216,Math.max(80,opensAbove.value ? above : below))
}
function open(){isOpen.value=true;placeMenu()}
function focusInput(){input.value?.focus();open()}
function close(){isOpen.value=false;highlighted.value=-1}
function toggleDropdown(){if(isOpen.value)close();else focusInput()}
function toggleOption(value:string){
 emit('update:modelValue',props.modelValue.includes(value) ? props.modelValue.filter(item=>item!==value) : [...props.modelValue,value])
 // Keep keyboard focus in the same list while multiple values are selected.
 nextTick(()=>input.value?.focus())
}
function remove(value:string){emit('update:modelValue',props.modelValue.filter(item=>item!==value))}
function clear(){emit('update:modelValue',[]);search.value='';nextTick(()=>input.value?.focus())}
async function keydown(event:KeyboardEvent){
 if(event.key==='Escape' && isOpen.value){event.preventDefault();event.stopPropagation();close();return}
 if(event.key==='Tab'){close();return}
 if(event.key==='Backspace' && !search.value && props.modelValue.length){remove(props.modelValue.at(-1)!);return}
 if(event.key==='ArrowDown' || event.key==='ArrowUp'){
  event.preventDefault();open();if(!filtered.value.length)return
  highlighted.value=event.key==='ArrowDown' ? (highlighted.value+1)%filtered.value.length : highlighted.value<=0 ? filtered.value.length-1 : highlighted.value-1
  limit.value=Math.max(limit.value,highlighted.value+1)
  await nextTick();menu.value?.querySelector(`#${id}-option-${highlighted.value}`)?.scrollIntoView({block:'nearest'});return
 }
 if(event.key==='Enter' && isOpen.value){event.preventDefault();if(highlighted.value>=0 && filtered.value[highlighted.value])toggleOption(filtered.value[highlighted.value]!)}
}
function outside(event:MouseEvent){if(!container.value?.contains(event.target as Node))close()}
function leaveFocus(event:FocusEvent){if(!container.value?.contains(event.relatedTarget as Node))close()}
function scroll(){if(menu.value && menu.value.scrollTop+menu.value.clientHeight>=menu.value.scrollHeight-32)limit.value+=40}
onMounted(()=>document.addEventListener('click',outside))
onBeforeUnmount(()=>document.removeEventListener('click',outside))
</script>
<template>
 <div ref="container" class="filter-select" @focusout="leaveFocus">
  <label :for="`${id}-input`" class="filter-select-label">{{label}}</label>
  <div class="filter-select-box" :class="{'is-open':isOpen}" @click="focusInput">
   <div class="filter-select-tags">
    <span v-for="value in modelValue" :key="value" class="filter-select-chip" :title="value">
     <span>{{value}}</span><button type="button" :aria-label="`Remover ${value}`" @click.stop="remove(value)"><AppIcon name="close"/></button>
    </span>
    <input ref="input" :id="`${id}-input`" v-model="search" class="filter-select-search" type="text" role="combobox" autocomplete="off"
     :aria-expanded="isOpen" :aria-controls="`${id}-list`" aria-autocomplete="list" :aria-activedescendant="isOpen && highlighted>=0 ? `${id}-option-${highlighted}` : undefined"
     :placeholder="placeholder" @focus="open" @keydown="keydown">
   </div>
   <div class="filter-select-controls">
    <button v-if="modelValue.length" type="button" :aria-label="`Limpar ${label}`" :title="`Limpar ${label}`" @click.stop="clear"><AppIcon name="close"/></button>
    <button type="button" tabindex="-1" :aria-label="`${isOpen ? 'Fechar' : 'Abrir'} opções de ${label}`" @click.stop="toggleDropdown"><AppIcon name="chevron-down" :class="{'is-open':isOpen}"/></button>
   </div>
  </div>
  <div v-show="isOpen" ref="menu" :id="`${id}-list`" class="filter-select-menu" :class="{'opens-above':opensAbove}" :style="{maxHeight:`${menuHeight}px`}" role="listbox" :aria-label="`Opções de ${label}`" aria-multiselectable="true" @scroll="scroll">
   <div v-for="(option,index) in visible" :key="option" :id="`${id}-option-${index}`" class="filter-select-option"
    :class="{'is-selected':modelValue.includes(option),'is-highlighted':highlighted===index}" role="option" :aria-selected="modelValue.includes(option)" :title="option" @mousedown.prevent @click.stop="toggleOption(option)">
    <span class="filter-select-check"><AppIcon v-if="modelValue.includes(option)" name="check"/></span><span class="filter-select-option-text">{{option}}</span>
   </div>
   <p v-if="!filtered.length" class="filter-select-empty">{{options.length ? 'Nenhuma opção encontrada' : 'Nenhuma opção disponível'}}</p>
   <p v-else-if="visible.length<filtered.length" class="filter-select-more">Role para ver mais opções</p>
  </div>
 </div>
</template>
