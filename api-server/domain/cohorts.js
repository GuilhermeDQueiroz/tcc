import {filterRows} from './filters.js';
import {addDays,diffDays} from './dates.js';
import {canonicalDelivery} from './delivery.js';

const windows=[7,15,30];
const measures={value:['VALOR_EMITIDO_CLEAN','VALOR_FATURADO_CLEAN'],weightKg:['PESO_EMITIDO_CLEAN','PESO_FATURADO_CLEAN'],volumeM3:['VOLUME_M3_EMITIDO_CLEAN','VOLUME_M3_FATURADO_CLEAN']};
const measureEntries=Object.entries(measures),measureNames=Object.keys(measures);
const validDates=new Map();
const monthShift=(value,offset)=>{const [year,month]=value.split('-').map(Number);return new Date(Date.UTC(year,month-1+offset,1)).toISOString().slice(0,10);};
const validDate=value=>{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 if(validDates.has(value))return validDates.get(value);
 const parsed=new Date(value+'T00:00:00Z');
 const result=Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value?value:null;
 if(validDates.size>=4096)validDates.clear();
 validDates.set(value,result);
 return result;
};
const orderKey=value=>value==null||String(value).trim()===''?null:String(value);
const amount=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const add=(total,value)=>total==null||value==null?null:total+value;
const ratio=(numerator,denominator)=>numerator!=null&&numerator>=0&&denominator>0?numerator/denominator*100:null;

// Cohort membership and its denominator come from emitted orders, never from
// the subset already billed. Invoices are linked to that membership by order.
export function buildCohortAnalysis({emissionRows=[],billingRows=[],referenceDate,filters={},period}){
 const periodStart=period?.start||monthShift(referenceDate,-11),periodEnd=period?.end<referenceDate?period.end:referenceDate;
 const start=filters.emissionRange?.[0]>periodStart?filters.emissionRange[0]:periodStart;
 const end=filters.emissionRange?.[1]<periodEnd?filters.emissionRange[1]:periodEnd;
 const {billingRange,...cohortFilters}=filters;
 if(cohortFilters.dimensions?.TIPO_ENTREGA)cohortFilters.dimensions={...cohortFilters.dimensions,TIPO_ENTREGA:cohortFilters.dimensions.TIPO_ENTREGA.map(canonicalDelivery)};
 const source=cohortFilters.dimensions?.TIPO_ENTREGA?.length?emissionRows.map(row=>{const delivery=canonicalDelivery(row.TIPO_ENTREGA);return delivery===row.TIPO_ENTREGA?row:{...row,TIPO_ENTREGA:delivery};}):emissionRows;
 const population=filterRows(source,cohortFilters,{ignoreDates:true});
 const quality={invalidEmissionRows:0,conflictingOrders:0,invalidBillingRows:0};
 const orders=new Map(),conflicts=new Set(),emissionDates=new Map();
 for(const row of population){
  const emitted=validDate(row.DATA_EMISSAO_PEDIDO_DATE),key=orderKey(row.CODIGO_PEDIDO);
  if(!emitted||!key){quality.invalidEmissionRows++;continue;}
  if(emitted>referenceDate)continue;
  if(emissionDates.has(key)&&emissionDates.get(key)!==emitted)conflicts.add(key);
  else emissionDates.set(key,emitted);
 }
 quality.conflictingOrders=conflicts.size;
 emissionDates.clear();
 // Allocate conversion windows only for eligible cohorts, while retaining
 // conflict detection against older dates elsewhere in the same source.
 for(const row of population){
  const emitted=validDate(row.DATA_EMISSAO_PEDIDO_DATE),key=orderKey(row.CODIGO_PEDIDO);
  if(!emitted||!key||emitted>referenceDate||emitted<start||emitted>end||conflicts.has(key))continue;
  let order=orders.get(key);
  if(!order){order={emitted,value:0,weightKg:0,volumeM3:0,billed:windows.map(()=>({value:0,weightKg:0,volumeM3:0,hasBilling:false}))};orders.set(key,order);}
  for(const [name,[column]] of measureEntries)order[name]=add(order[name],amount(row[column]));
 }
 let latestBilling=null;
 for(const row of billingRows){
  const billed=validDate(row.DT_FATURA_DATE);
  if(billed&&(!latestBilling||billed>latestBilling))latestBilling=billed;
  const order=orders.get(orderKey(row.CODIGO_PEDIDO));if(!order)continue;
  if(!billed||billed<order.emitted||validDate(row.DATA_EMISSAO_PEDIDO_DATE)!==order.emitted){quality.invalidBillingRows++;continue;}
  if(billed>referenceDate)continue;
  const elapsed=diffDays(billed,order.emitted);
  const hasBilling=['VALOR_FATURADO_CLEAN','PESO_FATURADO_CLEAN','VOLUME_M3_FATURADO_CLEAN','QUANTIDADE_FATURADA_CLEAN'].some(column=>amount(row[column])>0);
  for(let index=0;index<windows.length;index++){
   if(elapsed>windows[index])continue;
   const target=order.billed[index];
   for(const [name,[,column]] of measureEntries)target[name]=add(target[name],amount(row[column]));
   if(hasBilling)target.hasBilling=true;
  }
 }
 const observedThrough=latestBilling?(latestBilling<referenceDate?latestBilling:referenceDate):null;
 const byMonth=new Map();
 for(const order of orders.values()){
  const month=order.emitted.slice(0,7);
  if(!byMonth.has(month))byMonth.set(month,[]);byMonth.get(month).push(order);
 }
 const rows=[...byMonth].sort(([a],[b])=>a.localeCompare(b)).map(([month,items])=>{
  const base={month,orders:items.length,value:0,weightKg:0,volumeM3:0};
  for(const order of items)for(const name of measureNames)base[name]=add(base[name],order[name]);
  const monthEnd=addDays(monthShift(month,1),-1);
  const result=windows.map((days,index)=>{
   const availableOn=addDays(monthEnd,days),mature=observedThrough!=null&&availableOn<=observedThrough;
   const billed={value:0,weightKg:0,volumeM3:0};let billedOrders=0;
   for(const order of items){if(order.billed[index].hasBilling)billedOrders++;for(const name of measureNames)billed[name]=add(billed[name],order.billed[index][name]);}
   return {days,availableOn,mature,billedOrders,billedValue:billed.value,billedWeightKg:billed.weightKg,billedVolumeM3:billed.volumeM3,
    ordersPercent:mature?ratio(billedOrders,base.orders):null,valuePercent:mature?ratio(billed.value,base.value):null,
    weightPercent:mature?ratio(billed.weightKg,base.weightKg):null,volumePercent:mature?ratio(billed.volumeM3,base.volumeM3):null,
    exceedsBase:mature&&measureNames.some(name=>base[name]>0&&billed[name]>base[name]*(1+0.000001))};
  });
  return {...base,windows:result};
 });
 return {start,end,observedThrough,billingRangeIgnored:Boolean(billingRange),quality,rows};
}
