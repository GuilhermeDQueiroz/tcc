import {addDays,diffDays} from './dates.js';
import sharedDimensions from '../../shared/analysis-dimensions.json' with {type:'json'};
import {buildAftersalesDimensions} from './posvenda-dimensions.js';

const baseDimensions=Object.fromEntries(sharedDimensions.filter(entry=>entry.id!=='research').map(entry=>[entry.id,entry.label]));
export const aftersalesDimensions=area=>({...baseDimensions,status:area==='assistencias'?'Status da Assistência':'Status do Pedido',client:'Cliente',reason:'Motivo',kind:'Tipo de documento',company:'Empresa',forecastStatus:'Situação da previsão'});
const text=value=>String(value??'').trim()||'Não informado';
const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const sum=(a,b)=>a==null||b==null?null:a+b;
const month=value=>value.slice(0,7)+'-01';
const nextMonth=value=>{const date=new Date(value+'T00:00:00Z');date.setUTCMonth(date.getUTCMonth()+1);return date.toISOString().slice(0,10);};
const week=value=>addDays(value,-((new Date(value+'T00:00:00Z').getUTCDay()+6)%7));
const ageGroup=(row,referenceDate)=>{const age=diffDays(referenceDate,row.data);return age<=15?'0–15 dias':age<=30?'16–30 dias':age<=45?'31–45 dias':age<=60?'46–60 dias':'> 60 dias';};
const forecastStatus=(row,referenceDate)=>!row.previsao?'Sem previsão':row.previsao<referenceDate?'Previsão vencida':row.previsao<nextMonth(month(referenceDate))?'Mês vigente':'Meses futuros';
export function aftersalesDimensionValue(row,key,referenceDate){
 if(key==='document')return 'Documento '+row.documento_id;
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
export function buildAftersalesAnalysis({rows,area,open,quantity,value,start,end,referenceDate,dimension='month',granularity='month',hierarchy,metric='value'}){
 const period=granularity==='month'?month:granularity==='week'?week:value=>value;
 const byPeriod=new Map();for(const row of rows)byPeriod.set(period(row.data),(byPeriod.get(period(row.data))||0)+Number(row[quantity]||0));
 const periods=[];
 for(let current=period(start);current<=end&&start<=end;current=granularity==='month'?nextMonth(current):addDays(current,granularity==='week'?7:1)){
  periods.push({period:current,label:granularity==='month'?current.slice(5,7)+'/'+current.slice(2,4):current.slice(8,10)+'/'+current.slice(5,7)+'/'+current.slice(2,4),value:byPeriod.get(current)||0});
 }
 const grainLabel={month:'mês',week:'semana',day:'dia'}[granularity];
 const evolution=chart('monthly',open?'Saldo por '+grainLabel+' de emissão':'Quantidade por '+grainLabel,periods,'line');
 const options=aftersalesDimensions(area);
 const analysis=buildAftersalesDimensions({rows,options,dimension,quantity,value,referenceDate,dimensionValue,hierarchy,metric});
 if(area!=='assistencias')return {evolution,analysis};
 const pending=rows.filter(row=>Number(row.quantidade_aberta)>0);
 const forecast=groups(pending.filter(row=>row.previsao),row=>row.previsao,'quantidade_aberta','valor_aberto').map(row=>({date:row.label,value:row.quantity,documents:row.documents})).sort((a,b)=>a.date.localeCompare(b.date));
 const statuses=groups(pending,row=>forecastStatus(row,referenceDate),'quantidade_aberta','valor_aberto').map(row=>({label:row.label,value:row.quantity}));
 const aging=groups(rows,row=>ageGroup(row,referenceDate),quantity,value).sort((a,b)=>['0–15 dias','16–30 dias','31–45 dias','46–60 dias','> 60 dias'].indexOf(a.label)-['0–15 dias','16–30 dias','31–45 dias','46–60 dias','> 60 dias'].indexOf(b.label)).map(row=>({label:row.label,value:row.quantity}));
 const ranked=key=>groups(rows,row=>text(row[key]),quantity,value).sort((a,b)=>b.quantity-a.quantity).map(row=>({label:row.label,value:row.quantity}));
 const assistance={
  aging:{...chart('aging',open?'Distribuição por faixa de idade':'Idade das assistências emitidas',aging,'donut'),compactDonut:true,centerText:open?'Quantidade\npendente':'Quantidade\nemitida',colorMap:{'0–15 dias':'#8bc53f','16–30 dias':'#4e9d2d','31–45 dias':'#d97706','46–60 dias':'#c62828','> 60 dias':'#a87b18'}},
  forecast:{id:'posvenda.forecast',title:'Cronograma de previsão das assistências',type:'calendar',x:'date',y:['value'],format:'decimal',rows:forecast},
  forecastStatus:{...chart('forecastStatus','Status da previsão · saldo pendente',statuses,'donut'),compactDonut:true,centerText:'Quantidade\npendente',colorMap:{'Previsão vencida':'#c62828','Mês vigente':'#006a3a','Meses futuros':'#8bc53f','Sem previsão':'#94a3b8'}},
  types:{...chart('types','Tipo de assistência',ranked('modalidade'),'donut'),compactDonut:true,centerText:'Quantidade'},
  status:chart('status','Resumo por status da assistência',ranked('status_erp')),
 };
 return {evolution,analysis,assistance};
}
