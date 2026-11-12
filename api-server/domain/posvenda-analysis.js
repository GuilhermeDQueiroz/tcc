import {addDays,diffDays} from './dates.js';
import sharedDimensions from '../../shared/analysis-dimensions.json' with {type:'json'};
import measures from '../../shared/aftersales-measures.json' with {type:'json'};
import {buildAftersalesDimensions,eventLeadDays,summarizeAftersalesMeasures} from './posvenda-dimensions.js';

export function withAftersalesMeasures(series,area,kind=''){
 const definitions={...measures.common,...measures[area]};
 if(area==='cancelamentos'&&kind==='Assistência')definitions.orders={...definitions.orders,label:'Quantidade de assistências'};
 const entries=Object.entries(definitions);
 const metricOptions=Object.fromEntries(entries.map(([key])=>[key,key]));
 const metricLabels=Object.fromEntries(entries.map(([key,{label}])=>[key,label]));
 const metricFormats=Object.fromEntries(entries.map(([key,{format}])=>[key,format]));
 return {...series,y:['quantity'],format:metricFormats.quantity,metricOptions,metricLabels,metricFormats,
  labels:{...series.labels,...metricLabels},nonAdditiveMetrics:Object.keys(measures[area])};
}

function bucketRows(rows,key){
 const buckets=new Map();
 for(const row of rows){
  const label=key(row);
  if(!buckets.has(label))buckets.set(label,[]);
  buckets.get(label).push(row);
 }
 return buckets;
}

export function measureBuckets(rows,key,quantity,value,referenceDate,limit=Infinity){
 const buckets=[...bucketRows(rows,key)].map(([label,source])=>({
  source,summary:{label,...summarizeAftersalesMeasures(source,quantity,value,referenceDate)}
 }));
 if(buckets.length<=limit)return buckets.map(bucket=>bucket.summary);
 buckets.sort((a,b)=>b.summary.quantity-a.summary.quantity);
 const remainder=buckets.slice(limit).flatMap(bucket=>bucket.source);
 return [...buckets.slice(0,limit).map(bucket=>bucket.summary),
  {label:'Outros',_others:true,...summarizeAftersalesMeasures(remainder,quantity,value,referenceDate)}];
}

