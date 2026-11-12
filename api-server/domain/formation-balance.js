import {filterRows} from './filters.js';
import {addDays} from './dates.js';
import {canonicalDelivery} from './delivery.js';
import {logisticsBacklog} from './logistics-backlog.js';

export function buildFormationBalanceMetrics(logistics,billingRows,filters={}){
 const referenceDate=logistics.referenceDate;
 const dimensions={};
 if(filters.uf)dimensions.UF=[].concat(filters.uf);
 if(filters.city)dimensions.CIDADE=[].concat(filters.city);
 if(filters.delivery)dimensions.TIPO_ENTREGA=[].concat(filters.delivery).map(canonicalDelivery);
 const start=addDays(referenceDate,-89);
 const recent=billingRows.filter(row=>row.DT_FATURA_DATE>=start&&row.DT_FATURA_DATE<=referenceDate);
 const normalized=dimensions.TIPO_ENTREGA?recent.map(row=>({...row,TIPO_ENTREGA:canonicalDelivery(row.TIPO_ENTREGA)})):recent;
 const selected=filterRows(normalized,{dimensions,...(filters.emissionStart||filters.emissionEnd?{emissionRange:[filters.emissionStart||'0000-01-01',filters.emissionEnd||'9999-12-31']}: {})});
 const known=selected.every(row=>Number.isFinite(Number(row.VALOR_FATURADO_CLEAN))&&row.VALOR_FATURADO_CLEAN!==null);
 const dailyAverage=known?selected.reduce((total,row)=>total+Number(row.VALOR_FATURADO_CLEAN),0)/90:null;
 const backlog=logisticsBacklog(logistics.tables[0].rows,dailyAverage);
 const help='Saldo da carteira logística na posição publicada. Os filtros de formação selecionam os pedidos; UF, cidade, tipo de entrega e emissão também recortam o faturamento de referência.';
 return [
  {id:'logistica.portfolioValue',label:'Carteira logística',value:backlog.realValue,format:'currency',help},
  {id:'logistica.backlogReal',label:'Backlog logístico',value:backlog.realDays,format:'days',status:backlog.state,help:'Dias de faturamento necessários para cobrir a carteira logística: saldo ÷ faturamento médio diário dos últimos 90 dias. '+help},
 ];
}
