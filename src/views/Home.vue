<script setup lang="ts">
import AppIcon from '../components/ui/AppIcon.vue'
import {homeNavigation} from '../navigation'
const now=new Date()
const dateLabel=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now)
const dateParts=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(now).map(part=>[part.type,part.value]))
const dateIso=`${dateParts.year}-${dateParts.month}-${dateParts.day}`

</script>

<template>
 <div class="home-page">
  <header class="home-welcome">
   <h2>Bem-vindo ao painel</h2>
   <time class="home-date" :datetime="dateIso"><AppIcon name="calendar"/>{{dateLabel}}</time>
  </header>
  <nav class="home-grid" aria-label="Acessar painéis">
    <RouterLink v-for="card in homeNavigation" :key="card.path" :to="card.path" class="home-card" :class="'home-card--'+card.tone">
     <span class="home-card-icon"><AppIcon :name="card.icon"/></span>
     <span class="home-card-title">{{card.label}}</span>
    </RouterLink>
  </nav>
 </div>
</template>

<style scoped>
.home-page{max-width:1600px;margin:0 auto;padding:6px 4px 14px;display:grid;gap:20px;align-content:start}
.home-welcome{text-align:center;padding:4px 10px 2px}
.home-welcome h2{color:#122b1b;font-size:clamp(26px,3vw,38px);font-weight:800;letter-spacing:-.04em;line-height:1.15}
.home-date{display:inline-flex;align-items:center;gap:7px;margin-top:9px;padding:6px 12px;border:1px solid #dfe8df;border-radius:999px;background:#fff;color:#536d5a;font-size:12px;text-transform:capitalize}
.home-date :deep(svg){width:16px;height:16px;color:#006a3a}
.home-grid{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.home-card{flex:0 0 calc((100% - 48px)/5);min-width:0;min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:12px 10px;text-align:center;text-decoration:none;background:#fff;border:1px solid #dfe8df;border-radius:17px;color:#1b3223;box-shadow:0 4px 15px #193c2a0a;transition:transform .18s,box-shadow .18s,border-color .18s}
.home-card:hover,.home-card:focus-visible{transform:translateY(-3px);border-color:#9aca77;box-shadow:0 12px 28px #193c2a16}
.home-card-icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#fdf5bd;color:#8d5715}
.home-card-icon :deep(svg){width:32px;height:32px;stroke-width:1.8}
.home-card--teal .home-card-icon{background:#e2f4ee;color:#087967}
.home-card--rose .home-card-icon{background:#fbe8ed;color:#a53e5b}
.home-card--slate .home-card-icon{background:#e9eff4;color:#4d6175}
.home-card-title{font-size:14px;font-weight:750;line-height:1.25}
@media(max-width:1399px){.home-card{min-height:146px;gap:9px}.home-card-icon{width:54px;height:54px}.home-card-icon :deep(svg){width:27px;height:27px}}
@media(max-width:1199px){.home-card{flex-basis:calc((100% - 36px)/4);min-height:128px}}
@media(max-width:800px){.home-card{flex-basis:calc((100% - 12px)/2)}.home-page{padding-inline:12px}}
@media(max-width:460px){.home-grid{gap:10px}.home-card{min-height:132px;padding:12px 8px}.home-card-icon{width:47px;height:47px}.home-card-title{font-size:12px}.home-date{font-size:11px}}
@media(prefers-reduced-motion:reduce){.home-card{transition:none}}
</style>
