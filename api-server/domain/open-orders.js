import {groupRows,groupSum,groupMean,sum,mean,distinct} from './metrics.js';
// legacy/views/pedidos_em_aberto.py: df_grouped and tot_ped_aberto.
export const openOrderColumns=[
 ['CODIGO_PEDIDO','Pedido','text'],['CODIGO_CLIENTE','Cód. Cliente','text'],['RAZAO_SOCIAL','Razão Social','text'],['TIPO_ENTREGA','Tipo de Entrega','text'],['STATUS','Status','text'],
 ['VALOR_EM_ABERTO_CLEAN','Valor (R$)','currency'],['PESO_EM_ABERTO_CLEAN','Peso (t)','weight'],['VOLUME_M3_EM_ABERTO_CLEAN','Volume (m³)','volume'],['QTDEABERTA_DOCITEMDET_CLEAN','Qtd. Itens','integer'],['NIVEL_DE_SERVICO_CLEAN','Nível de Serviço','serviceDecimal']
].map(([key,label,format])=>({key,label,format}));
export function groupOpenOrders(rows){
 const grouped=groupRows(rows,['CODIGO_PEDIDO']).map(group=>{
  const result={CODIGO_PEDIDO:group[0].CODIGO_PEDIDO};
  for(const key of ['CODIGO_CLIENTE','RAZAO_SOCIAL','TIPO_ENTREGA','STATUS'])result[key]=group.find(row=>row[key]!=null)?.[key]??null;
  for(const key of ['VALOR_EM_ABERTO_CLEAN','PESO_EM_ABERTO_CLEAN','VOLUME_M3_EM_ABERTO_CLEAN','QTDEABERTA_DOCITEMDET_CLEAN'])result[key]=groupSum(group.map(row=>row[key]),{float32:key!=='VALOR_EM_ABERTO_CLEAN'});
  result.NIVEL_DE_SERVICO_CLEAN=groupMean(group.map(row=>row.NIVEL_DE_SERVICO_CLEAN),{float32:true});return result;
 });
 const total={CODIGO_PEDIDO:'TOTAL',CODIGO_CLIENTE:`${distinct(grouped.map(row=>row.CODIGO_CLIENTE))} clientes`,RAZAO_SOCIAL:`${grouped.length} pedidos`,TIPO_ENTREGA:'-',STATUS:'-'};
 for(const key of ['VALOR_EM_ABERTO_CLEAN','PESO_EM_ABERTO_CLEAN','VOLUME_M3_EM_ABERTO_CLEAN','QTDEABERTA_DOCITEMDET_CLEAN'])total[key]=sum(grouped.map(row=>row[key]),{float32:key!=='VALOR_EM_ABERTO_CLEAN'});
 total.NIVEL_DE_SERVICO_CLEAN=mean(grouped.map(row=>row.NIVEL_DE_SERVICO_CLEAN),{float32:true});
 return {rows:grouped,total};
}
