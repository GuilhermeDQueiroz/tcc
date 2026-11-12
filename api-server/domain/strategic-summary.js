import {sum,mean,groupSum} from './metrics.js';
import {isoDate} from './dates.js';
const known=value=>value!=null&&value!==''&&Number.isFinite(Number(value));
const unique=(rows,key)=>rows.some(row=>row[key]==null||!String(row[key]).trim()||String(row[key]).trim()==='None')?null:new Set(rows.map(row=>String(row[key]).trim())).size;
const amount=(rows,key,options)=>rows.some(row=>!known(row[key]))?null:sum(rows.map(row=>row[key]),options);
export function summarizeStrategicRows(rows){
 const service=rows.length?mean(rows.map(row=>row.NIVEL_DE_SERVICO_CLEAN),{float32:true}):null;
 const otif=rows.length?mean(rows.map(row=>row.ON_TIME_CLEAN),{float32:true}):null;
 const weight=rows.some(row=>!known(row.PESO_FATURADO_CLEAN))?null:groupSum(rows.map(row=>row.PESO_FATURADO_CLEAN),{float32:true});
 const value=amount(rows,'VALOR_FATURADO_CLEAN');
 const quantity=amount(rows,'QUANTIDADE_FATURADA_CLEAN',{float32:true});
 return {records:rows.length,withForecast:rows.filter(row=>isoDate(row.DT_PREVISAO_FATURAMENTO_DATE)).length,
  service,otif:otif==null?null:Math.fround(otif*100),weight,value,
  quantity,volume:amount(rows,'VOLUME_M3_FATURADO_CLEAN',{float32:true}),orders:unique(rows,'CODIGO_PEDIDO'),groups:unique(rows,'GRUPO_CLIENTE'),
  ticket:quantity>0&&value!=null?value/quantity:null,revenueKg:weight>0&&value!=null?value/weight:null};
}
