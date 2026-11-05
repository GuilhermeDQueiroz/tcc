import {filterRows} from './filters.js';
import {sum,mean,groupSum} from './metrics.js';
import {addDays,isoDate} from './dates.js';
import {InputError} from './contracts.js';
import {buildCohortAnalysis} from './cohorts.js';
import {canonicalDelivery} from './delivery.js';
export {canonicalDelivery};

const date=value=>isoDate(value)||null;
const monthStart=value=>value.slice(0,7)+'-01';
const monthShift=(value,offset)=>{
 const [year,month]=value.split('-').map(Number);
 return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10);
};
const maximum=values=>values.reduce((last,value)=>value&&value>last?value:last,'');
const weekStart=value=>{const day=new Date(value+'T00:00:00Z').getUTCDay();return addDays(value,-((day+6)%7));};
const label=(value,grain)=>grain==='month'?new Intl.DateTimeFormat('pt-BR',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z')).replace('.',''):value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(2,4);
const numericMean=(rows,column)=>mean(rows.map(row=>row[column]),{float32:true});
const percent=value=>value==null?null:Math.fround(value*100);
const validForecast=row=>Boolean(date(row.DT_PREVISAO_FATURAMENTO_DATE));
const summarize=rows=>({
 records:rows.length,withForecast:rows.filter(validForecast).length,
 service:rows.length?numericMean(rows,'NIVEL_DE_SERVICO_CLEAN'):null,
 otif:rows.length?percent(numericMean(rows,'ON_TIME_CLEAN')):null,
 weight:rows.length?groupSum(rows.map(row=>row.PESO_FATURADO_CLEAN),{float32:true}):0,
 value:sum(rows.map(row=>row.VALOR_FATURADO_CLEAN)),
});
const calendar=(start,end,grain)=>{
 const result=[];
 for(let value=grain==='month'?monthStart(start):grain==='week'?weekStart(start):start;value<=end;value=grain==='month'?monthShift(value,1):addDays(value,grain==='week'?7:1))result.push(value);
 return result;
};

function summarizeFlow(emissionRows,billingRows,filters,start,end){
 start=filters.emissionRange?.[0]>start?filters.emissionRange[0]:start;
 end=filters.emissionRange?.[1]<end?filters.emissionRange[1]:end;
 const months=start<=end?calendar(start,end,'month').length:0;
 const conversionStart=start===monthStart(start)?start:monthShift(start,1);
 const closedThrough=end===addDays(monthShift(end,1),-1)?end:addDays(monthStart(end),-1);
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
 const amount=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
 const add=(a,b)=>a==null||b==null?null:a+b;
 const itemKey=row=>row.CODIGO_ITEM==null||String(row.CODIGO_ITEM).trim()===''?null:JSON.stringify([String(row.CODIGO_ITEM).trim(),String(row.COR??'').trim()]);
 const dimensionFilters={dimensions:filters.dimensions};
 const population=filterRows(emissionRows.map(row=>{const delivery=canonicalDelivery(row.TIPO_ENTREGA);return delivery===row.TIPO_ENTREGA?row:{...row,TIPO_ENTREGA:delivery};}),dimensionFilters,{ignoreDates:true});
 const orders=new Map();
 for(const row of population){
  const emitted=row.DATA_EMISSAO_PEDIDO_DATE,key=String(row.CODIGO_PEDIDO??'').trim();
  if(!key||!validDate(emitted))continue;
  if(!orders.has(key))orders.set(key,{emitted,value:0,conflict:false,converted:false,items:new Map(),fullUnknown:false});
  const order=orders.get(key);
  order.conflict ||= order.emitted!==emitted;
  order.value=add(order.value,amount(row.VALOR_EMITIDO_CLEAN));
  if(emitted>=conversionStart&&emitted<=closedThrough){
   const item=itemKey(row),quantity=amount(row.QUANTIDADE_EMITIDA_CLEAN);
   if(!item||quantity==null||quantity<=0){order.fullUnknown=true;continue;}
   if(!order.items.has(item))order.items.set(item,{emitted:0,billed:0});
   order.items.get(item).emitted+=quantity;
  }
 }
 let emittedValue=0,conversionOrders=0;
 for(const [key,order] of orders){
  if(order.conflict||order.emitted<start||order.emitted>end){orders.delete(key);continue;}
  emittedValue=add(emittedValue,order.value);
  if(order.emitted>=conversionStart&&order.emitted<=closedThrough)conversionOrders++;
 }
 let billedValue=0;
 for(const row of filterRows(billingRows,dimensionFilters,{ignoreDates:true}))if(validDate(row.DT_FATURA_DATE)&&row.DT_FATURA_DATE>=start&&row.DT_FATURA_DATE<=end)billedValue=add(billedValue,amount(row.VALOR_FATURADO_CLEAN));
 for(const row of billingRows){
  const order=orders.get(String(row.CODIGO_PEDIDO??'').trim()),billed=row.DT_FATURA_DATE;
  if(!order||order.emitted<conversionStart||order.emitted>closedThrough||!validDate(billed)||billed<order.emitted||billed>closedThrough||row.DATA_EMISSAO_PEDIDO_DATE!==order.emitted||billed.slice(0,7)!==order.emitted.slice(0,7))continue;
  if(['VALOR_FATURADO_CLEAN','PESO_FATURADO_CLEAN','VOLUME_M3_FATURADO_CLEAN','QUANTIDADE_FATURADA_CLEAN'].some(key=>amount(row[key])>0))order.converted=true;
  const item=itemKey(row),quantity=amount(row.QUANTIDADE_FATURADA_CLEAN);
  if(!item||quantity==null||quantity<0){order.fullUnknown=true;continue;}
  if(order.items.has(item))order.items.get(item).billed+=quantity;
 }
 const convertedOrders=[...orders.values()].filter(order=>order.converted).length;
 let fullyConvertedOrders=0,fullConversionUnknownOrders=0;
 for(const order of orders.values()){
  if(order.emitted<conversionStart||order.emitted>closedThrough)continue;
  if(order.fullUnknown){fullConversionUnknownOrders++;continue;}
  if(order.converted&&order.items.size&&[...order.items.values()].every(item=>item.billed+0.000001>=item.emitted))fullyConvertedOrders++;
 }
 return {start,end,months,conversionStart,conversionThrough:closedThrough,conversionOrders,convertedOrders,fullyConvertedOrders,fullConversionUnknownOrders,emittedValue,billedValue,
  fullSameMonthConversion:conversionOrders&&!fullConversionUnknownOrders?fullyConvertedOrders/conversionOrders*100:null,
  monthlyEmissionAverage:months?emittedValue==null?null:emittedValue/months:null,monthlyBillingAverage:months?billedValue==null?null:billedValue/months:null,
  sameMonthConversion:conversionOrders?convertedOrders/conversionOrders*100:null,outflow:emittedValue>0&&billedValue!=null?billedValue/emittedValue*100:null,
  partialPeriod:months>0&&(start!==monthStart(start)||end!==addDays(monthShift(end,1),-1))};
}

// A compact composition of two published populations. Never turns billing into
// proof of physical delivery, nor replicates the formation tables in the client.
export function buildStrategicDashboard({logistics,billingRows,emissionRows=[],publication,filters={},granularity='month'}){
 const referenceDate=logistics.referenceDate;
 const valid=billingRows.filter(row=>date(row.DT_FATURA_DATE)).map(row=>{
  const delivery=canonicalDelivery(row.TIPO_ENTREGA);
  return delivery===row.TIPO_ENTREGA?row:{...row,TIPO_ENTREGA:delivery};
 });
 filters={...filters,dimensions:{...filters.dimensions,...(filters.dimensions?.TIPO_ENTREGA?{TIPO_ENTREGA:filters.dimensions.TIPO_ENTREGA.map(canonicalDelivery)}:{})}};
 const latest=maximum(valid.map(row=>row.DT_FATURA_DATE));
 const publishedEnd=latest&&latest<referenceDate?latest:referenceDate;
 const end=filters.billingRange?.[1]<publishedEnd?filters.billingRange[1]:publishedEnd;
 const windowStart=monthShift(monthStart(end),-11);
 const start=filters.billingRange?.[0]>windowStart?filters.billingRange[0]:windowStart;
 if(start>end)throw new InputError('O período de faturamento está além da cobertura publicada.');
 const selected=filterRows(valid,filters).filter(row=>row.DT_FATURA_DATE>=start&&row.DT_FATURA_DATE<=end);
 const totals=summarize(selected);
 const months=calendar(start,end,'month'),byMonth=new Map(),byGrain=new Map();
 for(const row of selected){
  const month=monthStart(row.DT_FATURA_DATE),period=granularity==='month'?month:granularity==='week'?weekStart(row.DT_FATURA_DATE):row.DT_FATURA_DATE;
  for(const [map,key] of [[byMonth,month],[byGrain,period]]){if(!map.has(key))map.set(key,[]);map.get(key).push(row);}
 }
 const monthly=months.map(period=>({period,label:label(period,'month'),...summarize(byMonth.get(period)||[])}));
 const earliest=valid.reduce((first,row)=>row.DT_FATURA_DATE<first?row.DT_FATURA_DATE:first,latest||referenceDate);
 const grainRows=calendar(start,end,granularity).map(period=>{
  const rows=byGrain.get(period)||[],t=summarize(rows);
  const bucketEnd=granularity==='month'?addDays(monthShift(period,1),-1):addDays(period,granularity==='week'?6:0);
  const covered=Boolean(valid.length)&&bucketEnd>=earliest&&period<=publishedEnd;
  return {period,label:label(period,granularity),value:covered?Math.fround(t.weight/1000):null,records:t.records};
 });
 // Calendar-day rate: 90 days including the published balance reference.
 // A display-period filter must not change the backlog denominator.
 const {billingRange,...rateFilters}=filters;
 const rateRows=filterRows(valid,rateFilters).filter(row=>row.DT_FATURA_DATE>=addDays(referenceDate,-89)&&row.DT_FATURA_DATE<=referenceDate);
 const dailyAverage=sum(rateRows.map(row=>row.VALOR_FATURADO_CLEAN))/90;
 const orders=logistics.tables[0].rows,measures=logistics.meta.measures;
 const openValue=measures.valor_aberto?.missing?null:measures.valor_aberto?.value??null;
 const loadValue=measures.valor_em_carga?.missing?null:measures.valor_em_carga?.value??null;
 const openWeight=measures.peso_aberto?.missing?null:measures.peso_aberto?.value??null;
 const metric=(id,label,value,format,help)=>({id:'strategic.'+id,label,value,format,help});
 const formatDate=value=>value.split('-').reverse().join('/');
 const balanceHelp='Saldo dos pedidos publicado em '+formatDate(referenceDate)+'. ';
 const historyHelp='Faturamentos de '+formatDate(start)+' a '+formatDate(end)+'. ';
 const coverage=totals.records?totals.withForecast/totals.records*100:null;
 const flow=summarizeFlow(emissionRows,valid,filters,start,end);
 const flowHelp=flow.months?'Período comum de '+formatDate(flow.start)+' a '+formatDate(flow.end)+'. '+(flow.partialPeriod?'Recorte parcial; médias divididas pelas '+flow.months+' competências incluídas. ':''):'Sem período comum entre os filtros de emissão e faturamento. ';
 const conversionHelp=flow.conversionStart<=flow.conversionThrough?'Competências mensais completas de '+formatDate(flow.conversionStart)+' a '+formatDate(flow.conversionThrough)+'. ':'Nenhuma competência mensal completa no recorte. ';
 const metrics=[
  metric('loads','Cargas em aberto',logistics.metrics.find(metric=>metric.id==='logistica.loads')?.value??0,'integer',balanceHelp+'Cargas distintas com saldo aberto vinculado. Não confirma saída física.'),
  metric('valueLoad','Valor em carga',loadValue,'currency',balanceHelp+'Valor unitário × quantidade aberta alocada, sem duplicar pedidos que participam de várias cargas. Medidas incompletas são exibidas como indisponíveis.'),
  metric('weightKg','Peso em aberto',openWeight,'weight64',balanceHelp+'Peso bruto unitário × quantidade aberta, incluindo saldo em carga e sem carga. Exibido em toneladas.'),
  metric('backlogReal','Backlog',dailyAverage>0&&openValue!=null?openValue/dailyAverage:null,'days',balanceHelp+'Valor total aberto ÷ faturamento médio diário dos 90 dias anteriores, incluindo a referência. Base: dias corridos e os mesmos filtros de localização, entrega e emissão. O período de faturamento exibido nos gráficos não altera essa base. Não é prazo prometido de entrega.'),
  metric('orders30','Pedidos > 30 dias',orders.filter(order=>Number(order.idade)>30).length,'integer',balanceHelp+'Pedidos distintos emitidos há mais de 30 dias. Tempo em aberto não significa atraso em relação a uma promessa de entrega.'),
  metric('serviceDays','Nível de serviço',totals.service,'days',historyHelp+'Lead time médio dos registros faturados: data de faturamento menos data de emissão do pedido. O total é calculado sobre os registros, sem fazer média das médias mensais.'),
  metric('otif','OTIF',totals.otif,'percent',historyHelp+'Regra atual: proporção dos registros faturados até a previsão de faturamento. Sem previsão é contado como fora do prazo, conforme a regra existente. Não comprova entrega física nem atendimento integral. Registros com previsão: '+(coverage==null?'não disponível':coverage.toFixed(1).replace('.',',')+'%')+'.'),
  {...metric('sameMonthConversion','Conversão no mês',flow.sameMonthConversion,'percent',conversionHelp+'Algum faturamento: pedidos com faturamento no próprio mês ÷ todos os emitidos × 100, incluindo parciais. Integral no mês: pedidos cujas quantidades emitidas de cada produto e cor foram totalmente faturadas até o fim do mês de entrada ÷ a mesma base × 100. Notas parciais são somadas; excedentes de um produto ou cor não compensam faltas de outro (tolerância de 0,000001 unidade). Média ponderada por pedidos, incluindo os sem faturamento, sem duplicar itens ou notas. Base: '+flow.convertedOrders.toLocaleString('pt-BR')+' com faturamento e '+flow.fullyConvertedOrders.toLocaleString('pt-BR')+' integrais confirmados de '+flow.conversionOrders.toLocaleString('pt-BR')+' emitidos. '+(flow.fullConversionUnknownOrders?flow.fullConversionUnknownOrders.toLocaleString('pt-BR')+' pedidos sem dados suficientes; taxa integral indisponível. ':'')+'Não é a janela de 30 dias nem comprova entrega física.'),subtitle:'Algum faturamento',supplementary:[{label:'Integral no mês',value:flow.fullSameMonthConversion,format:'percent'}]},
  {...metric('outflow','Escoamento',flow.outflow,'percent',flowHelp+'Média mensal do faturamento em R$ ÷ média mensal da entrada de pedidos em R$ × 100; equivale à razão entre os totais do mesmo período. Inclui faturamento de pedidos emitidos em meses anteriores. Acima de 100% significa faturamento superior à entrada; não confirma entrega nem, isoladamente, a variação da carteira. O filtro de emissão delimita o período comum, sem excluir do faturamento as safras anteriores.'),subtitle:flow.partialPeriod?'Período parcial':'Médias mensais',supplementary:[{label:'Faturamento/mês',value:flow.monthlyBillingAverage,format:'currencyCompact'},{label:'Entrada/mês',value:flow.monthlyEmissionAverage,format:'currencyCompact'}]},
 ];
 const priority=(id,label,value,format,help)=>({id:'priority.'+id,label,value,format,help:balanceHelp+help});
 const operationalMetrics=[
  priority('valueFree','Valor sem carga',measures.valor_sem_carga?.missing?null:measures.valor_sem_carga?.value??null,'currency','Valor unitário × saldo ainda não alocado. Inclui a parcela livre de pedidos parcialmente alocados. Preços ausentes tornam a medida indisponível.'),
  priority('freeOrders','Pedidos com saldo sem carga',orders.filter(order=>Number(order.quantidade_sem_carga)>=0.000001).length,'integer','Pedidos distintos com saldo sem carga, incluindo os parcialmente alocados. Saldo mínimo de 0,000001 unidade, como no filtro de detalhamento. Um pedido com vários itens é contado uma vez.'),
  priority('overdueOrders','Previsão vencida',orders.filter(order=>date(order.previsao)&&order.previsao<referenceDate).length,'integer','Pedidos distintos com previsão de faturamento anterior à referência. Previsões para hoje e pedidos sem data não entram nesta contagem.'),
  priority('undatedOrders','Pedidos sem previsão',orders.filter(order=>!date(order.previsao)).length,'integer','Pedidos distintos sem previsão de faturamento válida. Ausência de prazo não comprova atraso.'),
 ];
 const trend=(id,title,key,format)=>({id:'strategic.'+id,title,type:'line',x:'label',y:['value'],format,overviewStyle:true,labels:{value:title},rows:monthly.map(row=>({period:row.period,label:row.label,value:row[key],records:row.records,withForecast:row.withForecast}))});
 const deliveries=new Map();
 for(const row of selected){const type=String(row.TIPO_ENTREGA||'Não informado').trim();deliveries.set(type,(deliveries.get(type)||0)+Number(row.VALOR_FATURADO_CLEAN||0));}
 const series=[
  trend('service','Nível de serviço por mês','service','days'),
  {...trend('revenueKg','R$/kg faturado','value','currency'),rows:monthly.map(row=>({period:row.period,label:row.label,value:row.records&&row.weight>0?row.value/row.weight:null}))},
  {id:'strategic.tonnage',title:'Toneladas faturadas · '+({month:'mês',week:'semana',day:'dia'}[granularity]),type:'bar',x:'label',y:['value'],format:'decimal',labels:{value:'Toneladas'},overviewStyle:true,rows:grainRows},
  trend('otif','Evolução do OTIF por mês','otif','percent'),
  {id:'strategic.delivery',title:'Entrega / retirada · valor faturado',type:'donut',x:'type',y:['value'],format:'currency',labels:{value:'Valor faturado'},compactDonut:true,rows:[...deliveries].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([type,value])=>({type,value}))},
 ];
 const options={};
 for(const [key,logisticsKey] of [['UF','ufs'],['CIDADE','cities'],['TIPO_ENTREGA',null]]){
  const values=[...valid,...emissionRows].map(row=>key==='TIPO_ENTREGA'?canonicalDelivery(row[key]):row[key]).filter(value=>typeof value==='string'&&value.trim()&&value!=='None');
  values.push(...(logisticsKey?logistics.options[logisticsKey]||[]:(logistics.options.deliveries||orders.map(order=>order.tipo_entrega)).map(canonicalDelivery)));
  options[key]=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 }
 const cohorts=buildCohortAnalysis({emissionRows,billingRows,referenceDate,filters});
 return {dataVersion:publication.version+'|'+logistics.dataVersion,source:publication.source,referenceDate,metrics,operationalMetrics,series,options,cohorts,
  meta:{publishedAt:logistics.meta.publishedAt,history:{start,end,records:totals.records,withForecast:totals.withForecast,forecastCoverage:coverage,partialMonth:end!==addDays(monthShift(end,1),-1)},
   backlog:{dailyAverage,start:addDays(referenceDate,-89),end:referenceDate,records:rateRows.length},flow,
   publications:{logistics:{version:logistics.dataVersion,referenceDate,publishedAt:logistics.meta.publishedAt},billing:{version:publication.version,publishedAt:publication.publishedAt,lastBillingDate:latest||null}}}};
}
