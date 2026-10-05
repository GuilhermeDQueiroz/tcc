import {sum,mean,groupSum,summarize,numericColumns} from './metrics.js';
import {weeklyPeriods,daysInMonth,businessDays,isBusinessDay,dateValue,shiftYear} from './dates.js';
import {groupRows,distinct,buildCustomerDashboard} from './customers.js';
import {consultantGoalRanking,consultantGoalTotal} from './goals.js';

const labels={value:'Valor',weightKg:'Peso',volumeM3:'Volume',quantity:'Qtd Itens',orders:'Qtd Pedidos',groups:'Grupos Atendidos',ticket:'Ticket Médio',serviceDays:'Nível de Serviço',onTime:'OTIF (% No Prazo)',revenuePerTon:'(R$)/Ton'};
const formats={value:'currency',weightKg:'weight',volumeM3:'volume',quantity:'number',orders:'number',groups:'number',ticket:'currency',serviceDays:'days',onTime:'percent',revenuePerTon:'currency'};
const maximum=(rows,column)=>rows.reduce((max,row)=>row[column] && row[column]>max ? row[column]:max,'');
const delta=(current,previous,empty=null)=>previous>0?(current/previous-1)*100:empty;
const dateColumn=area=>area==='emitidos'?'DATA_EMISSAO_PEDIDO_DATE':'DT_FATURA_DATE';
export function salesChannel(row) {const origin=String(row.ORIGEM??'').trim().toUpperCase();return ['SITE','MANUAL'].includes(origin)?'Varejo':origin.includes('INTEGRA')||origin==='PANORAMAMOVEIS'?'E-commerce':'Outros';}
const selectPeriod=(rows,column,start,end)=>rows.filter(row=>row[column] && row[column]>=start && row[column]<=end);
function cards(summary,keys,comparison={}) {return keys.map(id=>{
  const details=comparison[id],value=id==='onTime'&&summary[id]!=null?Math.fround(summary[id]*100):summary[id];
  const result={id,label:labels[id],value,format:formats[id]};
  if(details!==undefined){const percent=details.change??details.previousChange;
    result.comparison={...details,value:percent,label:details.year?`vs ${details.year}`:'vs Semana Anterior',format:'percent'};
    result.comparisons=[];
    if(details.previous!==undefined)result.comparisons.push({label:details.year?`Mesmo período ${details.year}`:'Semana Anterior',value:id==='onTime'&&details.previous!=null?Math.fround(details.previous*100):details.previous,format:formats[id],percentage:percent});
    if(details.earlier!==undefined)result.comparisons.push({label:'Semana Retrasada',value:id==='onTime'&&details.earlier!=null?Math.fround(details.earlier*100):details.earlier,format:formats[id],percentage:details.earlierChange});
  }
  return result;
});}
const columns=(keys)=>keys.map(key=>({key,label:labels[key]??key,format:formats[key]??(key==='Data'||key==='Mes_Ano'?'text':'number')}));
const rank=(rows,dimension,area,{trim=false}={})=>groupRows(rows,trim?row=>row[dimension]==null?null:String(row[dimension]).trim():dimension).map(group=>({[dimension]:group.key,...summarize(group.rows,area,{grouped:true})})).sort((a,b)=>b.value-a.value);
function sumTable(rows,labelKey) {const total={[labelKey]:'TOTAL'};for(const key of ['value','weightKg','volumeM3','quantity','orders','groups'])total[key]=sum(rows.map(row=>row[key]),{float32:['weightKg','volumeM3','quantity'].includes(key)});return total;}

