import {filterRows} from './filters.js';
import {addDays,shiftYear} from './dates.js';
import {summarizeStrategicRows as summarize} from './strategic-summary.js';
import {strategicDimensions} from './strategic-analysis.js';
const monthStart=date=>date.slice(0,7)+'-01';
const nextMonth=date=>{const [year,month]=date.split('-').map(Number);return new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);};
const periods=(start,end)=>{const result=[];for(let value=monthStart(start);value<=end;value=nextMonth(value))result.push(value);return result;};
const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const states=new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
function billingGeography(selected){
 const grouped=new Map(),unmapped=[];
 for(const row of selected){
  const uf=String(row.UF??'').trim().toUpperCase();
  if(!states.has(uf)){unmapped.push(row);continue;}
  if(!grouped.has(uf))grouped.set(uf,[]);
  grouped.get(uf).push(row);
 }
 return {id:'strategic.geography',title:'MAPA DE FATURAMENTO',type:'map',x:'UF',y:['value'],dimension:'UF',format:'currency',overviewStyle:true,visualMapLabel:'Faturamento (R$)',labels:{UF:'UF',value:'Faturamento (R$)'},
  rows:[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([UF,rows])=>({UF,value:summarize(rows).value,records:rows.length})),
  unmapped:{records:unmapped.length,value:summarize(unmapped).value}};
}
const add=(a,b)=>a==null||b==null?null:a+b;
const change=(current,previous)=>previous>0&&current!=null?(current/previous-1)*100:null;
const yearLabel=(start,end)=>start.slice(0,4)===end.slice(0,4)?start.slice(0,4):start.slice(0,4)+'/'+end.slice(0,4);
export const strategicHeatmapMeasures={value:{label:'Faturamento (R$)',format:'currency'},weight:{label:'Peso (t)',format:'decimal'},volume:{label:'Volume (m³)',format:'volume'},quantity:{label:'Qtd. itens',format:'decimal'},orders:{label:'Qtd. pedidos',format:'integer'},groups:{label:'Grupos atendidos',format:'integer'}};
export function strategicPreviousPeriod(history,start,end,filters={}){
 const dates=history.map(row=>row.DT_FATURA_DATE),firstObserved=dates.reduce((a,b)=>b<a?b:a,'9999-12-31'),last=dates.reduce((a,b)=>b>a?b:a,'0000-01-01');
 // The commercial extract starts on 01/01/2025; days without invoices are valid zeroes.
 const first=firstObserved.slice(0,4)==='2025'?'2025-01-01':firstObserved;
 const previousFilters={...filters,billingRange:[shiftYear(start,-1),shiftYear(end,-1)],...(filters.emissionRange?{emissionRange:filters.emissionRange.map(date=>shiftYear(date,-1))}:{})};
 const previousRows=filterRows(history,previousFilters),previousCovered=history.length>0&&previousFilters.billingRange[0]>=first&&previousFilters.billingRange[1]<=last;
 const compareStart=history.length?([start,end.slice(0,4)+'-01-01',first,shiftYear(first,1)].sort().at(-1)):start;
 const compareEnd=[end,last,shiftYear(last,1)].sort()[0];
 const comparable=history.length>0&&compareStart<=compareEnd;
 const comparison=comparable?{
  start:compareStart,end:compareEnd,
  currentRows:filterRows(history,{...filters,billingRange:[compareStart,compareEnd]}),
  previousRows:filterRows(history,{...previousFilters,billingRange:[shiftYear(compareStart,-1),shiftYear(compareEnd,-1)]})
 }:null;
 return {first,last,previousFilters,previousRows,previousCovered,comparison};
}
export function buildStrategicFinancial({history,selected,monthly,totals,start,end,filters={},heatmapDimension='year',heatmapMetric='value',flow}){
 const {first,last,previousFilters,previousRows,previousCovered,comparison:annualComparison}=strategicPreviousPeriod(history,start,end,filters);
 const previousMonthly=new Map();
 for(const row of previousRows){const key=monthStart(row.DT_FATURA_DATE);if(!previousMonthly.has(key))previousMonthly.set(key,[]);previousMonthly.get(key).push(row);}
 const monthlyFlow=new Map((flow?.monthly||[]).map(row=>[row.period,row]));
 const monthlyRows=monthly.map(row=>{
  const currentStart=row.period<start?start:row.period,currentEnd=addDays(nextMonth(row.period),-1)>end?end:addDays(nextMonth(row.period),-1);
  const covered=history.length>0&&shiftYear(currentStart,-1)>=first&&shiftYear(currentEnd,-1)<=last;
  const prior=covered?summarize(previousMonthly.get(shiftYear(row.period,-1))||[]):null;
  return {conversion:monthlyFlow.get(row.period)?.conversion??null,outflow:monthlyFlow.get(row.period)?.outflow??null,revenueKg:row.revenueKg,period:row.period,label:months[Number(row.period.slice(5,7))-1]+'/'+row.period.slice(2,4),value:row.value,share:totals.value>0&&row.value!=null?row.value/totals.value*100:null,
   previousValue:prior?.value??null,difference:prior?.value!=null&&row.value!=null?row.value-prior.value:null,ticket:row.ticket,revenueTon:row.weight>0&&row.value!=null?row.value/(row.weight/1000):null,
   orders:row.orders,quantity:row.quantity,tonnes:row.weight==null?null:row.weight/1000,volume:row.volume,groups:row.groups,service:row.service,otif:row.otif};
 });
 const comparableCurrent=annualComparison?summarize(annualComparison.currentRows):previousCovered?totals:null;
 const previousTotal=annualComparison?summarize(annualComparison.previousRows):previousCovered?summarize(previousRows):null;
 const columns=[{key:'label',label:'Mês',format:'text',sortKey:'period'},{key:'value',label:'Valor (R$)',format:'currency'},{key:'share',label:'% Part.',format:'percent'},{key:'difference',label:'Superávit / déficit vs. ano anterior',format:'currency'},
  {key:'ticket',label:'Ticket médio',format:'currency'},{key:'revenueTon',label:'R$/ton',format:'currency'},{key:'orders',label:'Qtd. pedidos',format:'integer'},{key:'quantity',label:'Qtd. itens',format:'decimal'},
  {key:'tonnes',label:'Peso (t)',format:'decimal'},{key:'volume',label:'Volume (m³)',format:'volume'},{key:'groups',label:'Grupos atendidos',format:'integer'},{key:'service',label:'Nível de serviço',format:'days'},{key:'otif',label:'OTIF',format:'percent'},{key:'revenueKg',label:'R$/KG',format:'currency'},{key:'conversion',label:'Conversão',format:'percent'},{key:'outflow',label:'Escoamento',format:'percent'}];
 const monthlyTable={id:'strategic.monthly',title:'TABELA DE EVOLUÇÃO MENSAL',unavailableText:'—',columns,rows:monthlyRows,
  total:{label:'TOTAL DO RECORTE',revenueKg:totals.revenueKg,conversion:flow?.sameMonthConversion??null,outflow:flow?.outflow??null,value:totals.value,share:totals.value>0?100:null,difference:previousTotal?.value!=null&&comparableCurrent?.value!=null?comparableCurrent.value-previousTotal.value:null,ticket:totals.ticket,
   revenueTon:totals.weight>0&&totals.value!=null?totals.value/(totals.weight/1000):null,orders:totals.orders,quantity:totals.quantity,tonnes:totals.weight==null?null:totals.weight/1000,volume:totals.volume,groups:totals.groups,service:totals.service,otif:totals.otif}};
 const mean=key=>monthly.length&&monthly.every(row=>row[key]!=null)?monthly.reduce((sum,row)=>sum+row[key],0)/monthly.length:null;
 const cardSummary={...monthlyTable, id:'strategic.cardSummary',title:'RESUMO DO PERÍODO · MESMAS MÉTRICAS DOS CARDS',
  columns:columns.filter(column=>!['value','share','difference','revenueTon'].includes(column.key)).map(column=>({...column,label:column.key==='label'?'Base':column.key==='tonnes'?'Peso (t)':column.label,format:['orders','groups'].includes(column.key)?'decimal':column.format})),
  rows:[{label:monthly.length+' competências',tonnes:mean('weight')==null?null:mean('weight')/1000,volume:mean('volume'),quantity:mean('quantity'),orders:mean('orders'),groups:mean('groups'),service:totals.service,otif:totals.otif,ticket:totals.ticket,revenueKg:totals.revenueKg,conversion:flow?.sameMonthConversion??null,outflow:flow?.outflow??null}],total:undefined};
 // Align the two windows before cumulating: no invented zero before source coverage.
 const compareStart=annualComparison?.start||start;
 const compareEnd=annualComparison?.end||end;
 const available=Boolean(annualComparison);
 const currentLabel=available?yearLabel(compareStart,compareEnd):'Período atual',priorLabel=available?yearLabel(shiftYear(compareStart,-1),shiftYear(compareEnd,-1)):'Ano anterior';
 const currentByMonth=new Map(),priorByMonth=new Map();
 if(available){
  const current=filterRows(history,{...filters,billingRange:[compareStart,compareEnd]}),prior=filterRows(history,{...previousFilters,billingRange:[shiftYear(compareStart,-1),shiftYear(compareEnd,-1)]});
  for(const [rows,map] of [[current,currentByMonth],[prior,priorByMonth]])for(const row of rows){const key=monthStart(row.DT_FATURA_DATE);if(!map.has(key))map.set(key,[]);map.get(key).push(row);}
 }
 let cv=0,pv=0,cw=0,pw=0;
 const comparisonRows=available?periods(compareStart,compareEnd).map(period=>{
  const current=summarize(currentByMonth.get(period)||[]),prior=summarize(priorByMonth.get(shiftYear(period,-1))||[]);
  cv=add(cv,current.value);pv=add(pv,prior.value);cw=add(cw,current.weight);pw=add(pw,prior.weight);
  return {period,label:months[Number(period.slice(5,7))-1],current:current.value,previous:prior.value,currentAccumulated:cv,previousAccumulated:pv,currentRevenueTon:cw>0&&cv!=null?cv/(cw/1000):null,previousRevenueTon:pw>0&&pv!=null?pv/(pw/1000):null};
 }):[];
 const comparison={available,start:available?compareStart:null,end:available?compareEnd:null,previousStart:available?shiftYear(compareStart,-1):null,previousEnd:available?shiftYear(compareEnd,-1):null,currentLabel,previousLabel:priorLabel,
  revenueDifference:available&&cv!=null&&pv!=null?cv-pv:null,revenueChange:available?change(cv,pv):null,revenueTonChange:available?change(cw>0&&cv!=null?cv/(cw/1000):null,pw>0&&pv!=null?pv/(pw/1000):null):null};
 const comparative=(id,title,current,previous)=>({id:'strategic.'+id,title,type:'line',x:'label',y:[previous,current],format:'currency',overviewStyle:true,fillArea:false,colors:['#C69214','#006A3A'],labels:{[previous]:priorLabel,[current]:currentLabel},rows:comparisonRows});
 const annualSeries=[comparative('annualMonthly','EVOLUÇÃO MENSAL DO FATURAMENTO POR ANO','current','previous'),comparative('annualCumulative','EVOLUÇÃO ACUMULADA DO FATURAMENTO POR ANO','currentAccumulated','previousAccumulated'),comparative('annualRevenueTon','COMPARATIVO ACUMULADO DE REAIS POR TONELADA (R$/T) · FATURAMENTO POR ANO','currentRevenueTon','previousRevenueTon')];
 const heatGroups=new Map();
 for(const row of selected){const raw=heatmapDimension==='year'?row.DT_FATURA_DATE.slice(0,4):String(row[heatmapDimension]??'').trim(),key=!raw||raw==='None'?'Não informado':raw;if(!heatGroups.has(key))heatGroups.set(key,[]);heatGroups.get(key).push(row);}
 const coveredMonths=new Set(history.length?periods(start>first?start:first,end<last?end:last).map(period=>Number(period.slice(5,7))):[]);
 const heatRows=[...heatGroups].map(([dimension,rows])=>{
  const cells={dimension},year=heatmapDimension==='year'?dimension:null;
  const grouped=new Map();for(const row of rows){const key=Number(row.DT_FATURA_DATE.slice(5,7));if(!grouped.has(key))grouped.set(key,[]);grouped.get(key).push(row);}
  for(let month=1;month<=12;month++){
   const inWindow=year?`${year}-${String(month).padStart(2,'0')}-01`<=end&&addDays(nextMonth(`${year}-${String(month).padStart(2,'0')}-01`),-1)>=(start>first?start:first):coveredMonths.has(month);
   const subset=grouped.get(month),value=subset?summarize(subset)[heatmapMetric]:inWindow?0:null;
   cells['month_'+month]=heatmapMetric==='weight'&&value!=null?value/1000:value;
  }
  return cells;
 });
 heatRows.sort(heatmapDimension==='year'?(a,b)=>String(a.dimension).localeCompare(String(b.dimension)):(a,b)=>Object.values(b).filter(value=>typeof value==='number').reduce((s,v)=>s+v,0)-Object.values(a).filter(value=>typeof value==='number').reduce((s,v)=>s+v,0));
 const heatmap={id:'strategic.heatmap',title:'MAPA DE CALOR DO FATURAMENTO',type:'heatmap',icon:'grid',x:'dimension',y:Array.from({length:12},(_,i)=>'month_'+(i+1)),heatmapLabels:false,rows:heatmapDimension==='year'?heatRows:heatRows.slice(0,15),format:strategicHeatmapMeasures[heatmapMetric].format,
  labels:Object.fromEntries(months.map((label,i)=>['month_'+(i+1),label]))};
 return {annualSeries,comparison,monthlyTable,cardSummary,previousRows,previousCovered,annualComparison,geography:billingGeography(selected),heatmap,heatmapOptions:{dimension:heatmapDimension,metric:heatmapMetric,dimensions:[{id:'year',label:'Ano'},...strategicDimensions.map(option=>({id:option.legacy,label:option.label}))],measures:strategicHeatmapMeasures}};
}
