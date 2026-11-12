import {strategicDefaultPeriod} from '../../shared/strategic-period.js';
import {filterRows} from './filters.js';
import {sum} from './metrics.js';
import {addDays,isoDate} from './dates.js';
import {buildCohortAnalysis} from './cohorts.js';
import {canonicalDelivery} from './delivery.js';
import {logisticsBacklog} from './logistics-backlog.js';
import {summarizeStrategicRows as summarize} from './strategic-summary.js';
import {buildPortfolioAnalysis} from './strategic-portfolio.js';
import {buildStrategicAnalysis} from './strategic-analysis.js';
import {buildStrategicFinancial,strategicPreviousPeriod} from './strategic-financial.js';
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
const calendar=(start,end,grain)=>{
 const result=[];
 for(let value=grain==='month'?monthStart(start):grain==='week'?weekStart(start):start;value<=end;value=grain==='month'?monthShift(value,1):addDays(value,grain==='week'?7:1))result.push(value);
 return result;
};

function summarizeFlow(emissionRows,billingRows,filters,start,end,dimension,observationEnd=end){
 const monthlyAmounts=new Map();
 const monthValues=period=>{if(!monthlyAmounts.has(period))monthlyAmounts.set(period,{emittedValue:0,billedValue:0,conversionOrders:0,convertedOrders:0});return monthlyAmounts.get(period);};
 start=filters.emissionRange?.[0]>start?filters.emissionRange[0]:start;
 end=filters.emissionRange?.[1]<end?filters.emissionRange[1]:end;
 const months=start<=end?calendar(start,end,'month').length:0;
 const conversionStart=start===monthStart(start)?start:monthShift(start,1);
 const observed=observationEnd<end?observationEnd:end;
 const closedThrough=observed===addDays(monthShift(observed,1),-1)?observed:addDays(monthStart(observed),-1);
 const validatedDates=new Map();
 const validDate=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  if(validatedDates.has(value))return validatedDates.get(value);
  const parsed=new Date(value+'T00:00:00Z');
  const valid=Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;
  if(validatedDates.size>=4096)validatedDates.clear();
  validatedDates.set(value,valid);
  return valid;
 };
 const amount=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
 const add=(a,b)=>a==null||b==null?null:a+b;
 const itemKey=row=>row.CODIGO_ITEM==null||String(row.CODIGO_ITEM).trim()===''?null:JSON.stringify([String(row.CODIGO_ITEM).trim(),String(row.COR??'').trim()]);
 const dimensionFilters={dimensions:filters.dimensions};
 const normalizeDelivery=dimension==='TIPO_ENTREGA'||Boolean(filters.dimensions?.TIPO_ENTREGA?.length);
 const source=normalizeDelivery?emissionRows.map(row=>{const delivery=canonicalDelivery(row.TIPO_ENTREGA);return delivery===row.TIPO_ENTREGA?row:{...row,TIPO_ENTREGA:delivery};}):emissionRows;
 const population=filterRows(source,dimensionFilters,{ignoreDates:true});
 const orders=new Map(),dimensionValues=new Map();
 const dimensionKey=row=>{const raw=String(row[dimension]??'').trim();return !raw||raw==='None'?'Não informado':raw;};
 const dimensionValue=key=>{if(!dimensionValues.has(key))dimensionValues.set(key,{label:key,emittedValue:0,billedValue:0,conversionOrders:0,convertedOrders:0});return dimensionValues.get(key);};
 for(const row of population){
  const emitted=row.DATA_EMISSAO_PEDIDO_DATE,key=String(row.CODIGO_PEDIDO??'').trim();
  if(!key||!validDate(emitted))continue;
  if(!orders.has(key))orders.set(key,{emitted,value:0,conflict:false,converted:false,items:new Map(),fullUnknown:false,dimensions:new Map()});
  const order=orders.get(key);
  order.conflict ||= order.emitted!==emitted;
  order.value=add(order.value,amount(row.VALOR_EMITIDO_CLEAN));
  if(dimension){const key=dimensionKey(row);order.dimensions.set(key,add(order.dimensions.has(key)?order.dimensions.get(key):0,amount(row.VALOR_EMITIDO_CLEAN)));}
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
  const month=monthValues(monthStart(order.emitted));month.emittedValue=add(month.emittedValue,order.value);
  const eligible=order.emitted>=conversionStart&&order.emitted<=closedThrough;
  if(eligible){conversionOrders++;month.conversionOrders++;}
  if(dimension)for(const [label,value] of order.dimensions){const group=dimensionValue(label);group.emittedValue=add(group.emittedValue,value);if(eligible)group.conversionOrders++;}
 }
 let billedValue=0;
 for(const row of filterRows(billingRows,dimensionFilters,{ignoreDates:true}))if(validDate(row.DT_FATURA_DATE)&&row.DT_FATURA_DATE>=start&&row.DT_FATURA_DATE<=end){const value=amount(row.VALOR_FATURADO_CLEAN);billedValue=add(billedValue,value);const month=monthValues(monthStart(row.DT_FATURA_DATE));month.billedValue=add(month.billedValue,value);if(dimension){const group=dimensionValue(dimensionKey(row));group.billedValue=add(group.billedValue,value);}}
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
  if(order.converted){monthValues(monthStart(order.emitted)).convertedOrders++;if(dimension)for(const key of order.dimensions.keys())dimensionValue(key).convertedOrders++;}
  if(order.fullUnknown){fullConversionUnknownOrders++;continue;}
  if(order.converted&&order.items.size&&[...order.items.values()].every(item=>item.billed+0.000001>=item.emitted))fullyConvertedOrders++;
 }
 const monthly=start<=end?calendar(start,end,'month').map(period=>{const values=monthValues(period);return {period,label:label(period,'month'),...values,conversion:values.conversionOrders?values.convertedOrders/values.conversionOrders*100:null,outflow:values.emittedValue>0&&values.billedValue!=null?values.billedValue/values.emittedValue*100:null};}):[];
 const byDimension=dimension?[...dimensionValues.values()].map(row=>({...row,conversion:row.conversionOrders?row.convertedOrders/row.conversionOrders*100:null,outflow:row.emittedValue>0&&row.billedValue!=null?row.billedValue/row.emittedValue*100:null})):undefined;
 return {...(dimension?{byDimension}:{}),start,end,months,monthly,conversionStart,conversionThrough:closedThrough,conversionOrders,convertedOrders,fullyConvertedOrders,fullConversionUnknownOrders,emittedValue,billedValue,
  fullSameMonthConversion:conversionOrders&&!fullConversionUnknownOrders?fullyConvertedOrders/conversionOrders*100:null,
  monthlyEmissionAverage:months?emittedValue==null?null:emittedValue/months:null,monthlyBillingAverage:months?billedValue==null?null:billedValue/months:null,
  sameMonthConversion:conversionOrders?convertedOrders/conversionOrders*100:null,outflow:emittedValue>0&&billedValue!=null?billedValue/emittedValue*100:null,
  partialPeriod:months>0&&(start!==monthStart(start)||end!==addDays(monthShift(end,1),-1))};
}

