import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCommercialDashboard} from '../api-server/domain/commercial.js';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
import {filterRows} from '../api-server/domain/filters.js';
const profile=await import('../api-server/domain/billing-logistics.js').catch(()=>({}));
const row=(overrides={})=>({CODIGO_PEDIDO:1,GRUPO_CLIENTE:'Grupo A',CLIENTE:'Cliente A',UF:'SP',CIDADE:'Cidade A',REGIAO_UF:'Sudeste',TIPO_ENTREGA:'ENTREGA',CONSULTOR:'A',SUPERVISOR:'A',DT_FATURA_DATE:'2026-09-28',DATA_EMISSAO_PEDIDO_DATE:'2026-09-01',VALOR_FATURADO_CLEAN:100,PESO_FATURADO_CLEAN:1000,VOLUME_M3_FATURADO_CLEAN:2,QUANTIDADE_FATURADA_CLEAN:10,NIVEL_DE_SERVICO_CLEAN:27,ON_TIME_CLEAN:1,...overrides});
const rows=[row(),row({CODIGO_PEDIDO:1,TIPO_ENTREGA:'RETIRADA',VALOR_FATURADO_CLEAN:50,PESO_FATURADO_CLEAN:500,VOLUME_M3_FATURADO_CLEAN:1,NIVEL_DE_SERVICO_CLEAN:27,ON_TIME_CLEAN:0}),row({CODIGO_PEDIDO:2,DT_FATURA_DATE:'2026-09-29',UF:'MG',CIDADE:'Cidade B',TIPO_ENTREGA:null,VALOR_FATURADO_CLEAN:25,PESO_FATURADO_CLEAN:250,VOLUME_M3_FATURADO_CLEAN:0.5,NIVEL_DE_SERVICO_CLEAN:28,ON_TIME_CLEAN:1})];
function build(tab,items=rows,extra={}){
 assert.equal(typeof profile.buildBillingLogisticsDashboard,'function');
 const context={area:'faturados',referenceDate:'2026-09-30',tab,rows:items,history:items,metric:'weightKg',heatmapDimension:'UF',...extra};
 const original=buildCommercialDashboard(context),before=structuredClone(original);
 const result=profile.buildBillingLogisticsDashboard(original,context);
 assert.deepEqual(original,before,'profile must preserve the commercial calculation for other consumers');
 return result;
}
test('monthly logistics preserves physical totals and partial billing, without sales targets',()=>{
 const result=build('mensal'),cards=new Map(result.metrics.map(m=>[m.id,m]));
 assert.deepEqual(result.metrics.slice(0,3).map(m=>m.id),['weightKg','volumeM3','orders']);
 assert.equal(cards.get('weightKg').value,1750);assert.equal(cards.get('volumeM3').value,3.5);assert.equal(cards.get('orders').value,2);
 assert.equal(cards.get('serviceDays').value,Math.fround(82/3));
 assert.equal(cards.get('onTime').value,Math.fround(Math.fround(2/3)*100));
 assert.ok(!cards.has('ticket')&&!cards.has('projection'));
 assert.ok(!result.series.some(s=>s.type==='gauge'||s.title.includes('Meta')));
 const daily=result.tables.find(t=>t.id==='billingDaily');
 assert.equal(daily.rows[0].orders,1);assert.equal(daily.rows[0].volumeM3,3);
 assert.equal(daily.total.orders,2);assert.equal(daily.total.serviceDays,Math.fround(82/3));
 assert.deepEqual(result.tables.find(t=>t.id==='billingModalities').rows.map(r=>r.TIPO_ENTREGA),['ENTREGA','Não informado','RETIRA']);
});
test('weekly logistics shows service and physical flows instead of consultant rankings',()=>{
 const result=build('semanal');
 assert.equal(result.metrics.find(m=>m.id==='serviceDays').value,Math.fround(82/3));
 assert.ok(result.series.some(s=>s.id==='billingVolumeDaily'));
 assert.ok(!result.tables.some(t=>/consultor|supervisor|top5/i.test(t.id)));
 assert.equal(result.tables.find(t=>t.id==='billingDaily').total.orders,2);
});
test('geography ranks the full population by the chosen logistics metric',()=>{
 const items=Array.from({length:12},(_,i)=>row({CODIGO_PEDIDO:i,UF:`UF${i}`,VALOR_FATURADO_CLEAN:1000-i,PESO_FATURADO_CLEAN:i+1,VOLUME_M3_FATURADO_CLEAN:i+1}));
 const result=build('geografia',items,{metric:'volumeM3'}),rank=result.series.find(s=>s.id==='top10_UF');
 assert.deepEqual(rank.y,['volumeM3']);assert.equal(rank.rows.at(-1).UF,'UF11');
 assert.equal(result.series.find(s=>s.id==='map').rows.length,12);
 assert.ok(!result.metrics.some(m=>['supervisor','consultor'].includes(m.id)));
});
test('evolution retains billing timeliness and cubage; empty results do not fabricate performance',()=>{
 const result=build('evolucao');
 assert.ok(result.series.some(s=>s.id==='billingVolumeMonthly'&&s.rows[0].Volume_M3===3.5));
 assert.equal(result.series.find(s=>s.id==='otif').title,'Faturamento no prazo por mês');
 assert.ok(!result.tables[0].columns.some(c=>['Ticket','R$/Ton'].includes(c.key)));
 const empty=build('mensal',[]);assert.deepEqual(empty.metrics,[]);assert.deepEqual(empty.series,[]);assert.deepEqual(empty.tables,[]);
 assert.deepEqual(build('evolucao',[]).series,[]);
});
test('repository applies the logistics profile only to faturados and respects metric selection',async()=>{
 const repository=new PostgresRepository(null);
 repository.getVersion=async()=> 'controlled-test';
 repository.snapshot=async()=>({version:'controlled-test',frames:{faturados:rows,emitidos:rows,carteira:[],metas:[]}});
 const context={area:'faturados',referenceDate:'2026-09-30',filters:{},dimension:'UF',metric:'volumeM3'};
 const result=await repository.getDashboard(context,'mensal');
 assert.equal(result.meta.focus,'logistics');
 const table=result.tables.find(t=>t.id==='faturados.dimensoes.UF');
 assert.equal(table.tree[0].children[0].col_name,'CIDADE');
 const dimensional=await repository.getDashboard(context,'dimensoes');
 const chart=dimensional.series.find(s=>s.id.endsWith('.evolucao'));
 assert.equal(chart.format,'volume');assert.equal(chart.rows.reduce((s,r)=>s+r.value,0),3.5);
 const byModality=await repository.getDashboard({...context,dimension:'TIPO_ENTREGA'},'dimensoes');
 assert.equal(byModality.tables[0].total.Qtd_Pedidos,2,'partial billing in two categories counts once in the total');
 assert.equal(byModality.tables[0].total.Grupos_Atendidos,1);
 const emitted=await repository.getDashboard({...context,area:'emitidos'},'mensal');
 assert.ok(emitted.series.some(s=>s.id==='financialGoal'));
 assert.equal(emitted.meta.focus,undefined);
});
test('weekly period without invoices cannot leak the old financial charts or rankings',()=>{
 const result=build('semanal',rows,{referenceDate:'2026-09-15'});
 assert.equal(result.meta.billingRecords,0);
 assert.ok(!result.series.some(s=>s.id.startsWith('daily_')||s.id.startsWith('cumulative_')));
 assert.ok(!result.tables.some(t=>/consultor|supervisor|top5/i.test(t.id)));
 assert.equal(result.metrics.find(m=>m.id==='weightKg').help.includes('faturad'),true);
});
test('geographic drilldown keeps every original ERP label behind a trimmed destination',()=>{
 const items=[row({CIDADE:'Cidade A '}),row({CODIGO_PEDIDO:2,CIDADE:'Cidade A'})];
 const result=build('geografia',items),city=result.series.find(s=>s.id==='top10_CIDADE').rows[0];
 assert.deepEqual(city.filterValues,['Cidade A ','Cidade A']);
 assert.equal(filterRows(items,{dimensions:{CIDADE:city.filterValues}}).length,2);
});
