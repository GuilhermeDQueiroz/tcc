// Coverage of the published logistical balance. Thresholds and ERP statuses
// follow legacy/views/pedidos_em_aberto.py; they are project bands, not an SLA.
export const backlogStatuses=['DOCUMENTO EM CARGA','LOGISTICA','FATURADO PARCIAL','DOCUMENTO LIBERADO'];
const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
export function backlogState(days){
 if(days==null||!Number.isFinite(days))return {tone:'neutral',label:'Indisponível'};
 if(days<15)return {tone:'critical',label:'Crítico (baixo demais)'};
 if(days<25)return {tone:'warning',label:'Atenção (baixo)'};
 if(days<35)return {tone:'good',label:'Ideal'};
 if(days<45)return {tone:'warning',label:'Atenção (alto)'};
 return {tone:'critical',label:'Crítico (alto demais)'};
}
export const isLogisticsOrder=order=>backlogStatuses.some(status=>normalize(order.status_erp).includes(status));
export function logisticsBacklog(orders,dailyAverage){
 const selected=orders.filter(isLogisticsOrder);
 const realValue=selected.some(order=>typeof order.valor_aberto!=='number'||!Number.isFinite(order.valor_aberto))?null:selected.reduce((total,order)=>total+order.valor_aberto,0);
 const coverage=value=>dailyAverage>0&&value!=null?value/dailyAverage:null;
 const realDays=coverage(realValue);
 return {realValue,realDays,orders:selected.length,statuses:backlogStatuses,state:backlogState(realDays)};
}
