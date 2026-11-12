// A column dictionary preserves repeated labels, nulls, zeroes and row order.
// This is a transport format for genuine publications, never a data generator.
export function packRows(rows){
 const keys=new Set();for(const row of rows)for(const key of Object.keys(row))keys.add(key);
 const columns=[...keys];
 return {columns,data:columns.map(key=>{
  const dictionary=[],indices=[],known=new Map();
  for(const row of rows){const value=row[key]??null;let index=known.get(value);
   if(index===undefined){index=dictionary.length;known.set(value,index);dictionary.push(value);}
   indices.push(index);
  }
  return {dictionary,indices};
 }),length:rows.length};
}
export function unpackRows(table){
 const rows=Array.from({length:table.length},()=>({}));
 table.columns.forEach((key,column)=>{
  const {dictionary,indices}=table.data[column];
  for(let row=0;row<rows.length;row++)rows[row][key]=dictionary[indices[row]];
 });
 return rows;
}
// Public demo markers retain the source region, never the delivery address or exact point.
export function generalizeLogisticsLocation(item){
 const {cep,latitude,longitude,geo_origin,...publicItem}=item;
 const lat=Number(latitude),lon=Number(longitude);
 const valid=latitude!==null&&latitude!==undefined&&longitude!==null&&longitude!==undefined
  &&Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-34&&lat<=6&&lat!==0&&lon>=-74&&lon<=-34;
 return {...publicItem,latitude:valid?Math.round(lat*4)/4:null,
  longitude:valid?Math.round(lon*4)/4:null,geo_origin:valid?'DEMO':null};
}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
 return value;
}
export function demoRequestKey(path,referenceDate){
 const url=new URL(path,'https://demo.invalid'),q=Object.fromEntries(url.searchParams);
 for(const key of Object.keys(q))if(q[key]==='')delete q[key];
 if(url.pathname.startsWith('/bi/')){
  Object.assign(q,{filters:JSON.parse(q.filters||'{}'),referenceDate:q.referenceDate||referenceDate,
   year:q.year||referenceDate.slice(0,4),month:q.month||String(Number(referenceDate.slice(5,7))),
   backlogType:q.backlogType||'real',dimension:q.dimension||'UF',metric:q.metric||'value',chartType:q.chartType||'bar',heatmapDimension:q.heatmapDimension||'CONSULTOR'});
  if(url.pathname.endsWith('/detalhes'))Object.assign(q,{page:q.page||'1',pageSize:q.pageSize||'20',sort:q.sort||'CODIGO_PEDIDO',direction:q.direction||'desc',grain:q.grain||'item'});
  if(q.detailFilters){q.detailFilters=JSON.parse(q.detailFilters);if(!Object.keys(q.detailFilters.dimensions||{}).length)delete q.detailFilters.dimensions;if(!Object.keys(q.detailFilters).length)delete q.detailFilters;}
 }else if(url.pathname==='/logistica/estrategico')Object.assign(q,{filters:JSON.parse(q.filters||'{}'),granularity:q.granularity||'month'});
 else if(url.pathname.startsWith('/posvenda/')){
  Object.assign(q,{page:q.page||'1',pageSize:q.pageSize||'20',sort:q.sort||'data',direction:q.direction||'desc',dimension:q.dimension||'month',metric:q.metric||'value',granularity:q.granularity||'month'});
  if(url.pathname==='/posvenda/assistencias'){
   q.view=q.view||'abertas';
   // Older captures can still serve their raw rows to the worker.
   if(q.view==='abertas'&&!q.section&&!q.export)q.openAssistanceSchema=2;
  }
  if(url.pathname==='/posvenda/cancelamentos'&&!q.section&&!q.export)q.cancellationSchema=2;
  if(url.pathname==='/posvenda/devolucoes'&&!q.section&&!q.export)q.returnSchema=2;
 }
 return url.pathname+'?'+JSON.stringify(stable(q));
}
export const demoInitialPaths=[
 '/bi/abertos/resumo?chartType=table',
 '/bi/abertos/dimensoes?dimension=Mes_Grupo&chartType=table',
 '/bi/abertos/detalhes?grain=order&pageSize=1000000&sort=VALOR_EM_ABERTO_CLEAN&chartType=table',
 ...['abertos','emitidos','faturados'].map(area=>`/bi/${area}/filtros?chartType=table&metric=${area==='faturados'?'weightKg':'value'}&heatmapDimension=${area==='faturados'?'UF':'CONSULTOR'}`),
 ...['mensal','semanal','evolucao','geografia','dimensoes','pesquisa'].map(tab=>`/bi/faturados/${tab}?metric=weightKg&chartType=table&heatmapDimension=UF`),
 ...['month','week','day'].map(grain=>'/logistica/estrategico?granularity='+grain),
 '/logistica/formacao',
 '/posvenda/assistencias?view=abertas','/posvenda/assistencias?view=emitidas','/posvenda/assistencias?view=faturadas',
 '/posvenda/cancelamentos?kind=Venda','/posvenda/cancelamentos?kind=Assistência',
 '/posvenda/devolucoes?kind=Venda','/posvenda/devolucoes?kind=Assistência',
 '/settings/metas','/settings/presets',
];