// A compact composition of two published populations. Never turns billing into
// proof of physical delivery, nor replicates the formation tables in the client.
function strategicBillingPeriod(billingRows,referenceDate,filters){
 const valid=billingRows.filter(row=>date(row.DT_FATURA_DATE)&&row.DT_FATURA_DATE<=referenceDate).map(row=>{
  const delivery=canonicalDelivery(row.TIPO_ENTREGA);
  return delivery===row.TIPO_ENTREGA?row:{...row,TIPO_ENTREGA:delivery};
 });
 filters={...filters,dimensions:{...filters.dimensions,...(filters.dimensions?.TIPO_ENTREGA?{TIPO_ENTREGA:filters.dimensions.TIPO_ENTREGA.map(canonicalDelivery)}:{})}};
 const latest=maximum(valid.map(row=>row.DT_FATURA_DATE));
 const publishedEnd=latest&&latest<referenceDate?latest:referenceDate;
 const defaultPeriod=strategicDefaultPeriod();
 const [start,end]=filters.billingRange||[defaultPeriod.start,defaultPeriod.end];
 filters={...filters,billingRange:[start,end]};
 const selected=filterRows(valid,filters).filter(row=>row.DT_FATURA_DATE>=start&&row.DT_FATURA_DATE<=end);
 return {valid,filters,latest,publishedEnd,start,end,selected};
}

