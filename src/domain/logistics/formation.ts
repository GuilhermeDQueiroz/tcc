import type {AnalyticTable,Row,Series} from '../../types/analytics'
export type FormationSelection={kind:'load'|'order';id:string}|null
const children=(row:Row)=>Array.isArray(row.children)?row.children as Row[]:[]
// Unknown measures stay unknown. Add only leaf allocations, never order totals twice.
function total(rows:Row[],keys:string[]):Row{
 return Object.fromEntries(keys.map(key=>[key,rows.some(row=>row[key]==='Não disponível')?'Não disponível':rows.reduce((sum,row)=>sum+(typeof row[key]==='number'?row[key] as number:0),0)]))
}
const allocationKeys=['quantidade_alocada','valor_em_carga','peso_em_carga','cubagem_em_carga']
const orderKeys=['quantidade_aberta','quantidade_alocada','quantidade_sem_carga','valor_aberto','valor_em_carga','valor_sem_carga','peso_aberto','peso_em_carga','peso_sem_carga','cubagem_em_carga','cubagem_sem_carga']
function withRows(table:AnalyticTable,rows:Row[],keys:string[]):AnalyticTable & {total:Row}{return {...table,rows,tree:rows,total:{identificacao:'Total exibido',...total(rows,keys)}}}
export function formationTables(tables:AnalyticTable[],selection:FormationSelection){
 const orders=tables[0]!,loads=tables[1]!
 if(!selection)return {orders,loads}
 if(selection.kind==='order'){
  const rows=loads.rows.flatMap(load=>{
   const linked=children(load).filter(order=>String(order.pedido_id)===selection.id)
   const dates=linked.flatMap(order=>children(order).map(item=>item.previsao)).filter(Boolean).sort()
   return linked.length?[{...load,children:linked,pedidos:linked.length,previsao:dates[0]||null,...total(linked,allocationKeys)}]:[]
  })
  const selected=withRows(loads,rows,allocationKeys)
  selected.total.pedidos=new Set(rows.flatMap(load=>children(load).map(order=>order.pedido_id))).size
  selected.total.identificacao='Total · pedidos distintos'
  return {orders,loads:selected}
 }
 const ordersById=new Map(orders.rows.map(row=>[String(row.pedido_id),row]))
 const load=loads.rows.find(row=>String(row.carga_id)===selection.id)
 const rows=children(load||{}).map(order=>{
  const source=ordersById.get(String(order.pedido_id))||{}
  const items=children(order)
  return {...source,id:'pedido-'+order.pedido_id,children:items,...total(items,orderKeys),cargas:selection.id,situacao:'Em carga selecionada',previsao:items.map(item=>item.previsao).filter(Boolean).sort()[0]||null}
 })
 return {loads,orders:withRows(orders,rows,orderKeys)}
}
export function formationOrders(tables:AnalyticTable[],selection:FormationSelection){
 if(selection?.kind==='order')return tables[0]!.rows.filter(row=>String(row.pedido_id)===selection.id)
 return formationTables(tables,selection).orders.rows
}
export function destinationSeries(orders:Row[]):Series{
 const states=new Map<string,Row>()
 const points:Row[]=[]
 for(const order of orders){
  const uf=String(order.uf||'');if(!/^[A-Z]{2}$/.test(uf))continue
  if(!states.has(uf))states.set(uf,{UF:uf,orders:0,cities:new Set<string>(),value:0,weightKg:0,volumeM3:0})
  const row=states.get(uf)!;row.orders=Number(row.orders)+1;(row.cities as Set<string>).add(String(order.cidade))
  for(const item of children(order))for(const [field,key] of [['value','valor_aberto'],['weightKg','peso_aberto'],['volumeM3','cubagem_aberto']]){
   const value=key==='cubagem_aberto' ? typeof item.cubagem_em_carga==='number'&&typeof item.cubagem_sem_carga==='number'?item.cubagem_em_carga+item.cubagem_sem_carga:null:item[key]
   if(typeof value==='number')row[field]=Number(row[field])+value
  }
  if(typeof order.latitude==='number'&&order.latitude>=-34&&order.latitude<=6&&order.latitude!==0&&typeof order.longitude==='number'&&order.longitude>=-74&&order.longitude<=-34){
   const sums=total(children(order),['valor_aberto','peso_aberto','cubagem_em_carga','cubagem_sem_carga','quantidade_aberta'])
   points.push({pedido_id:order.pedido_id,name:'Pedido '+order.pedido_id,cliente:order.cliente,cidade:order.cidade,uf,longitude:order.longitude,latitude:order.latitude,...sums})
  }
 }
 return {id:'logistica.destinos',title:'Destinos dos pedidos',type:'map',x:'UF',y:['volumeM3'],format:'volume',dimension:'UF',metricOptions:{volumeM3:'volumeM3',weightKg:'weightKg',value:'value',orders:'orders'},detailedMap:true,points,rows:[...states.values()].map(row=>({...row,cities:(row.cities as Set<string>).size}))}
}
export function destinationTable(orders:Row[],uf:string):AnalyticTable{
 const cities=new Map<string,Row>()
 for(const order of orders){
  if(uf&&order.uf!==uf)continue
  const key=String(order.uf)+'|'+String(order.cidade)
  if(!cities.has(key))cities.set(key,{id:key,cidade:order.cidade,uf:order.uf,pedidos:0,valor_aberto:0,peso_aberto:0,cubagem_em_carga:0,cubagem_sem_carga:0})
  const row=cities.get(key)!;row.pedidos=Number(row.pedidos)+1
  const sums=total(children(order),['valor_aberto','peso_aberto','cubagem_em_carga','cubagem_sem_carga'])
  for(const [field,value]of Object.entries(sums))row[field]=value==='Não disponível'||row[field]==='Não disponível'?'Não disponível':Number(row[field])+Number(value)
 }
 const rows:Row[]=[...cities.values()].map(row=>({...row,localidade:row.cidade}))
 const states=new Map<string,Row>()
 const keys=['pedidos','valor_aberto','peso_aberto','cubagem_em_carga','cubagem_sem_carga']
 for(const city of rows){
  const state=String(city.uf)
  if(!states.has(state))states.set(state,{id:'destino-uf-'+state,uf:state,localidade:state,children:[]})
  ;(states.get(state)!.children as Row[]).push(city)
 }
 const tree=[...states.values()].map(state=>({...state,...total(state.children as Row[],keys)}))
 return {id:'logistica-destinos',title:'Destinos por UF e cidade',rows,tree,total:{localidade:'Total',...total(rows,keys)},columns:[{key:'localidade',label:'UF / cidade',format:'text'},{key:'pedidos',label:'Pedidos',format:'integer'},{key:'valor_aberto',label:'Valor aberto',format:'currency'},{key:'peso_aberto',label:'Peso (t)',format:'weight64'},{key:'cubagem_em_carga',label:'Em carga (m³)',format:'volume'},{key:'cubagem_sem_carga',label:'Sem carga (m³)',format:'volume'}]}
}
