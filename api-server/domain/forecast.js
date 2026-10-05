import {daysInMonth,isoDate} from './dates.js';
import {sum,groupSum} from './metrics.js';
const STATUSES=['DOCUMENTO EM CARGA','LOGÍSTICA','LOGISTICA','FATURADO PARCIAL','DOCUMENTO LIBERADO'];
export function filterForecastBacklog(rows,type='real'){
  return type!=='real'?rows:rows.filter(r=>STATUSES.some(s=>String(r.STATUS??'').trim().toUpperCase().includes(s)));
}
export function backlogSummary(rows,dailyAverage){
  const value=sum(rows.map(r=>r.VALOR_EM_ABERTO_CLEAN));
  const realValue=sum(filterForecastBacklog(rows).map(r=>r.VALOR_EM_ABERTO_CLEAN));
  const realDays=dailyAverage>0?realValue/dailyAverage:0;
  const thresholds=[15,25,35,45],labels=['🔴 Crítico (baixo demais)','🟡 Atenção (baixo)','🟢 Ideal','🟡 Atenção (alto)','🔴 Crítico (alto demais)'];
  const index=thresholds.findIndex(limit=>realDays<limit);
  return {realValue,value,realDays,generalDays:dailyAverage>0?value/dailyAverage:0,dailyAverage,status:labels[index<0?4:index]};
}
export function forecastCalendar(rows,year,month,type='geral'){
  const prefix=`${year}-${String(month).padStart(2,'0')}`,groups=new Map();
  for(const row of filterForecastBacklog(rows,type)){
    const date=isoDate(row.DT_PREVISAO_FATURAMENTO_DATE);
    if(!date?.startsWith(prefix+'-'))continue;
    if(!groups.has(date))groups.set(date,[]);groups.get(date).push(row.VALOR_EM_ABERTO_CLEAN);
  }
  return Array.from({length:daysInMonth(year,month)},(_,i)=>{const date=`${prefix}-${String(i+1).padStart(2,'0')}`;return {date,day:i+1,value:groupSum(groups.get(date)||[])};});
}
const months=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function monthLabel(date){return `${months[Number(date.slice(5,7))-1]}/${date.slice(2,4)}`;}
export function prepareOpenRows(rows,referenceDate){
  const nextMonth=new Date(Date.UTC(Number(referenceDate.slice(0,4)),Number(referenceDate.slice(5,7)),1)).toISOString().slice(0,10);
  return rows.map(r=>{
    const em=isoDate(r.DATA_EMISSAO_PEDIDO_DATE),prev=isoDate(r.DT_PREVISAO_FATURAMENTO_DATE),ns=r.NIVEL_DE_SERVICO_CLEAN??999;
    const orig=String(r.ORIGEM??'').trim().toUpperCase();
    return {...r,Mes_Sort:em?Number(em.slice(0,4))*12+Number(em.slice(5,7)):999999,Mes_Grupo:em?monthLabel(em):'ind/nan',
      Aging_Bucket:ns<=15?'0-15 dias':ns<=30?'16-30 dias':ns<=45?'31-45 dias':ns<=60?'46-60 dias':'> 60 dias',
      Mes_Previsao_Sort:prev?Number(prev.slice(0,4))*12+Number(prev.slice(5,7)):999999,Mes_Previsao:prev?monthLabel(prev):'Sem Previsão',
      Status_Previsao:!prev?'Sem Previsão':prev<referenceDate?'Previsão Vencida':prev<nextMonth?'Mês Vigente':'Meses Futuros',
      Canal:['SITE','MANUAL'].includes(orig)?'Varejo':orig.includes('INTEGRA')||orig==='PANORAMAMOVEIS'?'E-commerce':'Outros'};
  });
}
