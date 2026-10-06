// Quantities describe outstanding allocation. Billing and physical dispatch are separate events.
export const allocationLabels = {none:'Sem carga',partial:'Parcialmente alocado',full:'Totalmente alocado'};
export const allocationStatus = (open,allocated)=>Math.abs(allocated)<0.000001?'none':open-allocated>0.000001?'partial':'full';
export const loadStageLabels=['Sem etapa registrada','Em separação','Separação concluída','Em conferência','Conferência concluída','Fechamento registrado','Saída liberada'];
const loadStage=link=>link.liberacao_saida?loadStageLabels[6]:link.fechamento?loadStageLabels[5]:link.fim_conferencia?loadStageLabels[4]:link.inicio_conferencia?loadStageLabels[3]:link.fim_separacao?loadStageLabels[2]:link.inicio_separacao?loadStageLabels[1]:loadStageLabels[0];
const matches=(filter,value)=>!filter||(Array.isArray(filter)?!filter.length||filter.includes(value):filter===value);
const minimum=(filter,value)=>filter===undefined||filter===''||(typeof value==='number'&&Number.isFinite(value)&&value>=Number(filter));
const number=value=>Number(value ?? 0);
const days=(start,end)=>Math.round((Date.parse(end)-Date.parse(start))/86400000);
const columns = () => [
  {key:'identificacao',label:'Pedido / item',format:'text'},
  {key:'empresa',label:'Empresa',format:'text'},
  {key:'emissao',label:'Emissão',format:'date'},
  {key:'situacao',label:'Alocação',format:'text'},
  {key:'quantidade_aberta',label:'Qtd. aberta',format:'quantity4'},
  {key:'quantidade_alocada',label:'Qtd. em carga',format:'quantity4'},
  {key:'quantidade_sem_carga',label:'Qtd. sem carga',format:'quantity4'},
  {key:'valor_aberto',label:'Valor em aberto',format:'currency'},
  {key:'cargas',label:'Cargas',format:'text'},
  {key:'previsao',label:'Previsão de faturamento',format:'date'},
  {key:'prazo',label:'Situação do prazo',format:'text'},
  {key:'idade',label:'Atendimento em curso (dias)',format:'integer'},
];

