import {summarize,groupRows} from './metrics.js';
import {canonicalDelivery} from './delivery.js';

const labels={weightKg:'Peso faturado',volumeM3:'Cubagem faturada',orders:'Pedidos com faturamento',quantity:'Itens faturados',serviceDays:'Lead time até faturamento',onTime:'Faturamento no prazo',groups:'Grupos atendidos',value:'Valor faturado'};
const formats={weightKg:'weight',volumeM3:'volume',orders:'integer',quantity:'number',serviceDays:'days',onTime:'ratio',groups:'integer',value:'currency'};
const serviceHelp='Média por registro do tempo entre emissão e faturamento. Faturamentos parciais participam da média. Não mede entrega ao cliente.';
const onTimeHelp='Pontualidade do faturamento pela regra ON_TIME_CLEAN do ERP/DW. Não comprova entrega física nem atendimento integral (In Full).';
const physicalHelp={weightKg:'Soma do peso das parcelas faturadas no recorte, apresentada em toneladas. Não mede ocupação de veículo nem peso entregue.',volumeM3:'Soma da cubagem das parcelas faturadas no recorte, em metros cúbicos. Não mede capacidade disponível.',orders:'Pedidos distintos com algum faturamento no recorte, inclusive parcial. Não comprova atendimento integral.',quantity:'Soma das quantidades de itens faturadas no recorte.',groups:'Grupos de clientes distintos com algum faturamento no recorte.',value:'Soma do valor das parcelas faturadas no recorte. Contexto econômico do fluxo processado; não é custo de frete.'};
const metricKeys=Object.keys(labels);
const tableKeys=['weightKg','Peso','Toneladas','volumeM3','Volume_M3','orders','Pedidos','Qtd_Pedidos','quantity','Qtde','serviceDays','Lead_Time','NS','NivelServico','onTime','OTIF','groups','Clientes','Grupos_Atendidos','value','Valor'];
const aliases={Peso:'weightKg',Toneladas:'weightKg',Volume_M3:'volumeM3',Pedidos:'orders',Qtd_Pedidos:'orders',Qtde:'quantity',Lead_Time:'serviceDays',NS:'serviceDays',NivelServico:'serviceDays',OTIF:'onTime',Clientes:'groups',Grupos_Atendidos:'groups',Valor:'value'};
export function billingHierarchy(dimension='UF'){
 const geography={UF:['UF','CIDADE','CLIENTE','CODIGO_PEDIDO'],REGIAO_UF:['REGIAO_UF','UF','CIDADE','CLIENTE','CODIGO_PEDIDO'],TIPO_ENTREGA:['TIPO_ENTREGA','UF','CIDADE','CLIENTE','CODIGO_PEDIDO']};
 return geography[dimension];
}
function logisticsTable(table){
 const columns=table.columns.filter(c=>tableKeys.includes(c.key)||c===table.columns[0]).map(c=>{
  const key=aliases[c.key]||c.key;
  return labels[key]?{...c,label:c.key==='Toneladas'?'Peso faturado (t)':labels[key],format:c.key==='Toneladas'?'number':formats[key]}:c;
 }).sort((a,b)=>a===table.columns[0]?-1:b===table.columns[0]?1:tableKeys.indexOf(a.key)-tableKeys.indexOf(b.key));
 return {...table,columns};
}
const dailyColumns=[{key:'Data',label:'Data',format:'date'},...metricKeys.map(key=>({key,label:labels[key],format:formats[key]}))];
function dailyDashboard(rows){
 const daily=groupRows(rows,['DT_FATURA_DATE']).map(items=>({Data:items[0].DT_FATURA_DATE,...summarize(items,'faturados',{grouped:true})}));
 const summary=summarize(rows,'faturados');
 return {series:[
  {id:'billingWeightDaily',title:'Peso faturado por dia',type:'bar',rows:daily,x:'Data',y:['weightKg'],format:'weight'},
  {id:'billingVolumeDaily',title:'Cubagem faturada por dia',type:'bar',rows:daily,x:'Data',y:['volumeM3'],format:'volume'},
  {id:'billingOrdersDaily',title:'Pedidos com faturamento por dia',type:'bar',rows:daily,x:'Data',y:['orders'],format:'integer'},
  {id:'billingServiceDaily',title:'Lead time até faturamento por dia',type:'line',rows:daily,x:'Data',y:['serviceDays'],format:'days'},
  {id:'billingOnTimeDaily',title:'Faturamento no prazo por dia',type:'line',rows:daily,x:'Data',y:['onTime'],format:'ratio'}
 ],table:{id:'billingDaily',title:'Fluxo faturado por dia',rows:daily,columns:dailyColumns,total:{Data:'TOTAL',...summary}}};
}
function modalityDashboard(rows,metric){
 const data=groupRows(rows.map(r=>({...r,TIPO_ENTREGA:canonicalDelivery(r.TIPO_ENTREGA)})),['TIPO_ENTREGA']).map(items=>({TIPO_ENTREGA:items[0].TIPO_ENTREGA,Modalidade:items[0].TIPO_ENTREGA,...summarize(items,'faturados',{grouped:true})}));
 // Canonical labels can combine multiple original ERP values. Do not turn
 // these labels into exact-match filters that would omit part of the group.
 return {series:{id:'billingModalities',title:`Modalidade de atendimento • ${labels[metric]}`,type:'pie',rows:data,x:'Modalidade',y:[metric],format:formats[metric]},
  table:{id:'billingModalities',title:'Entrega e retirada • modalidade cadastrada',rows:data,columns:[{key:'Modalidade',label:'Modalidade',format:'text'},...dailyColumns.slice(1)],total:{Modalidade:'TOTAL',...summarize(rows,'faturados')}}};
}
function geographicSeries(rows,metric){
 const result=[];
 for(const dimension of ['UF','CIDADE','REGIAO_UF']){
  const clean=rows.filter(r=>r[dimension]!=null&&String(r[dimension]).trim()&&!['nan','None'].includes(String(r[dimension]))).map(r=>({...r,_originalDestination:String(r[dimension]),[dimension]:String(r[dimension]).trim()}));
  const ranked=groupRows(clean,[dimension]).map(items=>({[dimension]:items[0][dimension],filterValues:[...new Set(items.map(r=>r._originalDestination))],...summarize(items,'faturados',{grouped:true})})).sort((a,b)=>b[metric]-a[metric]);
  result.push({id:`top10_${dimension}`,title:`Principais destinos por ${labels[metric].toLowerCase()} • ${dimension}`,type:'bar',rows:ranked.slice(0,10).reverse(),x:dimension,y:[metric],format:formats[metric],dimension});
  if(dimension==='UF')result.push({id:'map',title:`Distribuição por UF • ${labels[metric]}`,type:'map',rows:ranked,x:'UF',y:[metric],format:formats[metric],dimension:'UF'});
 }
 return result;
}

