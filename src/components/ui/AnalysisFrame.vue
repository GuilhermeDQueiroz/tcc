<script setup lang="ts">
import {ref,useId,onMounted,onBeforeUnmount,nextTick,watch} from 'vue'
import AppIcon from './AppIcon.vue'
import LoadingState from './LoadingState.vue'
defineOptions({inheritAttrs:false})
defineProps<{title:string;icon?:string;loading?:boolean;busy?:boolean;loadingLabel?:string}>()
const menu=ref(false),expanded=ref(false),root=ref<HTMLElement>(),trigger=ref<HTMLButtonElement>(),closeButton=ref<HTMLButtonElement>(),menuElement=ref<HTMLElement>(),id=useId()
const menuPosition=ref({top:'0px',left:'0px',width:'340px',maxHeight:'620px'})
function positionMenu(){
 if(!menu.value||!trigger.value)return
 const button=trigger.value.getBoundingClientRect(),gutter=16,gap=8,width=Math.min(340,window.innerWidth-gutter*2)
 const below=window.innerHeight-button.bottom-gap-gutter,above=button.top-gap-gutter
 const placeAbove=below<280&&above>below,available=Math.max(120,placeAbove?above:below)
 const height=Math.min(menuElement.value?.scrollHeight || 620,620,available)
 menuPosition.value={top:`${Math.max(gutter,placeAbove?button.top-gap-height:Math.min(button.bottom+gap,window.innerHeight-height-gutter))}px`,left:`${Math.max(gutter,Math.min(button.right-width,window.innerWidth-width-gutter))}px`,width:`${width}px`,maxHeight:`${Math.min(620,available,window.innerHeight-gutter*2)}px`}
}
watch(menu,async value=>{if(!value)return;await nextTick();positionMenu()})
async function expand(){menu.value=false;expanded.value=true;await nextTick();closeButton.value?.focus()}
async function close(){expanded.value=false;await nextTick();trigger.value?.focus()}
function key(event:KeyboardEvent){if(expanded.value&&event.key==='Tab'){const selector='button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]';const elements=[...Array.from(root.value?.querySelectorAll<HTMLElement>(selector) || []),...Array.from(menuElement.value?.querySelectorAll<HTMLElement>(selector) || [])].filter(element=>element.getClientRects().length);const first=elements[0],last=elements.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}if(event.key==='Escape'){if(menu.value){menu.value=false;trigger.value?.focus()}else if(expanded.value)void close()}}
function outside(event:PointerEvent){if(!root.value?.contains(event.target as Node)&&!menuElement.value?.contains(event.target as Node))menu.value=false}
onMounted(()=>{document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);window.addEventListener('resize',positionMenu);document.addEventListener('scroll',positionMenu,true)})
onBeforeUnmount(()=>{document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',positionMenu);document.removeEventListener('scroll',positionMenu,true)})
</script>
<template><Teleport to="body" :disabled="!expanded"><div v-if="expanded" class="analysis-backdrop" @click="close"></div><section ref="root" v-bind="$attrs" class="panel analysis-frame" :class="{'analysis-expanded':expanded}" :role="expanded?'dialog':undefined" :aria-modal="expanded?true:undefined" :aria-label="expanded?title:undefined" :aria-busy="loading || busy || undefined"><header class="panel-heading"><h2><AppIcon :name="icon || 'chart'"/>{{title}}</h2><div class="analysis-actions"><slot name="controls"/><button ref="trigger" class="analysis-config-trigger" :aria-label="`Configurar ${title}`" :title="`Configurar ${title}`" :aria-expanded="menu" :aria-controls="id" @click="menu=!menu"><AppIcon name="sliders"/></button><button v-if="expanded" ref="closeButton" class="icon-button" aria-label="Sair da tela cheia" title="Sair da tela cheia (Esc)" @click="close"><AppIcon name="close"/></button></div></header><div v-if="$slots.toolbar" class="analysis-toolbar"><slot name="toolbar"/></div><div class="analysis-body"><slot/><LoadingState :active="!!loading" overlay :label="loadingLabel"/></div></section></Teleport><Teleport to="body"><div v-if="menu" ref="menuElement" :id="id" class="analysis-config" :style="menuPosition" role="region" :aria-label="`Configurações de ${title}`"><header class="config-heading"><div><strong>Configurações</strong><span>{{title}}</span></div><button class="icon-button" aria-label="Fechar configurações" @click="menu=false;trigger?.focus()"><AppIcon name="close"/></button></header><div class="config-content"><slot name="config"/><div class="config-actions"><button @click="expand"><AppIcon name="expand"/>Expandir em tela cheia</button></div></div></div></Teleport></template>
