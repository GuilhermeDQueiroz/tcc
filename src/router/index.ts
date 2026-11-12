import { createRouter, createWebHistory } from 'vue-router'
const PedidosEmAberto=()=>import('../views/PedidosEmAberto.vue')
const PedidosEmitidos=()=>import('../views/PedidosEmitidos.vue')
const PedidosFaturados=()=>import('../views/PedidosFaturados.vue')
const FormacaoCargas=()=>import('../views/FormacaoCargas.vue')
const VisaoEstrategica=()=>import('../views/VisaoEstrategica.vue')
const PosVenda=()=>import('../views/PosVenda.vue')
const Home=()=>import('../views/Home.vue')
const OverviewPlaceholder=()=>import('../views/OverviewPlaceholder.vue')
export default createRouter({
  history:createWebHistory(),
  routes:[
    {path:'/',component:Home},
    {path:'/vendas/visao-geral',component:OverviewPlaceholder},
    {path:'/assistencias/visao-geral',component:OverviewPlaceholder},
    {path:'/abertos',component:PedidosEmAberto},
    {path:'/emitidos',component:PedidosEmitidos},
    {path:'/faturados',component:PedidosFaturados},
    {path:'/cargas',component:FormacaoCargas},
    {path:'/estrategico',component:VisaoEstrategica},
    {path:'/assistencias',component:PosVenda},
    {path:'/cancelamentos',component:PosVenda},
    {path:'/devolucoes',component:PosVenda},
    {path:'/:pathMatch(.*)*',redirect:'/'},
  ],
})
