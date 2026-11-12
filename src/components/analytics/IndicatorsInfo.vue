<script setup lang="ts">
import {computed,onMounted,ref,useId} from 'vue'
import {useRoute} from 'vue-router'
import {useAftersalesStore} from '../../stores/posvenda'
import {useLogisticsStore} from '../../stores/logistics'
import {useStrategicStore} from '../../stores/strategic'
import {useAnalyticsStore} from '../../stores/analytics'
import {formatValue} from '../../composables/useFormatters'
import AppIcon from '../ui/AppIcon.vue'
import {indicatorGuide} from '../../content/indicator-guides'

const props=defineProps<{title:string;demo:boolean}>()
const route=useRoute(),aftersales=useAftersalesStore(),logistics=useLogisticsStore(),strategic=useStrategicStore(),commercial=useAnalyticsStore()
const dialog=ref<HTMLDialogElement>(),trigger=ref<HTMLButtonElement>(),dialogId=useId()
const demoReference=ref(''),demoError=ref(false)
onMounted(async()=>{
 if(!props.demo)return
 try{
  const {getDemoManifest}=await import('../../demo/data')
  demoReference.value=(await getDemoManifest()).referenceDate
 }catch{demoError.value=true}
})
const isAftersales=computed(()=>['/assistencias','/cancelamentos','/devolucoes'].includes(route.path))
const referenceDate=computed<string|undefined>(()=>{
 if(props.demo&&demoReference.value)return demoReference.value
 if(isAftersales.value)return aftersales.dashboard?.referenceDate
 if(route.path==='/cargas')return logistics.dashboard?.referenceDate
 if(route.path==='/estrategico')return strategic.dashboard?.referenceDate
 if(!['/abertos','/emitidos','/faturados'].includes(route.path)||commercial.dashboard?.area!==route.path.slice(1))return undefined
 const latest=commercial.dashboard?.referenceDate || commercial.dashboard?.meta?.lastDate || commercial.dashboard?.meta?.latestDate
 return typeof latest==='string'?latest:undefined
})
const guide=computed(()=>indicatorGuide(route.path,String(route.query.view||'abertas'),String(route.query.kind||'Venda')))
const isCommercial=computed(()=>['/abertos','/emitidos','/faturados'].includes(route.path))
const publishedAt=computed(()=>isCommercial.value?commercial.dashboard?.meta?.publishedAt:undefined)
const historyPeriod=computed(()=>route.path==='/estrategico'?strategic.dashboard?.meta.history:undefined)
const context=computed(()=>{
 if(route.path==='/')return {
  summary:'A Home reúne atalhos para os painéis publicados e identifica as análises ainda em construção.',
  rule:'Cada painel define seus próprios indicadores, filtros e datas. Consulte esta janela dentro da análise para interpretar seus números.'
 }
 if(route.path.endsWith('/visao-geral'))return {
  summary:`A ${props.title} está em construção e ainda não possui indicadores publicados.`,
  rule:'Use as demais análises disponíveis para consultar os dados já publicados. Nenhum total ou meta foi estimado nesta página.'
 }
 if(route.path==='/assistencias'&&route.query.view==='faturadas')return {
  summary:'Quantidade faturada acumulada dos itens de assistência na posição publicada. O período seleciona a emissão das assistências, inclusive quando o faturamento ocorreu depois.',
  rule:'O valor considera a quantidade faturada acumulada e o preço unitário do item. Esta visão não informa a data de cada parcela faturada. Faturamento não comprova entrega nem conclusão do atendimento; os valores não representam custo da assistência.'
 }
 if(route.path==='/assistencias'&&route.query.view==='emitidas')return {
  summary:'O período seleciona assistências pela emissão, inclusive as já atendidas, canceladas ou sem valor comercial.',
  rule:'A idade é contada até a posição da base. O faturamento de reposição não confirma entrega nem conclusão do atendimento. Os valores não representam custo da assistência.'
 }
 if(route.path==='/assistencias')return {
  summary:'Saldo pendente na referência publicada, inclusive saldos parciais. O período filtra a emissão das assistências; selecionar um período anterior não reconstrói o saldo daquela data.',
  rule:'A idade e a situação da previsão usam a posição da base. Faturamento de reposição e saldo aberto não confirmam entrega nem conclusão do atendimento. Valores não representam custo da assistência.'
 }
 if(route.path==='/cancelamentos')return {
  summary:`Eventos de cancelamento de ${route.query.kind==='Assistência'?'assistências':'pedidos de venda'}, inclusive parciais. O período filtra a data do documento de cancelamento.`,
  rule:'O prazo é contado da emissão do documento original até o cancelamento. O valor utiliza o preço unitário do item original e a quantidade cancelada no evento.'
 }
 if(route.path==='/devolucoes')return {
  summary:`Devoluções de clientes registradas no ERP e vinculadas a documentos de ${route.query.kind==='Assistência'?'assistência':'venda'}. O período filtra a emissão da devolução.`,
  rule:'O prazo vai da emissão do documento de origem até a devolução. O valor usa o preço unitário do item de origem. O registro no ERP não comprova recolhimento físico.'
 }
 if(route.path==='/abertos')return {
  summary:'Pedidos de venda com saldo em aberto na publicação carregada. Os filtros selecionam os documentos e atributos da carteira; a referência dos cálculos identifica o contexto de datas usado pela consulta.',
  rule:'O saldo pertence à publicação disponível. A referência dos cálculos não é necessariamente a data de extração. Agrupar por emissão ou selecionar um período anterior não reconstrói uma carteira histórica.'
 }
 if(route.path==='/emitidos')return {
  summary:'Pedidos de venda emitidos no recorte selecionado, usados para analisar a demanda comercial.',
  rule:'A emissão registra o pedido no ERP; por si só, ela não comprova faturamento, expedição nem entrega.'
 }
 if(route.path==='/faturados')return {
  summary:'Faturamento de pedidos de venda no recorte selecionado, com análises comerciais e logísticas associadas.',
  rule:'A data e os valores de faturamento não comprovam entrega física. Indicadores de prazo dependem dos eventos e campos disponíveis na publicação.'
 }
 if(route.path==='/estrategico')return {
  summary:'Visão consolidada das publicações comerciais e logísticas disponíveis na posição da base.',
  rule:'Compare indicadores apenas quando período, unidade e população coincidirem. Previsões e saldos representam o recorte da publicação, não eventos futuros confirmados.'
 }
 return {
  summary:'Formação de cargas e vínculos logísticos publicados no recorte selecionado.',
  rule:'Alocação em carga e previsão não comprovam expedição ou entrega. Quantidades e saldos devem ser lidos na posição da base publicada.'
 }
})
function open(){
 const element=dialog.value;if(!element)return
 element.querySelectorAll('details').forEach(section=>{section.open=false})
 element.querySelector('.indicators-info-body')?.scrollTo({top:0})
 element.showModal()
}
function close(){dialog.value?.close()}
function restoreFocus(){trigger.value?.focus()}
</script>

