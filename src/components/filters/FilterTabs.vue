<script setup lang="ts">
import {ref,nextTick} from 'vue'
import AppIcon from '../ui/AppIcon.vue'
const props=defineProps<{modelValue:string;tabs:{id:string;label:string;icon:string;count?:number;ariaLabel?:string}[];prefix:string;panelId:string}>()
const emit=defineEmits<{'update:modelValue':[value:string]}>()
const navigation=ref<HTMLElement>()
async function select(id:string,focus=false){
 emit('update:modelValue',id);await nextTick()
 const tab=navigation.value?.querySelector<HTMLElement>(`#${props.prefix}-${id}`)
 if(focus)tab?.focus({preventScroll:true})
 tab?.scrollIntoView({block:'nearest',inline:'nearest'})
}
function keydown(event:KeyboardEvent,index:number){
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return
 event.preventDefault()
 const target=event.key==='Home'?0:event.key==='End'?props.tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+props.tabs.length)%props.tabs.length
 void select(props.tabs[target]!.id,true)
}
</script>
<template>
 <nav ref="navigation" class="filter-modal-tabs" role="tablist" aria-label="Categorias de filtros">
  <button v-for="(tab,index) in tabs" :id="`${prefix}-${tab.id}`" :key="tab.id" type="button" class="filter-tab-button" :class="{'is-active':modelValue===tab.id}" role="tab" :aria-label="tab.ariaLabel||tab.label" :aria-selected="modelValue===tab.id" :aria-controls="panelId" :tabindex="modelValue===tab.id?0:-1" @keydown="keydown($event,index)" @click="select(tab.id)"><AppIcon :name="tab.icon"/><span>{{tab.label}}</span><span v-if="tab.count" class="filter-tab-badge">({{tab.count}})</span></button>
 </nav>
</template>
