import {logisticsBacklog,isLogisticsOrder} from './logistics-backlog.js';
import {sum} from './metrics.js';
import {addDays} from './dates.js';
export function buildPortfolioAnalysis(orders,rateRows,referenceDate,dailyAverage){
 const selected=orders.filter(isLogisticsOrder),groups=new Map();
 const key=value=>String(value??'').trim()||'Não informado';
 const group=label=>{if(!groups.has(label))groups.set(label,{orders:[],billing:[]});return groups.get(label);};
 for(const row of selected)group(key(row.uf)).orders.push(row);
 for(const row of rateRows)group(key(row.UF)).billing.push(row);
 const measure=(rows,rate)=>{const backlog=logisticsBacklog(rows,rate);return {value:backlog.realValue,backlog:backlog.realDays,orders:backlog.orders,dailyAverage:rate};};
 const rows=[...groups].map(([label,group])=>({label,...measure(group.orders,sum(group.billing.map(row=>row.VALOR_FATURADO_CLEAN))/90)})).sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
 return {referenceDate,rateStart:addDays(referenceDate,-89),rateEnd:referenceDate,table:{id:'strategic.portfolio',title:'CARTEIRA LOGÍSTICA ATUAL',unavailableText:'—',
  columns:[{key:'label',label:'UF',format:'text'},{key:'value',label:'Carteira logística',format:'currency'},{key:'backlog',label:'Backlog logístico',format:'days'},{key:'orders',label:'Qtd pedidos',format:'integer'},{key:'dailyAverage',label:'Faturamento médio diário · 90 dias',format:'currency'}],
  rows,total:{label:'TOTAL DO RECORTE',...measure(selected,dailyAverage)}}};
}