<template>
 <button ref="trigger" class="header-context-btn" type="button" aria-label="Sobre os indicadores" title="Sobre os indicadores" aria-haspopup="dialog" :aria-controls="dialogId" @click="open"><AppIcon name="help"/></button>
 <Teleport to="body">
  <dialog :id="dialogId" ref="dialog" class="indicators-info-dialog" :aria-labelledby="dialogId+'-title'" @close="restoreFocus">
   <div class="indicators-info-content">
    <header><div><h2 :id="dialogId+'-title'">Sobre os indicadores</h2><p>{{title}}</p></div><button type="button" class="modal-close-button" aria-label="Fechar informações" title="Fechar informações" autofocus @click="close"><AppIcon name="close"/></button></header>
    <div class="indicators-info-body">
     <section v-if="demo" class="demo-disclosure" aria-label="Informações da demonstração">
      <strong>Demonstração</strong>
      <p>Versão de apresentação do TCC com uma fotografia anonimizada das publicações reais. Não há atualização do ERP nesta versão; os filtros consultam apenas o recorte exportado. Configurações temporárias duram somente nesta aba.</p>
      <p v-if="demoError">A data da fotografia não pôde ser carregada agora.</p>
     </section>
     <dl v-if="(isAftersales&&aftersales.dashboard)||referenceDate">
      <div v-if="isAftersales&&aftersales.dashboard"><dt>Período filtrado</dt><dd>{{formatValue(aftersales.dashboard.meta.start,'date')}} – {{formatValue(aftersales.dashboard.meta.end,'date')}}</dd></div>
      <div v-if="referenceDate"><dt>{{isCommercial&&!demo?'Referência dos cálculos':'Posição da base'}}</dt><dd><time :datetime="referenceDate">{{formatValue(referenceDate,'date')}}</time></dd></div>
      <div v-if="historyPeriod"><dt>Período dos faturamentos</dt><dd>{{formatValue(historyPeriod.start,'date')}} – {{formatValue(historyPeriod.end,'date')}}</dd></div>
      <div v-if="publishedAt"><dt>Publicado em</dt><dd>{{formatValue(publishedAt,'date')}}</dd></div>
     </dl>
     <h3>O que o painel mostra</h3><p>{{context.summary}}</p>
     <div class="indicator-guide"><details v-for="section in guide" :key="section.title" class="info-section"><summary>{{section.title}}<AppIcon name="chevron-down"/></summary><ul><li v-for="entry in section.entries" :key="entry.label"><strong>{{entry.label}}</strong><p>{{entry.text}}</p></li></ul></details></div>
     <h3>Como interpretar</h3><p>{{context.rule}}</p>
     <p v-if="demo" class="demo-footnote">A fotografia não reconstrói automaticamente saldos históricos. Pesquisas usam os campos exportados e as coordenadas individuais foram omitidas.</p>
    </div>
   </div>
  </dialog>
 </Teleport>