// Presentation profile for Faturados: commercial formulas remain available to
// Emitidos and equivalence tests, while this route prioritizes logistics.
export function buildBillingLogisticsDashboard(payload,{tab,rows=[],metric='weightKg'}){
 if(payload.meta.empty)return {...payload,meta:{...payload.meta,focus:'logistics'}};
 const selectedMetric=['value','weightKg','volumeM3','quantity','orders'].includes(metric)?metric:'weightKg';
 const period=tab==='semanal'?payload.meta.periods?.[0]:tab==='mensal'||tab==='resumo'?payload.meta.dimensionPeriod:null;
 const current=rows.filter(r=>r.DT_FATURA_DATE&&(!period||(r.DT_FATURA_DATE>=period.start&&r.DT_FATURA_DATE<=period.end)));
 const forecastRecords=current.filter(r=>r.DT_PREVISAO_FATURAMENTO_DATE).length;
 const forecastCoverage=current.length?forecastRecords/current.length*100:null;
 const coverageHelp=` ${forecastRecords} de ${current.length} registros com previsão de faturamento. Registros sem previsão mantêm zero na regra existente.`;
 let metrics=payload.metrics.filter(m=>metricKeys.includes(m.id)||m.id.startsWith('safra')).map(m=>({...m,label:labels[m.id]||m.label,
  ...(physicalHelp[m.id]?{help:physicalHelp[m.id]}:{}),
  ...(m.id==='serviceDays'?{help:serviceHelp,supplementary:[]}:m.id==='onTime'?{help:onTimeHelp+coverageHelp}:{})}));
 if(tab==='semanal'&&current.length){const s=summarize(current,'faturados');metrics.push({id:'serviceDays',label:labels.serviceDays,value:s.serviceDays,format:'days',help:serviceHelp});}
 metrics.sort((a,b)=>(metricKeys.indexOf(a.id)<0?99:metricKeys.indexOf(a.id))-(metricKeys.indexOf(b.id)<0?99:metricKeys.indexOf(b.id)));
 let series=payload.series.map(s=>({...s})),tables=payload.tables.map(logisticsTable);
 const latest=current.map(r=>r.DT_FATURA_DATE).sort().at(-1);
 const dimensionScope=['dimensoes','geografia'].includes(tab)?current.filter(r=>r.DT_FATURA_DATE.startsWith(latest?.slice(0,4)||'')):current;
 const dimensionTotal=summarize(dimensionScope,'faturados');
 tables=tables.map(t=>t.id.startsWith('faturados.dimensoes.')?{...t,total:{...t.total,Qtd_Pedidos:dimensionTotal.orders,'Qtd Pedidos':dimensionTotal.orders,Grupos_Atendidos:dimensionTotal.groups,'Grupos Atendidos':dimensionTotal.groups}}:t);
 if(tab==='mensal'||tab==='resumo'||tab==='semanal'){
  const daily=dailyDashboard(current);series=daily.series;
  tables=[daily.table,...(tab==='semanal'?[]:tables.filter(t=>t.id!=='daily'))];
 }
 if(tab==='evolucao'){
  const monthly=payload.tables.find(t=>t.id==='monthly')?.rows||[];
  const priorities=['weight','service','otif','orders','items','groups','heatmap'];
  series=priorities.flatMap(id=>payload.series.filter(s=>s.id===id).map(s=>({...s,title:id==='service'?'Lead time até faturamento por mês':id==='otif'?'Faturamento no prazo por mês':s.title})));
  series.splice(1,0,{id:'billingVolumeMonthly',title:'Cubagem faturada por mês',type:'bar',rows:monthly,x:'Mes_Ano',y:['Volume_M3'],format:'volume'});
  tables=tables.map(t=>t.treeSpec?{...t,treeSpec:{...t.treeSpec,columns:['Mes_Ano','UF','CIDADE','CLIENTE','CODIGO_PEDIDO']}}:t);
 }
 if(tab==='geografia'){
  metrics=payload.metrics.filter(m=>['uf','cidade'].includes(m.id));
  series=geographicSeries(current,selectedMetric);
 }
 if(tab==='dimensoes'){
  // Use the chosen physical metric in BOTH dimensional charts, rather than
  // silently reverting the monthly chart to sales value.
  const latest=current.map(r=>r.DT_FATURA_DATE).sort().at(-1),year=latest?.slice(0,4),dimension=payload.meta.dimension;
  const selected=current.filter(r=>r.DT_FATURA_DATE.startsWith(year||''));
  const tableMetric={weightKg:'Peso',volumeM3:'Volume_M3',quantity:'Qtde',orders:'Qtd_Pedidos',value:'Valor'}[selectedMetric];
  const cats=new Set((payload.tables[0]?.rows||[]).slice().sort((a,b)=>b[tableMetric]-a[tableMetric]).slice(0,7).map(r=>r[dimension]));
  const categorized=selected.map(r=>({...r,month:r.DT_FATURA_DATE.slice(0,7),category:cats.has(r[dimension])?r[dimension]:'Outros'}));
  const evolution=groupRows(categorized,['month','category']).map(items=>({month:items[0].month,category:items[0].category,value:summarize(items,'faturados',{grouped:true})[selectedMetric]}));
  series=series.map(s=>s.id.endsWith('.evolucao')?{...s,rows:evolution,title:`Evolução mensal por dimensão • ${labels[selectedMetric]}`,format:formats[selectedMetric]}:s);
 }
 if(current.length&&['mensal','resumo','semanal','evolucao','geografia'].includes(tab)){
  const modality=modalityDashboard(current,selectedMetric);series.push(modality.series);tables.push(modality.table);
 }
 return {...payload,metrics,series,tables,meta:{...payload.meta,focus:'logistics',billingPeriod:period,billingRecords:current.length,forecastCoverage,forecastRecords,serviceDefinition:serviceHelp,onTimeDefinition:onTimeHelp+coverageHelp}};
}
