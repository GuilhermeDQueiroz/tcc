import {summarize,sum,mean,distinct,groupRows} from './metrics.js';
import {backlogSummary,forecastCalendar,prepareOpenRows} from './forecast.js';
import {dimensionRows,dimensionColumns,buildHierarchy} from './dimensions.js';
const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
export function buildOpenDashboard({rows,referenceDate,dailyAverage=0,tab='resumo',year,month,backlogType='real',metric='value'}){
  rows=prepareOpenRows(rows,referenceDate);const s=summarize(rows,'abertos'),backlog=backlogSummary(rows,dailyAverage);
  const old=rows.filter(r=>r.NIVEL_DE_SERVICO_CLEAN>60),oldSummary=summarize(old,'abertos');
  const special=r=>/MADEIRAMADEIRA|1392|1665/i.test(String(r.GRUPO_CLIENTE??''));
  const specialRows=rows.filter(special),ordinaryRows=rows.filter(r=>!special(r));
  const value=(id,label,value,format,extra={})=>({id:`abertos.resumo.${id}`,label,value,format,...extra});
  const metrics=[value('value','Valor',s.value,'currency'),value('weightKg','Peso',s.weightKg,'weight'),value('volumeM3','Volume',s.volumeM3,'volume'),value('quantity','Qtd itens',s.quantity,'integer'),
    value('orders','Qtd pedidos',s.orders,'integer',{subtitle:`${distinct(rows.filter(r=>r.Canal==='Varejo').map(r=>r.CODIGO_PEDIDO))} Var | ${distinct(rows.filter(r=>r.Canal==='E-commerce').map(r=>r.CODIGO_PEDIDO))} E-com`}),
    value('groups','Grupos aguardando',s.groups,'integer'),value('serviceDays','Nível de serviço',s.serviceDays,'days',{supplementary:[
      {label:'Varejo',value:mean(ordinaryRows.map(r=>r.NIVEL_DE_SERVICO_CLEAN),{float32:true})??0,format:'days'},
      {label:'E-commerce',value:mean(specialRows.map(r=>r.NIVEL_DE_SERVICO_CLEAN),{float32:true})??0,format:'days'}]}),
    value('backlogReal','Backlog real',backlog.realDays,'days',{subtitle:backlog.status}),value('backlogGeneral','Backlog geral',backlog.generalDays,'days'),
    value('orders60','Pedidos > 60 dias',oldSummary.orders,'integer',{supplementary:[{label:'Participação dos pedidos',value:s.orders>0?oldSummary.orders/s.orders*100:0,format:'percent'}]}),
    value('value60','Valor > 60 dias',oldSummary.value,'currency',{supplementary:[{label:'Participação do valor',value:s.value>0?oldSummary.value/s.value*100:0,format:'percent'}]})];
  const series=[],tables=[];
  function add(dim,title,type='bar',limit){
    const data=dimensionRows(rows,'abertos',dim);const ordered=[...data];
    const key=metric==='weightKg'?'Peso':metric==='quantity'?'Qtde':metric==='volumeM3'?'Volume_M3':'Valor';
    series.push({id:`abertos.resumo.${dim==='Aging_Bucket'?'aging':dim}`,title,type,rows:limit?ordered.slice(0,limit):ordered,x:dim,y:[key],format:metric==='weightKg'?'weight':metric==='quantity'?'integer':metric==='volumeM3'?'volume':'currency',dimension:dim});
    tables.push({id:`abertos.resumo.tabela.${dim}`,title,rows:data,columns:dimensionColumns(dim),total:{[dim]:'TOTAL',Valor:sum(data.map(r=>r.Valor)),Peso:sum(data.map(r=>r.Peso),{float32:true}),Volume_M3:sum(data.map(r=>r.Volume_M3),{float32:true}),Qtde:sum(data.map(r=>r.Qtde),{float32:true}),Qtd_Pedidos:s.orders,Grupos_Atendidos:s.groups,NS:s.serviceDays,'Ticket Medio':s.ticket,'R$/Ton':s.revenuePerTon,'% Part':1}});
    return data;
  }
  if(tab==='calendario'){
    year??=Number(referenceDate.slice(0,4));month??=Number(referenceDate.slice(5,7));
    const calendar=forecastCalendar(rows,year,month,backlogType);
    return {metrics:[{id:'abertos.calendario.total',label:'Previsão do mês',value:sum(calendar.map(d=>d.value)),format:'currency'}],series:[{id:'abertos.calendario.dias',title:'Cronograma de previsão de faturamento',type:'calendar',rows:calendar,x:'date',y:['value'],format:'currency'}],tables:[{id:'abertos.calendario.tabela',title:'Previsão diária',rows:calendar,columns:[{key:'date',label:'Data',format:'date'},{key:'value',label:'Valor',format:'currency'}]}],meta:{year,month,backlogType,calendar}};
  }
  if(tab==='geografia'){
    const data=add('UF','Carteira por estado','map');const byUF=new Map(data.map(r=>[r.UF,r]));
    series[0].rows=UFS.map(UF=>byUF.get(UF)||{UF,Valor:0,Peso:0,Volume_M3:0,Qtde:0,Qtd_Pedidos:0,Grupos_Atendidos:0,NS:0});
    add('REGIAO_UF','Regiões');add('MICRO_REGIAO','Microrregiões','bar',15);add('CIDADE','Cidades','bar',15);
    return {metrics,series,tables,meta:{backlog}};
  }
  add('Mes_Grupo','Evolução mensal do backlog','line');add('Aging_Bucket','Faixas de tempo','pie');add('STATUS','Situação dos pedidos','barHorizontal');
  const statusSeries=series.at(-1),statusRows=[...statusSeries.rows].sort((a,b)=>a.Valor-b.Valor),statusTotal=sum(statusRows.map(r=>r.Valor));
  statusRows.forEach(r=>r.Part=statusTotal>0?r.Valor/statusTotal:0);
  statusSeries.availableRows=statusRows;
  if(statusRows.length>10){const others=statusRows.slice(0,-9),v=sum(others.map(r=>r.Valor));statusSeries.rows=[{STATUS:'Outros Status',Valor:v,Qtd_Pedidos:sum(others.map(r=>r.Qtd_Pedidos)),Part:statusTotal>0?v/statusTotal:0},...statusRows.slice(-9)];}
  else statusSeries.rows=statusRows;
  add('Mes_Previsao','Previsão de faturamento');add('Status_Previsao','Status da previsão','pie');
  add('TIPO_ENTREGA','Entrega e retirada','pie');
  const delivery=series.at(-1);delivery.y=['Peso'];delivery.format='weight';delivery.metricOptions={value:'Valor',weightKg:'Peso'};
  delivery.rows=delivery.rows.map(r=>({...r,Tipo:r.TIPO_ENTREGA==='ENTREGA'?'Sim (Entrega)':'Não (Retira)'}));delivery.x='Tipo';
  add('Canal','Canais de pedidos','pie');
  // Restore the overview composition from pedidos_em_aberto.py. These reuse
  // the same original calendar/groupby reducers as the dedicated analyses.
  year??=Number(referenceDate.slice(0,4));month??=Number(referenceDate.slice(5,7));
  const calendar=forecastCalendar(rows,year,month,backlogType);
  series.push({id:'abertos.resumo.calendario',title:'Cronograma de previsão de faturamento',type:'calendar',rows:calendar,x:'date',y:['value'],format:'currency'});
  const geographic=dimensionRows(rows,'abertos','UF'),byUF=new Map(geographic.map(r=>[r.UF,r]));
  series.push({id:'abertos.resumo.UF',title:'Distribuição geográfica (UF)',type:'map',rows:UFS.map(UF=>byUF.get(UF)||{UF,Valor:0}),x:'UF',y:['Valor'],format:'currency',dimension:'UF'});
  const monthlyDelivery=[];
  for(const kind of new Set(rows.map(r=>r.TIPO_ENTREGA)))for(const row of dimensionRows(rows.filter(r=>r.TIPO_ENTREGA===kind),'abertos','Mes_Grupo'))monthlyDelivery.push({...row,TIPO_ENTREGA:kind});
  series.push({id:'abertos.resumo.entregaMensal',title:'Evolução mensal por tipo de entrega',type:'bar',rows:monthlyDelivery,x:'Mes_Grupo',y:['Valor'],category:'TIPO_ENTREGA',format:'currency'});
  for(const [kind,label] of [['ENTREGA','Entrega agendada'],['RETIRA','Retirada']]){
    const selected=rows.filter(r=>kind==='ENTREGA'?r.TIPO_ENTREGA==='ENTREGA':r.TIPO_ENTREGA!=='ENTREGA'),s1=summarize(selected,'abertos');
    metrics.push(value('entrega.'+kind,label,s1.value,'currency',{supplementary:[
      {label:'Peso',value:s1.weightKg,format:'weight'},{label:'Pedidos',value:s1.orders,format:'integer'},
      {label:'Participação',value:s.value>0?s1.value/s.value*100:0,format:'percent'}]}));
  }
  return {metrics,series,tables,meta:{backlog,empty:!rows.length,serviceWithSpecial:mean(specialRows.map(r=>r.NIVEL_DE_SERVICO_CLEAN),{float32:true}),serviceWithoutSpecial:mean(ordinaryRows.map(r=>r.NIVEL_DE_SERVICO_CLEAN),{float32:true}),lateOrdersPct:s.orders>0?oldSummary.orders/s.orders*100:0,lateValuePct:s.value>0?oldSummary.value/s.value*100:0}};
}