export function buildStrategicDimensionPayload({billingRows,emissionRows=[],referenceDate,filters={},dimension='UF'}){
 const context=strategicBillingPeriod(billingRows,referenceDate,filters);
 const {valid,publishedEnd,start,end,selected}=context;
 const {previousRows,previousCovered,comparison}=strategicPreviousPeriod(valid.filter(row=>row.DT_FATURA_DATE<=publishedEnd),start,end,context.filters);
 const flow=['UF','CIDADE','TIPO_ENTREGA'].includes(dimension)?summarizeFlow(emissionRows,valid,context.filters,start,end,dimension,referenceDate):null;
 return buildStrategicAnalysis(selected,dimension,calendar(start,end,'month').length,previousRows,previousCovered,flow,comparison);
}

export function buildStrategicDashboard({logistics,billingRows,emissionRows=[],publication,filters={},granularity='month',dimension='UF',heatmapDimension='year',heatmapMetric='value',includeAnalysis=true}){
 const referenceDate=logistics.referenceDate;
 const context=strategicBillingPeriod(billingRows,referenceDate,filters);
 const {valid,latest,publishedEnd,start,end,selected}=context;filters=context.filters;
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
 const backlog=logisticsBacklog(orders,dailyAverage);
 const metric=(id,label,value,format,help)=>({id:'strategic.'+id,label,value,format,help});
 const formatDate=value=>value.split('-').reverse().join('/');
 const balanceHelp='Saldo dos pedidos publicado em '+formatDate(referenceDate)+'. ';
 const historyHelp='Faturamentos de '+formatDate(start)+' a '+formatDate(end)+'. ';
 const coverage=totals.records?totals.withForecast/totals.records*100:null;
 const flow=summarizeFlow(emissionRows,valid,filters,start,end,['UF','CIDADE','TIPO_ENTREGA'].includes(dimension)?dimension:undefined,referenceDate);
 const {byDimension,...publishedFlow}=flow;
 const flowHelp=flow.months?'Período comum de '+formatDate(flow.start)+' a '+formatDate(flow.end)+'. '+(flow.partialPeriod?'Recorte parcial; médias divididas pelas '+flow.months+' competências incluídas. ':''):'Sem período comum entre os filtros de emissão e faturamento. ';
 const conversionHelp=flow.conversionStart<=flow.conversionThrough?'Competências mensais completas de '+formatDate(flow.conversionStart)+' a '+formatDate(flow.conversionThrough)+'. ':'Nenhuma competência mensal completa no recorte. ';
 const monthlyAverage=key=>monthly.length&&monthly.every(row=>row[key]!=null)?monthly.reduce((total,row)=>total+row[key],0)/monthly.length:null;
 const averageHelp=historyHelp+'Média mensal do período: total das competências dividido por '+months.length+' meses, incluindo meses sem movimento. Recortes parciais não são projetados. ';
 const metrics=[
  {...metric('backlogReal','Backlog logístico',backlog.realDays,'days',balanceHelp+'Cobertura em dias de faturamento da carteira logística: Documento em Carga, Logística, Faturado Parcial e Documento Liberado. Valor pendente ÷ faturamento médio diário dos 90 dias corridos terminados na referência, com os mesmos filtros de localização, entrega e emissão. O período visual de faturamento não altera essa base. Faixas do legacy aplicadas ao logístico: <15 crítico baixo; 15 a <25 atenção baixo; 25 a <35 ideal; 35 a <45 atenção alto; ≥45 crítico alto. Sem média positiva ou valor conhecido, indisponível. São faixas de acompanhamento do projeto, não prazo prometido nem disponibilidade física de estoque.'),status:backlog.state},
  metric('portfolioValue','Carteira logística',backlog.realValue,'currency',balanceHelp+'Valor aberto nos status Documento em Carga, Logística, Faturado Parcial e Documento Liberado. Itens e pedidos em várias cargas são contados uma vez. Preços ausentes tornam o valor indisponível.'),
  metric('serviceDays','Nível de serviço',totals.service,'days',historyHelp+'Lead time médio dos registros faturados: data de faturamento menos data de emissão do pedido. O total é calculado sobre os registros, sem fazer média das médias mensais.'),
  metric('otif','OTIF',totals.otif,'percent',historyHelp+'Regra atual: proporção dos registros faturados até a previsão de faturamento. Sem previsão é contado como fora do prazo, conforme a regra existente. Não comprova entrega física nem atendimento integral. Registros com previsão: '+(coverage==null?'não disponível':coverage.toFixed(1).replace('.',',')+'%')+'.'),
  metric('sameMonthConversion','Conversão',flow.sameMonthConversion,'percent',conversionHelp+'Pedidos com algum faturamento no próprio mês de emissão ÷ todos os pedidos emitidos × 100, incluindo parciais. Média ponderada por pedidos, incluindo os sem faturamento, sem duplicar itens ou notas. Base: '+flow.convertedOrders.toLocaleString('pt-BR')+' com faturamento de '+flow.conversionOrders.toLocaleString('pt-BR')+' emitidos. Não é a janela de 30 dias nem comprova entrega física.'),
  metric('outflow','Escoamento',flow.outflow,'percent',flowHelp+'Média mensal do faturamento em R$ ÷ média mensal da entrada de pedidos em R$ × 100; equivale à razão entre os totais do mesmo período. Inclui faturamento de pedidos emitidos em meses anteriores. Acima de 100% significa faturamento superior à entrada; não confirma entrega nem, isoladamente, a variação da carteira. O filtro de emissão delimita o período comum, sem excluir do faturamento as safras anteriores.'),
  metric('revenueTon','R$/TON',totals.weight>0&&totals.value!=null?totals.value/(totals.weight/1000):null,'currency',historyHelp+'Valor faturado total ÷ peso faturado total em toneladas. Razão ponderada pela massa; não é média simples das razões mensais nem custo de frete.'),
  metric('monthlyVolume','Volume',monthlyAverage('volume'),'volume',averageHelp+'Volume faturado em m³ por mês. É média dos totais mensais, não cubagem média de um item.'),
  metric('ticket','Ticket médio',totals.ticket,'currency',historyHelp+'Faturamento total ÷ quantidade faturada de itens, conforme o legacy. É valor médio por unidade faturada, não por pedido nem média simples dos tickets mensais. Sem quantidade positiva, indisponível.'),
  metric('monthlyTonnage','Peso',monthlyAverage('weight')==null?null:monthlyAverage('weight')/1000,'decimal',averageHelp+'Soma dos pesos mensais em toneladas ÷ número de meses.'),
  metric('monthlyQuantity','Qtd itens',monthlyAverage('quantity'),'decimal',averageHelp+'Quantidade faturada de unidades; não é contagem de linhas ou produtos distintos.'),
  metric('monthlyOrders','Qtd pedidos',monthlyAverage('orders'),'decimal',averageHelp+'Pedidos distintos em cada mês de faturamento. Parcelas e notas do mesmo pedido no mês contam uma vez; um pedido faturado em meses diferentes participa de cada mês.'),
  metric('monthlyGroups','Grupos atendidos',monthlyAverage('groups'),'decimal',averageHelp+'Grupos de cliente distintos em cada mês com faturamento. O mesmo grupo em meses diferentes participa de cada mês; cadastro ausente torna a medida indisponível.'),
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
 for(const row of selected){const type=String(row.TIPO_ENTREGA||'Não informado').trim();if(!deliveries.has(type))deliveries.set(type,[]);deliveries.get(type).push(row);}
 const lightGreen='#8BC53F';
 const series=[
  {...trend('outflow','ESCOAMENTO POR MÊS','value','percent'),rows:flow.monthly.map(row=>({period:row.period,label:row.label,value:row.outflow,emittedValue:row.emittedValue,billedValue:row.billedValue})),color:lightGreen,singleColor:true,fillArea:true},
  {id:'strategic.tonnage',title:'PESO POR '+({month:'MÊS',week:'SEMANA',day:'DIA'}[granularity]),type:'bar',x:'label',y:['value'],format:'decimal',labels:{value:'Toneladas'},icon:'weight',color:lightGreen,singleColor:true,overviewStyle:true,rows:grainRows},
  {...trend('ticket','TICKET MÉDIO POR MÊS','ticket','currency'),color:lightGreen,singleColor:true,fillArea:true,icon:'currency'},
  {...trend('quantity','QTD. ITENS POR MÊS','quantity','decimal'),color:lightGreen,singleColor:true,fillArea:true,icon:'layers'},
  {...trend('orders','QTD. PEDIDOS POR MÊS','orders','integer'),type:'bar',color:lightGreen,singleColor:true,icon:'cart'},
  {...trend('groups','GRUPOS ATENDIDOS POR MÊS','groups','integer'),type:'bar',color:lightGreen,singleColor:true,icon:'users'},
  {...trend('service','NÍVEL DE SERVIÇO POR MÊS','service','days'),color:lightGreen,singleColor:true,fillArea:true,icon:'clock'},
  {...trend('revenueTon','R$/TON POR MÊS','revenueKg','currency'),type:'bar',rows:monthly.map(row=>({period:row.period,label:row.label,value:row.weight>0&&row.value!=null?row.value/(row.weight/1000):null,records:row.records,withForecast:row.withForecast})),color:lightGreen,singleColor:true,icon:'currency'},
  {...trend('otif','OTIF POR MÊS','otif','percent'),type:'bar',color:lightGreen,singleColor:true,icon:'target'},
  {id:'strategic.delivery',title:'TIPO DE ENTREGA',type:'donut',x:'type',dimension:'TIPO_ENTREGA',y:['value'],format:'currency',labels:{value:'Valor (R$)',weightKg:'Peso'},metricOptions:{value:'value',weightKg:'weightKg'},metricLabels:{value:'Valor (R$)',weightKg:'Peso'},metricFormats:{value:'currency',weightKg:'weight'},colorMap:{ENTREGA:'#8BC53F',RETIRA:'#4E9D2D'},compactDonut:true,overviewStyle:true,rows:[...deliveries].sort(([a],[b])=>a.localeCompare(b,'pt-BR')).map(([type,rows])=>{const t=summarize(rows);return {type,value:t.value,weightKg:t.weight};})},
 ];
 const {previousRows,previousCovered,annualComparison,...financial}=buildStrategicFinancial({history:valid.filter(row=>row.DT_FATURA_DATE<=publishedEnd),selected,monthly,totals,start,end,filters,heatmapDimension,heatmapMetric,flow});
 const options={};
 for(const [key,logisticsKey] of [['UF','ufs'],['CIDADE','cities'],['TIPO_ENTREGA',null]]){
  const values=[...valid,...emissionRows].map(row=>key==='TIPO_ENTREGA'?canonicalDelivery(row[key]):row[key]).filter(value=>typeof value==='string'&&value.trim()&&value!=='None');
  values.push(...(logisticsKey?logistics.options[logisticsKey]||[]:(logistics.options.deliveries||orders.map(order=>order.tipo_entrega)).map(canonicalDelivery)));
  options[key]=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 }
 const cohorts=buildCohortAnalysis({emissionRows,billingRows,referenceDate,filters,period:{start,end}});
 return {dataVersion:publication.version+'|'+logistics.dataVersion,source:publication.source,referenceDate,metrics,operationalMetrics,series:[...financial.annualSeries,...series],options,cohorts,financial,portfolio:buildPortfolioAnalysis(orders,rateRows,referenceDate,dailyAverage),analysis:includeAnalysis?buildStrategicAnalysis(selected,dimension,months.length,previousRows,previousCovered,byDimension?flow:null,annualComparison):{...buildStrategicAnalysis([],dimension,months.length),deferred:true},
  meta:{publishedAt:logistics.meta.publishedAt,history:{start,end,records:totals.records,withForecast:totals.withForecast,forecastCoverage:coverage,months:months.length,monthly,totals,partialMonth:start!==monthStart(start)||end!==addDays(monthShift(end,1),-1)},
   backlog:{...backlog,dailyAverage,start:addDays(referenceDate,-89),end:referenceDate,records:rateRows.length},flow:publishedFlow,
   publications:{logistics:{version:logistics.dataVersion,referenceDate,publishedAt:logistics.meta.publishedAt},billing:{version:publication.version,publishedAt:publication.publishedAt,lastBillingDate:latest||null}}}};
}
