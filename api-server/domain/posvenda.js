import {InputError} from './contracts.js';
import {diffDays} from './dates.js';
import {aftersalesDimensions,measureBuckets,buildAftersalesAnalysis,withAftersalesMeasures} from './posvenda-analysis.js';
import {eventLeadDays} from './posvenda-dimensions.js';

export const aftersalesAreas=['assistencias','cancelamentos','devolucoes'];
const text=value=>String(value??'').trim()||'Não informado';
const amount=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const distinct=(rows,key)=>new Set(rows.map(row=>row[key]).filter(value=>value!=null)).size;
const total=(rows,key)=>rows.reduce((sum,row)=>sum==null||amount(row[key])==null?null:sum+amount(row[key]),0);
function knownGroups(rows){
 const groups=new Set(rows.map(row=>text(row.grupo_cliente)).filter(group=>group.toLowerCase()!=='não informado'));
 return groups.size||(rows.length?null:0);
}
const share=(label,part,whole)=>({supplementary:[{label,value:part!=null&&whole>0?part/whole*100:null,format:'percent'}]});
const columns=[['documento_id','Documento','integer'],['pedido_id','Pedido original','integer'],['data','Data','date'],['cliente','Cliente','text'],['uf','UF','text'],['cidade','Cidade','text'],['produto','Produto','text'],['motivo','Motivo','text'],['modalidade','Tipo','text'],['quantidade_exibida','Quantidade','decimal'],['valor_exibido','Valor','currencyCompact'],['status_erp','Status ERP','text']].map(([key,label,format])=>({key,label,format}));
const returnColumns=columns.map(column=>column.key==='pedido_id'?{...column,label:'Documento de origem'}:column);
export function validateAftersalesQuery(area,query){
 if(!aftersalesAreas.includes(area))throw new InputError('Painel de pós-venda inválido.');
 const allowed=['view','start','end','uf','city','reason','product','kind','search','page','pageSize','sort','direction','export','granularity','dimension','forecastDate','section','hierarchy','metric'];
 if(Object.keys(query).some(key=>!allowed.includes(key))||Object.values(query).some(value=>typeof value!=='string'&&typeof value!=='number'))throw new InputError('Filtro de pós-venda inválido.');
 if(query.view!==undefined&&(area!=='assistencias'||!['abertas','emitidas','faturadas'].includes(query.view)))throw new InputError('Visão de assistências inválida.');
 if(query.granularity!==undefined&&!['month','week','day'].includes(query.granularity))throw new InputError('Granularidade inválida.');
 if(query.dimension!==undefined&&!Object.hasOwn(aftersalesDimensions(area),query.dimension))throw new InputError('Dimensão inválida.');
 if(query.metric!==undefined&&!['value','weightKg','volumeM3','quantity','orders','documents'].includes(query.metric))throw new InputError('Métrica inválida.');
 if(query.hierarchy){const levels=String(query.hierarchy).split(','),effective=[...levels.filter(key=>!['document','item'].includes(key)),'document','item'];if(effective.length>8||new Set(levels).size!==levels.length||levels[0]!==String(query.dimension||'month')||levels.some(key=>!['document','item'].includes(key)&&!Object.hasOwn(aftersalesDimensions(area),key)))throw new InputError('Hierarquia inválida. Comece pela dimensão selecionada e use até oito níveis distintos.');}
 if(query.section!==undefined&&query.section!=='details')throw new InputError('Seção inválida.');
 if(query.forecastDate!==undefined&&area!=='assistencias')throw new InputError('Filtro de previsão exclusivo de assistências.');
 const result={...query,page:Number(query.page??1),pageSize:Number(query.pageSize??20),sort:query.sort??'data',direction:query.direction??'desc'};
 for(const key of ['start','end','forecastDate'])if(result[key]){
  const value=result[key];if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new InputError('Data inválida.');
 }
 if(result.start&&result.end&&result.start>result.end)throw new InputError('Período invertido.');
 if(!Number.isInteger(result.page)||result.page<1||result.page>1000000||!Number.isInteger(result.pageSize)||result.pageSize<1||result.pageSize>1000000)throw new InputError('Paginação inválida.');
 if(!columns.some(column=>column.key===result.sort)||!['asc','desc'].includes(result.direction))throw new InputError('Ordenação inválida.');
 if(result.export!==undefined&&result.export!=='csv')throw new InputError('Exportação inválida.');
 for(const key of ['uf','city','reason','product','kind','search'])if(result[key]?.length>200)throw new InputError('Filtro muito extenso.');
 return result;
}
export function paginateAftersalesDashboard(dashboard,query={}){
 const page=Number(query.page||1),pageSize=Number(query.pageSize||20);
 return {...dashboard,page,pageSize,table:{...dashboard.table,rows:query.export==='csv'?dashboard.table.rows:dashboard.table.rows.slice((page-1)*pageSize,page*pageSize)}};
}
export function buildAftersalesDashboard({execution,rows,area,query={}}){
 const billed=area==='assistencias'&&query.view==='faturadas';
 const open=area==='assistencias'&&query.view!=='emitidas'&&!billed;
 const isReturn=area==='devolucoes';
 const isEvent=area==='cancelamentos'||isReturn;
 const hasMeasures=open||billed||isEvent;
 const start=query.start>execution.data_inicio?query.start:execution.data_inicio,end=query.end&&query.end<execution.data_referencia?query.end:execution.data_referencia;
 const base=rows.filter(row=>row.categoria===area&&(!open||Number(row.quantidade_aberta)>0)&&(!billed||Number(row.quantidade_faturada)>0)).map(row=>billed?{...row,valor_faturado:amount(row.valor_unitario)==null?null:amount(row.quantidade_faturada)*amount(row.valor_unitario)}:row);
 const search=String(query.search||'').trim().toLocaleLowerCase('pt-BR');
 const selected=base.filter(row=>row.data>=start&&row.data<=end&&(!query.forecastDate||row.previsao===query.forecastDate)&&[['uf','uf'],['city','cidade'],['reason','motivo'],['product','produto'],['kind','modalidade']].every(([filter,column])=>!query[filter]||text(row[column])===query[filter])&&(!search||['documento_id','pedido_id','cliente','produto','motivo'].some(key=>String(row[key]??'').toLocaleLowerCase('pt-BR').includes(search))));
 const quantity=open?'quantidade_aberta':billed?'quantidade_faturada':'quantidade',value=open?'valor_aberto':billed?'valor_faturado':'valor';
 const metrics=[],metric=(id,label,value,format,help,extra)=>({id:'posvenda.'+id,label,value,format,help,...extra});
 const analytics=buildAftersalesAnalysis({rows:selected,area,open,billed,kind:query.kind,quantity,value,start,end,referenceDate:execution.data_referencia,dimension:query.dimension,granularity:query.granularity,hierarchy:query.hierarchy?String(query.hierarchy).split(','):undefined,metric:query.metric});
 const summary=analytics.analysis.table.total;
 const aged=area==='assistencias'?selected.filter(row=>diffDays(execution.data_referencia,row.data)>30):[];
 const quality={missingValues:selected.filter(row=>amount(row[value])==null).length};
 if(open){
  const agedDocuments=distinct(aged,'documento_id'),agedValue=total(aged,value);
  metrics.push(
   metric('value','Valor',summary.value,'currency','Valor do saldo em aberto na posição da base.'),
   metric('weightKg','Peso',summary.weightKg,'weight64','Peso unitário × quantidade pendente, em toneladas. Exige medida para todos os itens do recorte.'),
   metric('volumeM3','Volume',summary.volumeM3,'volume','Volume unitário × quantidade pendente, em metros cúbicos. Exige medida para todos os itens do recorte.'),
   metric('quantity','Qtd itens',summary.quantity,'quantity4','Soma da quantidade pendente dos itens de assistência.'),
   metric('documents','Qtd assistências',summary.documents,'integer','Documentos de assistência distintos com saldo em aberto.'),
   metric('groups','Grupos aguardando',knownGroups(selected),'integer','Grupos de clientes identificados com assistências em aberto.'),
   metric('serviceDays','Nível de serviço',summary.ageDays,'days','Idade média dos registros pendentes, em dias da emissão da assistência até a posição da base.'),
   metric('aged','Assistências > 30 dias',agedDocuments,'integer','Assistências distintas emitidas há mais de 30 dias na posição da base.',share('Participação das assistências',agedDocuments,summary.documents)),
   metric('value30','Valor > 30 dias',agedValue,'currency','Valor pendente das assistências emitidas há mais de 30 dias na posição da base.',share('Participação do valor',agedValue,summary.value))
  );
 }else if(billed){
  metrics.push(
   metric('value','Valor',summary.value,'currency','Quantidade faturada na posição da base × valor unitário do item de assistência. Não representa custo nem confirma entrega.'),
   metric('weightKg','Peso',summary.weightKg,'weight64','Peso unitário × quantidade faturada, em toneladas. Exige medida para todos os itens do recorte.'),
   metric('volumeM3','Volume',summary.volumeM3,'volume','Volume unitário × quantidade faturada, em metros cúbicos. Exige medida para todos os itens do recorte.'),
   metric('quantity','Qtd itens',summary.quantity,'quantity4','Quantidade faturada acumulada dos itens de assistência na posição da base.'),
   metric('documents','Qtd assistências',summary.documents,'integer','Assistências distintas com quantidade faturada positiva na posição da base.'),
   metric('groups','Grupos atendidos',knownGroups(selected),'integer','Grupos de clientes identificados com assistência faturada.')
  );
 }else if(isEvent){
  const event=isReturn?'devolução':'cancelamento';
  const assistanceCancellation=!isReturn&&query.kind==='Assistência';
  const origin=isReturn?'documento de origem':assistanceCancellation?'assistência original':'pedido original';
  const units=isReturn?'quantidade devolvida':'quantidade cancelada';
  const late=[];
  quality.missingLeadTime=0;
  for(const row of selected){
   const days=eventLeadDays(row);
   if(days==null)quality.missingLeadTime++;
   else if(days>30)late.push(row);
  }
  const noValidDates=selected.length>0&&quality.missingLeadTime===selected.length;
  const lateOrders=noValidDates?null:distinct(late,'pedido_id');
  const lateValue=noValidDates?null:total(late,value);
  metrics.push(
   metric('value','Valor',summary.value,'currency',isReturn?'Quantidade devolvida × valor unitário do item original. Representa o valor do vínculo no ERP.':'Quantidade cancelada no evento × valor unitário do item original.'),
   metric('weightKg','Peso',summary.weightKg,'weight64',`Peso unitário × ${units}, em toneladas. Exige medida para todos os itens do recorte.`),
   metric('volumeM3','Volume',summary.volumeM3,'volume',`Volume unitário × ${units}, em metros cúbicos. Exige medida para todos os itens do recorte.`),
   metric('quantity','Qtd itens',summary.quantity,'quantity4',isReturn?'Soma das quantidades devolvidas registradas no ERP.':'Soma das quantidades canceladas nos eventos do recorte, incluindo cancelamentos parciais.'),
   metric('orders',isReturn?'Qtd documentos de origem':assistanceCancellation?'Qtd assistências':'Qtd pedidos',summary.orders,'integer',
    isReturn?'Documentos de origem distintos, de venda ou assistência, vinculados às devoluções do recorte.':assistanceCancellation?'Assistências originais distintas afetadas pelos cancelamentos do recorte.':'Pedidos de venda originais distintos afetados pelos cancelamentos do recorte.',
    {supplementary:[{label:'Documentos de '+event,value:summary.documents,format:'integer'}]}),
   metric('groups','Grupos afetados',knownGroups(selected),'integer','Grupos de clientes identificados nos registros do recorte.'),
   metric('serviceDays','Prazo até '+event,summary.ageDays,'days',`Média por registro com datas válidas, em dias da emissão do ${origin} à emissão do documento de ${event}.`),
   metric('orders30',isReturn?'Docs. de origem > 30 dias':assistanceCancellation?'Assistências > 30 dias':'Pedidos > 30 dias',lateOrders,'integer',
    isReturn?'Documentos de origem distintos com ao menos uma devolução registrada mais de 30 dias após a emissão.':assistanceCancellation?'Assistências originais distintas com ao menos um cancelamento mais de 30 dias após a emissão.':'Pedidos originais distintos com ao menos um evento ocorrido mais de 30 dias após a emissão.',
    share(isReturn?'Participação dos documentos de origem':assistanceCancellation?'Participação das assistências':'Participação dos pedidos',lateOrders,summary.orders)),
   metric('value30','Valor > 30 dias',lateValue,'currency',`Valor das parcelas de ${event} registradas mais de 30 dias após a emissão do ${origin}.`,share('Participação do valor',lateValue,summary.value))
  );
 }else{
  const note='Eventos do período selecionado. ';
  metrics.push(metric('documents','Assistências emitidas',distinct(selected,'documento_id'),'integer',note+'Documentos distintos; vários itens não duplicam a contagem.'));
  metrics.push(metric('quantity','Quantidade emitida',total(selected,quantity),'decimal',note+'Soma das quantidades dos itens raiz. Valores monetários zero não excluem registros.'));
  metrics.push(metric('value','Valor emitido',total(selected,value),'currencyCompact',note+'Valor registrado no ERP; saldo aberto valorado pelo preço unitário do item. Não representa custo da assistência nem receita adicional.'));
  metrics.push(metric('aged','Mais de 30 dias',distinct(aged,'documento_id'),'integer','Idade desde a emissão até a referência publicada. Na visão emitidas inclui documentos já atendidos; não significa atraso na previsão.'));
 }
 const rankings=(key,limit=12)=>{
  if(hasMeasures)return measureBuckets(selected,row=>text(row[key]),quantity,value,execution.data_referencia,limit)
   .sort((a,b)=>b.quantity-a.quantity);
  const groups=new Map();for(const row of selected){const label=text(row[key]);groups.set(label,(groups.get(label)||0)+Number(row[quantity]||0));}
  const ranked=[...groups].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  if(ranked.length>limit)return [...ranked.slice(0,limit),{label:'Outros',_others:true,value:ranked.slice(limit).reduce((sum,row)=>sum+row.value,0)}];return ranked;
 };
 const chart=(id,title,rows,type='bar')=>{
  const series={id:'posvenda.'+id,title,rows,type,x:'label',dimension:{reasons:'reason',products:'product',states:'uf'}[id],y:['value'],format:'decimal',labels:{value:'Quantidade'}};
  return hasMeasures?withAftersalesMeasures(series,area,query.kind):series;
 };
 const display=selected.map(row=>({...row,quantidade_exibida:amount(row[quantity]),valor_exibido:amount(row[value])}));
 const sort=query.sort||'data',direction=query.direction==='asc'?1:-1;
 display.sort((a,b)=>{const av=a[sort],bv=b[sort];return direction*(typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),'pt-BR',{numeric:true}))||Number(b.registro_id)-Number(a.registro_id);});
 const page=Number(query.page||1),pageSize=Number(query.pageSize||20);
 const options={};for(const [key,column] of [['uf','uf'],['city','cidade'],['reason','motivo'],['product','produto'],['kind','modalidade']])options[key]=[...new Set(base.map(row=>text(row[column])))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 const chartSubject=isReturn?'Devoluções':isEvent?'Cancelamentos':open?'Saldo':'Quantidade';
 return paginateAftersalesDashboard({dataVersion:execution.data_version||execution.id,referenceDate:execution.data_referencia,source:'firebird/apache-hop',area,view:open?'abertas':billed?'faturadas':'emitidas',
  meta:{publishedAt:execution.fim,start,end,sourceStart:execution.data_inicio,granularity:query.granularity||'month',dimensionsVersion:execution.dimensionsVersion||null},metrics,options,analysis:analytics.analysis,assistance:analytics.assistance,
  quality,
  series:[analytics.evolution,chart('reasons',chartSubject+' por motivo',rankings('motivo'),'barHorizontal'),chart('products',chartSubject+' por produto',rankings('produto'),'barHorizontal'),chart('states',area==='assistencias'?'Distribuição geográfica (UF)':chartSubject+' por UF',rankings('uf',area==='assistencias'?Infinity:12),area==='assistencias'?'map':'bar')],
  total:display.length,page,pageSize,table:{id:'posvenda.'+area,title:'Detalhamento dos registros',columns:isReturn?returnColumns:columns,rows:display}},query);
}
