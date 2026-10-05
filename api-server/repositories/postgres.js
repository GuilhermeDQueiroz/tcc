import fs from 'node:fs';
import {AsyncCache,stableKey} from '../cache.js';
import {InputError,DIMENSIONS,validateAreaTab} from '../domain/contracts.js';
import {filterRows} from '../domain/filters.js';
import {sum} from '../domain/metrics.js';
import {isoDate,addDays} from '../domain/dates.js';
import {buildOpenDashboard} from '../domain/open.js';
import {buildDimensionDashboard,buildHierarchy} from '../domain/dimensions.js';
import {buildCommercialDashboard} from '../domain/commercial.js';
import {prepareOpenRows} from '../domain/forecast.js';
import {groupOpenOrders,openOrderColumns} from '../domain/open-orders.js';
const contract=JSON.parse(fs.readFileSync(new URL('../../etl/contrato-colunas-dw.json',import.meta.url),'utf8'));
const views={abertos:'pedidos_abertos',emitidos:'pedidos_emitidos',faturados:'pedidos_faturados',carteira:'carteira_clientes',metas:'metas_consultores'};
const q=name=>'"'+name+'"';
const logicalColumns=area=>contract.areas[area].columns;
export function buildProjection(area,{compact=false}={}){
  const columns=logicalColumns(area),names=Object.fromEntries(columns.map(c=>[c.legacy,c.name]));
  const projection=columns.filter(c=>!compact||!['abertos','emitidos','faturados'].includes(area)||c.legacy.endsWith('_CLEAN')||c.legacy.endsWith('_DATE')||['CODIGO_PEDIDO','CODIGO_CLIENTE','RAZAO_SOCIAL','CODIGO_CONSULTOR','CODIGO_ITEM','NOTAFISCAL','ENTREGA','CARGA','DESCRICAO_ITEM','DESCRICAO_CARGA',...DIMENSIONS,'ORIGEM','ORGAO','COR','FAMILIA'].includes(c.legacy)).map(c=>{
    let name=c.name;if(c.legacy.startsWith('VOLUME_M3')&&!c.legacy.endsWith('_CLEAN'))name=names[c.legacy+'_CLEAN']||name;
    const expression=c.legacy.endsWith('_DATE')?q(name)+'::date::text':q(name);
    return expression+' AS '+q(c.legacy);
  }).join(', ');
  if(!compact&&['abertos','emitidos','faturados'].includes(area))return projection+`, btrim(COALESCE(${q(names.CODIGO_CLIENTE)}::text,'None')) || ' - ' || btrim(COALESCE(${q(names.RAZAO_SOCIAL)},'None')) AS "CLIENTE"`;
  return projection;
}
export function buildWhere(area,filters={},referenceDate,{ignoreDates=false}={}){
  const available=new Set(logicalColumns(area).map(c=>c.legacy)),values=[],clauses=[];
  const param=value=>{values.push(value);return '$'+values.length;};
  if(['abertos','emitidos','faturados'].includes(area)){
    for(const col of ['CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'])clauses.push(`COALESCE(${q(col)}::text,'') NOT ILIKE '%tekdashboard%'`);
    if(area==='emitidos')clauses.push(`${q('DATA_EMISSAO_PEDIDO_DATE')}::date<=${param(referenceDate)}::date`);
  }
  const virtual={CLIENTE:`btrim(COALESCE(${q('CODIGO_CLIENTE')}::text,'None')) || ' - ' || btrim(COALESCE(${q('RAZAO_SOCIAL')},'None'))`,
    Aging_Bucket:`CASE WHEN ${q('NIVEL_DE_SERVICO_CLEAN')}<=15 THEN '0-15 dias' WHEN ${q('NIVEL_DE_SERVICO_CLEAN')}<=30 THEN '16-30 dias' WHEN ${q('NIVEL_DE_SERVICO_CLEAN')}<=45 THEN '31-45 dias' WHEN ${q('NIVEL_DE_SERVICO_CLEAN')}<=60 THEN '46-60 dias' ELSE '> 60 dias' END`,
    Canal:`CASE WHEN upper(btrim(${q('ORIGEM')})) IN ('SITE','MANUAL') THEN 'Varejo' WHEN upper(${q('ORIGEM')}) LIKE '%INTEGRA%' OR upper(btrim(${q('ORIGEM')}))='PANORAMAMOVEIS' THEN 'E-commerce' ELSE 'Outros' END`};
  const monthExpression=col=>`(ARRAY['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])[extract(month FROM ${q(col)}::date)::int] || '/' || to_char(${q(col)}::date,'YY')`;
  virtual.Mes_Grupo=`COALESCE(${monthExpression('DATA_EMISSAO_PEDIDO_DATE')},'ind/nan')`;
  virtual.Mes_Previsao=`COALESCE(${monthExpression('DT_PREVISAO_FATURAMENTO_DATE')},'Sem Previsão')`;
  for(const [col,list] of Object.entries(filters.dimensions||{}))if(list.length){
    let expression=available.has(col)?(col==='TIPO_ENTREGA'?`upper(btrim(${q(col)}))`:q(col)+'::text'):virtual[col];
    if(col==='Status_Previsao')expression=`CASE WHEN ${q('DT_PREVISAO_FATURAMENTO_DATE')} IS NULL THEN 'Sem Previsão' WHEN ${q('DT_PREVISAO_FATURAMENTO_DATE')}::date<${param(referenceDate)}::date THEN 'Previsão Vencida' WHEN ${q('DT_PREVISAO_FATURAMENTO_DATE')}::date<date_trunc('month',${param(referenceDate)}::date)+interval '1 month' THEN 'Mês Vigente' ELSE 'Meses Futuros' END`;
    if(expression)clauses.push(`(${expression}) = ANY(${param(list)})`);
  }
  if(filters.includeGroups?.length)clauses.push(`${q('GRUPO_CLIENTE')} = ANY(${param(filters.includeGroups)})`);
  if(filters.excludeGroups?.length)clauses.push(`NOT (${q('GRUPO_CLIENTE')} = ANY(${param(filters.excludeGroups)}))`);
  if(!ignoreDates)for(const [key,column] of [['billingRange',area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE'],['emissionRange','DATA_EMISSAO_PEDIDO_DATE']]){
    if(filters[key]&&available.has(column)){clauses.push(`${q(column)}::date BETWEEN ${param(filters[key][0])}::date AND ${param(filters[key][1])}::date`);}
  }
  for(const [key,col] of [['value',area==='abertos'?'VALOR_EM_ABERTO_CLEAN':area==='emitidos'?'VALOR_EMITIDO_CLEAN':'VALOR_FATURADO_CLEAN'],['quantity',area==='abertos'?'QTDEABERTA_DOCITEMDET_CLEAN':area==='emitidos'?'QUANTIDADE_EMITIDA_CLEAN':'QUANTIDADE_FATURADA_CLEAN']]){
    const comp=filters[key];if(comp){const operator={'==':'=','!=':'<>','>':'>','>=':'>=','<':'<','<=':'<='}[comp.operator];if(!operator)throw new InputError('Operador inválido.');const expression=key==='quantity'?q(col)+'::real::double precision':q(col);clauses.push(`${expression} ${operator} ${param(comp.value)}`);}
  }
  if(filters.search){const escaped=filters.search.replace(/[\\%_]/g,'\\$&');const p=param('%'+escaped+'%');const cols=['CODIGO_PEDIDO','CODIGO_CLIENTE','RAZAO_SOCIAL','GRUPO_CLIENTE','DESCRICAO_ITEM','CONSULTOR','SUPERVISOR','STATUS','NOTAFISCAL'].filter(c=>available.has(c));clauses.push('('+cols.map(c=>`${q(c)}::text ILIKE ${p}`).join(' OR ')+')');}
  return {text:clauses.length?' WHERE '+clauses.join(' AND '):'',values};
}
export function normalizeRows(rows,area,referenceDate){
  const interns=new Map();const intern=text=>{if(!interns.has(text))interns.set(text,text);return interns.get(text);};
  const result=[];
  for(const row of rows){
    for(const [key,value] of Object.entries(row)){
      if(key.endsWith('_CLEAN'))row[key]=key.startsWith('VALOR_')?Number(value)||0:Math.fround(Number(value)||0);
      else if(key.endsWith('_DATE'))row[key]=isoDate(value);
      else if(['CODIGO_PEDIDO','CODIGO_CLIENTE','CODIGO_CONSULTOR','CODIGO_ITEM','ENTREGA','CARGA'].includes(key)&&value!=null)row[key]=Number(value);
      else if(typeof value==='string')row[key]=intern(value);
    }
    const volume=Object.keys(row).find(k=>k.startsWith('VOLUME_M3')&&k.endsWith('_CLEAN'));
    if(volume&&row[volume]>1000)row[volume]=Math.fround(row[volume]/1000);
    if(['abertos','emitidos','faturados'].includes(area)){
      if(Object.hasOwn(row,'CODIGO_CLIENTE')&&Object.hasOwn(row,'RAZAO_SOCIAL'))row.CLIENTE=intern(String(row.CODIGO_CLIENTE??'None').trim()+' - '+String(row.RAZAO_SOCIAL??'None').trim());
      row.TIPO_ENTREGA=intern(String(row.TIPO_ENTREGA??'None').toUpperCase().trim());
      if(['CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'].some(k=>String(row[k]??'').toLowerCase().includes('tekdashboard')))continue;
      if(area==='emitidos'){
        if(Object.hasOwn(row,'DATA_EMISSAO_PEDIDO_DATE')&&(!row.DATA_EMISSAO_PEDIDO_DATE||row.DATA_EMISSAO_PEDIDO_DATE>referenceDate))continue;
        if(Object.hasOwn(row,'DATA_EMISSAO_PEDIDO_DATE'))row.DT_FATURA_DATE=row.DATA_EMISSAO_PEDIDO_DATE;
        for(const prefix of ['VALOR','PESO','VOLUME_M3','QUANTIDADE']){const emit=prefix+(prefix==='QUANTIDADE'?'_EMITIDA_CLEAN':'_EMITIDO_CLEAN');const fat=prefix+(prefix==='QUANTIDADE'?'_FATURADA_CLEAN':'_FATURADO_CLEAN');if(Object.hasOwn(row,emit))row[fat]=row[emit];}
      }
    }
    result.push(row);
  }return area==='abertos'?prepareOpenRows(result,referenceDate):result;
}
const latestSQL="SELECT id::text, fim::text, origem FROM etl.execucao_carga WHERE status='publicado' ORDER BY fim DESC LIMIT 1";
export class PostgresRepository {
  constructor(pool){this.pool=pool;this.snapshots=new AsyncCache({maxEntries:3,ttl:1800000});this.dimensionOptions=new AsyncCache({maxEntries:3,ttl:1800000});this.payloads=new AsyncCache({maxEntries:24,ttl:300000});}
  async getVersion(){const {rows}=await this.pool.query(latestSQL);if(!rows.length)throw new Error('Nenhuma carga Hop publicada.');return rows[0].id;}
  async snapshot(referenceDate,requestedArea){
    const version=await this.getVersion();
    return this.snapshots.get(version+'|'+referenceDate+'|'+requestedArea,async()=>{
      const client=await this.pool.connect();
      try{await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const meta=(await client.query(latestSQL)).rows[0];if(!meta)throw new Error('Nenhuma carga Hop publicada.');
        const snapshot={version:meta.id,publishedAt:meta.fim,source:'firebird/apache-hop',frames:{}};
        for(const area of requestedArea==='abertos'?['abertos']:[requestedArea,'carteira','metas']){
          const projection=buildProjection(area,{compact:true}),where=buildWhere(area,{},referenceDate);
          const order=['abertos','emitidos','faturados'].includes(area)?' ORDER BY registro_id':'';
          const result=await client.query(`SELECT * FROM (SELECT ${projection}${order?', registro_id':''} FROM dw.${views[area]}) base${where.text}${order}`,where.values);
          for(const row of result.rows)delete row.registro_id;
          snapshot.frames[area]=normalizeRows(result.rows,area,referenceDate);
        }
        if(requestedArea==='abertos'){
          const where=buildWhere('faturados',{},referenceDate);
          // The twice-scanned CTE needs only the value/date and exclusion keys.
          // Keep registro_id order so the NumPy-compatible reduction is unchanged.
          const needed=new Set(['VALOR_FATURADO_CLEAN','DT_FATURA_DATE','CONSULTOR','SUPERVISOR','GRUPO_CLIENTE']);
          const projection=logicalColumns('faturados').filter(column=>needed.has(column.legacy)).map(column=>q(column.name)+' AS '+q(column.legacy)).join(', ');
          const rows=(await client.query(`WITH base AS (SELECT ${projection},registro_id FROM dw.pedidos_faturados), valid AS (SELECT * FROM base${where.text}) SELECT "VALOR_FATURADO_CLEAN" AS value FROM valid WHERE "DT_FATURA_DATE"::date >= (SELECT max("DT_FATURA_DATE"::date) FROM valid)-interval '90 days' ORDER BY registro_id`,where.values)).rows;
          snapshot.dailyAverage=sum(rows.map(r=>Number(r.value)))/90;
        }
        await client.query('COMMIT');return snapshot;
      }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
    });
  }
  async getDashboard(context,tab){
    validateAreaTab(context.area,tab);const snapshot=await this.snapshot(context.referenceDate,context.area);
    return this.payloads.get(stableKey([snapshot.version,context,tab]),async()=>{
      const frames=snapshot.frames,history=filterRows(frames[context.area],context.filters,{ignoreDates:true});let rows=filterRows(frames[context.area],context.filters);
      if(context.forecastDate)rows=rows.filter(r=>r.DT_PREVISAO_FATURAMENTO_DATE===context.forecastDate);
      let result;
      if(tab==='pesquisa')result={metrics:[],series:[],tables:[],meta:{empty:!rows.length}};
      else if(tab==='dimensoes')result=buildDimensionDashboard({...context,rows,history});
      else if(context.area==='abertos'){
        result=buildOpenDashboard({...context,rows,dailyAverage:snapshot.dailyAverage,tab});
      }else result=buildCommercialDashboard({...context,tab,rows,history,carteira:frames.carteira,metas:frames.metas});
      if(tab==='geografia'&&context.area!=='abertos'){
        const period=result.meta.comparisonPeriod,dc=context.area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE';
        const previousRows=period?history.filter(r=>r[dc]>=period.start&&r[dc]<=period.end):[];
        const dimension=['UF','CIDADE','REGIAO_UF','MICRO_REGIAO'].includes(context.dimension)?context.dimension:'UF';
        const detail=buildDimensionDashboard({...context,dimension,rows,history,previousRows});
        result.tables.push(...detail.tables);
      }
      if(tab==='mensal'&&result.meta.dimensionPeriod){
        const dc=context.area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE',period=result.meta.dimensionPeriod;
        const monthlyRows=rows.filter(r=>r[dc]>=period.start&&r[dc]<=period.end);
        const detail=buildDimensionDashboard({...context,rows:monthlyRows,history});
        detail.tables[0].title+=' • mês vigente';result.tables.push(...detail.tables);
      }
      for(const table of result.tables||[])if(table.treeSpec){
        const spec=table.treeSpec;const dc=context.area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE';
        let input=spec.period?.start?rows.filter(r=>r[dc]>=spec.period.start&&r[dc]<=spec.period.end):rows;
        if(spec.groups?.length){const groups=new Set(spec.groups);input=input.filter(r=>groups.has(r.GRUPO_CLIENTE));}
        if(spec.columns?.includes('Mes_Ano'))input=input.map(row=>({...row,Mes_Ano:isoDate(row[dc])?.slice(0,7)}));
        table.tree=buildHierarchy(input,context.area,spec.columns||[],[],{maxChildren:spec.maxChildren,maxRoots:spec.maxRoots,rootRows:table.rows});
      }
      return {...result,area:context.area,tab,dataVersion:snapshot.version,source:snapshot.source,referenceDate:context.referenceDate,meta:{...result.meta,publishedAt:snapshot.publishedAt,records:rows.length}};
    });
  }
  async getDimensions(context){
    const snapshot=await this.snapshot(context.referenceDate,context.area);
    return this.dimensionOptions.get(stableKey([snapshot.version,context.referenceDate,context.area]),()=>{
      const rows=snapshot.frames[context.area],dimensions={};
      for(const key of DIMENSIONS)dimensions[key]=[...new Set(rows.map(r=>r[key]).filter(v=>v!=null&&v!==''))].sort();
      const ranges={};for(const [name,column] of [['emission','DATA_EMISSAO_PEDIDO_DATE'],['billing','DT_FATURA_DATE']]){const dates=rows.map(r=>r[column]).filter(Boolean).sort();ranges[name]=dates.length?[dates[0],dates.at(-1)]:[];}
      return {dataVersion:snapshot.version,dimensions,dates:ranges};
    });
  }
  async getDetails(context,options){
    if(options.grain==='order'){
      if(context.area!=='abertos')throw new InputError('Consolidação por pedido disponível para Abertos.');
      const columns=openOrderColumns.map(column=>column.key),selected=options.columns || columns;
      if(!selected.length||selected.some(key=>!columns.includes(key)))throw new InputError('Coluna de pedidos inválida.');
      if(!columns.includes(options.sort)||!['asc','desc'].includes(options.direction))throw new InputError('Ordenação inválida.');
      if(options.export&&options.export!=='csv')throw new InputError('Formato de exportação inválido.');
      const snapshot=await this.snapshot(context.referenceDate,'abertos');
      let source=filterRows(snapshot.frames.abertos,context.filters);
      if(context.forecastDate)source=source.filter(row=>row.DT_PREVISAO_FATURAMENTO_DATE===context.forecastDate);
      const localOptions=Object.fromEntries(['SUPERVISOR','CONSULTOR','STATUS'].map(key=>[key,[...new Set(source.map(row=>row[key]).filter(value=>value!=null))].sort()]));
      source=filterRows(source,context.detailFilters);
      const grouped=groupOpenOrders(source),direction=options.direction==='asc'?1:-1;
      grouped.rows.sort((a,b)=>{const first=a[options.sort],second=b[options.sort];return direction*(typeof first==='number'&&typeof second==='number'?first-second:String(first??'').localeCompare(String(second??''),'pt-BR',{numeric:true}))||Number(a.CODIGO_PEDIDO)-Number(b.CODIGO_PEDIDO);});
      if(options.export){const escape=value=>'"'+String(value??'').replaceAll('"','""')+'"';return '\uFEFF'+[selected.map(key=>escape(openOrderColumns.find(column=>column.key===key).label)).join(';'),...grouped.rows.map(row=>selected.map(key=>escape(row[key])).join(';'))].join('\r\n');}
      return {dataVersion:snapshot.version,grain:'order',rows:grouped.rows.slice((options.page-1)*options.pageSize,options.page*options.pageSize),total:grouped.rows.length,totalRow:grouped.total,localOptions,page:options.page,pageSize:options.pageSize,columns:openOrderColumns.filter(column=>selected.includes(column.key))};
    }
    const area=context.area,columns=['CLIENTE',...logicalColumns(area).map(c=>c.legacy)];
    const selected=options.columns||columns;if(!selected.length||selected.some(c=>!columns.includes(c)))throw new InputError('Coluna de detalhes inválida.');
    if(!columns.includes(options.sort)||!['asc','desc'].includes(options.direction))throw new InputError('Ordenação inválida.');
    if(options.export&&options.export!=='csv')throw new InputError('Formato de exportação inválido.');
    const client=await this.pool.connect();try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');const meta=(await client.query(latestSQL)).rows[0];if(!meta)throw new Error('Nenhuma carga Hop publicada.');
      const where=buildWhere(area,context.filters,context.referenceDate),base=`(SELECT ${buildProjection(area)}, registro_id FROM dw.${views[area]}) base`;
      if(context.forecastDate){where.values.push(context.forecastDate);where.text+=(where.text?' AND ':' WHERE ')+`"DT_PREVISAO_FATURAMENTO_DATE"::date=$${where.values.length}::date`;}
      const total=Number((await client.query(`SELECT count(*) AS count FROM ${base}${where.text}`,where.values)).rows[0].count);
      const params=[...where.values],paging=options.export?'':` LIMIT $${params.push(options.pageSize)} OFFSET $${params.push((options.page-1)*options.pageSize)}`;
      const result=await client.query(`SELECT ${selected.map(q).join(',')} FROM ${base}${where.text} ORDER BY ${q(options.sort)} ${options.direction.toUpperCase()}, registro_id${paging}`,params);
      await client.query('COMMIT');const data=normalizeRows(result.rows,area,context.referenceDate);
      if(options.export){const escape=v=>'"'+String(v??'').replaceAll('"','""')+'"';return '\uFEFF'+[selected.map(escape).join(';'),...data.map(row=>selected.map(c=>escape(row[c])).join(';'))].join('\r\n');}
      return {dataVersion:meta.id,rows:data,total,page:options.page,pageSize:options.pageSize,columns:selected.map(key=>({key,label:key,format:key.endsWith('_DATE')?'date':key.endsWith('_CLEAN')?(key.startsWith('VALOR_')?'currency':'number'):'text'}))};
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async getBacklogDailyAverage(referenceDate){return (await this.snapshot(referenceDate,'abertos')).dailyAverage;}
}