</template>

<style scoped>
.indicators-info-dialog{position:fixed;inset:0;margin:auto;padding:0;width:min(820px,calc(100% - 24px));height:min(720px,calc(100dvh - 24px));max-height:calc(100dvh - 24px);border:1px solid #d9e5d7;border-radius:16px;background:#fff;color:#31465a;box-shadow:0 20px 60px #173c2733;overflow:hidden;overscroll-behavior:contain}
.indicators-info-dialog::backdrop{background:#173c275e}
.indicators-info-content{display:flex;flex-direction:column;height:100%;max-height:100%}
.indicators-info-content header{flex:none;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:20px;background:#f5f8f3;border-bottom:1px solid #e2ebe0}
.indicators-info-content h2{margin:0;font-size:18px;color:#17442c}
.indicators-info-content header p{margin:4px 0 0;font-size:13px}
.indicators-info-content header .modal-close-button{flex:none}
.indicators-info-body{padding:20px;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;font-size:14px;line-height:1.6}
.indicators-info-body dl{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 18px}
.indicators-info-body dl div{flex:1 1 175px;padding:10px 12px;background:#f3f8ee;border-radius:8px}
.indicators-info-body dt{color:#476346;font-size:12px;font-weight:700}
.indicators-info-body dd{margin:2px 0 0;font-weight:700;font-variant-numeric:tabular-nums}
.indicators-info-body h3{margin:14px 0 4px;font-size:14px;color:#17442c}
.indicators-info-body p{margin:0}
.demo-disclosure{padding:12px 14px;margin:0 0 18px;border:1px solid #cfe2bf;border-radius:10px;background:#f3f8ee}
.demo-disclosure strong{display:block;margin-bottom:4px;color:#356222;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.demo-disclosure p+p{margin-top:7px}
.indicators-info-body .demo-footnote{margin-top:16px;padding-top:14px;border-top:1px solid #e5ece2;color:#5b705f;font-size:12px}
.indicator-guide{display:grid;gap:10px;margin-top:18px}.info-section{border:1px solid #dce6d8;border-radius:10px;overflow:hidden}.info-section summary{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;background:#f5f8f2;cursor:pointer;color:#245036;font-size:14px;font-weight:650;list-style:none}.info-section summary::-webkit-details-marker{display:none}.info-section summary .app-icon{width:16px;height:16px;transition:transform .2s}.info-section[open] summary .app-icon{transform:rotate(180deg)}.info-section ul{list-style:none;margin:0;padding:4px 14px}.info-section li{padding:10px 0;border-top:1px solid #eef2eb}.info-section li:first-child{border-top:0}.info-section li strong{display:block;font-size:13px;color:#315d3e;margin-bottom:3px}.info-section li p{font-size:13px;color:#475969;line-height:1.65}
@media(max-width:600px){.indicators-info-content header,.indicators-info-body{padding:16px}.indicators-info-content h2{font-size:17px}.info-section summary{font-size:13px}}
</style>
