import {sum, mean, groupSum, groupMean} from './metrics.js';
import {diffDays} from './dates.js';

export const distinct = values => new Set(values.filter(value => value != null)).size;
export function groupRows(rows, key) {
  const result = new Map();
  for (const row of rows) {
    const value = typeof key === 'function' ? key(row) : row[key];
    if (value == null) continue;
    if (!result.has(value)) result.set(value, []);
    result.get(value).push(row);
  }
  return [...result].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, rows]) => ({key, rows}));
}
const nums = (rows, key) => rows.map(row => row[key]);
const gs = (rows, key, float32 = false) => groupSum(nums(rows, key), {float32});
const gm = (rows, key, float32 = false) => groupMean(nums(rows, key), {float32});
const maxDate = rows => rows.reduce((latest, row) => row.DT_FATURA_DATE && row.DT_FATURA_DATE > latest ? row.DT_FATURA_DATE : latest, '');
const roundEven = (value, digits = 1) => {const factor = 10 ** digits, x = value * factor, lower = Math.floor(x); return (x - lower === 0.5 ? lower + lower % 2 : Math.round(x)) / factor;};
export function classifyTier(value) {
  return value > 500000 ? 'Diamante (> R$ 500k)' : value >= 100000 ? 'Ouro (R$ 100k-500k)' : 'Prata (< R$ 100k)';
}
export function rfmSegment(r, f, m) {
  if (r >= 4 && f >= 4 && m >= 4) return 'Campeões';
  if (r >= 3 && f >= 3 && m >= 3) return 'Grupos Fiéis';
  if (r >= 4 && f <= 2) return 'Promissores';
  if (r <= 2 && f >= 3) return 'Em Risco';
  if (r <= 2 && f <= 2) return 'Perdidos';
  return 'Atenção';
}
// qcut(rank(method='first')) uses linearly interpolated quantile edges, right-closed.
export function rankQuantiles(values, reverse = false) {
  const order = values.map((value, index) => ({value, index})).sort((a,b) => a.value - b.value || a.index - b.index);
  const result = Array(values.length).fill(3);
  if (values.length < 5) return result;
  order.forEach(({index}, offset) => {
    let bin = 0;
    while (bin < 4 && offset + 1 > 1 + (values.length - 1) * (bin + 1) / 5) bin++;
    result[index] = reverse ? 5 - bin : bin + 1;
  });
  return result;
}
export function customerStatus(rows, carteira = [], months = 6) {
  const empty = {ativos_12m:0, recorrentes_3m:0, ativos_param:0, quase_inativos:0, inativos:0, total_clientes:0,
    pct_ativos:0, pct_recorrentes:0, pct_quase_inativos:0, pct_inativos:0, pct_ativos_6m:0, novos_ano:0, recuperados_ano:0};
  const valid = rows.filter(row => row.DT_FATURA_DATE);
  if (!valid.length) return empty;
  const reference = maxDate(valid), year = reference.slice(0,4);
  const base = carteira.length ? carteira : valid;
  const all = [...new Set(base.map(row => row.GRUPO_CLIENTE).filter(value => value != null))];
  const grouped = groupRows(valid, 'GRUPO_CLIENTE'), latest = new Map(grouped.map(group => [group.key, maxDate(group.rows)]));
  const monthsSince = all.map(group => latest.has(group) ? roundEven(diffDays(reference, latest.get(group)) / 30) : 999);
  const count = predicate => monthsSince.filter(predicate).length;
  const result = {...empty, total_clientes:all.length, ativos_12m:count(m=>m<=12), recorrentes_3m:count(m=>m<=3),
    ativos_param:count(m=>m<=months), quase_inativos:count(m=>m>months && m<=12), inativos:count(m=>m>12)};
  for (const {rows:items} of grouped) {
    const current = items.filter(row=>row.DT_FATURA_DATE.slice(0,4)===year);
    if (!current.length) continue;
    const previous = items.filter(row=>row.DT_FATURA_DATE.slice(0,4)<year);
    if (!previous.length) result.novos_ano++;
    else if (diffDays(current.reduce((date,row)=>row.DT_FATURA_DATE<date ? row.DT_FATURA_DATE:date,current[0].DT_FATURA_DATE),maxDate(previous))>=365) result.recuperados_ano++;
  }
  const percentage = value => all.length ? roundEven(value / all.length * 100) : 0;
  Object.assign(result, {pct_ativos:percentage(result.ativos_12m), pct_recorrentes:percentage(result.recorrentes_3m),
    pct_quase_inativos:percentage(result.quase_inativos), pct_inativos:all.length?roundEven(100-percentage(result.ativos_param)-percentage(result.quase_inativos)):0, pct_ativos_6m:percentage(result.ativos_param)});
  return result;
}
export function customerAnalysis(rows, carteira = []) {
  const reference = maxDate(rows), numMonths = Math.max(1, distinct(rows.map(row=>row.DT_FATURA_DATE?.slice(5,7))));
  const clients = groupRows(rows,'GRUPO_CLIENTE').map(({key,rows:items})=> {
    const value = gs(items,'VALOR_FATURADO_CLEAN'), quantity = gs(items,'QUANTIDADE_FATURADA_CLEAN',true), weight = gs(items,'PESO_FATURADO_CLEAN',true);
    return {GRUPO_CLIENTE:key, Valor:value, Qtde:quantity, Peso:weight, NS:gm(items,'NIVEL_DE_SERVICO_CLEAN',true),
      Pedidos:distinct(nums(items,'CODIGO_PEDIDO')), Meses_Ativos:distinct(items.map(row=>row.DT_FATURA_DATE?.slice(5,7))),
      Ultima_Compra:maxDate(items) || null, Volume_M3:gs(items,'VOLUME_M3_FATURADO_CLEAN',true), OTIF:gm(items,'ON_TIME_CLEAN',true),
      Media_Mensal:value/numMonths, 'Nível':classifyTier(value), 'Nível (Média Mensal)':classifyTier(value/numMonths),
      'Ticket Medio':value/(quantity || 1), 'R$/Ton':value/Math.fround((weight || 1)/1000)};
  }).sort((a,b)=>b.Valor-a.Valor);
  const r=rankQuantiles(clients.map(row=>row.Ultima_Compra ? diffDays(reference,row.Ultima_Compra):-1),true);
  const f=rankQuantiles(clients.map(row=>row.Pedidos)), m=rankQuantiles(clients.map(row=>row.Valor));
  clients.forEach((row,i)=>Object.assign(row,reference ? {Recencia:row.Ultima_Compra ? diffDays(reference,row.Ultima_Compra):-1,
    R_Score:r[i],F_Score:f[i],M_Score:m[i],RFM_Score:`${r[i]}${f[i]}${m[i]}`,Segmento:rfmSegment(r[i],f[i],m[i])}
    : {Recencia:-1,RFM_Score:'---',Segmento:'Sem Histórico'}));
  const total = sum(clients.map(row=>row.Valor)), shares=[5,10,20].map(n=>total ? sum(clients.slice(0,n).map(row=>row.Valor))/total*100:0);
  const year=reference.slice(0,4), currentMonths=new Set(rows.filter(row=>row.DT_FATURA_DATE?.startsWith(year)).map(row=>row.DT_FATURA_DATE.slice(5,7)));
  const diffs=new Map(groupRows(rows,'GRUPO_CLIENTE').map(({key,rows:items})=>[key,
    gs(items.filter(row=>row.DT_FATURA_DATE?.startsWith(year)),'VALOR_FATURADO_CLEAN') -
    gs(items.filter(row=>row.DT_FATURA_DATE?.startsWith(String(Number(year)-1)) && currentMonths.has(row.DT_FATURA_DATE.slice(5,7))),'VALOR_FATURADO_CLEAN')]));
  clients.forEach(row=>Object.assign(row,{Diff_Raw:diffs.get(row.GRUPO_CLIENTE)||0,'% Part':total>0 ? row.Valor/total:0}));
  const activity=clients.filter(row=>row.Ultima_Compra).map(row=>({GRUPO_CLIENTE:row.GRUPO_CLIENTE,Ultima_Compra:row.Ultima_Compra,
    Faturamento_Historico:row.Valor,Pedidos:row.Pedidos,Dias_sem_compra:row.Recencia}));
  const inactive30=activity.filter(row=>row.Dias_sem_compra>=30),inactive60=activity.filter(row=>row.Dias_sem_compra>=60),priority=inactive60.slice(0,20);
  const inactivity=['Até 29 dias','30–59 dias','60–89 dias','90+ dias'].map((Faixa,index)=>({Faixa,'Grupos de Clientes':activity.filter(row=>Math.min(3,Math.floor(row.Dias_sem_compra/30))===index).length})).sort((a,b)=>b['Grupos de Clientes']-a['Grupos de Clientes']);
  const order=['Campeões','Grupos Fiéis','Promissores','Atenção','Em Risco','Perdidos','Sem Histórico'];
  const rfmSummary=groupRows(clients,'Segmento').map(({key,rows:items})=>({Segmento:key,Quantidade:items.length,Faturamento_Total:gs(items,'Valor'),
    Recencia_Media:mean(items.filter(row=>row.Recencia>=0).map(row=>row.Recencia)) ?? 0,Pedidos_Medio:mean(items.map(row=>row.Pedidos))})).sort((a,b)=>order.indexOf(a.Segmento)-order.indexOf(b.Segmento));
  const uf=groupRows(rows.filter(row=>row.UF!=null),row=>String(row.UF).trim()).filter(group=>group.key!==''&&group.key!=='nan')
    .map(({key,rows:items})=>({UF:key,Grupos:distinct(nums(items,'GRUPO_CLIENTE')),Faturamento:gs(items,'VALOR_FATURADO_CLEAN'),Peso:gs(items,'PESO_FATURADO_CLEAN',true)})).sort((a,b)=>b.Grupos-a.Grupos);
  const ufGroups=sum(uf.map(row=>row.Grupos));
  uf.forEach(row=>Object.assign(row,{'% Part Carteira':ufGroups>0?row.Grupos/ufGroups:0,Peso_Ton:Math.fround(row.Peso/1000)}));
  return {clients,status:customerStatus(rows,carteira),shares,priority,inactive30,inactive60,inactivity,rfmSummary,uf,numMonths,reference};
}
const columnLabels={GRUPO_CLIENTE:'Grupo de Cliente',Diff_Raw:'Superávit / Déficit vs. Ano Ant.',NS:'Nível de Serviço',Media_Mensal:'Média Mensal (R$)',Meses_Ativos:'Meses Ativos',Recencia:'Recência (Dias)',Pedidos:'Qtd Pedidos',RFM_Score:'Score RFM',Ultima_Compra:'Última Compra',Dias_sem_compra:'Dias sem Compra',Faturamento_Historico:'Histórico (R$)',Faturamento_Total:'Faturamento Total',Recencia_Media:'Recência Média (Dias)',Pedidos_Medio:'Média Pedidos / Grupo',Peso_Ton:'Peso (t)',Volume_M3:'Volume (m³)',Grupos:'Qtd Grupos'};
const columns = keys => keys.map(key=>({key,label:columnLabels[key]??key,format: /Valor|Historico|Faturamento|Media_Mensal|Ticket|R\$|Diff_Raw/.test(key)?'currency': /Part|OTIF/.test(key)?'ratio':key==='Ultima_Compra'?'date':key==='Peso_Ton'?'decimal':key==='NS'?'days':key==='Volume_M3'?'volume': /Peso/.test(key)?'weight': /GRUPO|Segmento|Nível|RFM|^UF$/.test(key)?'text':'number'}));
export function buildCustomerDashboard({area,rows,carteira=[]}) {
  const a=customerAnalysis(rows,carteira), c=a.clients, totalKey=key=>sum(c.map(row=>row[key]),{float32:['Peso','Qtde','Volume_M3'].includes(key)});
  const total={GRUPO_CLIENTE:'TOTAL',Valor:totalKey('Valor'),Diff_Raw:totalKey('Diff_Raw'),'% Part':1,Media_Mensal:totalKey('Media_Mensal'),
    'Ticket Medio':totalKey('Qtde')>0?totalKey('Valor')/totalKey('Qtde'):0,'R$/Ton':totalKey('Peso')>0?totalKey('Valor')/Math.fround(totalKey('Peso')/1000):0,
    Peso:totalKey('Peso'),Volume_M3:totalKey('Volume_M3'),OTIF:mean(nums(rows,'ON_TIME_CLEAN'),{float32:true})??0,NS:mean(nums(c,'NS'),{float32:true}),
    Meses_Ativos:mean(nums(c,'Meses_Ativos')),Recencia:mean(c.filter(row=>row.Recencia>=0).map(row=>row.Recencia))??0,Pedidos:totalKey('Pedidos'),RFM_Score:'-',Segmento:'-'};
  const metrics=[{id:'total_clientes',label:'Total de Grupos',value:a.status.total_clientes,format:'number'},
    {id:'novos_recuperados',label:'Novos / Recuperados',value:a.status.novos_ano+a.status.recuperados_ano,format:'number',subtitle:`${a.status.novos_ano} nov / ${a.status.recuperados_ano} rec`},
    {id:'recorrentes_3m',label:'Grupos Recorr. (3m)',value:a.status.recorrentes_3m,format:'number',subtitle:`${a.status.pct_recorrentes}% do total`},
    {id:'ativos_param',label:'Grupos Ativos (6m)',value:a.status.ativos_param,format:'number',subtitle:`${a.status.pct_ativos_6m}% do total`},
    {id:'quase_inativos',label:'Quase Inativos',value:a.status.quase_inativos,format:'number',subtitle:`${a.status.pct_quase_inativos}% do total`},
    {id:'inativos',label:'Grupos Inat. (12m+)',value:a.status.inativos,format:'number',subtitle:`${a.status.pct_inativos}% do total`}];
  metrics.push(...a.shares.map((value,index)=>({id:`top${[5,10,20][index]}`,label:`Part. Top ${[5,10,20][index]}`,value,format:'percent'})),
    {id:'inactive30',label:`Sem ${area==='emitidos'?'emissão':'faturamento'} há 30+ dias`,value:a.inactive30.length,format:'number'},
    {id:'inactive60',label:`Sem ${area==='emitidos'?'emissão':'faturamento'} há 60+ dias`,value:a.inactive60.length,format:'number'},
    {id:'riskRevenue',label:'Receita em risco (60+ dias)',value:sum(a.inactive60.map(row=>row.Faturamento_Historico)),format:'currency'});
  const tiers=groupRows(c,'Nível (Média Mensal)').map(({key,rows:items})=>({Nivel:key,N:items.length}));
  const ufTotal={UF:'TOTAL',Grupos:sum(a.uf.map(row=>row.Grupos)),Faturamento:sum(a.uf.map(row=>row.Faturamento)),Peso_Ton:Math.fround(sum(a.uf.map(row=>row.Peso),{float32:true})/1000),'% Part Carteira':1};
  return {metrics,series:[{id:'top15',title:'Top 15 Grupos',type:'bar',rows:c.slice(0,15).reverse(),x:'GRUPO_CLIENTE',y:['Valor']},
    {id:'tiers',title:'QTD Grupos de Clientes (Média Mensal)',type:'funnel',rows:tiers,x:'Nivel',y:['N']},
    {id:'inactivity',title:'Distribuição da inatividade',type:'bar',rows:a.inactivity,x:'Faixa',y:['Grupos de Clientes']},
    {id:'rfm',title:'Distribuição dos Grupos por Segmento',type:'bar',rows:a.rfmSummary,x:'Segmento',y:['Quantidade']},
    {id:'ufCoverage',title:'Distribuição por UF',type:'treemap',rows:a.uf,x:'UF',y:['Grupos']}],
    tables:[{id:'customers',title:'Desempenho por Grupo de Cliente',rows:c,columns:columns(['GRUPO_CLIENTE','Valor','Diff_Raw','% Part','NS','Media_Mensal','Ticket Medio','R$/Ton','Peso','Volume_M3','OTIF','Meses_Ativos','Recencia','Pedidos','RFM_Score','Segmento']),total,treeSpec:{columns:['GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],maxChildren:6,maxRoots:40}},
      {id:'reactivation',title:'Prioridade de reativação',rows:a.priority,columns:columns(['GRUPO_CLIENTE','Ultima_Compra','Dias_sem_compra','Faturamento_Historico']),
        total:{GRUPO_CLIENTE:'TOTAL (Top 20)',Dias_sem_compra:mean(a.priority.map(row=>row.Dias_sem_compra)),Faturamento_Historico:sum(a.priority.map(row=>row.Faturamento_Historico))},treeSpec:{columns:['GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],groups:a.priority.map(row=>row.GRUPO_CLIENTE),maxChildren:6,maxRoots:20}},
      {id:'rfmSummary',title:'Resumo Estratégico da Carteira',rows:a.rfmSummary,columns:columns(['Segmento','Quantidade','Faturamento_Total','Recencia_Media','Pedidos_Medio']),total:{Segmento:'TOTAL',Quantidade:sum(a.rfmSummary.map(row=>row.Quantidade)),Faturamento_Total:sum(a.rfmSummary.map(row=>row.Faturamento_Total)),Recencia_Media:mean(a.rfmSummary.map(row=>row.Recencia_Media)),Pedidos_Medio:mean(a.rfmSummary.map(row=>row.Pedidos_Medio))}},
      {id:'uf',title:'Cobertura por UF',rows:a.uf,columns:columns(['UF','Grupos','Faturamento','Peso_Ton','% Part Carteira']),total:ufTotal,treeSpec:{columns:['UF','CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],maxChildren:6,maxRoots:35}}],
    meta:{referenceDate:a.reference,numMonths:a.numMonths,status:a.status,shares:a.shares,coverage:{states:a.uf.length,top3Groups:sum(a.uf.slice(0,3).map(row=>row.Grupos)),totalGroups:ufTotal.Grupos}}};
}
