<script setup lang="ts">
import {ref,computed} from 'vue'
import {useRoute} from 'vue-router'
import {useAnalyticsStore} from './stores/analytics'
import {useLogisticsStore} from './stores/logistics'
import {useStrategicStore} from './stores/strategic'
import {areas} from './types/analytics'
import FilterDrawer from './components/filters/FilterDrawer.vue'
import GoalsDialog from './components/analytics/GoalsDialog.vue'
import AppIcon from './components/ui/AppIcon.vue'
import logo from './assets/favicon-legacy.svg'
const store=useAnalyticsStore(),filtersOpen=ref(false),goalsOpen=ref(false),menuOpen=ref(false),collapsed=ref(false)
const logistics=useLogisticsStore(),route=useRoute(),isLogistics=computed(()=>route.path==='/cargas')
const strategic=useStrategicStore(),isStrategic=computed(()=>route.path==='/estrategico')
const navigation=areas.filter(area=>area.id!=='emitidos')
const title=computed(()=>isStrategic.value?'Visão Estratégica':isLogistics.value?'Formação de Cargas':areas.find(area=>area.id===store.area)?.label || 'Dashboard TCC')
const filterCount=computed(()=>isStrategic.value?strategic.filterCount:isLogistics.value?logistics.filterCount:store.filterCount)
const loading=computed(()=>isStrategic.value?strategic.loading:isLogistics.value?logistics.loading:store.loading)
function openFilters(){if(isStrategic.value)strategic.filtersOpen=true;else if(isLogistics.value)logistics.filtersOpen=true;else filtersOpen.value=true}
function refresh(){if(isStrategic.value)void strategic.load();else if(isLogistics.value)void logistics.load();else void store.load()}
const areaIcons:Record<string,string>={abertos:'hourglass',emitidos:'cart',faturados:'receipt'}
const lastUpdate=computed(()=>{
 const published=isStrategic.value?strategic.dashboard?.meta.publishedAt:isLogistics.value?logistics.dashboard?.meta.publishedAt:store.dashboard?.meta.publishedAt
 if(typeof published!=='string')return null
 const date=new Date(published)
 if(Number.isNaN(date.getTime()))return null
 return {iso:date.toISOString(),label:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date).replace(',',' às')}
})
</script>
<template>
<div class="app-shell" :class="{'sidebar-collapsed':collapsed}">
 <Transition name="sidebar-backdrop"><div v-if="menuOpen" class="menu-backdrop" @click="menuOpen=false"></div></Transition>
 <aside class="sidebar" :class="{'mobile-open':menuOpen}">
  <div class="sidebar-brand-row"><RouterLink to="/abertos" class="brand" aria-label="TCC · Inteligência Logística" @click="menuOpen=false"><img :src="logo" alt="TCC · Inteligência Logística"></RouterLink><button class="close-mobile-menu" aria-label="Fechar menu" @click="menuOpen=false">×</button></div>
  <div class="sidebar-caption">Business Intelligence</div>
  <hr class="sidebar-separator sidebar-menu-separator">
  <nav aria-label="Áreas do dashboard"><RouterLink to="/estrategico" title="Visão Estratégica" @click="menuOpen=false"><AppIcon name="line"/><span class="nav-label">Visão Estratégica</span></RouterLink><RouterLink v-for="area in navigation" :key="area.id" :to="`/${area.id}`" :title="area.label" @click="menuOpen=false"><AppIcon :name="areaIcons[area.id]"/><span class="nav-label">{{area.label}}</span></RouterLink><RouterLink to="/cargas" title="Formação de Cargas" @click="menuOpen=false"><AppIcon name="truck"/><span class="nav-label">Formação de Cargas</span></RouterLink></nav>
  <div class="sidebar-footer">
   <hr class="sidebar-separator sidebar-filter-separator">
   <button class="sidebar-filter" title="Filtros Avançados" aria-label="Filtros Avançados" @click="openFilters"><AppIcon name="filter"/><span>Filtros Avançados</span><span v-if="filterCount" class="filter-count">{{filterCount}}</span></button>
   <button v-if="!isLogistics && !isStrategic && store.area!=='abertos'" class="sidebar-refresh" title="Metas" @click="goalsOpen=true"><AppIcon name="target"/><span>Metas</span></button>
   <button class="sidebar-refresh" title="Atualizar dados" :disabled="loading" @click="refresh"><AppIcon name="refresh"/><span>Atualizar dados</span></button>
   <div class="sidebar-last-update" :title="lastUpdate ? 'Publicação da última carga do Apache Hop' : 'Horário da carga ainda não disponível'"><span><i aria-hidden="true">●</i> Última atualização:</span><time v-if="lastUpdate" :datetime="lastUpdate.iso">{{lastUpdate.label}}</time><span v-else>—</span></div>
   <button class="collapse-menu" :aria-label="collapsed?'Expandir menu':'Recolher menu'" :title="collapsed?'Expandir menu':'Recolher menu'" @click="collapsed=!collapsed"><svg viewBox="0 0 24 24" aria-hidden="true" :class="{rotated:collapsed}"><path d="m11 19-7-7 7-7m7 14-7-7 7-7"/></svg><span>{{collapsed?'Expandir menu':'Recolher menu'}}</span></button>
  </div>
 </aside>
 <div class="main-shell"><header class="app-header"><div class="header-context"><button class="mobile-menu icon-button" aria-label="Abrir menu" @click="menuOpen=!menuOpen">☰</button><span class="module-icon"><AppIcon  :name="isStrategic?'line':isLogistics?'truck':areaIcons[store.area]"/></span><h1>{{isLogistics||isStrategic?title:'Análise de '+title}}</h1></div><div class="header-actions"><button class="header-filter-btn" aria-label="Filtros" title="Filtros" @click="openFilters"><AppIcon name="filter"/><span>Filtros</span><span v-if="filterCount" class="filter-count">{{filterCount}}</span></button></div></header><main><RouterView /></main><div v-if="!isLogistics && !isStrategic && store.notice" role="status" class="notification">{{store.notice}}<button aria-label="Fechar aviso" @click="store.notice=''">×</button></div></div>
 <FilterDrawer :open="!isLogistics && !isStrategic && filtersOpen" @close="filtersOpen=false"/><GoalsDialog :open="!isLogistics && !isStrategic && goalsOpen" @close="goalsOpen=false"/>
</div>
</template>
