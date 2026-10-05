import { createRouter, createWebHistory } from 'vue-router'
const PedidosEmAberto=()=>import('../views/PedidosEmAberto.vue')
const PedidosEmitidos=()=>import('../views/PedidosEmitidos.vue')
const PedidosFaturados=()=>import('../views/PedidosFaturados.vue')
const FormacaoCargas=()=>import('../views/FormacaoCargas.vue')
const VisaoEstrategica=()=>import('../views/VisaoEstrategica.vue')
export default createRouter({
  history:createWebHistory(),
  routes:[
    {path:'/',redirect:'/abertos'},
    {path:'/abertos',component:PedidosEmAberto},
    {path:'/emitidos',component:PedidosEmitidos},
    {path:'/faturados',component:PedidosFaturados},
    {path:'/cargas',component:FormacaoCargas},
    {path:'/estrategico',component:VisaoEstrategica},
    {path:'/:pathMatch(.*)*',redirect:'/abertos'},
  ],
})
