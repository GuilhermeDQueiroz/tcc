import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {buildCommercialDashboard} from '../api-server/domain/commercial.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../.local/${name}.json`,import.meta.url)));
const oracle=read('normalized-reference-comercial');
function close(actual,expected,path) {
  if(typeof expected==='number')assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<=Math.max(1e-6,Math.abs(expected)*1e-8),`${path}: ${actual} != ${expected}`);
  else assert.equal(actual,expected,path);
}
function compareRows(actual,expected,keys,path) {assert.equal(actual.length,expected.length,`${path} count`);expected.forEach((row,index)=>keys.forEach(key=>close(actual[index][key],row[key],`${path}[${index}].${key}`)));}
function originalHeatmaps(area) {
  const root=fileURLToPath(new URL('../',import.meta.url)),legacy=path.resolve(root,'../legacy');
  // Reproduce the original pandas pivot on cached DW records, retaining loader dtypes.
  const script=`import json,sys,pandas as pd
df=pd.DataFrame(json.load(open(sys.argv[1],encoding='utf8')))
area=sys.argv[2]
date='DATA_EMISSAO_PEDIDO_DATE' if area=='emitidos' else 'DT_FATURA_DATE'
suffix='EMITIDO' if area=='emitidos' else 'FATURADO'
df[date]=pd.to_datetime(df[date])
df['Ano_Num']=df[date].dt.year
df['month']=df[date].dt.month
out={}
for dimension,metric in [('UF','value'),('Ano_Num','orders'),('UF','volumeM3'),('UF','weightKg')]:
    column={'value':'VALOR_'+suffix+'_CLEAN','orders':'CODIGO_PEDIDO','volumeM3':'VOLUME_M3_'+suffix+'_CLEAN','weightKg':'PESO_'+suffix+'_CLEAN'}[metric]
    if metric in ['volumeM3','weightKg']: df[column]=df[column].astype('float32')
    pivot=df.groupby([dimension,'month'])[column].agg('nunique' if metric=='orders' else 'sum').unstack().fillna(0)
    if metric=='weightKg': pivot=pivot/1000
    pivot['total']=pivot.sum(axis=1)
    if dimension=='Ano_Num': pivot=pivot.sort_index()
    else: pivot=pivot.sort_values('total').tail(15)
    out[metric]=[{'dimension':str(index),**{('total' if month=='total' else 'month_'+str(month)):float(value) for month,value in row.items()}} for index,row in pivot.iterrows()]
print(json.dumps(out))`;
  const result=spawnSync(path.join(legacy,'.venv/Scripts/python.exe'),['-c',script,path.join(root,`.local/normalized-history-${area}.json`),area],{encoding:'utf8',env:{...process.env,PYTHONIOENCODING:'utf-8'}});
  assert.equal(result.status,0,result.stderr);
  return JSON.parse(result.stdout);
}
test('as análises comerciais expõem o serviço puro para registros reais', async () => {
  const module = await import('../api-server/domain/commercial.js').catch(() => ({}));
  assert.equal(typeof module.buildCommercialDashboard, 'function');
});
for(const area of ['emitidos','faturados']) {
  const rows=read(`normalized-${area}`),history=read(`normalized-history-${area}`);
  const ref=tab=>oracle.captures[`${area}.agosto.${tab}`];
  let heatmaps;
  const expectedHeatmaps=()=>heatmaps??=originalHeatmaps(area);
  test(`${area}: dimensão própria do mapa de calor prevalece sobre a análise por dimensão`,()=>{
    const payload=buildCommercialDashboard({area,tab:'evolucao',rows:history,dimension:'CONSULTOR',heatmapDimension:'UF',metric:'value'});
    compareRows(payload.series.find(series=>series.id==='heatmap').rows,expectedHeatmaps().value,['dimension','month_8','total'],'heatmap UF');
    assert.equal(payload.meta.heatmap.dimension,'UF');
  });
  test(`${area}: Ano_Num da API mantém os dois anos reais ordenados e pedidos distintos`,()=>{
    const payload=buildCommercialDashboard({area,tab:'evolucao',rows:history,dimension:'UF',heatmapDimension:'Ano_Num',metric:'orders'});
    assert.deepEqual(payload.series.find(series=>series.id==='heatmap').rows,expectedHeatmaps().orders);
    assert.equal(payload.meta.heatmap.dimension,'Ano_Num');
  });
  for(const metric of ['volumeM3','weightKg'])test(`${area}: mapa de calor usa ${metric} real e precisão float32 do pandas`,()=>{
    const payload=buildCommercialDashboard({area,tab:'evolucao',rows:history,dimension:'UF',heatmapDimension:'UF',metric});
    assert.deepEqual(payload.series.find(series=>series.id==='heatmap').rows,expectedHeatmaps()[metric]);
    assert.equal(payload.meta.heatmap.metric,metric);
  });
  test(`${area}: metas diárias, acumulados e projeção preservam o original em agosto real`,()=>{
    const original=ref('mensal');assert.ok(original,'oracle mensal real disponível');
    const payload=buildCommercialDashboard({area,tab:'mensal',rows,history,referenceDate:oracle.referenceDate,goalsConfig:{'2026-08':{financeira:original.META_FINANCEIRA,peso:original.META_PESO}}});
    const metrics=Object.fromEntries(payload.metrics.map(card=>[card.id,card.value]));
    for(const [key,source]of Object.entries({value:'fat_mes',weightKg:'peso_mes',volumeM3:'m3_mes',quantity:'qtde_itens',orders:'total_pedidos',groups:'grupos_clientes',ticket:'ticket_medio',projection:'projecao_mes'}))close(metrics[key],original[source],key);
    for(const [key,source]of Object.entries({presentDays:'n_dias',goalDays:'dias_meta_total',totalGoal:'meta_total_fat',accumulatedGoal:'meta_acum_fat',weightTotalGoal:'meta_total_peso',weightAccumulatedGoal:'meta_acum_peso',dailyAverage:'media_diaria',remainingDays:'dias_restantes'}))close(payload.meta[key],original[source],key);
    compareRows(payload.tables.find(table=>table.id==='daily').rows,original.daily_df,['Valor','Peso','Meta Financeira','Meta Peso','Pct_Fat','Pct_Peso','Dif_Fat','Dif_Peso','Valor_Acum','Meta_Fat_Acum','Peso_Acum_t','Meta_Peso_Acum_t'],'daily');
    compareRows(payload.series.find(series=>series.id==='yearComparisonDaily').rows,original.comp_df,['Dia','Ano Atual','Ano Anterior','Projecao Atual','Ano_Anterior_Acum','Ano_Atual_Acum','Projecao_Acum'],'comparison');
  });
  test(`${area}: três semanas e canais usam totais reais e pedidos distintos`,()=>{
    const original=ref('semanal');assert.ok(original,'oracle semanal disponível');
    const payload=buildCommercialDashboard({area,tab:'semanal',rows,history,referenceDate:oracle.referenceDate});
    ['atual','passada','retrasada'].forEach((period,index)=>{
      for(const [key,prefix]of Object.entries({value:'v',weightKg:'p',quantity:'items',orders:'q',groups:'groups',volumeM3:'m3'}))close(payload.meta.periodTotals[index][key],original[`${prefix}_sem_${period}`],`${period}.${key}`);
      for(const [name,source]of [['Varejo','var'],['E-commerce','ecom']])for(const [key,prefix]of Object.entries({value:'v',weightKg:'p',quantity:'items',orders:'q',groups:'groups'}))close(payload.meta.channels[name][index][key],original[`${prefix}_${source}_${period}`],`${name}.${period}.${key}`);
    });
    const top=payload.tables.find(table=>table.id==='top5_0').rows;
    compareRows(top,original.top_cli_at,['GRUPO_CLIENTE'],'top5');
    original.top_cli_at.forEach((row,index)=>{for(const [key,alias]of Object.entries({value:'Valor',weightKg:'Peso',quantity:'Qtd_Itens',orders:'Qtd_Pedidos'}))close(top[index][key],row[alias],`top5.${key}`);});
    for(const [index,name,suffix]of [[1,'Semana Anterior','sem'],[2,'Semana Retrasada','ret']]) {
      const branch=oracle.captures[`${area}.agosto.semanal.${name}`];assert.ok(branch,`oracle ${name}`);
      const ranking=payload.tables.find(table=>table.id===`top5_${index}`).rows,expected=branch[`top_cli_${suffix}`];
      compareRows(ranking,expected,['GRUPO_CLIENTE'],name);
      expected.forEach((row,index)=>{for(const [key,alias]of Object.entries({value:'Valor',weightKg:'Peso',quantity:'Qtd_Itens',orders:'Qtd_Pedidos'}))close(ranking[index][key],row[alias],`${name}.${key}`);});
    }
  });
  test(`${area}: evolução conserva somas agrupadas, serviço por registro e totalizador`,()=>{
    const original=ref('evolucao');assert.ok(original,'oracle evolução disponível');
    const payload=buildCommercialDashboard({area,tab:'evolucao',rows,history,filters:{flt_fat:true},referenceDate:oracle.referenceDate});
    compareRows(payload.tables[0].rows,original.mensal_ev,['Mes_Ano','Valor','Peso','Volume_M3','Pedidos','Qtde','Clientes','Lead_Time','OTIF','Ticket','Toneladas','Valor_por_Kg','Diff_Raw','% Part','R$/Ton'],'monthly');
    for(const key of ['Valor','Diff_Raw','% Part','Ticket','R$/Ton','Pedidos','Qtde','Peso','Volume_M3','Clientes','Lead_Time','OTIF'])close(payload.tables[0].total[key],original.tot_dict[key],`total.${key}`);
  });
  test(`${area}: intervalo da API mantém histórico não temporal na comparação anual`,()=>{
    const source=ref('mensal');
    const payload=buildCommercialDashboard({area,tab:'evolucao',rows,history,filters:area==='emitidos'?{emissionRange:['2026-08-01','2026-08-31']}:{billingRange:['2026-08-01','2026-08-31']},referenceDate:oracle.referenceDate});
    close(payload.tables[0].rows[0].previousValue,source.last_year_fat,'previousValue');
  });
  test(`${area}: cobertura geográfica conserva os distintos originais`,()=>{
    const original=ref('geografia');assert.ok(original,'oracle geográfico real disponível');
    const payload=buildCommercialDashboard({area,tab:'geografia',rows,history,referenceDate:oracle.referenceDate});
    const metrics=Object.fromEntries(payload.metrics.map(card=>[card.id,card.value]));
    for(const [key,source]of Object.entries({uf:'states',cidade:'cities',supervisor:'supervisores',consultor:'consultores'}))close(metrics[key],original[source],`coverage.${key}`);
    if(original.prev_min)assert.equal(payload.meta.comparisonPeriod.start,original.prev_min.slice(0,10));
    if(original.prev_max)assert.equal(payload.meta.comparisonPeriod.end,original.prev_max.slice(0,10));
  });
}
