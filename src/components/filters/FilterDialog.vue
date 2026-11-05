<script setup lang="ts">
import {ref,watch,nextTick,onBeforeUnmount} from 'vue'
import AppIcon from '../ui/AppIcon.vue'
const props=withDefaults(defineProps<{open:boolean;label:string;subtitle?:string;section?:string;busy?:boolean}>(),{subtitle:''})
const emit=defineEmits<{close:[];apply:[]}>()
const panel=ref<HTMLElement>(),body=ref<HTMLElement>()
let previousFocus:HTMLElement|null=null,overflow='',locked=false,openedPath=''
function release(){if(locked){document.body.style.overflow=overflow;locked=false}}
function visible(element:HTMLElement|null){
 if(!element?.isConnected||getComputedStyle(element).visibility==='hidden')return false
 const rect=element.getBoundingClientRect()
 return rect.width>0&&rect.height>0&&rect.right>0&&rect.left<innerWidth&&rect.bottom>0&&rect.top<innerHeight
}
watch(()=>props.open,async open=>{
 if(open){
  previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null
  overflow=document.body.style.overflow;locked=true;openedPath=location.pathname;document.body.style.overflow='hidden'
  await nextTick();if(props.open)panel.value?.focus({preventScroll:true})
 }else{
  release();await nextTick()
  if(props.open||document.querySelector('.filter-modal-dialog')||openedPath!==location.pathname)return
  const target=visible(previousFocus)?previousFocus:document.querySelector<HTMLElement>('.header-filter-btn')
  if(visible(target))target?.focus({preventScroll:true})
 }
},{immediate:true})
watch(()=>props.section,()=>nextTick(()=>body.value?.scrollTo({top:0})))
onBeforeUnmount(release)
function keydown(event:KeyboardEvent){
 if(event.defaultPrevented)return
 if(event.key==='Escape'){event.preventDefault();event.stopPropagation();emit('close');return}
 if(event.key==='Enter'&&event.target instanceof HTMLInputElement&&event.target.getAttribute('role')!=='combobox'){
  event.preventDefault();emit('apply');return
 }
 if(event.key!=='Tab')return
 const items=Array.from(panel.value?.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')||[]).filter(element=>!element.hasAttribute('disabled')&&element.tabIndex>=0&&visible(element))
 const first=items[0],last=items.at(-1)
 if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.value)){event.preventDefault();last?.focus()}
 else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===panel.value)){event.preventDefault();first?.focus()}
}
</script>
<template>
 <Teleport to="body">
  <div v-if="open" class="filter-modal-overlay" @click.self="emit('close')" @keydown="keydown">
   <section id="advanced-filter-dialog" ref="panel" class="filter-modal-dialog" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1">
    <header class="filter-modal-header">
     <div class="filter-modal-heading"><span class="filter-modal-heading-icon"><AppIcon name="filter"/></span><div><h2 class="filter-modal-title">Filtros avançados</h2><p class="filter-modal-subtitle">{{subtitle}}</p></div></div>
     <button type="button" class="filter-modal-close" aria-label="Fechar filtros" title="Fechar filtros" @click="emit('close')"><AppIcon name="close"/></button>
    </header>
    <slot name="presets"/>
    <slot name="tabs"/>
    <div ref="body" class="filter-modal-body" :aria-busy="busy||undefined"><slot/></div>
    <footer class="filter-modal-footer"><slot name="footer"/></footer>
   </section>
  </div>
 </Teleport>
</template>
