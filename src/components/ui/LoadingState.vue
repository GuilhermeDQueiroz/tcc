<script setup lang="ts">
import {ref,watch,onBeforeUnmount} from 'vue'
const props=withDefaults(defineProps<{active?:boolean;label?:string;compact?:boolean;overlay?:boolean;screen?:boolean}>(),{active:true,label:'Carregando…',compact:false,overlay:false,screen:false})
// Count time on screen, not request time: fast responses get readable feedback.
let started=performance.now()
const visible=ref(props.active)
let timer:ReturnType<typeof setTimeout>|undefined
watch(()=>props.active,active=>{
 clearTimeout(timer)
 if(active){started=performance.now();visible.value=true}
 else timer=setTimeout(()=>{visible.value=false},Math.max(0,2000-(performance.now()-started)))
})
onBeforeUnmount(()=>clearTimeout(timer))
const pending=new WeakMap<Element,Animation>()
function leave(element:Element,done:()=>void){
 const scope=element.classList.contains('loading-screen') ? document.getElementById('app') : element.closest('.filter-modal-body') || element.closest('.analysis-frame,.filter-drawer,[role="dialog"],.analytics-page') || document.getElementById('app')
 if(scope?.isConnected)window.dispatchEvent(new CustomEvent('dashboard:content-will-reveal',{detail:scope}))
 const finish=()=>{pending.delete(element);done();requestAnimationFrame(()=>{if(scope?.isConnected)window.dispatchEvent(new CustomEvent('dashboard:content-ready',{detail:scope}))})}
 const animation=element.animate([{opacity:1},{opacity:0}],{duration:350,easing:'cubic-bezier(0.16,1,0.3,1)',fill:'forwards'})
 animation.onfinish=finish
 pending.set(element,animation)
}
function cancelLeave(element:Element){pending.get(element)?.cancel();pending.delete(element)}
</script>
<template><Transition :css="false" @leave="leave" @leave-cancelled="cancelLeave"><div v-if="visible" class="loading-state smooth-loading legacy-loading" :class="{'loading-compact':compact,'loading-overlay':overlay,'loading-screen':screen}" role="status" aria-live="polite" aria-busy="true"><span class="loading-orbit loader-spinner" aria-hidden="true"></span><span class="loading-label" :class="{'loading-label-sr':screen}">{{label}}</span><div v-if="overlay && !screen && !compact" class="loading-skeleton" aria-hidden="true"><span v-for="width in [100,82,94,76]" :key="width" :style="{width:`${width}%`}"></span></div></div></Transition></template>
