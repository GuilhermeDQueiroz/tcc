import {filterRows} from './filters.js';
import {sum,mean,groupSum} from './metrics.js';
import {addDays,isoDate} from './dates.js';
import {InputError} from './contracts.js';

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
export function canonicalDelivery(value){
 const label=String(value||'Não informado').trim();
 const normalized=label.toLocaleUpperCase('pt-BR');
 if(['RETIRA','RETIRADA'].includes(normalized))return 'RETIRA';
 if(normalized==='ENTREGA')return 'ENTREGA';
 return ['NONE','NÃO INFORMADO',''].includes(normalized)?'Não informado':normalized;
}
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

// A compact composition of two published populations. Never turns billing into
// proof of physical delivery, nor replicates the formation tables in the client.
export function buildStrategicDashboard({logistics,billingRows,publication,filters={},granularity='month'}){
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
 const metrics=[
  metric('loads','Cargas em aberto',logistics.metrics.find(metric=>metric.id==='logistica.loads')?.value??0,'integer',balanceHelp+'Cargas distintas com saldo aberto vinculado. Não confirma saída física.'),
  metric('valueLoad','Valor em carga',loadValue,'currency',balanceHelp+'Valor unitário × quantidade aberta alocada, sem duplicar pedidos que participam de várias cargas. Medidas incompletas são exibidas como indisponíveis.'),
  metric('weightKg','Peso em aberto',openWeight,'weight64',balanceHelp+'Peso bruto unitário × quantidade aberta, incluindo saldo em carga e sem carga. Exibido em toneladas.'),
  metric('backlogReal','Backlog',dailyAverage>0&&openValue!=null?openValue/dailyAverage:null,'days',balanceHelp+'Valor total aberto ÷ faturamento médio diário dos 90 dias anteriores, incluindo a referência. Base: dias corridos e os mesmos filtros de localização, entrega e emissão. O período de faturamento exibido nos gráficos não altera essa base. Não é prazo prometido de entrega.'),
  metric('orders30','Pedidos > 30 dias',orders.filter(order=>Number(order.idade)>30).length,'integer',balanceHelp+'Pedidos distintos emitidos há mais de 30 dias. Tempo em aberto não significa atraso em relação a uma promessa de entrega.'),
  metric('serviceDays','Nível de serviço',totals.service,'days',historyHelp+'Lead time médio dos registros faturados: data de faturamento menos data de emissão do pedido. O total é calculado sobre os registros, sem fazer média das médias mensais.'),
  metric('otif','OTIF',totals.otif,'percent',historyHelp+'Regra atual: proporção dos registros faturados até a previsão de faturamento. Sem previsão é contado como fora do prazo, conforme a regra existente. Não comprova entrega física nem atendimento integral. Registros com previsão: '+(coverage==null?'não disponível':coverage.toFixed(1).replace('.',',')+'%')+'.'),
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
  const values=valid.map(row=>row[key]).filter(value=>typeof value==='string'&&value.trim()&&value!=='None');
  values.push(...(logisticsKey?logistics.options[logisticsKey]||[]:(logistics.options.deliveries||orders.map(order=>order.tipo_entrega)).map(canonicalDelivery)));
  options[key]=[...new Set(values)].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 }
 return {dataVersion:publication.version+'|'+logistics.dataVersion,source:publication.source,referenceDate,metrics,operationalMetrics,series,options,
  meta:{publishedAt:logistics.meta.publishedAt,history:{start,end,records:totals.records,withForecast:totals.withForecast,forecastCoverage:coverage,partialMonth:end!==addDays(monthShift(end,1),-1)},
   backlog:{dailyAverage,start:addDays(referenceDate,-89),end:referenceDate,records:rateRows.length},
   publications:{logistics:{version:logistics.dataVersion,referenceDate,publishedAt:logistics.meta.publishedAt},billing:{version:publication.version,publishedAt:publication.publishedAt,lastBillingDate:latest||null}}}};
}
