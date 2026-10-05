// pandas Series uses NumPy pairwise reduction; groupby uses compensated sums.
// Retain float32 arithmetic from the original loader, rather than summing doubles.
export function sum(values,{float32=false}={}) {
  const cast=float32?Math.fround:x=>x;
  const v=values.map(x=>x==null||Number.isNaN(Number(x))?0:cast(Number(x)));
  function pair(start,length){
    if(length<8){let r=cast(-0);for(let i=start;i<start+length;i++)r=cast(r+v[i]);return r;}
    if(length<=128){
      const r=v.slice(start,start+8);let i=8;
      for(;i<length-(length%8);i+=8)for(let k=0;k<8;k++)r[k]=cast(r[k]+v[start+i+k]);
      let total=cast(cast(cast(r[0]+r[1])+cast(r[2]+r[3]))+cast(cast(r[4]+r[5])+cast(r[6]+r[7])));
      for(;i<length;i++)total=cast(total+v[start+i]);return total;
    }
    let half=Math.floor(length/2);half-=half%8;
    return cast(pair(start,half)+pair(start+half,length-half));
  }
  return pair(0,v.length);
}
export function mean(values,options={}) {
  const valid=values.filter(x=>x!=null&&!Number.isNaN(Number(x)));
  if(!valid.length)return null;
  const result=sum(values,options)/valid.length;return options.float32?Math.fround(result):result;
}
export function groupSum(values,{float32=false}={}) {
  const cast=float32?Math.fround:x=>x;let total=0,compensation=0;
  for(const value of values){if(value==null||Number.isNaN(Number(value)))continue;
    const y=cast(cast(Number(value))-compensation),t=cast(total+y);
    compensation=cast(cast(t-total)-y);total=t;
  }return total;
}
export function groupMean(values,options={}) {
  const valid=values.filter(x=>x!=null&&!Number.isNaN(Number(x)));
  if(!valid.length)return null;
  const result=groupSum(valid,options)/valid.length;return options.float32?Math.fround(result):result;
}
export function numericColumns(area){return area==='abertos'?{value:'VALOR_EM_ABERTO_CLEAN',weightKg:'PESO_EM_ABERTO_CLEAN',quantity:'QTDEABERTA_DOCITEMDET_CLEAN',volumeM3:'VOLUME_M3_EM_ABERTO_CLEAN'}:area==='emitidos'?{value:'VALOR_EMITIDO_CLEAN',weightKg:'PESO_EMITIDO_CLEAN',quantity:'QUANTIDADE_EMITIDA_CLEAN',volumeM3:'VOLUME_M3_EMITIDO_CLEAN'}:{value:'VALOR_FATURADO_CLEAN',weightKg:'PESO_FATURADO_CLEAN',quantity:'QUANTIDADE_FATURADA_CLEAN',volumeM3:'VOLUME_M3_FATURADO_CLEAN'};}
export function distinct(values){return new Set(values.filter(x=>x!=null)).size;}
export function summarize(rows,area,{grouped=false}={}) {
  const reduce=grouped?groupSum:sum,avg=grouped?groupMean:mean;const out={};
  for(const [key,column] of Object.entries(numericColumns(area)))out[key]=reduce(rows.map(r=>r[column]),{float32:key!=='value'});
  out.orders=distinct(rows.map(r=>r.CODIGO_PEDIDO));out.groups=distinct(rows.map(r=>r.GRUPO_CLIENTE));
  out.serviceDays=avg(rows.map(r=>r.NIVEL_DE_SERVICO_CLEAN),{float32:true});
  out.onTime=avg(rows.map(r=>r.ON_TIME_CLEAN),{float32:true});
  out.billingDeviationDays=avg(rows.map(r=>r.DIAS_DESVIO_FATURAMENTO_CLEAN),{float32:true});
  out.ticket=out.quantity>0?out.value/out.quantity:0;
  out.revenuePerTon=out.weightKg>0?out.value/(out.weightKg/1000):0;
  return out;
}
export function groupRows(rows,columns){
  const groups=new Map();
  for(const row of rows){if(columns.some(c=>row[c]==null))continue;const key=JSON.stringify(columns.map(c=>row[c]));
    if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);
  }return [...groups.values()].sort((a,b)=>{for(const c of columns){if(a[0][c]<b[0][c])return -1;if(a[0][c]>b[0][c])return 1;}return 0;});
}
