<script setup lang="ts">
import {computed} from 'vue'
import {useRoute} from 'vue-router'
import AppIcon from '../components/ui/AppIcon.vue'

const route=useRoute()
const area=computed(()=>route.path.startsWith('/assistencias')?'Assistências':'Pedidos de Venda')
</script>

<template>
 <section class="overview-placeholder" aria-labelledby="overview-placeholder-title">
  <span class="overview-placeholder-icon"><AppIcon name="overview"/></span>
  <h2 id="overview-placeholder-title">Visão Geral de {{area}}</h2>
  <p class="overview-placeholder-status">Em construção</p>
  <p>Este painel ainda não possui indicadores publicados. As análises disponíveis podem ser acessadas pelo menu lateral ou pela Home.</p>
  <RouterLink to="/">Voltar à Home</RouterLink>
 </section>
</template>

<style scoped>
.overview-placeholder{max-width:620px;margin:clamp(24px,9vh,90px) auto;padding:clamp(28px,5vw,48px);border:1px solid #dfe9dc;border-radius:18px;background:#fff;text-align:center;box-shadow:0 10px 30px #173c270b;color:#506758}
.overview-placeholder-icon{width:70px;height:70px;margin:auto auto 18px;border-radius:20px;display:grid;place-items:center;background:#e8f4df;color:#006a3a}
.overview-placeholder-icon :deep(svg){width:34px;height:34px}
.overview-placeholder h2{margin:0 0 10px;color:#183a27;font-size:clamp(20px,3vw,28px)}
.overview-placeholder-status{display:inline-block;margin:0 0 16px;padding:6px 12px;border:1px solid #d5e8c9;border-radius:999px;background:#f1f8ec;color:#006a3a;font-weight:700}
.overview-placeholder p:not(.overview-placeholder-status){line-height:1.6;margin:0 0 20px}
.overview-placeholder a{display:inline-flex;padding:10px 16px;border-radius:9px;background:#006a3a;color:#fff;text-decoration:none;font-weight:700}
.overview-placeholder a:focus-visible{outline:3px solid #8bc53f;outline-offset:3px}
</style>
