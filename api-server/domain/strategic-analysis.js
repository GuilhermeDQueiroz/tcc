import catalog from '../../shared/analysis-dimensions.json' with {type:'json'};
import {summarizeStrategicRows} from './strategic-summary.js';
export const strategicDimensions=catalog.filter(entry=>['UF','REGIAO_UF','TIPO_ENTREGA','STATUS','SUPERVISOR','CONSULTOR','GRUPO_CLIENTE','GRUPO_ITEM','SUBGRUPO','LINHA','TIPO','COLECAO','DESCRICAO_ITEM','CLASSIFICACAO','ORIGEM','ORGAO','CIDADE','MICRO_REGIAO'].includes(entry.legacy));
strategicDimensions.push({legacy:'CLIENTE',id:'client',label:'Cliente',icon:'users'},{legacy:'FAMILIA',id:'family',label:'Família',icon:'layers'},{legacy:'COR',id:'color',label:'Cor',icon:'tag'});
export const strategicDimensionKeys=new Set(strategicDimensions.map(entry=>entry.legacy));
export function buildStrategicAnalysis(rows,dimension,months,previousRows=[],previousCovered=false,flow=null,annualComparison=null){
 const options=strategicDimensions.map(({legacy,label,icon})=>({id:legacy,label,icon}));
 const measures={value:{label:'Faturamento (R$)',format:'currency'},tonnes:{label:'Toneladas faturadas',format:'decimal'},revenueKg:{label:'R$/kg faturado',format:'currency'},
  quantityMonthly:{label:'Qtd. itens por mês',format:'decimal'},ordersMonthly:{label:'Qtd. pedidos por mês',format:'decimal'},groupsMonthly:{label:'Grupos atendidos por mês',format:'decimal'},
  volume:{label:'Volume (m³)',format:'volume'},ticket:{label:'Ticket médio',format:'currency'},revenueTon:{label:'R$/ton',format:'currency'},quantity:{label:'Qtd. itens',format:'decimal'},orders:{label:'Qtd. pedidos',format:'integer'},groups:{label:'Grupos atendidos',format:'integer'},share:{label:'% Part.',format:'percent'},difference:{label:'Superávit / déficit vs. ano anterior',format:'currency'},
  service:{label:'Nível de serviço',format:'days'},otif:{label:'OTIF',format:'percent'},tonnesMonthly:{label:'Peso médio mensal (t)',format:'decimal'},volumeMonthly:{label:'Volume médio mensal (m³)',format:'volume'},...(flow?{conversion:{label:'Conversão',format:'percent'},outflow:{label:'Escoamento',format:'percent'}}:{})};
 const key=row=>{const raw=String(row[dimension]??'').trim();return !raw||raw==='None'?'Não informado':dimension==='DESCRICAO_ITEM'?String(row.CODIGO_ITEM??'Sem código')+' - '+raw:raw;};
 const grouped=new Map(),previous=new Map(),currentAnnual=new Map();
 const comparable=Boolean(annualComparison)||previousCovered;
 for(const [population,map] of [[rows,grouped],[annualComparison?.previousRows||previousRows,previous],[annualComparison?.currentRows||rows,currentAnnual]])for(const row of population){const label=key(row);if(!map.has(label))map.set(label,[]);map.get(label).push(row);}
 if(comparable)for(const label of previous.keys())if(!grouped.has(label))grouped.set(label,[]);
 const overall=summarizeStrategicRows(rows);
 const summarize=(population,prior=[],annual=population)=>{
  const t=summarizeStrategicRows(population),p=comparable?summarizeStrategicRows(prior):null,annualValue=comparable?summarizeStrategicRows(annual).value:null,byMonth=new Map();
  for(const row of population){const period=row.DT_FATURA_DATE.slice(0,7);if(!byMonth.has(period))byMonth.set(period,[]);byMonth.get(period).push(row);}
  const monthly=[...byMonth.values()].map(summarizeStrategicRows);
  const average=key=>months&&monthly.every(row=>row[key]!=null)?monthly.reduce((total,row)=>total+row[key],0)/months:null;
  return {tonnesMonthly:t.weight==null?null:t.weight/1000/months,volumeMonthly:t.volume==null?null:t.volume/months,value:t.value,share:overall.value>0&&t.value!=null?t.value/overall.value*100:null,difference:p?.value!=null&&annualValue!=null?annualValue-p.value:null,volume:t.volume,ticket:t.ticket,quantity:t.quantity,orders:t.orders,groups:t.groups,revenueTon:t.revenueKg==null?null:t.revenueKg*1000,tonnes:t.weight==null?null:t.weight/1000,revenueKg:t.revenueKg,quantityMonthly:t.quantity==null?null:t.quantity/months,
   ordersMonthly:average('orders'),groupsMonthly:average('groups'),service:t.service,otif:t.otif};
 };
 const flows=new Map((flow?.byDimension||[]).map(row=>[row.label,row]));
 for(const key of flows.keys())if(!grouped.has(key))grouped.set(key,[]);
 const tableRows=[...grouped].map(([label,population])=>({label,...summarize(population,previous.get(label)||[],currentAnnual.get(label)||[]),...(flow?{conversion:flows.get(label)?.conversion??null,outflow:flows.get(label)?.outflow??null}:{})})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
 return {dimension,options,measures,table:{id:'strategic.dimensions.'+dimension,title:options.find(option=>option.id===dimension)?.label||dimension,
  unavailableText:'—',columns:[{key:'label',label:options.find(option=>option.id===dimension)?.label||dimension,format:'text'},...Object.entries(measures).map(([key,definition])=>({key,...definition}))],
  rows:tableRows,total:{label:'TOTAL DO RECORTE',...summarize(rows,annualComparison?.previousRows||previousRows,annualComparison?.currentRows||rows),...(flow?{conversion:flow.sameMonthConversion,outflow:flow.outflow}:{})}}};
}
