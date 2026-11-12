export type NavigationItem={path:string;label:string;icon:string;view?:string;tone?:string}

export const salesNavigation:NavigationItem[]=[
 {path:'/vendas/visao-geral',label:'Visão Geral de Pedidos de Venda',icon:'overview',tone:'gold'},
 {path:'/abertos',label:'Pedidos em Aberto',icon:'clock',tone:'gold'},
 {path:'/emitidos',label:'Pedidos Emitidos',icon:'cart',tone:'gold'},
 {path:'/faturados',label:'Pedidos Faturados',icon:'document',tone:'gold'},
 {path:'/cancelamentos?kind=Venda',label:'Pedidos Cancelados',icon:'cancel-circle',tone:'rose'},
 {path:'/devolucoes?kind=Venda',label:'Pedidos Devolvidos',icon:'return-arrow',tone:'rose'},
]

export const assistanceNavigation:NavigationItem[]=[
 {path:'/assistencias/visao-geral',label:'Visão Geral de Assistências',icon:'overview',tone:'teal'},
 {path:'/assistencias',label:'Assistências em Aberto',icon:'clock',view:'abertas',tone:'teal'},
 {path:'/assistencias?view=emitidas',label:'Assistências Emitidas',icon:'cart',view:'emitidas',tone:'teal'},
 {path:'/assistencias?view=faturadas',label:'Assistências Faturadas',icon:'document',view:'faturadas',tone:'teal'},
 {path:'/cancelamentos?kind=Assistência',label:'Assistências Canceladas',icon:'cancel-circle',view:'canceladas',tone:'rose'},
 {path:'/devolucoes?kind=Assistência',label:'Assistências Devolvidas',icon:'return-arrow',view:'devolvidas',tone:'rose'},
]

export const logisticsNavigation:NavigationItem[]=[
 {path:'/estrategico',label:'Visão estratégica',icon:'overview',tone:'slate'},
 {path:'/cargas',label:'Formação de Cargas',icon:'truck',tone:'slate'},
]

export const homeNavigation=[...salesNavigation,...assistanceNavigation,...logisticsNavigation]
