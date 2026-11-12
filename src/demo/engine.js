import {PostgresRepository} from '../../api-server/repositories/postgres.js';
import {StrategicRepository} from '../../api-server/repositories/strategic.js';
import {buildLogisticsDashboard} from '../../api-server/domain/logistics.js';
import {buildAftersalesDashboard,validateAftersalesQuery} from '../../api-server/domain/posvenda.js';
import {filterRows} from '../../api-server/domain/filters.js';
import {parseFilters,validateAreaTab} from '../../api-server/domain/contracts.js';
import {logisticsPayload} from '../../api-server/presentation/logistics.js';

export function createDemoApi({manifest,load}){
 const referenceDate=manifest.referenceDate;
 let goals, presets=[];
 class SnapshotRepository extends PostgresRepository {
  constructor(){super(null);}
  async getVersion(){return manifest.publications.commercial;}
  async snapshot(date,area){
   if(date!==referenceDate)throw new Error('A demonstração tem posição fixa em '+referenceDate.split('-').reverse().join('/')+'.');
   if(area==='formation-balance')return load('faturados');
   if(area==='strategic'){
    const [emission,billing]=await Promise.all([load('emitidos'),load('faturados')]);
    return {...billing,frames:{emitidos:emission.frames.emitidos,faturados:billing.frames.faturados}};
   }
   return load(area);
  }
  async getDetails(context,options){
   if(options.grain==='order')return super.getDetails(context,options);
   const snapshot=await this.snapshot(context.referenceDate,context.area);
   let rows=filterRows(snapshot.frames[context.area],context.filters);
   if(context.forecastDate)rows=rows.filter(row=>row.DT_PREVISAO_FATURAMENTO_DATE===context.forecastDate);
   const keys=Object.keys(snapshot.frames[context.area][0]||{}),selected=options.columns||keys;
   if(selected.some(key=>!keys.includes(key)))throw new Error('Coluna fora do recorte demonstrativo.');
   const direction=options.direction==='asc'?1:-1;
   rows=[...rows].sort((a,b)=>direction*compare(a[options.sort],b[options.sort]));
   const columns=selected.map(key=>({key,label:key,format:key.endsWith('_DATE')?'date':key.endsWith('_CLEAN')?(key.startsWith('VALOR_')?'currency':'number'):'text'}));
   const selectedRows=options.export?rows:rows.slice((options.page-1)*options.pageSize,options.page*options.pageSize);
   return {dataVersion:snapshot.version,rows:selectedRows.map(row=>Object.fromEntries(selected.map(key=>[key,row[key]]))),total:rows.length,page:options.page,pageSize:options.pageSize,columns};
  }
 }
 const repository=new SnapshotRepository();
 const logistics={snapshot:()=>load('logistica'),getDashboard:async filters=>buildLogisticsDashboard({...await load('logistica'),filters})};
 const strategic=new StrategicRepository(repository,logistics);
 const csv=(rows,columns)=>'\uFEFF'+[columns.map(column=>escape(column.label)).join(';'),...rows.map(row=>columns.map(column=>escape(row[column.key])).join(';'))].join('\r\n');
 return async function request(path,{method='GET',body}={}){
  const url=new URL(path,'https://demo.invalid'),parts=url.pathname.split('/').filter(Boolean),q=Object.fromEntries(url.searchParams);
  if(url.pathname.startsWith('/settings/')){
   goals??=structuredClone(await load('metas'));
   if(parts[1]==='metas'){
    if(method==='PUT')goals=JSON.parse(String(body));
    return structuredClone(goals);
   }
   if(parts[1]==='presets'){
    if(method==='POST')presets.push({...JSON.parse(String(body)),id:crypto.randomUUID()});
    if(method==='DELETE')presets=presets.filter(preset=>preset.id!==parts[2]);
    return structuredClone(presets);
   }
  }
  if(method!=='GET')throw new Error('Operação indisponível na demonstração.');
  if(parts[0]==='logistica'){
   if(parts[1]==='estrategico'&&q.section==='analysis')return strategic.getAnalysis(parseFilters(q.filters),q.dimension||'UF');
   if(parts[1]==='estrategico')return strategic.getDashboard(parseFilters(q.filters),q.granularity||'month',q.dimension||'UF',q.heatmapDimension||'year',q.heatmapMetric||'value');
   if(parts[1]==='formacao'){
    const filters={...q};
    for(const key of ['uf','city','delivery','erpStatus','client','product'])if(url.searchParams.has(key))filters[key]=url.searchParams.getAll(key);
    const dashboard=await logistics.getDashboard(filters);
    return logisticsPayload({...dashboard,portfolioMetrics:await strategic.getFormationBalance(dashboard,filters)});
   }
  }
  if(parts[0]==='posvenda'){
   const query=validateAftersalesQuery(parts[1],q),snapshot=await load('posvenda');
   const data=buildAftersalesDashboard({...snapshot,area:parts[1],query});
   if(query.export==='csv')return csv(data.table.rows,data.table.columns);
   if(query.section==='details')return {dataVersion:data.dataVersion,referenceDate:data.referenceDate,total:data.total,table:data.table,page:data.page,pageSize:data.pageSize};
   return data;
  }
  if(parts[0]==='bi'){
   const [,area,tab]=parts;validateAreaTab(area);
   if(q.referenceDate&&q.referenceDate!==referenceDate)throw new Error('A demonstração tem posição fixa em '+referenceDate.split('-').reverse().join('/')+'.');
   const context={area,filters:parseFilters(q.filters),referenceDate:q.referenceDate||referenceDate,
    year:Number(q.year||referenceDate.slice(0,4)),month:Number(q.month||referenceDate.slice(5,7)),
    backlogType:q.backlogType||'real',dimension:q.dimension||'UF',metric:q.metric||'value',chartType:q.chartType||'bar',heatmapDimension:q.heatmapDimension||'CONSULTOR',
    ...(q.forecastDate?{forecastDate:q.forecastDate}:{}),...(q.hierarchy?{hierarchy:q.hierarchy.split(',')}:{})};
   if(tab==='filtros')return repository.getDimensions(context);
   if(tab==='detalhes'){
    if(q.detailFilters)context.detailFilters=parseFilters(q.detailFilters);
    const options={grain:q.grain||'item',page:Number(q.page||1),pageSize:Number(q.pageSize||20),sort:q.sort||'CODIGO_PEDIDO',direction:q.direction||'desc',columns:q.columns?q.columns.split(','):undefined,export:q.export};
    const result=await repository.getDetails(context,{...options,export:undefined,page:options.export?1:options.page,pageSize:options.export?1000000:options.pageSize});
    return options.export==='csv'?csv(result.rows,result.columns):result;
   }
   validateAreaTab(area,tab);goals??=structuredClone(await load('metas'));context.goalsConfig=goals;
   return repository.getDashboard(context,tab);
  }
  throw new Error('Consulta não disponível nesta demonstração.');
 };
}
function compare(a,b){
 if(a==null)return b==null?0:1;if(b==null)return -1;
 return typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'pt-BR',{numeric:true});
}
function escape(value){return '"'+String(value??'').replaceAll('"','""')+'"';}
