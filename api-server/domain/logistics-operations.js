const n=value=>value==null?null:Number(value);
const unavailable='Não disponível';
const addDays=(date,days)=>new Date(Date.parse(date)+days*86400000).toISOString().slice(0,10);
const regions={AC:'Norte',AP:'Norte',AM:'Norte',PA:'Norte',RO:'Norte',RR:'Norte',TO:'Norte',AL:'Nordeste',BA:'Nordeste',CE:'Nordeste',MA:'Nordeste',PB:'Nordeste',PE:'Nordeste',PI:'Nordeste',RN:'Nordeste',SE:'Nordeste',DF:'Centro-Oeste',GO:'Centro-Oeste',MT:'Centro-Oeste',MS:'Centro-Oeste',ES:'Sudeste',MG:'Sudeste',RJ:'Sudeste',SP:'Sudeste',PR:'Sul',RS:'Sul',SC:'Sul'};
const measurable=(quantity,unit)=>quantity===0?0:unit==null?null:quantity*unit;

export function addOperations(dashboard,{items,links,allOrders,orders}){
 const byItem=new Map(items.map(item=>[String(item.item_id),item]));
 const measurements=new Map();
 const fields=['valor','peso','cubagem'];
 const quantities={aberto:'quantidade_aberta',em_carga:'quantidade_alocada',sem_carga:'quantidade_sem_carga'};
 for(const item of items){
  const values={};
  for(const [kind,unit] of [['valor','valor_unitario'],['peso','peso_unitario'],['cubagem','cubagem_unitaria']])for(const [scope,quantity] of Object.entries(quantities))values[kind+'_'+scope]=measurable(Number(item[quantity]),n(item[unit]));
  measurements.set(String(item.item_id),values);
 }
 const aggregate=(ids,key)=>{const values=ids.map(id=>measurements.get(String(id))?.[key]??null);return {value:values.reduce((sum,value)=>sum+(value??0),0),missing:values.filter(value=>value==null).length}};
 const itemIds=items.map(item=>item.item_id),summary={};
 for(const kind of fields)for(const scope of Object.keys(quantities))summary[kind+'_'+scope]=aggregate(itemIds,kind+'_'+scope);
 const metric=(id,label,key,format,help)=>({id:'logistica.'+id,label,value:summary[key].missing&&summary[key].value===0?unavailable:summary[key].value,format,help,
  ...(summary[key].missing?{subtitle:'Parcial · '+summary[key].missing+' itens sem medida válida'}:{})});
 const scopeHelp='Calculado sobre o saldo aberto dos itens selecionados, sem repetir o pedido por carga. Não inclui quantidades já faturadas.';
 dashboard.metrics.push(
  metric('valueLoad','Valor em carga','valor_em_carga','currency',scopeHelp),
  metric('valueFree','Valor sem carga','valor_sem_carga','currency',scopeHelp),
  metric('weightLoad','Peso em carga','peso_em_carga','weight64','Peso bruto unitário do produto/variação × quantidade aberta em carga. '+scopeHelp),
  metric('weightFree','Peso sem carga','peso_sem_carga','weight64','Peso bruto unitário do produto/variação × saldo ainda sem carga. '+scopeHelp),
  metric('cubeLoad','Cubagem em carga','cubagem_em_carga','volume','Cubagem unitária do produto/variação em m³ × quantidade aberta em carga. Valores ausentes são identificados; cubagem não representa ocupação percentual do veículo.'),
  metric('cubeFree','Cubagem sem carga','cubagem_sem_carga','volume','Cubagem unitária do produto/variação em m³ × quantidade ainda sem carga. Não inclui quantidades já faturadas.')
 );
 const additions=[{key:'cliente',label:'Cliente',format:'text'},{key:'cidade',label:'Cidade',format:'text'},{key:'uf',label:'UF',format:'text'},{key:'tipo_entrega',label:'Entrega / retirada',format:'text'},
  {key:'valor_em_carga',label:'Valor em carga',format:'currency'},{key:'valor_sem_carga',label:'Valor sem carga',format:'currency'},
  {key:'peso_aberto',label:'Peso aberto (t)',format:'weight64'},{key:'cubagem_em_carga',label:'Cubagem em carga',format:'volume'},{key:'cubagem_sem_carga',label:'Cubagem sem carga',format:'volume'},
  {key:'status_erp',label:'Status no ERP',format:'text'}];
 dashboard.tables[0].columns.splice(2,0,...additions.slice(0,4));dashboard.tables[0].columns.push(...additions.slice(4));
 for(const order of orders){
  order.regiao=regions[order.uf]||'Não informada';
  for(const child of order.children){
   Object.assign(child,Object.fromEntries(Object.entries(measurements.get(child.item_id)).map(([key,value])=>[key,value==null?unavailable:value])));
   const source=byItem.get(child.item_id);child.identificacao='Item '+child.item_id+' · '+(source.produto||'Produto '+child.produto_id);
   for(const key of ['cliente','cidade','uf','tipo_entrega','status_erp'])child[key]=order[key];
  }
  for(const key of Object.keys(summary)){const total=aggregate(order.children.map(item=>item.item_id),key);order[key]=total.missing?unavailable:total.value;}
 }
 for(const [key,result] of Object.entries(summary))dashboard.tables[0].total[key]=result.missing?unavailable:result.value;
 const loadMap=new Map(dashboard.tables[1].rows.map(load=>[load.carga_id,load]));
 const ordersById=new Map(orders.map(order=>[order.pedido_id,order]));
 const sourceItemsByOrder=new Map(orders.map(order=>[order.pedido_id,new Map(order.children.map(item=>[item.item_id,item]))]));
 const loadOrdersById=new Map([...loadMap].map(([id,load])=>[id,new Map(load.children.map(order=>[String(order.pedido_id),order]))]));
 const allocationNodes=new Map([...loadMap.values()].flatMap(load=>load.children.flatMap(order=>order.children.map(item=>[item.id,item]))));
 const descriptionsByLoad=new Map();
 for(const link of links)if(!descriptionsByLoad.has(String(link.carga_id)))descriptionsByLoad.set(String(link.carga_id),link.descricao);
 for(const load of loadMap.values()){
  Object.assign(load,{descricao:descriptionsByLoad.get(load.carga_id)||'Carga '+load.carga_id,valor_em_carga:0,peso_em_carga:0,cubagem_em_carga:0});
  for(const child of load.children)Object.assign(child,{valor_em_carga:0,peso_em_carga:0,cubagem_em_carga:0});
 }
 for(const link of links){
  const load=loadMap.get(String(link.carga_id)),source=byItem.get(String(link.item_id));
  const order=loadOrdersById.get(String(link.carga_id)).get(String(link.pedido_id)),child=allocationNodes.get('alocacao-'+link.alocacao_id);
  const sourceOrder=ordersById.get(String(link.pedido_id));
  const sourceChild=sourceItemsByOrder.get(String(link.pedido_id)).get(String(link.item_id));
  Object.assign(child,{...sourceChild,id:child.id,carga_id:String(link.carga_id),quantidade_aberta:Number(link.quantidade_aberta),quantidade_alocada:Number(link.quantidade_aberta),quantidade_sem_carga:0,cargas:String(link.carga_id),situacao:'Em carga',previsao:link.previsao_faturamento,
   valor_aberto:measurable(Number(link.quantidade_aberta),n(source.valor_unitario))??unavailable,
   peso_aberto:measurable(Number(link.quantidade_aberta),n(source.peso_unitario))??unavailable,valor_sem_carga:0,peso_sem_carga:0,cubagem_sem_carga:0});
  for(const key of ['cliente','cidade','uf','tipo_entrega','status_erp','emissao','idade'])order[key]=sourceOrder[key];
  if(link.previsao_faturamento&&(!load.previsao||link.previsao_faturamento<load.previsao))load.previsao=link.previsao_faturamento;
  for(const [kind,unit] of [['valor','valor_unitario'],['peso','peso_unitario'],['cubagem','cubagem_unitaria']]){
   const key=kind+'_em_carga',value=measurable(Number(link.quantidade_aberta),n(source[unit]));child[key]=value==null?unavailable:value;
   for(const row of [load,order])row[key]=value==null||row[key]===unavailable?unavailable:row[key]+value;
  }
 }
 dashboard.tables[1].columns.splice(1,0,{key:'descricao',label:'Descrição da carga',format:'text'});
 dashboard.tables[1].columns.push({key:'pedido_id',label:'Pedido',format:'text'},{key:'cliente',label:'Cliente',format:'text'},{key:'cidade',label:'Cidade',format:'text'},{key:'uf',label:'UF',format:'text'});
 dashboard.tables[1].columns.splice(7,0,{key:'valor_em_carga',label:'Valor aberto em carga',format:'currency'},{key:'peso_em_carga',label:'Peso em carga (t)',format:'weight64'},{key:'cubagem_em_carga',label:'Cubagem em carga',format:'volume'},{key:'previsao',label:'Próxima previsão de faturamento',format:'date'});
 for(const kind of fields){const key=kind+'_em_carga';dashboard.tables[1].total[key]=summary[key].missing?unavailable:summary[key].value;}
 dashboard.tables[1].total.pedidos=new Set(links.map(link=>String(link.pedido_id))).size;
 dashboard.tables[1].total.identificacao='Total · pedidos distintos';
 const forecast=[];
 for(const link of links)forecast.push({date:link.previsao_faturamento,scope:'em_carga',quantity:Number(link.quantidade_aberta),item:byItem.get(String(link.item_id))});
 for(const item of items)if(Number(item.quantidade_sem_carga)>0)forecast.push({date:item.previsao_faturamento,scope:'sem_carga',quantity:Number(item.quantidade_sem_carga),item});
 const monthly=new Map(),daily=Array.from({length:7},(_,index)=>({date:addDays(dashboard.referenceDate,index),em_carga:0,sem_carga:0}));
 const forecastMeta={withoutDateQuantity:0,overdueQuantity:0,scheduledQuantity:0,missingPriceQuantity:0,missingWeightQuantity:0};
 for(const row of forecast){
  if(!row.date){forecastMeta.withoutDateQuantity+=row.quantity;continue;}
  if(row.date<dashboard.referenceDate)forecastMeta.overdueQuantity+=row.quantity;else forecastMeta.scheduledQuantity+=row.quantity;
  const month=row.date.slice(0,7);if(!monthly.has(month))monthly.set(month,{month,em_carga:0,sem_carga:0});
  const price=n(row.item.valor_unitario),weight=n(row.item.peso_unitario);
  if(price!=null)monthly.get(month)[row.scope]+=price*row.quantity;else forecastMeta.missingPriceQuantity+=row.quantity;
  const day=daily.find(day=>day.date===row.date);if(day){if(weight!=null)day[row.scope]+=weight*row.quantity;else forecastMeta.missingWeightQuantity+=row.quantity;}
 }
 const states=new Map(),statuses=new Map();
 for(const order of orders){
  const status=order.status_erp;if(!statuses.has(status))statuses.set(status,{status,pedidos:0,sem_carga:0,parciais:0});
  statuses.get(status).pedidos++;if(order.alocacao==='none')statuses.get(status).sem_carga++;if(order.alocacao==='partial')statuses.get(status).parciais++;
  if(!states.has(order.uf))states.set(order.uf,{UF:order.uf,volumeM3:0,weightKg:0,value:0,orders:0});
  const state=states.get(order.uf);state.orders++;
  for(const child of order.children)for(const [field,key] of [['volumeM3','cubagem_sem_carga'],['weightKg','peso_sem_carga'],['value','valor_sem_carga']])if(typeof child[key]==='number')state[field]+=child[key];
 }
 dashboard.series=[
  {id:'logistica.previsao-valor',title:'Previsão de faturamento por mês',type:'bar',x:'month',y:['em_carga','sem_carga'],stack:true,format:'currency',labels:{month:'Mês',em_carga:'Em carga',sem_carga:'Sem carga'},rows:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month))},
  {id:'logistica.previsao-peso',title:'Peso previsto para faturamento · próximos 7 dias',type:'bar',x:'date',y:['em_carga','sem_carga'],stack:true,format:'weight64',labels:{date:'Data',em_carga:'Em carga',sem_carga:'Sem carga'},rows:daily},
  {id:'logistica.geografia',title:'Cubagem sem carga por estado',type:'map',x:'UF',y:['volumeM3'],format:'volume',dimension:'UF',metricOptions:{volumeM3:'volumeM3',weightKg:'weightKg',value:'value',orders:'orders'},rows:[...states.values()].filter(state=>/^[A-Z]{2}$/.test(state.UF))}
 ];
 dashboard.operationalTables=[{id:'logistica-status',title:'Situação dos pedidos no ERP',rows:[...statuses.values()],columns:[{key:'status',label:'Status',format:'text'},{key:'pedidos',label:'Pedidos',format:'integer'},{key:'sem_carga',label:'Sem carga',format:'integer'},{key:'parciais',label:'Parciais',format:'integer'}],total:{status:'Total',pedidos:orders.length,sem_carga:orders.filter(order=>order.alocacao==='none').length,parciais:orders.filter(order=>order.alocacao==='partial').length}}];
 dashboard.options={ufs:[...new Set(allOrders.map(order=>order.uf))].sort(),cities:[...new Set(allOrders.map(order=>order.cidade))].sort(),statuses:[...new Set(allOrders.map(order=>order.status_erp))].sort()};
 dashboard.meta.measures=summary;dashboard.meta.forecast=forecastMeta;dashboard.meta.missingGeographyOrders=orders.filter(order=>order.uf==='Não informado').length;
 return dashboard;
}
