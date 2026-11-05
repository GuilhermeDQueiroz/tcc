import {diffDays} from './dates.js';

const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const add=(a,b)=>a==null||b==null?null:a+b;
const physical=(row,quantity,key)=>{
 const unit=number(row[key]),count=number(row[quantity]);
 return unit==null||unit<0||count==null?null:unit*count;
};
const defaultHierarchy={month:['uf','client','document'],forecastMonth:['forecastStatus','document'],uf:['city','client','document'],region:['uf','city','client'],delivery:['uf','client'],supervisor:['consultant','clientGroup','client'],consultant:['clientGroup','client','document'],clientGroup:['client','document'],productGroup:['subgroup','product','document'],subgroup:['product','document'],line:['product','document'],productType:['product','document'],collection:['product','document'],product:['document'],city:['client','document'],reason:['product','document'],client:['document']};

export function buildAftersalesDimensions({rows,options,dimension,quantity,value,referenceDate,dimensionValue,hierarchy,metric='value'}){
 function aggregate(input,label){
  const values={label,value:0,weightKg:0,volumeM3:0,quantity:0,documents:0,orders:0,ageDays:null,share:null};
  const documents=new Set(),orders=new Set();let ages=0,dated=0;
  for(const row of input){
   if(row.documento_id!=null)documents.add(row.documento_id);
   if(row.pedido_id!=null)orders.add(row.pedido_id);
   values.value=add(values.value,number(row[value]));values.quantity=add(values.quantity,number(row[quantity]));
   values.weightKg=add(values.weightKg,physical(row,quantity,'peso_unitario'));
   values.volumeM3=add(values.volumeM3,physical(row,quantity,'volume_unitario'));
   const age=diffDays(referenceDate,row.data);if(Number.isFinite(age)){ages+=age;dated++;}
  }
  values.documents=documents.size;values.orders=orders.size;values.ageDays=dated?ages/dated:null;
  return values;
 }
 const total=aggregate(rows,'TOTAL');
 const levels=hierarchy?.length?hierarchy:[dimension,...(defaultHierarchy[dimension]||['document'])];
 const compare=(a,b)=>{
  if(['month','forecastMonth'].includes(a.dimension))return a.label.localeCompare(b.label,'pt-BR');
  return Number(b.summary[metric]??-Infinity)-Number(a.summary[metric]??-Infinity)||a.label.localeCompare(b.label,'pt-BR',{numeric:true});
 };
 let nodes=0;
 function grouped(input,key){
  const groups=new Map();for(const row of input){const label=dimensionValue(row,key,referenceDate);if(!groups.has(label))groups.set(label,[]);groups.get(label).push(row);}
  return [...groups].map(([label,source])=>({label,source,dimension:key,summary:aggregate(source,label)})).sort(compare);
 }
 function build(input,depth=0,path=''){
  const key=levels[depth];if(!key)return [];
  let groups=grouped(input,key);
  if(depth>0&&(groups.length>20||nodes>3000)){
   const keep=nodes>3000?0:20,rest=groups.slice(keep);
   groups=[...groups.slice(0,keep),{label:`Outros (${rest.length} grupos)`,source:rest.flatMap(group=>group.source),dimension:key,summary:aggregate(rest.flatMap(group=>group.source),`Outros (${rest.length} grupos)`),remainder:true}];
  }
  return groups.map((group,index)=>{
   nodes++;const id=path?path+'-'+index:'dimension-'+index;
   const summary={...group.summary,share:total.value>0&&group.summary.value!=null?group.summary.value/total.value:null};
   return {...summary,node_id:id,col_name:key,children:!group.remainder&&depth+1<levels.length?build(group.source,depth+1,id):[]};
  });
 }
 const tree=build(rows),rootRows=tree.map(({children,node_id,col_name,...row})=>row);
 const evolutionGroups=new Map();
 for(const row of rows){const period=row.data.slice(0,7),category=dimensionValue(row,dimension,referenceDate),key=JSON.stringify([period,category]);if(!evolutionGroups.has(key))evolutionGroups.set(key,{period,category,rows:[]});evolutionGroups.get(key).rows.push(row);}
 const evolution=[...evolutionGroups.values()].map(group=>({...aggregate(group.rows,group.period),period:group.period,category:group.category})).sort((a,b)=>a.period.localeCompare(b.period));
 total.share=total.value>0?1:null;
 return {selected:dimension,options:Object.entries(options).map(([id,label])=>({id,label})),hierarchy:levels,
  table:{id:'posvenda.analysis.'+dimension,title:options[dimension],columns:[
   {key:'label',label:options[dimension],format:'text'},{key:'value',label:'Valor (R$)',format:'currency'},
   {key:'share',label:'Participação',format:'progress'},{key:'weightKg',label:'Peso (t)',format:'weight64'},
   {key:'volumeM3',label:'Volume (m³)',format:'volume'},{key:'quantity',label:'Quantidade',format:'decimal'},
   {key:'orders',label:'Pedidos',format:'integer'},{key:'documents',label:'Documentos',format:'integer'},
   {key:'ageDays',label:'Idade média (dias)',format:'serviceDecimal'}],rows:rootRows,tree,total},
  evolution:{id:'posvenda.analysis.evolution',title:'Evolução mensal por dimensão',type:'line',rows:evolution,x:'period',y:[metric],category:dimension==='month'?undefined:'category',format:metric==='value'?'currency':metric==='weightKg'?'weight':metric==='volumeM3'?'volume':'decimal',overviewStyle:true},
  coverage:{weightMissing:rows.filter(row=>number(row.peso_unitario)==null).length,volumeMissing:rows.filter(row=>number(row.volume_unitario)==null).length,commercialConflicts:rows.filter(row=>row.conflito_comercial).length},
 };
}