export function buildLogisticsDashboard({execution,items,allocations,filters={},geoVersion='',geoWarning=null}) {
  const referenceDate=execution.data_referencia;
  const grouped=new Map();
  for(const source of items){
    const item={...source};
    for(const key of ['quantidade_aberta','quantidade_alocada','quantidade_sem_carga','quantidade_faturada','quantidade_cancelada','valor_unitario'])item[key]=source[key]==null?null:number(source[key]);
    item.valor_aberto=source.valor_aberto==null?null:number(source.valor_aberto);
    const key=String(item.pedido_id);
    if(!grouped.has(key))grouped.set(key,{id:'pedido-'+key,pedido_id:key,identificacao:'Pedido '+key,empresa:String(item.empresa_id),emissao:item.emissao,previsao:item.previsao_faturamento,
      quantidade_aberta:0,quantidade_alocada:0,quantidade_sem_carga:0,valor_aberto:0,valor_incompleto:false,children:[],loadIds:new Set()});
    const order=grouped.get(key);
    Object.assign(order,{cliente:item.cliente||'Não informado',uf:item.uf?.trim()||'Não informado',cidade:item.cidade||'Não informado',cep:item.cep||null,geo_origin:item.geo_origin||null,latitude:item.latitude==null?null:number(item.latitude),longitude:item.longitude==null?null:number(item.longitude),status_erp:item.status_erp||'Não informado',tipo_entrega:item.tipo_entrega||'Não informado'});
    for(const field of ['quantidade_aberta','quantidade_alocada','quantidade_sem_carga'])order[field]+=item[field];
    if(item.valor_aberto==null)order.valor_incompleto=true;else order.valor_aberto+=item.valor_aberto;
    order.children.push({id:'item-'+item.item_id,item_id:String(item.item_id),pedido_id:key,produto_id:String(item.produto_id),identificacao:'Item '+item.item_id+' · Produto '+item.produto_id,
      empresa:String(item.empresa_id),emissao:item.emissao,previsao:item.previsao_faturamento,quantidade_aberta:item.quantidade_aberta,quantidade_alocada:item.quantidade_alocada,quantidade_sem_carga:item.quantidade_sem_carga,
      valor_aberto:item.valor_aberto==null?'Não disponível':item.valor_aberto,valor_unitario:item.valor_unitario,alocacao:allocationStatus(item.quantidade_aberta,item.quantidade_alocada),
      situacao:allocationLabels[allocationStatus(item.quantidade_aberta,item.quantidade_alocada)],cargas:'—'});
  }
  const itemLoads=new Map(),orderStages=new Map();
  for(const link of allocations){
    if(number(link.quantidade_aberta)<=0)continue;
    grouped.get(String(link.pedido_id))?.loadIds.add(String(link.carga_id));
    const orderKey=String(link.pedido_id);if(!orderStages.has(orderKey))orderStages.set(orderKey,new Set());orderStages.get(orderKey).add(loadStage(link));
    const key=String(link.item_id);if(!itemLoads.has(key))itemLoads.set(key,new Set());itemLoads.get(key).add(String(link.carga_id));
  }
  const allOrders=[...grouped.values()].map(order=>{
    order.alocacao=allocationStatus(order.quantidade_aberta,order.quantidade_alocada);order.situacao=allocationLabels[order.alocacao];
    order.cargas=[...order.loadIds].join(', ')||'—';
    if(order.valor_incompleto)order.valor_aberto='Não disponível';
    for(const row of [order,...order.children]){
      row.idade=days(row.emissao,referenceDate);
      row.prazo=!row.previsao?'Sem previsão':row.previsao<referenceDate?'Previsão vencida':row.previsao===referenceDate?'Previsto para a referência':'Dentro da previsão';
      if(row.item_id)row.cargas=[...(itemLoads.get(row.item_id)||[])].join(', ')||'—';
    }
    return order;
  });
  const byItem=new Map(items.map(item=>[String(item.item_id),item]));
  const freeMeasure=(order,unit)=>{
    let total=0;
    for(const child of order.children){const source=byItem.get(child.item_id);if(number(source.quantidade_sem_carga)===0)continue;if(source[unit]==null)return null;total+=number(source.quantidade_sem_carga)*number(source[unit]);}
    return total;
  };
  const forecastMatches=order=>!filters.forecastStatus||(filters.forecastStatus==='undated'?!order.previsao:order.previsao&&(filters.forecastStatus==='overdue'?order.previsao<referenceDate:filters.forecastStatus==='today'?order.previsao===referenceDate:order.previsao>referenceDate));
  const search=String(filters.search||'').trim().toLocaleLowerCase('pt-BR');
  const orders=allOrders.filter(order=>(!filters.company||order.empresa===filters.company)&&(!filters.status||order.alocacao===filters.status)&&
    matches(filters.uf,order.uf)&&matches(filters.city,order.cidade)&&matches(filters.delivery,order.tipo_entrega)&&matches(filters.erpStatus,order.status_erp)&&matches(filters.client,order.cliente)&&
    (!filters.product||(Array.isArray(filters.product)&&!filters.product.length)||order.children.some(item=>matches(filters.product,item.produto_id)))&&
    (!filters.loadStage||orderStages.get(order.pedido_id)?.has(filters.loadStage))&&forecastMatches(order)&&
    minimum(filters.freeQuantityMin,order.quantidade_sem_carga)&&minimum(filters.orderValueMin,order.valor_aberto)&&
    (filters.freeVolumeMin===undefined||filters.freeVolumeMin===''||minimum(filters.freeVolumeMin,freeMeasure(order,'cubagem_unitaria')))&&
    (filters.freeWeightMin===undefined||filters.freeWeightMin===''||minimum(filters.freeWeightMin,freeMeasure(order,'peso_unitario')))&&
    (!filters.emissionStart||order.emissao>=filters.emissionStart)&&(!filters.emissionEnd||order.emissao<=filters.emissionEnd)&&
    (!filters.forecastStart||(order.previsao&&order.previsao>=filters.forecastStart))&&(!filters.forecastEnd||(order.previsao&&order.previsao<=filters.forecastEnd))&&
    (!filters.ageMin||order.idade>=filters.ageMin)&&
    (!search||[order.pedido_id,order.cliente,...order.loadIds,...order.children.flatMap(item=>[item.item_id,item.produto_id])].some(value=>String(value).toLocaleLowerCase('pt-BR').includes(search))));
  const orderIds=new Set(orders.map(order=>order.pedido_id));
  const chosenItems=items.filter(item=>orderIds.has(String(item.pedido_id)));
  const links=allocations.filter(link=>orderIds.has(String(link.pedido_id))&&number(link.quantidade_aberta)>0);
  const loads=new Map();
  for(const link of links){
    const key=String(link.carga_id);
    if(!loads.has(key))loads.set(key,{id:'carga-'+key,identificacao:'Carga '+key,carga_id:key,empresa:String(link.empresa_carga_id),emissao:link.emissao,
      inicio_separacao:link.inicio_separacao,fim_separacao:link.fim_separacao,inicio_conferencia:link.inicio_conferencia,fim_conferencia:link.fim_conferencia,fechamento:link.fechamento,liberacao_saida:link.liberacao_saida,
      etapa:loadStage(link),
      quantidade_alocada:0,pedidos:new Set(),children:[],childOrders:new Map()});
    const load=loads.get(key);load.quantidade_alocada+=number(link.quantidade_aberta);load.pedidos.add(String(link.pedido_id));
    const orderKey=String(link.pedido_id);
    if(!load.childOrders.has(orderKey)){
      const child={id:'carga-'+key+'-pedido-'+orderKey,pedido_id:orderKey,carga_id:key,identificacao:'Pedido '+orderKey,empresa:String(link.empresa_id),quantidade_alocada:0,pedidos:1,children:[]};
      load.childOrders.set(orderKey,child);load.children.push(child);
    }
    const child=load.childOrders.get(orderKey);child.quantidade_alocada+=number(link.quantidade_aberta);
    child.children.push({id:'alocacao-'+link.alocacao_id,item_id:String(link.item_id),pedido_id:orderKey,carga_id:key,identificacao:'Item '+link.item_id,empresa:String(link.empresa_id),quantidade_alocada:number(link.quantidade_aberta)});
  }
  const loadRows=[...loads.values()].map(({childOrders,...load})=>({...load,pedidos:load.pedidos.size}));
  const sum=field=>chosenItems.reduce((total,item)=>total+number(item[field]),0);
  const counts={none:orders.filter(order=>order.alocacao==='none').length,partial:orders.filter(order=>order.alocacao==='partial').length,full:orders.filter(order=>order.alocacao==='full').length};
  const totals={quantidade_aberta:sum('quantidade_aberta'),quantidade_alocada:sum('quantidade_alocada'),quantidade_sem_carga:sum('quantidade_sem_carga')};
  const unpriced=chosenItems.filter(item=>item.valor_aberto==null).length;
  totals.valor_aberto=unpriced?'Não disponível':sum('valor_aberto');
  // Sets are internal. Never serialize them as table cells or API state.
  const cleanOrders=orders.map(({loadIds,valor_incompleto,...order})=>({...order,children:order.children.map(({valor_unitario,...item})=>item)}));
  const dashboard={dataVersion:String(execution.id)+(geoVersion?':'+geoVersion:''),referenceDate,metrics:[
    {id:'logistica.orders',label:'Pedidos em aberto',value:orders.length,format:'integer',help:'Pedidos distintos com saldo aberto no recorte publicado. Cada pedido pertence a uma única situação de alocação.'},
    {id:'logistica.none',label:'Pedidos sem carga',value:counts.none,format:'integer',help:'Nenhuma quantidade em aberto do pedido está vinculada a uma carga ativa.'},
    {id:'logistica.partial',label:'Parcialmente alocados',value:counts.partial,format:'integer',help:'Uma parte do saldo do pedido está em carga e outra parte continua sem carga. Inclui pedidos com itens em situações diferentes.'},
    {id:'logistica.full',label:'Totalmente alocados',value:counts.full,format:'integer',help:'Todo o saldo aberto do pedido está vinculado a cargas. Alocação não comprova faturamento ou saída física.'},
    {id:'logistica.loads',label:'Cargas com saldo',value:loadRows.length,format:'integer',help:'Cargas distintas com quantidade ainda aberta dos pedidos selecionados. Um pedido pode participar de várias cargas.'},
    {id:'logistica.free',label:'Quantidade sem carga',value:totals.quantidade_sem_carga,format:'quantity4',help:'Quantidade aberta menos a soma das quantidades abertas dos vínculos em CARGA_ITENS. Não representa disponibilidade de estoque.'},
  ],tables:[
    {id:'logistica-pedidos',title:'Pedidos e saldo para formação de cargas',columns:columns(),rows:cleanOrders,tree:cleanOrders,total:{identificacao:'Total do recorte',...totals}},
    {id:'logistica-cargas',title:'Cargas e pedidos vinculados',columns:[{key:'identificacao',label:'Carga / pedido / item',format:'text'},{key:'empresa',label:'Empresa',format:'text'},{key:'emissao',label:'Emissão',format:'date'},
      {key:'etapa',label:'Última etapa registrada',format:'text'},{key:'pedidos',label:'Pedidos na carga',format:'integer'},{key:'quantidade_alocada',label:'Qtd. aberta em carga',format:'quantity4'},
      {key:'inicio_separacao',label:'Início de separação',format:'date'},{key:'fim_separacao',label:'Fim de separação',format:'date'},
      {key:'inicio_conferencia',label:'Início de conferência',format:'date'},{key:'fim_conferencia',label:'Fim de conferência',format:'date'},
      {key:'fechamento',label:'Fechamento',format:'date'},{key:'liberacao_saida',label:'Liberação de saída',format:'date'}],rows:loadRows,tree:loadRows,total:{identificacao:'Total do recorte',quantidade_alocada:totals.quantidade_alocada}},
  ],companies:[...new Set(allOrders.map(order=>order.empresa))].sort((a,b)=>Number(a)-Number(b)),
    meta:{publishedAt:execution.fim,startDate:execution.data_inicio,source:execution.origem,counts:execution.contagens,selectedItems:chosenItems.length,unpricedItems:unpriced,geoWarning,
      allocationQuantity:totals.quantidade_alocada,openQuantity:totals.quantidade_aberta,freeQuantity:totals.quantidade_sem_carga,ordersMultipleLoads:orders.filter(order=>order.loadIds.size>1).length}};
  addOperations(dashboard,{items:chosenItems,links,allOrders,orders:cleanOrders});
  dashboard.options.clients=[...new Set(allOrders.map(order=>order.cliente))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  dashboard.options.products=[...new Set(items.map(item=>String(item.produto_id)))].sort((a,b)=>Number(a)-Number(b));
  dashboard.options.loadStages=loadStageLabels.filter(stage=>[...orderStages.values()].some(stages=>stages.has(stage)));
  return dashboard;
}
import {addOperations} from './logistics-operations.js';
