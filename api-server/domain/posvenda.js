import {InputError} from './contracts.js';
import {diffDays} from './dates.js';
import {aftersalesDimensions,buildAftersalesAnalysis} from './posvenda-analysis.js';

export const aftersalesAreas=['assistencias','cancelamentos','devolucoes'];
const text=value=>String(value??'').trim()||'Não informado';
const amount=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
const distinct=(rows,key)=>new Set(rows.map(row=>row[key]).filter(value=>value!=null)).size;
const total=(rows,key)=>rows.reduce((sum,row)=>sum==null||amount(row[key])==null?null:sum+amount(row[key]),0);
const columns=[['documento_id','Documento','integer'],['pedido_id','Pedido original','integer'],['data','Data','date'],['cliente','Cliente','text'],['uf','UF','text'],['cidade','Cidade','text'],['produto','Produto','text'],['motivo','Motivo','text'],['modalidade','Tipo','text'],['quantidade_exibida','Quantidade','decimal'],['valor_exibido','Valor','currencyCompact'],['status_erp','Status ERP','text']].map(([key,label,format])=>({key,label,format}));
export function validateAftersalesQuery(area,query){
 if(!aftersalesAreas.includes(area))throw new InputError('Painel de pós-venda inválido.');
 const allowed=['view','start','end','uf','city','reason','product','kind','search','page','pageSize','sort','direction','export','granularity','dimension','forecastDate','section','hierarchy','metric'];
 if(Object.keys(query).some(key=>!allowed.includes(key))||Object.values(query).some(value=>typeof value!=='string'&&typeof value!=='number'))throw new InputError('Filtro de pós-venda inválido.');
 if(query.view!==undefined&&(area!=='assistencias'||!['abertas','emitidas'].includes(query.view)))throw new InputError('Visão de assistências inválida.');
 if(query.granularity!==undefined&&!['month','week','day'].includes(query.granularity))throw new InputError('Granularidade inválida.');
 if(query.dimension!==undefined&&!Object.hasOwn(aftersalesDimensions(area),query.dimension))throw new InputError('Dimensão inválida.');
 if(query.metric!==undefined&&!['value','weightKg','volumeM3','quantity','orders','documents'].includes(query.metric))throw new InputError('Métrica inválida.');
 if(query.hierarchy){const levels=String(query.hierarchy).split(',');if(levels.length>6||new Set(levels).size!==levels.length||levels[0]!==String(query.dimension||'month')||levels.some(key=>key!=='document'&&!Object.hasOwn(aftersalesDimensions(area),key)))throw new InputError('Hierarquia inválida. Comece pela dimensão selecionada e use até seis níveis distintos.');}
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
 const open=area==='assistencias'&&query.view!=='emitidas';
 const start=query.start>execution.data_inicio?query.start:execution.data_inicio,end=query.end&&query.end<execution.data_referencia?query.end:execution.data_referencia;
 const base=rows.filter(row=>row.categoria===area&&(!open||Number(row.quantidade_aberta)>0));
 const search=String(query.search||'').trim().toLocaleLowerCase('pt-BR');
 const selected=base.filter(row=>row.data>=start&&row.data<=end&&(!query.forecastDate||row.previsao===query.forecastDate)&&[['uf','uf'],['city','cidade'],['reason','motivo'],['product','produto'],['kind','modalidade']].every(([filter,column])=>!query[filter]||text(row[column])===query[filter])&&(!search||['documento_id','pedido_id','cliente','produto','motivo'].some(key=>String(row[key]??'').toLocaleLowerCase('pt-BR').includes(search))));
 const quantity=open?'quantidade_aberta':'quantidade',value=open?'valor_aberto':'valor';
 const metrics=[],metric=(id,label,value,format,help)=>({id:'posvenda.'+id,label,value,format,help});
 const note=open?'Saldo do ERP na referência publicada, agrupado pela emissão da assistência. ':'Eventos do período selecionado. ';
 metrics.push(metric('documents',area==='assistencias'?(open?'Assistências em aberto':'Assistências emitidas'):'Documentos',distinct(selected,'documento_id'),'integer',note+'Documentos distintos; vários itens não duplicam a contagem.'));
 if(area==='cancelamentos')metrics.push(metric('orders','Pedidos afetados',distinct(selected,'pedido_id'),'integer','Pedidos de venda originais com eventos de cancelamento, inclusive parciais. Não inclui notas fiscais canceladas.'));
 metrics.push(metric('quantity',open?'Quantidade pendente':area==='cancelamentos'?'Quantidade cancelada':area==='devolucoes'?'Quantidade devolvida':'Quantidade emitida',total(selected,quantity),'decimal',note+'Soma das quantidades dos itens raiz. Valores monetários zero não excluem registros.'));
 metrics.push(metric('value',open?'Valor pendente':area==='cancelamentos'?'Valor cancelado':area==='devolucoes'?'Valor devolvido':'Valor emitido',total(selected,value),'currencyCompact',note+(area==='cancelamentos'?'Quantidade do evento × valor unitário do item original; não soma novamente o saldo cumulativo cancelado.':area==='devolucoes'?'Quantidade devolvida × valor unitário do detalhe original. Não é crédito fiscal nem valor confirmado de uma nota de entrada.':'Valor registrado no ERP; saldo aberto valorado pelo preço unitário do item. Não representa custo da assistência nem receita adicional.')));
 if(area==='assistencias')metrics.push(metric('aged','Mais de 30 dias',distinct(selected.filter(row=>diffDays(execution.data_referencia,row.data)>30),'documento_id'),'integer','Idade desde a emissão até a referência publicada. Na visão emitidas inclui documentos já atendidos; não significa atraso na previsão.'));
 else metrics.push(metric('clients','Clientes',distinct(selected,'cliente_id'),'integer','Códigos de clientes distintos no recorte, sem agrupar pessoas diferentes pelo mesmo nome.'));
 const rankings=(key,limit=12)=>{
  const groups=new Map();for(const row of selected){const label=text(row[key]);groups.set(label,(groups.get(label)||0)+Number(row[quantity]||0));}
  const ranked=[...groups].sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  if(ranked.length>limit)return [...ranked.slice(0,limit),{label:'Outros',value:ranked.slice(limit).reduce((sum,row)=>sum+row.value,0)}];return ranked;
 };
 const analytics=buildAftersalesAnalysis({rows:selected,area,open,quantity,value,start,end,referenceDate:execution.data_referencia,dimension:query.dimension,granularity:query.granularity,hierarchy:query.hierarchy?String(query.hierarchy).split(','):undefined,metric:query.metric});
 const chart=(id,title,rows,type='bar')=>({id:'posvenda.'+id,title,rows,type,x:'label',y:['value'],format:'decimal',labels:{value:'Quantidade'}});
 const display=selected.map(row=>({...row,quantidade_exibida:amount(row[quantity]),valor_exibido:amount(row[value])}));
 const sort=query.sort||'data',direction=query.direction==='asc'?1:-1;
 display.sort((a,b)=>{const av=a[sort],bv=b[sort];return direction*(typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),'pt-BR',{numeric:true}))||Number(b.registro_id)-Number(a.registro_id);});
 const page=Number(query.page||1),pageSize=Number(query.pageSize||20);
 const options={};for(const [key,column] of [['uf','uf'],['city','cidade'],['reason','motivo'],['product','produto'],['kind','modalidade']])options[key]=[...new Set(base.map(row=>text(row[column])))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
 return paginateAftersalesDashboard({dataVersion:execution.data_version||execution.id,referenceDate:execution.data_referencia,source:'firebird/apache-hop',area,view:open?'abertas':'emitidas',
  meta:{publishedAt:execution.fim,start,end,sourceStart:execution.data_inicio,granularity:query.granularity||'month',dimensionsVersion:execution.dimensionsVersion||null},metrics,options,analysis:analytics.analysis,assistance:analytics.assistance,
  quality:{missingValues:selected.filter(row=>amount(row[value])==null).length},
  series:[analytics.evolution,chart('reasons','Quantidade por motivo',rankings('motivo'),'barHorizontal'),chart('products','Quantidade por produto',rankings('produto'),'barHorizontal'),chart('states',area==='assistencias'?'Distribuição geográfica (UF)':'Quantidade por UF',rankings('uf',area==='assistencias'?Infinity:12),area==='assistencias'?'map':'bar')],
  total:display.length,page,pageSize,table:{id:'posvenda.'+area,title:'Detalhamento dos registros',columns,rows:display}},query);
}
