import express from 'express';
import compression from 'compression';
import {InputError,validateAreaTab,parseFilters,ANALYSIS_DIMENSIONS} from './domain/contracts.js';
import {loadStageLabels} from './domain/logistics.js';
import {StrategicRepository} from './repositories/strategic.js';
const connectionFailures=new Map([
  ['timeout exceeded when trying to connect','pool_acquire_timeout'],
  ['Connection terminated due to connection timeout','connection_timeout'],
  ['Connection terminated unexpectedly','connection_terminated']
]);
const integer=(value,min,max,fallback)=>{if(value==null)return fallback;const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new InputError('Parâmetro numérico fora do intervalo.');return n;};
export function createApp({repository,logisticsRepository,settingsStore,clock=()=>new Date(),logger=console}={}){
  const app=express();app.disable('x-powered-by');app.use(compression());app.use(express.json({limit:'100kb'}));
  const strategic=new StrategicRepository(repository,logisticsRepository);
  app.get('/api/v1/logistica/estrategico',async(req,res)=>{
    if(Object.keys(req.query).some(key=>!['filters','granularity'].includes(key)))throw new InputError('Filtro estratégico inválido.');
    const filters=parseFilters(req.query.filters),granularity=req.query.granularity||'month';
    if(!['month','week','day'].includes(granularity))throw new InputError('Detalhamento inválido.');
    if(Object.keys(filters).some(key=>!['dimensions','billingRange','emissionRange'].includes(key))||Object.keys(filters.dimensions||{}).some(key=>!['UF','CIDADE','TIPO_ENTREGA'].includes(key)))throw new InputError('Filtro estratégico inválido.');
    if(!logisticsRepository?.snapshot||!repository?.snapshot)throw Object.assign(new Error('Publicações da visão estratégica indisponíveis.'),{status:409});
    res.json(await strategic.getDashboard(filters,granularity));
  });
  app.get('/api/v1/health',async(req,res)=>{const dataVersion=await repository.getVersion();res.json({status:'ok',dataVersion,source:'firebird/apache-hop'});});
  app.get('/api/v1/logistica/formacao',async(req,res)=>{
    if(!logisticsRepository)throw Object.assign(new Error('Módulo logístico indisponível.'),{status:409});
    const allowed=['company','status','search','uf','city','delivery','erpStatus','client','product','loadStage','forecastStatus','emissionStart','emissionEnd','forecastStart','forecastEnd','ageMin','freeQuantityMin','freeVolumeMin','freeWeightMin','orderValueMin'];
    if(Object.keys(req.query).some(key=>!allowed.includes(key)))throw new InputError('Filtro logístico inválido.');
    const {company,status,search}=req.query;
    if(company!==undefined&&(typeof company!=='string'||!/^\d{1,12}$/.test(company)))throw new InputError('Empresa inválida.');
    if(status!==undefined&&!['none','partial','full'].includes(status))throw new InputError('Situação de alocação inválida.');
    if(search!==undefined&&(typeof search!=='string'||search.length>100))throw new InputError('Pesquisa inválida.');
    const filters={company,status,search};
    for(const key of ['uf','city','delivery','erpStatus','client','product'])if(req.query[key]!==undefined){const values=Array.isArray(req.query[key])?req.query[key]:[req.query[key]];if(values.length>100||values.some(value=>typeof value!=='string'||!value.trim()||value.length>150))throw new InputError('Filtro logístico inválido.');filters[key]=req.query[key];}
    if(req.query.loadStage!==undefined){if(!loadStageLabels.includes(req.query.loadStage))throw new InputError('Etapa da carga inválida.');filters.loadStage=req.query.loadStage;}
    if(req.query.forecastStatus!==undefined){if(!['overdue','today','upcoming','undated'].includes(req.query.forecastStatus))throw new InputError('Situação da previsão inválida.');filters.forecastStatus=req.query.forecastStatus;}
    for(const key of ['freeQuantityMin','freeVolumeMin','freeWeightMin','orderValueMin'])if(req.query[key]!==undefined){const value=req.query[key];if(typeof value!=='string'||!value.trim()||!Number.isFinite(Number(value))||Number(value)<0)throw new InputError('Valor mínimo inválido.');filters[key]=Number(value);}
    for(const key of ['emissionStart','emissionEnd','forecastStart','forecastEnd'])if(req.query[key]!==undefined){if(typeof req.query[key]!=='string')throw new InputError('Data inválida.');parseFilters(JSON.stringify({emissionRange:[req.query[key],req.query[key]]}));filters[key]=req.query[key];}
    for(const [start,end] of [['emissionStart','emissionEnd'],['forecastStart','forecastEnd']])if(filters[start]&&filters[end]&&filters[start]>filters[end])throw new InputError('Período inválido.');
    if(req.query.ageMin!==undefined)filters.ageMin=integer(req.query.ageMin,0,10000,0);
    res.json(await logisticsRepository.getDashboard(filters));
  });
  app.get('/api/v1/bi/:area/:tab',async(req,res)=>{
    const {area,tab}=req.params;validateAreaTab(area);
    const filters=parseFilters(req.query.filters);
    let referenceDate=req.query.referenceDate||clock().toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
    parseFilters(JSON.stringify({emissionRange:[referenceDate,referenceDate]}));
    const context={area,filters,referenceDate,year:integer(req.query.year,1900,2200,Number(referenceDate.slice(0,4))),month:integer(req.query.month,1,12,Number(referenceDate.slice(5,7))),
      backlogType:req.query.backlogType||'real',dimension:req.query.dimension||'UF',metric:req.query.metric||'value',chartType:req.query.chartType||'bar',heatmapDimension:req.query.heatmapDimension||'CONSULTOR'};
    if(req.query.forecastDate){parseFilters(JSON.stringify({emissionRange:[req.query.forecastDate,req.query.forecastDate]}));context.forecastDate=req.query.forecastDate;}
    const extra=['CLIENTE','CODIGO_PEDIDO','Mes_Grupo','Mes_Previsao','Aging_Bucket','Status_Previsao','Canal'];
    if(![...ANALYSIS_DIMENSIONS,...extra].includes(context.dimension))throw new InputError('Dimensão inválida.');
    if(!['real','geral'].includes(context.backlogType)||!['value','weightKg','quantity','volumeM3','orders'].includes(context.metric)||!['bar','barHorizontal','pie','line','heatmap','table','treemap'].includes(context.chartType))throw new InputError('Opção de visualização inválida.');
    context.hierarchy=req.query.hierarchy?String(req.query.hierarchy).split(','):undefined;
    if(context.hierarchy&&(context.hierarchy.length>6||context.hierarchy.some(d=>![...ANALYSIS_DIMENSIONS,...extra].includes(d))))throw new InputError('Hierarquia inválida.');
    if(![...ANALYSIS_DIMENSIONS,'Ano_Num'].includes(context.heatmapDimension))throw new InputError('Dimensão do mapa de calor inválida.');
    if(tab==='filtros'){res.json(await repository.getDimensions(context));return;}
    if(tab==='detalhes'){
      if(req.query.grain&&!['item','order'].includes(req.query.grain))throw new InputError('Grão de pesquisa inválido.');
      if(req.query.detailFilters){
        context.detailFilters=parseFilters(req.query.detailFilters);
        if(Object.keys(context.detailFilters).some(key=>!['dimensions','search'].includes(key))||Object.keys(context.detailFilters.dimensions || {}).some(key=>!['SUPERVISOR','CONSULTOR','STATUS'].includes(key)))throw new InputError('Filtro local de pedidos inválido.');
      }
      const result=await repository.getDetails(context,{grain:req.query.grain||'item',page:integer(req.query.page,1,10000000,1),pageSize:integer(req.query.pageSize,1,1000000,20),sort:req.query.sort||'CODIGO_PEDIDO',direction:req.query.direction||'desc',columns:req.query.columns?String(req.query.columns).split(','):undefined,export:req.query.export});
      if(req.query.export==='csv'){res.type('text/csv; charset=utf-8').set('Content-Disposition',`attachment; filename="${area}.csv"`).send(result);return;}
      res.json(result);return;
    }
    validateAreaTab(area,tab);context.goalsConfig=await settingsStore.getMetas();res.json(await repository.getDashboard(context,tab));
  });
  app.get('/api/v1/settings/metas',async(req,res)=>res.json(await settingsStore.getMetas()));
  app.put('/api/v1/settings/metas',async(req,res)=>res.json(await settingsStore.setMetas(req.body)));
  app.get('/api/v1/settings/presets',async(req,res)=>res.json(await settingsStore.getPresets()));
  app.post('/api/v1/settings/presets',async(req,res)=>res.status(201).json(await settingsStore.addPreset(req.body)));
  app.delete('/api/v1/settings/presets/:id',async(req,res)=>{await settingsStore.deletePreset(req.params.id);res.status(204).end();});
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint não encontrado.'}));
  app.use((error,req,res,next)=>{
    const status=error.status|| (error.type==='entity.parse.failed'?400:503);
    if(status>=500){
      const identifier=value=>/^[A-Za-z0-9_$.-]{1,64}$/.test(String(value??''))?String(value):undefined;
      const frames=String(error.stack??'').split('\n').filter(line=>/^\s+at /.test(line)).flatMap(line=>{
        const location=line.match(/([A-Za-z0-9_.-]+\.(?:[cm]?js|ts)|node:[A-Za-z0-9_./-]+):(\d+):(\d+)\)?$/);
        if(!location)return [];
        const method=line.trim().match(/^at (?:async )?([A-Za-z0-9_.$<>]+) /)?.[1];
        return [`${method?method+' ':''}${location[1]}:${location[2]}:${location[3]}`];
      }).slice(0,5);
      const pool=repository?.pool,memory=process.memoryUsage();
      logger.error({event:'api_error',name:identifier(error.name),code:identifier(error.code),classification:connectionFailures.get(error.message)??'unclassified',
        method:req.method,path:req.path,frames,pool:pool?{total:pool.totalCount,idle:pool.idleCount,waiting:pool.waitingCount}:undefined,
        memory:{rss:memory.rss,heapUsed:memory.heapUsed,heapTotal:memory.heapTotal,external:memory.external}});
    }
    res.status(status).json({error:status===503?'O PostgreSQL do projeto está indisponível ou não há carga Hop publicada.':error.message});
  });return app;
}
