import {summarize,sum,mean,groupRows,groupSum,numericColumns} from './metrics.js';
import {prepareOpenRows} from './forecast.js';
import {isoDate,shiftYear} from './dates.js';
export const HIERARCHIES={
  Mes_Grupo:['Mes_Grupo','SUPERVISOR','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],Mes_Previsao:['Mes_Previsao','SUPERVISOR','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],Aging_Bucket:['Aging_Bucket','SUPERVISOR','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],
  SUPERVISOR:['SUPERVISOR','CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],CONSULTOR:['CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],GRUPO_CLIENTE:['GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],CLIENTE:['CLIENTE','CODIGO_PEDIDO'],
  REGIAO_UF:['REGIAO_UF','UF','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],UF:['UF','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],LINHA:['LINHA','SUBGRUPO','DESCRICAO_ITEM','CODIGO_PEDIDO'],SUBGRUPO:['SUBGRUPO','DESCRICAO_ITEM','CODIGO_PEDIDO'],
  GRUPO_ITEM:['GRUPO_ITEM','SUBGRUPO','LINHA','DESCRICAO_ITEM','CODIGO_PEDIDO'],TIPO:['TIPO','SUBGRUPO','DESCRICAO_ITEM','CODIGO_PEDIDO'],COLECAO:['COLECAO','LINHA','DESCRICAO_ITEM','CODIGO_PEDIDO'],DESCRICAO_ITEM:['DESCRICAO_ITEM','CODIGO_PEDIDO'],
  CLASSIFICACAO:['CLASSIFICACAO','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],ORIGEM:['ORIGEM','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],ORGAO:['ORGAO','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],STATUS:['STATUS','SUPERVISOR','CONSULTOR','CLIENTE','CODIGO_PEDIDO'],TIPO_ENTREGA:['TIPO_ENTREGA','UF','CONSULTOR','CLIENTE','CODIGO_PEDIDO']};
function aggregate(rows,area,dimension,previous=[],totalValue=0){
  const s=summarize(rows,area,{grouped:true});const prev=groupSum(previous.map(r=>r[numericColumns(area).value]));
  return {[dimension]:rows[0]?.[dimension],Valor:s.value,Peso:s.weightKg,Volume_M3:s.volumeM3,Qtde:s.quantity,NivelServico:s.serviceDays??0,NS:s.serviceDays??0,OTIF:s.onTime??0,
    Qtd_Pedidos:dimension==='CODIGO_PEDIDO'&&rows.length?1:s.orders,'Qtd Pedidos':dimension==='CODIGO_PEDIDO'&&rows.length?1:s.orders,
    Grupos_Atendidos:area==='abertos'&&dimension==='GRUPO_CLIENTE'?rows.length:s.groups,'Grupos Atendidos':dimension==='GRUPO_CLIENTE'&&rows.length?1:s.groups,
    'Ticket Medio':s.value/(s.quantity||1),'R$/Ton':s.value/Math.fround((s.weightKg||1)/1000),'% Part':totalValue>0?s.value/totalValue:0,Valor_Prev:prev,Diff_Raw:s.value-prev};
}
export function dimensionRows(rows,area,dimension,previous=[]){
  const prevGroups=new Map(groupRows(previous,[dimension]).map(g=>[g[0][dimension],g]));
  const result=groupRows(rows,[dimension]).map(g=>{const key=g[0][dimension],p=prevGroups.get(key)||[];prevGroups.delete(key);return aggregate(g,area,dimension,p);});
  for(const [key,p] of prevGroups)result.push({...aggregate([],area,dimension,p),[dimension]:key});
  const total=sum(result.map(r=>r.Valor));for(const row of result)row['% Part']=total>0?row.Valor/total:0;
  result.sort((a,b)=>b.Valor-a.Valor);
  if(dimension==='Mes_Grupo'||dimension==='Mes_Previsao'){
    const sort=dimension==='Mes_Grupo'?'Mes_Sort':'Mes_Previsao_Sort';const map=new Map(rows.map(r=>[r[dimension],r[sort]]));
    result.forEach(r=>r[sort]=map.get(r[dimension])??999999);result.sort((a,b)=>a[sort]-b[sort]);
  }
  if(dimension==='Aging_Bucket'){const order=['0-15 dias','16-30 dias','31-45 dias','46-60 dias','> 60 dias','Indefinido'];result.sort((a,b)=>order.indexOf(a[dimension])-order.indexOf(b[dimension]));}
  return result;
}
export function buildHierarchy(rows,area,columns,previous=[],{maxChildren=12,maxRoots,rootRows}={}){
  const overall=summarize(rows,area).value;
  const minimumDate=group=>group.reduce((date,row)=>{const current=isoDate(row.DATA_EMISSAO_PEDIDO_DATE);return current&&(!date||current<date)?current:date;},'');
  const months=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function build(current,prev,depth,path=''){
    const dim=columns[depth];if(!dim)return [];
    const previousGroups=new Map(groupRows(prev,[dim]).map(g=>[g[0][dim],g]));
    let groups=groupRows(current,[dim]).map(g=>({g,s:summarize(g,area,{grouped:true})})).sort((a,b)=>b.s.value-a.s.value);
    if(dim==='Mes_Ano')groups.sort((a,b)=>String(a.g[0][dim]).localeCompare(String(b.g[0][dim])));
    else if(dim==='Mes_Grupo'||dim==='Mes_Previsao'){const key=dim==='Mes_Grupo'?'Mes_Sort':'Mes_Previsao_Sort';groups.sort((a,b)=>(a.g[0][key]??999999)-(b.g[0][key]??999999));}
    else if(dim==='Aging_Bucket'){const order=['0-15 dias','16-30 dias','31-45 dias','46-60 dias','> 60 dias','Indefinido'];groups.sort((a,b)=>order.indexOf(a.g[0][dim])-order.indexOf(b.g[0][dim]));}
    else if(dim==='CODIGO_PEDIDO')groups.sort((a,b)=>minimumDate(a.g).localeCompare(minimumDate(b.g))||b.s.value-a.s.value);
    if(depth===0&&rootRows){const byKey=new Map(groups.map(group=>[String(group.g[0][dim]),group]));groups=rootRows.map(summary=>({...byKey.get(String(summary[dim])),g:byKey.get(String(summary[dim]))?.g||[],key:summary[dim],summary}));}
    if(depth===0&&maxRoots!=null)groups=groups.slice(0,maxRoots);
    if(depth>0){const cap=dim==='CODIGO_PEDIDO'?Math.max(maxChildren,20):Math.min(maxChildren,[Infinity,8,6,5,4][depth]??5);groups=groups.slice(0,cap);}
    return groups.map(({g,key=g[0]?.[dim],summary},i)=>{
      const p=previousGroups.get(key)||[],id=path?`${path}_${i}`:`n_${i}`,a=aggregate(g,area,dim,p,overall);
      if(g.length&&(columns.slice(0,depth+1).includes('GRUPO_CLIENTE')||['CLIENTE','CODIGO_PEDIDO'].includes(dim)))a['Grupos Atendidos']=a.Grupos_Atendidos=1;
      // shared.py build_multi_level_tree uses zero-safe ticket, double tonne
      // division and zero difference when no comparison frame was supplied.
      a['Ticket Medio']=a.Ticket=a.Qtde>0?a.Valor/a.Qtde:0;
      a['R$/Ton']=a.Peso>0?a.Valor/(a.Peso/1000):0;
      if(!previous.length)a.Diff_Raw=0;
      const aliases={value:a.Valor,weightKg:a.Peso,volumeM3:a.Volume_M3,quantity:a.Qtde,orders:a.Qtd_Pedidos,groups:a.Grupos_Atendidos,
        part_pct:a['% Part'],Pedidos:a.Qtd_Pedidos,Clientes:a.Grupos_Atendidos,Grupos:a.Grupos_Atendidos,Qtd_Itens:a.Qtde,
        Lead_Time:a.NS,Faturamento:a.Valor,Faturamento_Total:a.Valor,Faturamento_Historico:a.Valor,Peso_Ton:a.Peso>0?a.Peso/1000:0,
        '% Part Carteira':a['% Part'],[numericColumns(area).value]:a.Valor,[numericColumns(area).weightKg]:a.Peso,
        [numericColumns(area).quantity]:a.Qtde,[numericColumns(area).volumeM3]:a.Volume_M3};
      const date=minimumDate(g);
      const name=dim==='CODIGO_PEDIDO'?`Pedido ${key}${date?' ('+date.split('-').reverse().join('/')+')':''}`:dim==='Mes_Ano'?`${months[Number(String(key).slice(5,7))-1]}/${String(key).slice(2,4)}`:String(key);
      return {...a,...aliases,[dim]:key,...summary,name,node_id:id,parent_id:path,level:depth,col_name:dim,children:depth+1<columns.length?build(g,p,depth+1,id):[]};
    });
  }return build(rows,previous,0);
}
export const dimensionColumns=dimension=>[
  {key:dimension,label:dimension,format:'text'},{key:'Valor',label:'Valor (R$)',format:'currency'},{key:'% Part',label:'Participação',format:'ratio'},
  {key:'NS',label:'Nível de serviço',format:'days'},{key:'Ticket Medio',label:'Ticket médio',format:'currency'},{key:'R$/Ton',label:'R$/Ton',format:'currency'},
  {key:'Qtd_Pedidos',label:'Qtd pedidos',format:'integer'},{key:'Qtde',label:'Qtd itens',format:'integer'},{key:'Peso',label:'Peso (t)',format:'weight'},
  {key:'Volume_M3',label:'Volume (m³)',format:'volume'},{key:'Grupos_Atendidos',label:'Grupos atendidos',format:'integer'}];
export function buildDimensionDashboard({rows,history=[],previousRows,area,dimension='UF',hierarchy,referenceDate,metric='value',chartType='bar'}){
  if(area==='abertos')rows=prepareOpenRows(rows,referenceDate);
  const dateCol=area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE';let previous=[];
  if(area!=='abertos'){
    const dates=rows.map(r=>isoDate(r[dateCol])).filter(Boolean).sort(),max=dates.at(-1);
    if(max){const year=Number(max.slice(0,4));rows=rows.filter(r=>isoDate(r[dateCol])?.startsWith(String(year)));
      const min=rows.reduce((m,r)=>isoDate(r[dateCol])<m?isoDate(r[dateCol]):m,max),start=shiftYear(min,-1),end=shiftYear(max,-1);
      previous=history.filter(r=>isoDate(r[dateCol])>=start&&isoDate(r[dateCol])<=end);}
  }
  if(previousRows)previous=previousRows;
  const data=dimensionRows(rows,area,dimension,previous),s=summarize(rows,area),total={[dimension]:'TOTAL','% Part':1,NS:s.serviceDays??0,NivelServico:s.serviceDays??0,OTIF:s.onTime??0};
  for(const key of ['Valor','Peso','Volume_M3','Qtde','Diff_Raw'])total[key]=sum(data.map(r=>r[key]),{float32:!['Valor','Diff_Raw'].includes(key)});
  total.Qtd_Pedidos=area==='abertos'?s.orders:sum(data.map(r=>r.Qtd_Pedidos));total.Grupos_Atendidos=area==='abertos'?s.groups:sum(data.map(r=>r['Grupos Atendidos']));
  total['Qtd Pedidos']=total.Qtd_Pedidos;total['Grupos Atendidos']=total.Grupos_Atendidos;
  total['Ticket Medio']=total.Qtde>0?total.Valor/(area==='abertos'?total.Qtde:sum(data.map(r=>r.Qtde||1),{float32:true})):0;
  total['R$/Ton']=total.Peso>0?total.Valor/Math.fround(total.Peso/1000):0;
  let columns=dimensionColumns(dimension);
  if(area!=='abertos')columns=[...columns,{key:'Diff_Raw',label:'Superávit / déficit ano anterior',format:'currency'},...(area==='faturados'?[{key:'OTIF',label:'OTIF',format:'ratio'}]:[])];
  const effectiveHierarchy=hierarchy||HIERARCHIES[dimension]||[dimension,'CLIENTE','CODIGO_PEDIDO'];
  const tree=buildHierarchy(rows,area,effectiveHierarchy,previous,{maxChildren:area==='abertos'?12:6,rootRows:effectiveHierarchy[0]===dimension?data:undefined});
  const table={id:`${area}.dimensoes.${dimension}`,title:`Análise por ${dimension}`,rows:data,columns,total,tree};
  const key={value:'Valor',weightKg:'Peso',quantity:'Qtde',volumeM3:'Volume_M3',orders:'Qtd_Pedidos'}[metric]||'Valor';
  const top=[...data].sort((a,b)=>b[key]-a[key]);let chart=top.slice(0,15);
  if(chartType==='pie'&&top.length>10)chart=[...top.slice(0,9),{[dimension]:'Outros',[key]:sum(top.slice(9).map(r=>r[key]),{float32:metric!=='value'})}];
  const series=[{id:`${area}.dimensoes.distribuicao`,title:`${dimension} • ${metric}`,type:chartType==='table'?'bar':chartType,rows:chart,x:dimension,y:[key],format:metric==='value'?'currency':metric==='weightKg'?'weight':metric==='volumeM3'?'volume':'integer',dimension}];
  const monthCol=area==='abertos'?'Mes_Grupo':'Mes_Ano',ev=rows.map(r=>({...r,[monthCol]:area==='abertos'?r.Mes_Grupo:isoDate(r[dateCol])?.slice(0,7)}));
  const cats=new Set(top.slice(0,area==='abertos'?15:7).map(r=>r[dimension]));
  const categorized=ev.filter(r=>r[monthCol]).map(r=>({...r,category:cats.has(r[dimension])?r[dimension]:'Outros'}));
  const evRows=groupRows(categorized,[monthCol,'category']).map(g=>({month:g[0][monthCol],category:g[0].category,value:groupSum(g.map(r=>r[numericColumns(area).value]))}));
  series.push({id:`${area}.dimensoes.evolucao`,title:'Evolução mensal por dimensão',type:chartType==='heatmap'?'heatmap':'line',rows:evRows,x:'month',y:['value'],category:'category',format:'currency',stack:true});
  return {metrics:[],series,tables:[table],meta:{dimension,metric,chartType}};
}
