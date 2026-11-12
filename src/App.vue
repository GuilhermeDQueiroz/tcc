<script setup lang="ts">
import {ref,computed,watch,nextTick} from 'vue'
import {useRoute} from 'vue-router'
import {useAnalyticsStore} from './stores/analytics'
import {useLogisticsStore} from './stores/logistics'
import {useStrategicStore} from './stores/strategic'
import {useAftersalesStore,aftersalesTitles} from './stores/posvenda'
import FilterDrawer from './components/filters/FilterDrawer.vue'
import GoalsDialog from './components/analytics/GoalsDialog.vue'
import IndicatorsInfo from './components/analytics/IndicatorsInfo.vue'
import AppIcon from './components/ui/AppIcon.vue'
import {salesNavigation,assistanceNavigation,logisticsNavigation} from './navigation'
import logo from './assets/favicon-legacy.svg'
const isDemo=import.meta.env.MODE==='demo'
const store=useAnalyticsStore(),filtersOpen=ref(false),goalsOpen=ref(false),menuOpen=ref(false),collapsed=ref(false)
const logistics=useLogisticsStore(),route=useRoute(),isLogistics=computed(()=>route.path==='/cargas')
const isHome=computed(()=>route.path==='/')
const isPlaceholder=computed(()=>route.path==='/vendas/visao-geral'||route.path==='/assistencias/visao-geral')
const strategic=useStrategicStore(),isStrategic=computed(()=>route.path==='/estrategico')
const aftersales=useAftersalesStore(),isAftersales=computed(()=>Object.keys(aftersalesTitles).includes(route.path.slice(1)))
const salesOpen=ref(salesNavigation.some(item=>item.path.split('?')[0]===route.path)&&route.query.kind!=='Assistência')
const assistanceOpen=ref(route.path.startsWith('/assistencias')||['/devolucoes','/cancelamentos'].includes(route.path)&&route.query.kind==='Assistência')
const logisticsOpen=ref(logisticsNavigation.some(item=>item.path===route.path))
const assistanceView=computed(()=>route.query.view==='emitidas'||route.query.view==='faturadas'?route.query.view:'abertas')
function isActive(path:string,view?:string){
 if(route.path!==path.split('?')[0])return false
 if(view==='devolvidas'||view==='canceladas')return route.query.kind==='Assistência'&&route.path===path.split('?')[0]
 if(view)return assistanceView.value===view
 if(path.startsWith('/devolucoes'))return route.query.kind==='Venda'
 if(path.startsWith('/cancelamentos'))return route.query.kind!=='Assistência'
 return true
}
const activeGroup=computed(()=>assistanceNavigation.some(item=>isActive(item.path,item.view))?'assistance':salesNavigation.some(item=>isActive(item.path))?'sales':logisticsNavigation.some(item=>isActive(item.path))?'logistics':null)
function toggleSales(){
 if(activeGroup.value==='sales'&&salesOpen.value)return
 salesOpen.value=!salesOpen.value
 if(salesOpen.value){if(activeGroup.value!=='assistance')assistanceOpen.value=false;if(activeGroup.value!=='logistics')logisticsOpen.value=false}
}
function toggleAssistance(){
 if(activeGroup.value==='assistance'&&assistanceOpen.value)return
 assistanceOpen.value=!assistanceOpen.value
 if(assistanceOpen.value){if(activeGroup.value!=='sales')salesOpen.value=false;if(activeGroup.value!=='logistics')logisticsOpen.value=false}
}
function toggleLogistics(){
 if(activeGroup.value==='logistics'&&logisticsOpen.value)return
 logisticsOpen.value=!logisticsOpen.value
 if(logisticsOpen.value){if(activeGroup.value!=='sales')salesOpen.value=false;if(activeGroup.value!=='assistance')assistanceOpen.value=false}
}
const activeNavigation=computed(()=>assistanceNavigation.find(item=>isActive(item.path,item.view))||salesNavigation.find(item=>isActive(item.path))||logisticsNavigation.find(item=>isActive(item.path)))
const title=computed(()=>isHome.value?'Home':activeNavigation.value?.label||'Devoluções')
const headerIcon=computed(()=>isHome.value?'home':activeNavigation.value?.icon||'return-arrow')
const filterCount=computed(()=>isAftersales.value?aftersales.filterCount:isStrategic.value?strategic.filterCount:isLogistics.value?logistics.filterCount:store.filterCount)
const activeFiltersOpen=computed(()=>isAftersales.value?aftersales.filtersOpen:isStrategic.value?strategic.filtersOpen:isLogistics.value?logistics.filtersOpen:filtersOpen.value)
function closeDialogs(){filtersOpen.value=false;goalsOpen.value=false;logistics.filtersOpen=false;strategic.filtersOpen=false;aftersales.filtersOpen=false}
function openFilters(){closeDialogs();menuOpen.value=false;if(isAftersales.value)aftersales.filtersOpen=true;else if(isStrategic.value)strategic.filtersOpen=true;else if(isLogistics.value)logistics.filtersOpen=true;else filtersOpen.value=true}
watch(()=>[route.path,route.query.kind,route.query.view],()=>{closeDialogs();menuOpen.value=false;if(route.path.startsWith('/assistencias')||['/devolucoes','/cancelamentos'].includes(route.path)&&route.query.kind==='Assistência'){assistanceOpen.value=true;salesOpen.value=false;logisticsOpen.value=false}else if(logisticsNavigation.some(item=>item.path===route.path)){logisticsOpen.value=true;assistanceOpen.value=false;salesOpen.value=false}else if(salesNavigation.some(item=>item.path.split('?')[0]===route.path)){salesOpen.value=true;assistanceOpen.value=false;logisticsOpen.value=false}void nextTick(()=>document.querySelector('.main-shell main')?.scrollTo({top:0}))})
function navigateMenu(event:KeyboardEvent){
 if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return
 const links=Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('a,button')).filter(item=>item.getClientRects().length>0)
 const index=links.indexOf(document.activeElement as HTMLElement);if(index<0)return
 event.preventDefault()
 links[event.key==='Home'?0:event.key==='End'?links.length-1:(index+(event.key==='ArrowDown'?1:-1)+links.length)%links.length]?.focus()
}
function closeMenu(){menuOpen.value=false;void nextTick(()=>document.querySelector<HTMLElement>('.mobile-menu')?.focus())}
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
  <div class="sidebar-brand-row"><RouterLink to="/" class="brand" aria-label="TCC · Inteligência Logística" @click="menuOpen=false"><img :src="logo" alt="TCC · Inteligência Logística"></RouterLink><button class="close-mobile-menu" aria-label="Fechar menu" @click="menuOpen=false">×</button></div>
  <div class="sidebar-caption">Business Intelligence</div>
  <hr class="sidebar-separator sidebar-menu-separator">
  <nav aria-label="Áreas do dashboard" @keydown="navigateMenu">
   <RouterLink to="/" title="Home" aria-label="Home" :class="{'nav-active':isHome}" @click="menuOpen=false"><AppIcon name="home"/><span class="nav-label">Home</span></RouterLink>
   <button type="button" class="nav-group-toggle" :class="{'nav-active':activeGroup==='sales'}" aria-controls="sales-navigation" :aria-expanded="salesOpen" aria-label="Pedidos de venda" title="Pedidos de venda" @click="toggleSales"><AppIcon name="cart"/><span class="nav-label">Pedidos de venda</span><AppIcon name="chevron-down" class="nav-chevron"/></button>
   <div v-show="salesOpen" id="sales-navigation" class="nav-children"><RouterLink v-for="item in salesNavigation" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" active-class="route-match" :class="{'nav-active':isActive(item.path)}" @click="menuOpen=false"><AppIcon :name="item.icon"/><span class="nav-label">{{item.label}}</span></RouterLink></div>
   <button type="button" class="nav-group-toggle" :class="{'nav-active':activeGroup==='assistance'}" aria-controls="assistance-navigation" :aria-expanded="assistanceOpen" aria-label="Assistências" title="Assistências" @click="toggleAssistance"><AppIcon name="wrench"/><span class="nav-label">Assistências</span><AppIcon name="chevron-down" class="nav-chevron"/></button>
   <div v-show="assistanceOpen" id="assistance-navigation" class="nav-children"><RouterLink v-for="item in assistanceNavigation" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" active-class="route-match" :class="{'nav-active':isActive(item.path,item.view)}" @click="menuOpen=false"><AppIcon :name="item.icon"/><span class="nav-label">{{item.label}}</span></RouterLink></div>
   <button type="button" class="nav-group-toggle" :class="{'nav-active':activeGroup==='logistics'}" aria-controls="logistics-navigation" :aria-expanded="logisticsOpen" aria-label="Logística" title="Logística" @click="toggleLogistics"><AppIcon name="truck"/><span class="nav-label">Logística</span><AppIcon name="chevron-down" class="nav-chevron"/></button>
   <div v-show="logisticsOpen" id="logistics-navigation" class="nav-children"><RouterLink v-for="item in logisticsNavigation" :key="item.path" :to="item.path" :title="item.label" :aria-label="item.label" active-class="route-match" :class="{'nav-active':isActive(item.path)}" @click="menuOpen=false"><AppIcon :name="item.icon"/><span class="nav-label">{{item.label}}</span></RouterLink></div>
  </nav>
  <div class="sidebar-footer">
   <button v-if="!isHome && !isPlaceholder && !isLogistics && !isStrategic && !isAftersales && store.area==='emitidos'" class="sidebar-refresh" title="Metas" @click="goalsOpen=true"><AppIcon name="target"/><span>Metas</span></button>
   <div v-if="!isHome && !isPlaceholder" class="sidebar-last-update" :title="lastUpdate ? 'Publicação da última carga do Apache Hop' : 'Horário da carga ainda não disponível'"><span><i aria-hidden="true">●</i> Última atualização:</span><time v-if="lastUpdate" :datetime="lastUpdate.iso">{{lastUpdate.label}}</time><span v-else>—</span></div>
   <button class="collapse-menu" :aria-label="collapsed?'Expandir menu':'Recolher menu'" :title="collapsed?'Expandir menu':'Recolher menu'" @click="collapsed=!collapsed"><svg viewBox="0 0 24 24" aria-hidden="true" :class="{rotated:collapsed}"><path d="m11 19-7-7 7-7m7 14-7-7 7-7"/></svg><span>{{collapsed?'Expandir menu':'Recolher menu'}}</span></button>
  </div>
 </aside>
 <div class="main-shell"><header class="app-header"><div class="header-context"><button class="mobile-menu icon-button" aria-label="Abrir menu" aria-controls="app-sidebar" :aria-expanded="menuOpen" @click="menuOpen=!menuOpen">☰</button><span class="module-icon"><AppIcon :name="headerIcon"/></span><h1>{{title}}</h1></div><div class="header-actions">
  <IndicatorsInfo :key="route.fullPath" :title="title" :demo="isDemo"/>
  <button v-if="!isHome && !isPlaceholder" class="header-filter-btn" :class="{'has-active-filters':filterCount,'is-open':activeFiltersOpen}" aria-label="Filtros" :title="filterCount?`Filtros · ${filterCount} ativos`: 'Abrir filtros'" aria-haspopup="dialog" aria-controls="advanced-filter-dialog" :aria-expanded="activeFiltersOpen" @click="openFilters"><AppIcon name="filter"/><span v-if="filterCount" class="filter-count" :aria-label="`${filterCount} seleções aplicadas`">{{filterCount}}</span></button></div></header><main><RouterView /></main><div v-if="!isHome && !isPlaceholder && !isLogistics && !isStrategic && !isAftersales && store.notice" role="status" class="notification">{{store.notice}}<button aria-label="Fechar aviso" @click="store.notice=''">×</button></div></div>
 <FilterDrawer :open="!isHome && !isPlaceholder && !isLogistics && !isStrategic && !isAftersales && filtersOpen" @close="filtersOpen=false"/><GoalsDialog :open="!isHome && !isPlaceholder && !isLogistics && !isStrategic && !isAftersales && store.area==='emitidos' && goalsOpen" @close="goalsOpen=false"/>
</div>
</template>
