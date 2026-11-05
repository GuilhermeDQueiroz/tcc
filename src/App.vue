<script setup lang="ts">
import {ref,computed,watch,nextTick} from 'vue'
import {useRoute} from 'vue-router'
import {useAnalyticsStore} from './stores/analytics'
import {useLogisticsStore} from './stores/logistics'
import {useStrategicStore} from './stores/strategic'
import {useAftersalesStore,aftersalesTitles,type AftersalesArea} from './stores/posvenda'
import {areas} from './types/analytics'
import FilterDrawer from './components/filters/FilterDrawer.vue'
import GoalsDialog from './components/analytics/GoalsDialog.vue'
import AppIcon from './components/ui/AppIcon.vue'
import logo from './assets/favicon-legacy.svg'
const store=useAnalyticsStore(),filtersOpen=ref(false),goalsOpen=ref(false),menuOpen=ref(false),collapsed=ref(false)
const logistics=useLogisticsStore(),route=useRoute(),isLogistics=computed(()=>route.path==='/cargas')
const strategic=useStrategicStore(),isStrategic=computed(()=>route.path==='/estrategico')
const aftersales=useAftersalesStore(),isAftersales=computed(()=>Object.keys(aftersalesTitles).includes(route.path.slice(1)))
const navigation=[
 {path:'/estrategico',label:'Visão Estratégica',icon:'line'},
 ...areas.filter(area=>area.id!=='emitidos').map(area=>({path:'/'+area.id,label:area.label,icon:area.id==='abertos'?'hourglass':'receipt'})),
 {path:'/cargas',label:'Formação de Cargas',icon:'truck'},
 ...Object.entries(aftersalesTitles).map(([id,label])=>({path:'/'+id,label:id==='cancelamentos'?'Cancelamentos':label,icon:id==='assistencias'?'settings':id==='cancelamentos'?'close':'box'}))
]
const activeArea=computed(()=>route.path.slice(1))
const isBilled=computed(()=>route.path==='/faturados')
const title=computed(()=>isAftersales.value?aftersalesTitles[route.path.slice(1) as AftersalesArea]:isStrategic.value?'Visão Estratégica':isLogistics.value?'Formação de Cargas':isBilled.value?'Análise Logística dos Pedidos Faturados':areas.find(area=>area.id===activeArea.value)?.label || 'Dashboard TCC')
const filterCount=computed(()=>isAftersales.value?aftersales.filterCount:isStrategic.value?strategic.filterCount:isLogistics.value?logistics.filterCount:store.filterCount)
const loading=computed(()=>isAftersales.value?aftersales.loading:isStrategic.value?strategic.loading:isLogistics.value?logistics.loading:store.loading)
const activeFiltersOpen=computed(()=>isAftersales.value?aftersales.filtersOpen:isStrategic.value?strategic.filtersOpen:isLogistics.value?logistics.filtersOpen:filtersOpen.value)
function closeDialogs(){filtersOpen.value=false;goalsOpen.value=false;logistics.filtersOpen=false;strategic.filtersOpen=false;aftersales.filtersOpen=false}
function openFilters(){closeDialogs();menuOpen.value=false;if(isAftersales.value)aftersales.filtersOpen=true;else if(isStrategic.value)strategic.filtersOpen=true;else if(isLogistics.value)logistics.filtersOpen=true;else filtersOpen.value=true}
watch(()=>route.path,()=>{closeDialogs();menuOpen.value=false;void nextTick(()=>document.querySelector('.main-shell main')?.scrollTo({top:0}))})
function navigateMenu(event:KeyboardEvent){
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
 const links=Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLAnchorElement>('a'))
 const index=links.indexOf(document.activeElement as HTMLAnchorElement);if(index<0)return
 event.preventDefault()
 links[event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length]?.focus()
}
function closeMenu(){menuOpen.value=false;void nextTick(()=>document.querySelector<HTMLElement>('.mobile-menu')?.focus())}
function refresh(){if(isAftersales.value)void aftersales.load();else if(isStrategic.value)void strategic.load();else if(isLogistics.value)void logistics.load();else void store.load()}
const areaIcons:Record<string,string>={abertos:'hourglass',emitidos:'cart',faturados:'receipt'}
const lastUpdate=computed(()=>{
 const published=isAftersales.value?aftersales.dashboard?.meta.publishedAt:isStrategic.value?strategic.dashboard?.meta.publishedAt:isLogistics.value?logistics.dashboard?.meta.publishedAt:store.dashboard?.meta.publishedAt
 if(typeof published!=='string')return null
 const date=new Date(published)
 if(Number.isNaN(date.getTime()))return null
 return {iso:date.toISOString(),label:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date).replace(',',' às')}
})
</script>
<template>
<div class="app-shell" :class="{'sidebar-collapsed':collapsed}">
 <Transition name="sidebar-backdrop"><div v-if="menuOpen" class="menu-backdrop" @click="menuOpen=false"></div></Transition>
 <aside id="app-sidebar" class="sidebar" :class="{'mobile-open':menuOpen}" @keydown.esc="closeMenu">
  <div class="sidebar-brand-row"><RouterLink to="/abertos" class="brand" aria-label="TCC · Inteligência Logística" @click="menuOpen=false"><img :src="logo" alt="TCC · Inteligência Logística"></RouterLink><button class="close-mobile-menu" aria-label="Fechar menu" @click="menuOpen=false">×</button></div>
  <div class="sidebar-caption">Business Intelligence</div>
  <hr class="sidebar-separator sidebar-menu-separator">
  <nav aria-label="Áreas do dashboard" @keydown="navigateMenu"><RouterLink v-for="item in navigation" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" @click="menuOpen=false"><AppIcon :name="item.icon"/><span class="nav-label">{{item.label}}</span></RouterLink></nav>
  <div class="sidebar-footer">
   <hr class="sidebar-separator sidebar-filter-separator">
   <button class="sidebar-filter" title="Filtros Avançados" aria-label="Filtros Avançados" aria-haspopup="dialog" aria-controls="advanced-filter-dialog" :aria-expanded="activeFiltersOpen" @click="openFilters"><AppIcon name="filter"/><span>Filtros Avançados</span><span v-if="filterCount" class="filter-count">{{filterCount}}</span></button>
   <button v-if="!isLogistics && !isStrategic && !isAftersales && store.area==='emitidos'" class="sidebar-refresh" title="Metas" @click="goalsOpen=true"><AppIcon name="target"/><span>Metas</span></button>
   <button class="sidebar-refresh" title="Atualizar dados" :disabled="loading" @click="refresh"><AppIcon name="refresh"/><span>Atualizar dados</span></button>
   <div class="sidebar-last-update" :title="lastUpdate ? 'Publicação da última carga do Apache Hop' : 'Horário da carga ainda não disponível'"><span><i aria-hidden="true">●</i> Última atualização:</span><time v-if="lastUpdate" :datetime="lastUpdate.iso">{{lastUpdate.label}}</time><span v-else>—</span></div>
   <button class="collapse-menu" :aria-label="collapsed?'Expandir menu':'Recolher menu'" :title="collapsed?'Expandir menu':'Recolher menu'" @click="collapsed=!collapsed"><svg viewBox="0 0 24 24" aria-hidden="true" :class="{rotated:collapsed}"><path d="m11 19-7-7 7-7m7 14-7-7 7-7"/></svg><span>{{collapsed?'Expandir menu':'Recolher menu'}}</span></button>
  </div>
 </aside>
 <div class="main-shell"><header class="app-header"><div class="header-context"><button class="mobile-menu icon-button" aria-label="Abrir menu" aria-controls="app-sidebar" :aria-expanded="menuOpen" @click="menuOpen=!menuOpen">☰</button><span class="module-icon"><AppIcon  :name="isAftersales?'box':isStrategic?'line':isLogistics?'truck':areaIcons[activeArea]"/></span><h1>{{isAftersales||isLogistics||isStrategic||isBilled?title:'Análise de '+title}}</h1></div><div class="header-actions"><button class="header-filter-btn" :class="{'has-active-filters':filterCount,'is-open':activeFiltersOpen}" aria-label="Filtros" :title="filterCount?`Filtros · ${filterCount} ativos`: 'Abrir filtros'" aria-haspopup="dialog" aria-controls="advanced-filter-dialog" :aria-expanded="activeFiltersOpen" @click="openFilters"><AppIcon name="filter"/><span>Filtros</span><span v-if="filterCount" class="filter-count" :aria-label="`${filterCount} seleções aplicadas`">{{filterCount}}</span></button></div></header><main><RouterView /></main><div v-if="!isLogistics && !isStrategic && !isAftersales && store.notice" role="status" class="notification">{{store.notice}}<button aria-label="Fechar aviso" @click="store.notice=''">×</button></div></div>
 <FilterDrawer :open="!isLogistics && !isStrategic && !isAftersales && filtersOpen" @close="filtersOpen=false"/><GoalsDialog :open="!isLogistics && !isStrategic && !isAftersales && store.area==='emitidos' && goalsOpen" @close="goalsOpen=false"/>
</div>
</template>