export function weeklyAnalysis({area,rows,referenceDate}) {
  const column=dateColumn(area),valid=rows.filter(row=>row[column]),last=maximum(valid,column);
  if(!last)return {metrics:[],series:[],tables:[],meta:{empty:true}};
  const periods=weeklyPeriods(referenceDate,last),names=['Atual','Anterior','Retrasada'],keys=['value','weightKg','volumeM3','quantity','orders','groups'];
  if(area==='faturados')keys.push('onTime');
  const datasets=periods.map(period=>selectPeriod(valid,column,period.start,period.end)),totals=datasets.map(items=>summarize(items,area));
  const comparisons=Object.fromEntries(keys.map(key=>[key,{previous:totals[1][key],earlier:totals[2][key],previousChange:delta(totals[0][key],totals[1][key],0),earlierChange:delta(totals[0][key],totals[2][key],0)}]));
  const metrics=cards(totals[0],keys,comparisons),series=[],tables=[];
  const channels={};
  for(const channel of ['Total','Varejo','E-commerce']) {
    const channelSets=datasets.map(items=>channel==='Total'?items:items.filter(row=>salesChannel(row)===channel));
    channels[channel]=channelSets.map(items=>summarize(items,area));
    const daily=Array.from({length:7},(_,weekday)=>({weekday,Dia:['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'][weekday]}));
    const accumulators=[0,0,0];
    daily.forEach((day,index)=>channelSets.forEach((items,periodIndex)=>{
      const dayRows=items.filter(row=>(new Date(dateValue(row[column])).getUTCDay()+6)%7===index);
      day[names[periodIndex]]=groupSum(dayRows.map(row=>row[numericColumns(area).value]));
      accumulators[periodIndex]+=day[names[periodIndex]];day[`${names[periodIndex]}_Acum`]=accumulators[periodIndex];
    }));
    series.push({id:`daily_${channel}`,title:`Comparativo Diário — ${channel}`,type:'bar',rows:daily,x:'Dia',y:names,format:'currency'},
      {id:`cumulative_${channel}`,title:`Acumulado Semanal — ${channel}`,type:'line',rows:daily,x:'Dia',y:names.map(name=>`${name}_Acum`),format:'currency'});
    if(channel!=='Total'){const channelComparisons=Object.fromEntries(['value','weightKg','volumeM3','quantity','orders','groups'].map(key=>[key,{previous:channels[channel][1][key],earlier:channels[channel][2][key],previousChange:delta(channels[channel][0][key],channels[channel][1][key],0),earlierChange:delta(channels[channel][0][key],channels[channel][2][key],0)}]));
      metrics.push(...cards(channels[channel][0],['value','weightKg','volumeM3','quantity','orders','groups'],channelComparisons).map(card=>({...card,id:`${channel}_${card.id}`,label:`${channel}: ${card.label}`})));}
  }
  metrics.find(card=>card.id==='orders').supplementary=['Varejo','E-commerce'].flatMap(channel=>channels[channel].map((value,index)=>({label:`${channel} — ${names[index]}`,value:value.orders,format:'number'})));
  datasets.forEach((items,index)=> {
    const top=rank(items,'GRUPO_CLIENTE',area).slice(0,5);
    tables.push({id:`top5_${index}`,title:`Top 5 Grupos de Clientes (Semana ${names[index]})`,rows:top,columns:columns(['GRUPO_CLIENTE','value','weightKg','quantity','orders']),total:sumTable(top,'GRUPO_CLIENTE'),treeSpec:{columns:['GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],maxChildren:6,maxRoots:5,period:periods[index]}});
    for(const dimension of ['SUPERVISOR','CONSULTOR']) {
      const ranking=rank(items,dimension,area);ranking.forEach(row=>row.part_pct=totals[index].value>0?row.value/totals[index].value:0);
      tables.push({id:`${dimension.toLowerCase()}_${index}`,title:`Detalhamento por ${dimension} — Semana ${names[index]}`,rows:ranking,
        columns:[...columns([dimension,'value']),{key:'part_pct',label:'% Part.',format:'ratio'},...columns(['weightKg','quantity','orders','groups'])],
        total:{...sumTable(ranking,dimension),groups:totals[index].groups,part_pct:1},treeSpec:{columns:dimension==='SUPERVISOR'?['SUPERVISOR','CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO']:['CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],maxChildren:8,maxRoots:35,period:periods[index]}});
    }
  });
  return {metrics,series,tables,meta:{periods,periodTotals:totals,channels,referenceDate:referenceDate<last?referenceDate:last}};
}

export function monthlyAnalysis({area,rows,history=rows,goalsConfig={},metas=[],referenceDate}) {
  const column='DT_FATURA_DATE',valid=rows.filter(row=>row[column]),last=maximum(valid,column);
  if(!last)return {metrics:[],series:[],tables:[],meta:{empty:true}};
  const monthKey=last.slice(0,7),year=Number(last.slice(0,4)),month=Number(last.slice(5,7)),day=Number(last.slice(8,10));
  const current=valid.filter(row=>row[column].startsWith(monthKey)),previousFull=history.filter(row=>row[column]?.startsWith(`${year-1}-${String(month).padStart(2,'0')}`));
  const previous=previousFull.filter(row=>Number(row[column].slice(8,10))<=day),s=summarize(current,'faturados'),p=summarize(previous,'faturados');
  const target=goalsConfig[monthKey]??goalsConfig.default??{},prefix=area==='emitidos'?'emissao_':'';
  const financial=Number(target[`${prefix}financeira`]??target.financeira??818181.181),weight=Number(target[`${prefix}peso`]??target.peso??150000);
  let accumulatedValue=0,accumulatedWeight=0;
  const daily=groupRows(current,column).map(({key,rows:items},index)=>{
    const v=summarize(items,'faturados',{grouped:true});accumulatedValue+=v.value;accumulatedWeight=Math.fround(accumulatedWeight+Math.fround(v.weightKg/1000));
    return {Data:key,Valor:v.value,Peso:v.weightKg,'Meta Financeira':financial,'Meta Peso':weight,Pct_Fat:financial>0?v.value/financial:0,Pct_Peso:weight>0?Math.fround(v.weightKg/weight):0,
      Dif_Fat:v.value-financial,Dif_Peso:Math.fround(v.weightKg-weight),Valor_Acum:accumulatedValue,Meta_Fat_Acum:financial*(index+1),Peso_Acum_t:accumulatedWeight,Meta_Peso_Acum_t:weight/1000*(index+1)};
  });
  // Cards use a second Series reduction over the daily groupby result.
  s.value=sum(daily.map(row=>row.Valor));s.weightKg=sum(daily.map(row=>row.Peso),{float32:true});s.ticket=s.quantity>0?s.value/s.quantity:0;
  const days=daysInMonth(year,month),goalDays=area==='emitidos'?days:businessDays(year,month),positiveDays=daily.filter(row=>row.Valor>0).length;
  const dailyAverage=positiveDays>0?s.value/positiveDays:0;
  const maxDay=Math.max(days,...previousFull.map(row=>Number(row[column].slice(8,10))));
  let remaining=0;for(let d=day+1;d<=maxDay;d++)if(area==='emitidos'||isBusinessDay(`${monthKey}-${String(d).padStart(2,'0')}`))remaining++;
  const projection=s.value+dailyAverage*remaining,totalGoal=financial*goalDays,accumulatedGoal=financial*daily.length;
  const comparisons=Object.fromEntries(['value','weightKg','quantity','orders','groups','ticket','serviceDays'].map(key=>[key,{previous:p[key],change:delta(s[key],p[key]),year:year-1}]));
  const keys=['value','weightKg','volumeM3','quantity','orders','groups','ticket'];if(area==='faturados')keys.push('serviceDays','onTime');
  const metrics=cards(s,keys,comparisons);
  metrics.splice(1,0,{id:'projection',label:'Projeção do Mês',value:projection,format:'currency',comparison:{previous:sum(previousFull.map(row=>row.VALOR_FATURADO_CLEAN)),change:delta(projection,sum(previousFull.map(row=>row.VALOR_FATURADO_CLEAN))),value:delta(projection,sum(previousFull.map(row=>row.VALOR_FATURADO_CLEAN))),label:`vs ${year-1}`,format:'percent',goalPercent:totalGoal>0?projection/totalGoal*100:0}});
  const channels=Object.fromEntries(['Varejo','E-commerce','Outros'].map(channel=>[channel,summarize(current.filter(row=>salesChannel(row)===channel),'faturados')]));
  const mm=current.filter(row=>/MADEIRAMADEIRA|1392|1665/i.test(String(row.GRUPO_CLIENTE))),other=current.filter(row=>!/MADEIRAMADEIRA|1392|1665/i.test(String(row.GRUPO_CLIENTE)));
  const serviceSegments={ecommerce:mm.length?mean(mm.map(row=>row.NIVEL_DE_SERVICO_CLEAN),{float32:true}):0,retail:other.length?mean(other.map(row=>row.NIVEL_DE_SERVICO_CLEAN),{float32:true}):0};
  metrics.find(card=>card.id==='orders').supplementary=['Varejo','E-commerce'].map(channel=>({label:channel,value:channels[channel].orders,format:'number'}));
  metrics.find(card=>card.id==='projection').supplementary=[{label:'Média Diária',value:dailyAverage,format:'currency'},{label:area==='emitidos'?'Dias Restantes':'Dias Úteis Restantes',value:remaining,format:'number'},{label:'Meta Total',value:totalGoal>0?projection/totalGoal*100:0,format:'percent'}];
  if(area==='faturados')metrics.find(card=>card.id==='serviceDays').supplementary=[{label:'Varejo',value:serviceSegments.retail>0?serviceSegments.retail:null,format:'days'},{label:'E-commerce',value:serviceSegments.ecommerce>0?serviceSegments.ecommerce:null,format:'days'}];
  const safra=current.filter(row=>row.DATA_EMISSAO_PEDIDO_DATE?.startsWith(monthKey)),safraOrders=distinct(safra.map(row=>row.CODIGO_PEDIDO)),safraValue=sum(safra.map(row=>row.VALOR_FATURADO_CLEAN));
  if(area==='faturados')metrics.push({id:'safraOrdersPercent',label:'Conversão (Safra): Qtd',value:s.orders>0?safraOrders/s.orders*100:0,format:'percent'},
    {id:'safraValuePercent',label:'Conversão (Safra): Valor',value:s.value>0?safraValue/s.value*100:0,format:'percent'});
  const currentDays=new Map(daily.map(row=>[Number(row.Data.slice(8,10)),row.Valor])),previousDays=new Map(groupRows(previousFull,column).map(({key,rows:items})=>[Number(key.slice(8,10)),groupSum(items.map(row=>row.VALOR_FATURADO_CLEAN))]));
  let cy=0,ly=0,projected=s.value;
  const comparison=Array.from({length:days},(_,index)=>{
    const d=index+1,value=d<=day?(currentDays.get(d)||0):null,prev=previousDays.get(d)||0;ly+=prev;if(value!=null)cy+=value;
    // The original chart excludes weekends only; the projection card also excludes holidays.
    const projectionStep=d>day&&(area==='emitidos'||new Date(Date.UTC(year,month-1,d)).getUTCDay()%6!==0)?dailyAverage:null;
    if(d>day)projected+=projectionStep||0;
    return {Dia:d,'Ano Atual':value,'Ano Anterior':prev,'Projecao Atual':projectionStep,Ano_Atual_Acum:d<=day?cy:null,Ano_Anterior_Acum:ly,Projecao_Acum:d>=day?projected:null};
  });
  const total={Data:'TOTAL',Valor:s.value,Peso:s.weightKg,'Meta Financeira':financial*daily.length,'Meta Peso':weight*daily.length,Pct_Fat:accumulatedGoal>0?s.value/accumulatedGoal:0,Pct_Peso:weight*daily.length>0?s.weightKg/(weight*daily.length):0,Dif_Fat:s.value-financial*daily.length,Dif_Peso:s.weightKg-weight*daily.length};
  const average={Data:'MEDIA',Valor:mean(daily.map(row=>row.Valor)),Peso:mean(daily.map(row=>row.Peso),{float32:true}),'Meta Financeira':financial,'Meta Peso':weight,Pct_Fat:null,Pct_Peso:null,Dif_Fat:mean(daily.map(row=>row.Dif_Fat)),Dif_Peso:mean(daily.map(row=>row.Dif_Peso),{float32:true})};
  const dailyColumns=[{key:'Data',label:'Data',format:'date'},...['Valor','Meta Financeira','Pct_Fat','Dif_Fat','Peso','Meta Peso','Pct_Peso','Dif_Peso'].map(key=>({key,label:key,format:key.includes('Pct')?'ratio':key.includes('Peso')?'weight':'currency'}))];
  const tables=[{id:'daily',title:'Tabela Diária Detalhada',rows:daily,columns:dailyColumns,total,average}];
  if(area==='emitidos'&&metas.length){const elapsed=referenceDate?.slice(0,7)===monthKey?Number(referenceDate.slice(8,10)):days;
    const ranking=consultantGoalRanking(current,metas,year,month,elapsed,days);tables.push({id:'consultantGoals',title:'Metas por Consultor — Pedidos Emitidos',rows:ranking,
      columns:['POSICAO','CONSULTOR','VALOR_EMITIDO','META_MENSAL','PERCENTUAL_ATINGIDO','VALOR_RESTANTE','PROJECAO_FECHAMENTO','SITUACAO'].map(key=>({key,label:key,format:['CONSULTOR','SITUACAO'].includes(key)?'text':key==='PERCENTUAL_ATINGIDO'?'percent':key==='POSICAO'?'number':'currency'})),total:consultantGoalTotal(ranking)});}
  const gauge=(id,label,value,accumulated,total,format)=>({id,title:label,type:'gauge',rows:[{value,accumulated,total,max:total>0?Math.max(value,accumulated,total)*1.08:1,accumulatedPercent:accumulated>0?value/accumulated*100:0,totalPercent:total>0?value/total*100:0}],y:['value'],format});
  return {metrics,series:[gauge('financialGoal','Meta Financeira',s.value,accumulatedGoal,totalGoal,'currency'),gauge('weightGoal','Meta Peso',s.weightKg/1000,weight*daily.length/1000,weight*goalDays/1000,'number'),
    {id:'financialDaily',title:'Valor Diário e Meta',type:'bar',rows:daily,x:'Data',y:['Valor','Meta Financeira'],format:'currency'},
    {id:'financialCumulative',title:'Valor Acumulado e Meta',type:'line',rows:daily,x:'Data',y:['Valor_Acum','Meta_Fat_Acum'],format:'currency'},
    {id:'weightDaily',title:'Peso Diário e Meta',type:'bar',rows:daily,x:'Data',y:['Peso','Meta Peso'],format:'weight'},
    {id:'weightCumulative',title:'Peso Acumulado e Meta',type:'line',rows:daily,x:'Data',y:['Peso_Acum_t','Meta_Peso_Acum_t'],format:'number'},
    {id:'yearComparisonDaily',title:'Comparativo Diário com Ano Anterior',type:'bar',rows:comparison,x:'Dia',y:['Ano Atual','Ano Anterior','Projecao Atual'],format:'currency'},
    {id:'yearComparisonCumulative',title:'Comparativo Acumulado com Ano Anterior',type:'line',rows:comparison,x:'Dia',y:['Ano_Atual_Acum','Ano_Anterior_Acum','Projecao_Acum'],format:'currency'}],tables,
    meta:{month:monthKey,referenceDate:last,goalDays,presentDays:daily.length,positiveDays,dailyAverage,remainingDays:remaining,projection,totalGoal,accumulatedGoal,weightTotalGoal:weight*goalDays,weightAccumulatedGoal:weight*daily.length,channels,serviceSegments,safra:{orders:safraOrders,value:safraValue},dimensionPeriod:{start:`${monthKey}-01`,end:last}}};
}

export function evolutionAnalysis({area,rows,history=rows,dimension='Ano',heatmapDimension=dimension,metric='value',filters={}}) {
  const column=dateColumn(area),valid=rows.filter(row=>row.DT_FATURA_DATE),last=maximum(valid,column);
  if(!last)return {metrics:[],series:[],tables:[],meta:{empty:true}};
  const year=Number(last.slice(0,4)),month=Number(last.slice(5,7)),day=Number(last.slice(8,10)),s=summarize(valid,'faturados');
  const monthly=groupRows(valid,row=>row.DT_FATURA_DATE.slice(0,7)).map(({key,rows:items})=>{
    const t=summarize(items,'faturados',{grouped:true});
    return {Mes_Ano:key,Valor:t.value,Peso:t.weightKg,Volume_M3:t.volumeM3,Pedidos:t.orders,Qtde:t.quantity,Clientes:t.groups,Lead_Time:t.serviceDays,OTIF:t.onTime??0,
      Ticket:t.value/(t.quantity||1),Toneladas:Math.fround(t.weightKg/1000),Valor_por_Kg:t.value/(t.weightKg||1),'R$/Ton':t.value/(Math.fround((t.weightKg||1)/1000)),
      ...t};
  });
  const current=valid.filter(row=>Number(row[column]?.slice(0,4))===year),prior=valid.filter(row=>Number(row[column]?.slice(0,4))===year-1 && (Number(row[column].slice(5,7))<month || (Number(row[column].slice(5,7))===month&&Number(row[column].slice(8,10))<=day)));
  const cy=summarize(current,area),py=summarize(prior,area),keys=['value','weightKg','volumeM3','quantity','orders','groups','ticket'];if(area==='faturados')keys.push('serviceDays','onTime');
  const comparisons=Object.fromEntries(keys.map(key=>[key,{previous:py[key],change:delta(cy[key],py[key]),year:year-1}]));
  const metrics=cards(s,keys,comparisons);
  const bestWorst={};
  for(const key of keys) {
    const candidates=monthly.filter(row=>row[key]!=null);if(!candidates.length)continue;
    const best=candidates.reduce((a,b)=>(key==='serviceDays'?b[key]<a[key]:b[key]>a[key])?b:a),worst=candidates.reduce((a,b)=>(key==='serviceDays'?b[key]>a[key]:b[key]<a[key])?b:a);
    const total=sum(candidates.map(row=>row[key]),{float32:['weightKg','volumeM3','quantity','serviceDays','onTime'].includes(key)}),average=mean(candidates.map(row=>row[key]),{float32:['weightKg','volumeM3','quantity','serviceDays','onTime'].includes(key)});
    bestWorst[key]={bestMonth:best.Mes_Ano,worstMonth:worst.Mes_Ano,best:best[key],worst:worst[key],average,
      bestContribution:total>0?best[key]/total*100:0,worstContribution:total>0?worst[key]/total*100:0,
      bestDeviation:average>0?(best[key]/average-1)*100:0,worstDeviation:average>0?(worst[key]/average-1)*100:0};
    metrics.find(card=>card.id===key).comparison={...comparisons[key],...bestWorst[key],value:comparisons[key].change,label:`vs ${year-1}`,format:'percent'};
    const chartFormat=formats[key],scale=value=>key==='onTime'&&value!=null?Math.fround(value*100):value;
    const supplementary=[{label:'Melhor Mês',value:best.Mes_Ano,format:'month'},{label:'Melhor Valor',value:scale(best[key]),format:chartFormat},{label:'Pior Mês',value:worst.Mes_Ano,format:'month'},{label:'Pior Valor',value:scale(worst[key]),format:chartFormat}];
    if(key==='serviceDays'||key==='onTime')supplementary.push({label:'Média Histórica Mensal',value:scale(average),format:chartFormat});
    if(key==='serviceDays')supplementary.push({label:'Melhor vs Média Histórica',value:bestWorst[key].bestDeviation,format:'percent'},{label:'Pior vs Média Histórica',value:bestWorst[key].worstDeviation,format:'percent'});
    else if(key!=='onTime')supplementary.push({label:'Participação do Melhor Mês',value:bestWorst[key].bestContribution,format:'percent'},{label:'Participação do Pior Mês',value:bestWorst[key].worstContribution,format:'percent'});
    metrics.find(card=>card.id===key).supplementary=supplementary;
  }
  const useHistory=Boolean(filters.billingRange||filters.emissionRange||filters.flt_fat||filters.flt_em||filters.faturamento||filters.emissao),comparisonBase=useHistory?history:valid;
  const historyMonths=new Map(groupRows(comparisonBase.filter(row=>row[column]),row=>row[column].slice(0,7)).map(({key,rows:items})=>[key,groupSum(items.map(row=>row[numericColumns(area).value]))]));
  const totalValue=sum(monthly.map(row=>row.Valor));let difference=0,previousSum=0;
  monthly.forEach(row=>{
    const [y,m]=row.Mes_Ano.split('-').map(Number);let previous=null;
    if(y===year)previous=m===month?sum(comparisonBase.filter(item=>Number(item[column]?.slice(0,4))===y-1&&Number(item[column].slice(5,7))===m&&Number(item[column].slice(8,10))<=day).map(item=>item[numericColumns(area).value])):historyMonths.get(`${y-1}-${String(m).padStart(2,'0')}`)??null;
    row.previousValue=previous;row.Diff_Raw=previous==null?0:row.Valor-previous;row['% Part']=totalValue>0?row.Valor/totalValue:0;
    if(previous!=null){difference+=row.Diff_Raw;previousSum+=previous;}
  });
  const years=[...new Set(monthly.map(row=>Number(row.Mes_Ano.slice(0,4))))].sort(),annual=[],annualMaps=new Map(),monthlyMaps=new Map(),tonMaps=new Map();
  for(const y of years){let value=0,weight=0;for(const row of monthly.filter(row=>Number(row.Mes_Ano.slice(0,4))===y)) {
    value+=row.Valor;weight=Math.fround(weight+row.Peso);const m=Number(row.Mes_Ano.slice(5,7)),ton=Math.fround(weight/1000),rton=ton?value/ton:0;
    const entry={year:y,month:m,Valor:row.Valor,Valor_Acum:value,Peso_Acum:weight,R_Ton_Acum:rton};annual.push(entry);
    annualMaps.set(`${y}-${m}`,value);monthlyMaps.set(`${y}-${m}`,row.Valor);tonMaps.set(`${y}-${m}`,rton);
  }}
  const presentMonths=new Set(current.map(row=>Number(row[column].slice(5,7)))),annualPrior=valid.filter(row=>Number(row[column]?.slice(0,4))===year-1&&((presentMonths.has(Number(row[column].slice(5,7)))&&Number(row[column].slice(5,7))<month)||(Number(row[column].slice(5,7))===month&&Number(row[column].slice(8,10))<=day)));
  const fullCurrent=monthly.filter(row=>Number(row.Mes_Ano.slice(0,4))===year),cv=sum(fullCurrent.map(row=>row.Valor)),cw=sum(fullCurrent.map(row=>row.Peso),{float32:true}),ps=summarize(annualPrior,area),cr=cw>0?cv/Math.fround(cw/1000):0,pr=ps.weightKg>0?ps.value/Math.fround(ps.weightKg/1000):0;
  if(years.includes(year-1)) {
    annualMaps.set(`${year-1}-${month}`,ps.value);tonMaps.set(`${year-1}-${month}`,pr);
    monthlyMaps.set(`${year-1}-${month}`,sum(annualPrior.filter(row=>Number(row[column].slice(5,7))===month).map(row=>row[numericColumns(area).value])));
    const priorEntry=annual.find(row=>row.year===year-1&&row.month===month);if(priorEntry)Object.assign(priorEntry,{Valor_Acum:ps.value,Peso_Acum:ps.weightKg,R_Ton_Acum:pr});
  }
  annual.forEach(row=>{row.monthlyGrowth=delta(row.Valor,monthlyMaps.get(`${row.year-1}-${row.month}`));row.accumulatedGrowth=delta(row.Valor_Acum,annualMaps.get(`${row.year-1}-${row.month}`));row.tonGrowth=delta(row.R_Ton_Acum,tonMaps.get(`${row.year-1}-${row.month}`));});
  const annualRows=Array.from({length:12},(_,index)=>{const m=index+1,out={month:m};for(const y of years){const row=annual.find(row=>row.year===y&&row.month===m);out[`monthly_${y}`]=row?.Valor??null;out[`cumulative_${y}`]=row?.Valor_Acum??null;out[`ton_${y}`]=row?.R_Ton_Acum??null;}return out;});
  const heatmapColumn=['Ano','Ano_Num','year'].includes(heatmapDimension)?'year':heatmapDimension;
  const heatmapMetric={value:'VALOR_FATURADO_CLEAN',weightKg:'PESO_FATURADO_CLEAN',quantity:'QUANTIDADE_FATURADA_CLEAN',volumeM3:'VOLUME_M3_FATURADO_CLEAN',orders:'CODIGO_PEDIDO'}[metric]??'VALOR_FATURADO_CLEAN';
  const heatmapFloat32=['weightKg','quantity','volumeM3'].includes(metric);
  let heat=groupRows(valid,row=>heatmapColumn==='year'?Number(row.DT_FATURA_DATE.slice(0,4)):row[heatmapColumn]).map(({key,rows:items})=>{
    const result={dimension:String(key)},groups=groupRows(items,row=>Number(row.DT_FATURA_DATE.slice(5,7)));for(const {key:month,rows:subset} of groups){let value=metric==='orders'?distinct(subset.map(row=>row.CODIGO_PEDIDO)):groupSum(subset.map(row=>row[heatmapMetric]),{float32:heatmapFloat32});if(metric==='weightKg')value=Math.fround(value/1000);result[`month_${month}`]=value;}result.total=sum(Object.entries(result).filter(([key])=>key.startsWith('month_')).map(([,value])=>value),{float32:heatmapFloat32});return result;
  });
  const months=[...new Set(valid.map(row=>Number(row.DT_FATURA_DATE.slice(5,7))))].sort((a,b)=>a-b);heat.forEach(row=>months.forEach(m=>row[`month_${m}`]??=0));
  heat=heatmapColumn==='year'?heat.sort((a,b)=>Number(a.dimension)-Number(b.dimension)):heat.sort((a,b)=>a.total-b.total).slice(-15);
  const totalQuantity=sum(monthly.map(row=>row.Qtde),{float32:true}),totalWeight=sum(monthly.map(row=>row.Peso),{float32:true});
  const total={Mes_Ano:'TOTAL',Valor:totalValue,Diff_Raw:difference,'% Part':1,Ticket:totalQuantity>0?totalValue/totalQuantity:0,'R$/Ton':totalWeight>0?totalValue/Math.fround(totalWeight/1000):0,
    Pedidos:s.orders,Qtde:totalQuantity,Peso:totalWeight,Volume_M3:sum(monthly.map(row=>row.Volume_M3),{float32:true}),Clientes:s.groups,Lead_Time:s.serviceDays,OTIF:s.onTime??0};
  const tableColumns=['Mes_Ano','Valor','% Part','Diff_Raw','Ticket','R$/Ton','Pedidos','Qtde','Peso','Volume_M3','Clientes'];if(area==='faturados')tableColumns.push('Lead_Time','OTIF');
  const series=[{id:'annualMonthly',title:'Evolução Mensal por Ano',type:'line',rows:annualRows,x:'month',y:years.map(year=>`monthly_${year}`),format:'currency'},
    {id:'annualCumulative',title:'Evolução Acumulada por Ano',type:'line',rows:annualRows,x:'month',y:years.map(year=>`cumulative_${year}`),format:'currency'},
    {id:'annualRevenuePerTon',title:'Comparativo Acumulado de Reais por Tonelada',type:'line',rows:annualRows,x:'month',y:years.map(year=>`ton_${year}`),format:'currency'}];
  for(const [id,title,key,type,format] of [['weight','Toneladas por Mês','Toneladas','bar','number'],['ticket','Ticket Médio por Mês','Ticket','line','currency'],['orders','Qtd Pedidos por Mês','Pedidos','bar','number'],['items','Qtd Itens por Mês','Qtde','bar','number'],['groups','Grupos Atendidos por Mês','Clientes','bar','number'],['valuePerKg','Média Mensal de Valor por kg','Valor_por_Kg','line','currency']])series.push({id,title,type,rows:monthly,x:'Mes_Ano',y:[key],format});
  if(area==='faturados')series.push({id:'service','Nível de Serviço':'Nível de Serviço',title:'Nível de Serviço por Mês',type:'line',rows:monthly,x:'Mes_Ano',y:['Lead_Time'],format:'days'},{id:'otif',title:'OTIF por Mês',type:'line',rows:monthly,x:'Mes_Ano',y:['OTIF'],format:'ratio'});
  series.push({id:'heatmap',title:'Mapa de Calor',type:'heatmap',rows:heat,x:'dimension',y:months.map(m=>`month_${m}`),format:metric==='value'?'currency':metric==='volumeM3'?'volume':'number'});
  return {metrics,series,tables:[{id:'monthly',title:'Tabela de Evolução Mensal',rows:monthly,columns:tableColumns.map(key=>({key,label:key,format:['Valor','Diff_Raw','Ticket','R$/Ton'].includes(key)?'currency':key==='Peso'?'weight':key==='Mes_Ano'?'text':['% Part','OTIF'].includes(key)?'ratio':'number'})),total,treeSpec:{columns:['Mes_Ano','SUPERVISOR','CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'],maxChildren:12,maxRoots:60}}],
    meta:{referenceDate:last,bestWorst,annual,annualGrowth:years.includes(year-1)?delta(cv,ps.value):null,annualDifference:ps.value>0?cv-ps.value:0,annualTonGrowth:years.includes(year-1)?delta(cr,pr):null,annualTonDifference:pr>0?cr-pr:0,comparisonYear:year-1,totalDifferencePercent:previousSum>0?difference/previousSum*100:null,previousSum,heatmap:{dimension:heatmapDimension,metric,months}}};
}

export function geographyAnalysis({area,rows,history=rows}) {
  const dimensions={UF:'Cobertura Estadual',CIDADE:'Cobertura Municipal',SUPERVISOR:'Supervisores Vinculados',CONSULTOR:'Consultores Vinculados'},valid=value=>value!=null&&value!==''&&value!=='nan';
  const metrics=Object.entries(dimensions).map(([key,label])=>({id:key.toLowerCase(),label,value:distinct(rows.map(row=>row[key]).filter(valid)),format:'number'}));
  const series=[];
  for(const dimension of ['UF','CIDADE','REGIAO_UF']) {
    const clean=rows.filter(row=>row[dimension]!=null&&valid(String(row[dimension]).trim()));
    series.push({id:`top10_${dimension}`,title:`Top 10 ${dimension}`,type:'bar',rows:rank(clean,dimension,'faturados',{trim:true}).slice(0,10).reverse(),x:dimension,y:['value'],format:'currency'});
  }
  const map=rank(rows.filter(row=>valid(row.UF)),'UF','faturados');series.push({id:'map',title:'Mapa Geográfico',type:'map',rows:map,x:'UF',y:['value'],format:'currency'});
  const column=dateColumn(area),last=maximum(rows,column),year=Number(last.slice(0,4)),current=rows.filter(row=>row[column]?.startsWith(String(year))),start=current.reduce((min,row)=>row[column]<min?row[column]:min,last);
  const ly=selectPeriod(history,column,start?shiftYear(start,-1):'',last?shiftYear(last,-1):'');
  return {metrics,series,tables:[],meta:{referenceDate:last,comparisonYear:year-1,comparisonPeriod:last?{start:shiftYear(start,-1),end:shiftYear(last,-1)}:null,previousRows:ly.length,dimensions:['UF','CIDADE','REGIAO_UF','MICRO_REGIAO']}};
}

export function buildCommercialDashboard(options) {
  if(!['emitidos','faturados'].includes(options.area))throw new RangeError('Área comercial inválida.');
  const rows=options.rows??[],history=options.history??rows;
  // Emitidos normally arrives mapped by the repository; accept native loader rows too.
  const mapped=items=>options.area==='emitidos' && items.length && !('DT_FATURA_DATE' in items[0] && 'VALOR_FATURADO_CLEAN' in items[0] && 'PESO_FATURADO_CLEAN' in items[0] && 'QUANTIDADE_FATURADA_CLEAN' in items[0])?items.map(row=>({...row,DT_FATURA_DATE:row.DT_FATURA_DATE??row.DATA_EMISSAO_PEDIDO_DATE,
    VALOR_FATURADO_CLEAN:row.VALOR_FATURADO_CLEAN??row.VALOR_EMITIDO_CLEAN,PESO_FATURADO_CLEAN:row.PESO_FATURADO_CLEAN??row.PESO_EMITIDO_CLEAN,
    QUANTIDADE_FATURADA_CLEAN:row.QUANTIDADE_FATURADA_CLEAN??row.QUANTIDADE_EMITIDA_CLEAN,VOLUME_M3_FATURADO_CLEAN:row.VOLUME_M3_FATURADO_CLEAN??row.VOLUME_M3_EMITIDO_CLEAN})):items;
  const args={...options,rows:mapped(rows),history:mapped(history)};
  const builders={semanal:weeklyAnalysis,mensal:monthlyAnalysis,resumo:monthlyAnalysis,evolucao:evolutionAnalysis,geografia:geographyAnalysis,carteira:buildCustomerDashboard};
  if(!builders[options.tab])throw new RangeError('Análise comercial inválida.');
  return builders[options.tab](args);
}