const baseDimensions=Object.fromEntries(sharedDimensions.filter(entry=>entry.id!=='research').map(entry=>[entry.id,entry.label]));
const eventTitles={cancelamentos:'Cancelamentos',devolucoes:'Devoluções'};
const leadDimensions={cancelamentos:'Prazo até cancelamento',devolucoes:'Prazo até devolução'};
export const aftersalesDimensions=area=>({...baseDimensions,...(leadDimensions[area]?{aging:leadDimensions[area]}:{}),status:area==='assistencias'?'Status da Assistência':'Status do Pedido',client:'Cliente',reason:'Motivo',kind:'Tipo de documento',company:'Empresa',forecastStatus:'Situação da previsão'});
const text=value=>String(value??'').trim()||'Não informado';
const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const sum=(a,b)=>a==null||b==null?null:a+b;
const month=value=>value.slice(0,7)+'-01';
const nextMonth=value=>{const date=new Date(value+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,10);};
const week=value=>addDays(value,-((new Date(value+'T00:00:00Z').getUTCDay()+6)%7));
function ageGroup(row,referenceDate){
 const age=eventTitles[row.categoria]?eventLeadDays(row):diffDays(referenceDate,row.data);
 if(!Number.isFinite(age))return 'Não informado';
 return age<=15?'0–15 dias':age<=30?'16–30 dias':age<=45?'31–45 dias':age<=60?'46–60 dias':'> 60 dias';
}
const forecastStatus=(row,referenceDate)=>!row.previsao?'Sem previsão':row.previsao<referenceDate?'Previsão vencida':row.previsao<nextMonth(month(referenceDate))?'Mês vigente':'Meses futuros';
export function aftersalesDimensionValue(row,key,referenceDate){
 if(key==='document')return 'Documento '+row.documento_id;
 if(key==='item')return `Item ${row.produto_id??'sem código'} - ${text(row.produto)} · Registro ${row.registro_id}`;
 if(key==='month')return row.data.slice(0,7);
 if(key==='forecastMonth')return row.previsao?.slice(0,7)||'Sem previsão';
 if(key==='aging')return ageGroup(row,referenceDate);
 if(key==='forecastStatus')return forecastStatus(row,referenceDate);
 if(key==='company')return row.empresa_id==null?'Não informado':'Empresa '+row.empresa_id;
 if(key==='client'||key==='product'){
  const id=row[key==='client'?'cliente_id':'produto_id'],label=text(row[key==='client'?'cliente':'produto']);
  return id==null?label:String(id)+' - '+label;
 }
 return text(row[{city:'cidade',reason:'motivo',status:'status_erp',kind:'modalidade',region:'regiao_uf',microregion:'micro_regiao',delivery:'tipo_entrega',consultant:'consultor',clientGroup:'grupo_cliente',productGroup:'grupo_item',subgroup:'subgrupo',line:'linha',productType:'tipo_produto',collection:'colecao',classification:'classificacao',origin:'origem',agency:'orgao'}[key]||key]);
}
const dimensionValue=aftersalesDimensionValue;
function groups(rows,key,quantity,value){
 const result=new Map();
 for(const row of rows){
  const label=key(row);if(!result.has(label))result.set(label,{label,documents:new Set(),quantity:0,value:0});
  const target=result.get(label);target.documents.add(row.documento_id);target.quantity=sum(target.quantity,number(row[quantity]));target.value=sum(target.value,number(row[value]));
 }
 return [...result.values()].map(row=>({...row,documents:row.documents.size}));
}
const chart=(id,title,rows,type='barHorizontal')=>({id:'posvenda.'+id,title,rows,type,x:'label',y:['value'],format:'decimal',labels:{value:'Quantidade'}});
export function buildAftersalesAnalysis({rows,area,open,billed=false,kind='',quantity,value,start,end,referenceDate,dimension='month',granularity='month',hierarchy,metric='value'}){
 const hasMeasures=open||billed||Boolean(eventTitles[area]);
 const period=granularity==='month'?month:granularity==='week'?week:value=>value;
 const byPeriod=bucketRows(rows,row=>period(row.data));
 const periods=[];
 for(let current=period(start);current<=end&&start<=end;current=granularity==='month'?nextMonth(current):addDays(current,granularity==='week'?7:1)){
  const source=byPeriod.get(current)||[];
  const measures=hasMeasures?summarizeAftersalesMeasures(source,quantity,value,referenceDate):
   {value:source.reduce((total,row)=>total+Number(row[quantity]||0),0)};
  periods.push({period:current,label:granularity==='month'?current.slice(5,7)+'/'+current.slice(2,4):current.slice(8,10)+'/'+current.slice(5,7)+'/'+current.slice(2,4),...measures});
 }
 const grainLabel={month:'mês',week:'semana',day:'dia'}[granularity];
 const title=open?'Saldo por '+grainLabel+' de emissão':billed?'Quantidade faturada por '+grainLabel+' de emissão':(eventTitles[area]||'Quantidade')+' por '+grainLabel;
 const baseEvolution=chart('monthly',title,periods,'line');
 const evolution=hasMeasures?withAftersalesMeasures(baseEvolution,area,kind):baseEvolution;
 const options=aftersalesDimensions(area);
 const analysis=buildAftersalesDimensions({rows,area,options,dimension,quantity,value,referenceDate,dimensionValue,hierarchy,metric});
 if(area!=='assistencias'||billed)return {evolution,analysis};
 const pending=rows.filter(row=>Number(row.quantidade_aberta)>0);
 const toBuckets=(input,key)=>open?measureBuckets(input,key,quantity,value,referenceDate):groups(input,key,quantity,value);
 const pendingBuckets=(input,key)=>open?toBuckets(input,key):groups(input,key,'quantidade_aberta','valor_aberto');
 const toSeriesRow=row=>open?row:{label:row.label,value:row.quantity};
 const forecast=pendingBuckets(pending.filter(row=>row.previsao),row=>row.previsao)
  .map(row=>({...toSeriesRow(row),date:row.label,documents:row.documents})).sort((a,b)=>a.date.localeCompare(b.date));
 const statuses=pendingBuckets(pending,row=>forecastStatus(row,referenceDate)).map(toSeriesRow);
 const ageLabels=['0–15 dias','16–30 dias','31–45 dias','46–60 dias','> 60 dias'];
 const aging=toBuckets(rows,row=>ageGroup(row,referenceDate)).sort((a,b)=>ageLabels.indexOf(a.label)-ageLabels.indexOf(b.label)).map(toSeriesRow);
 const ranked=key=>toBuckets(rows,row=>text(row[key])).sort((a,b)=>b.quantity-a.quantity).map(toSeriesRow);
 const assistance={
  aging:{...chart('aging',open?'Distribuição por faixa de idade':'Idade das assistências emitidas',aging,'donut'),compactDonut:true,centerText:open?'Quantidade\npendente':'Quantidade\nemitida',colorMap:{'0–15 dias':'#8bc53f','16–30 dias':'#4e9d2d','31–45 dias':'#d97706','46–60 dias':'#c62828','> 60 dias':'#a87b18'}},
  forecast:{id:'posvenda.forecast',title:'Cronograma de previsão das assistências',type:'calendar',x:'date',y:['value'],format:'decimal',rows:forecast},
  forecastStatus:{...chart('forecastStatus','Status da previsão · saldo pendente',statuses,'donut'),compactDonut:true,centerText:'Quantidade\npendente',colorMap:{'Previsão vencida':'#c62828','Mês vigente':'#006a3a','Meses futuros':'#8bc53f','Sem previsão':'#94a3b8'}},
  types:{...chart('types','Tipo de assistência',ranked('modalidade'),'donut'),compactDonut:true,centerText:'Quantidade'},
  status:chart('status','Resumo por status da assistência',ranked('status_erp')),
 };
 if(open){
  for(const [key,series] of Object.entries(assistance))assistance[key]=withAftersalesMeasures(series,area);
 }
 return {evolution,analysis,assistance};
}
