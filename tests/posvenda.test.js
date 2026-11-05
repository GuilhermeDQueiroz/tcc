import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAftersalesDashboard,validateAftersalesQuery} from '../api-server/domain/posvenda.js';
import {AftersalesRepository} from '../api-server/repositories/posvenda.js';
import {createApp} from '../api-server/app.js';
import {readFileSync} from 'node:fs';

const execution={id:'publication',data_inicio:'2025-01-01',data_referencia:'2026-09-30',fim:'2026-10-26T12:00:00Z'};
const assistance=(id,extra={})=>({categoria:'assistencias',registro_id:id,documento_id:10,pedido_id:10,data:'2026-08-01',quantidade:'10',quantidade_aberta:'3',quantidade_faturada:'7',valor:'100',valor_aberto:'30',cliente:'Cliente anonimizado',produto:'Item A',uf:'MG',cidade:'Ubá',motivo:'Reparo',previsao:'2026-09-01',...extra});
test('assistance open and emitted use distinct quantities and distinct document counts, including zero values',()=>{
 const rows=[assistance(1),assistance(2,{valor:'0',valor_aberto:'0'}),assistance(3,{documento_id:11,pedido_id:11,quantidade_aberta:'0',valor_aberto:'0'})];
 const open=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'abertas'}});
 assert.equal(open.metrics[0].value,1);assert.equal(open.metrics.find(m=>m.id==='posvenda.quantity').value,6);
 assert.equal(open.metrics.find(m=>m.id==='posvenda.value').value,30);assert.equal(open.total,2);
 assert.equal(open.metrics.find(m=>m.id==='posvenda.aged').value,1,'age is reference minus emission; duplicate items count one document');
 const issued=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'emitidas'}});
 assert.equal(issued.metrics[0].value,2);assert.equal(issued.metrics.find(m=>m.id==='posvenda.quantity').value,30);assert.equal(issued.total,3);
});
test('cancellation counts events and affected sales separately and never sums cumulative balances',()=>{
 const rows=[assistance(1,{categoria:'cancelamentos',documento_id:20,quantidade:2,valor:20,quantidade_cancelada:9}),assistance(2,{categoria:'cancelamentos',documento_id:21,quantidade:3,valor:30,quantidade_cancelada:9})];
 const data=buildAftersalesDashboard({execution,rows,area:'cancelamentos',query:{}});
 assert.equal(data.metrics[0].value,2);assert.equal(data.metrics.find(m=>m.id==='posvenda.orders').value,1);
 assert.equal(data.metrics.find(m=>m.id==='posvenda.quantity').value,5);assert.equal(data.metrics.find(m=>m.id==='posvenda.value').value,50);
});
test('returns keep assistance and sales documents identifiable; filters and pagination preserve totals',()=>{
 const rows=[assistance(1,{categoria:'devolucoes',tipo_documento:1,modalidade:'Venda'}),assistance(2,{categoria:'devolucoes',documento_id:11,tipo_documento:2,modalidade:'Assistência',uf:'SP'})];
 const data=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{uf:'SP',page:1,pageSize:20}});
 assert.equal(data.total,1);assert.equal(data.table.rows[0].modalidade,'Assistência');assert.equal(data.metrics[0].value,1);
 const empty=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{start:'2026-09-01'}});
 assert.equal(empty.total,0);assert.equal(empty.metrics[0].value,0);
});
test('missing monetary measures remain unavailable and unknown dimensions stay visible',()=>{
 const data=buildAftersalesDashboard({execution,rows:[assistance(1,{valor_aberto:null,motivo:null})],area:'assistencias',query:{view:'abertas'}});
 assert.equal(data.metrics.find(m=>m.id==='posvenda.value').value,null);
 assert.equal(data.quality.missingValues,1);assert.equal(data.series.find(s=>s.id==='posvenda.reasons').rows[0].label,'Não informado');
});
test('query rejects unknown areas, SQL-like sorting, malformed dates, inverted ranges and invalid paging',()=>{
 for(const [area,query] of [['other',{}],['assistencias',{sort:'drop table'}],['assistencias',{start:'2026-02-30'}],['assistencias',{start:'2026-09-30',end:'2026-09-01'}],['cancelamentos',{view:'abertas'}],['devolucoes',{page:'0'}],['devolucoes',{pageSize:'10000000'}],['devolucoes',{unexpected:'x'}]])assert.throws(()=>validateAftersalesQuery(area,query),{status:400});
});

test('aftersales reads one consistent publication and never serves cached facts after publication disappears',async()=>{
 const commands=[];let published=true,released=0;
 const client={async query(sql){commands.push(sql);return {rows:sql.includes('to_regclass')?[{available:true}]:sql.includes('JOIN posvenda.execucao')?(published?[execution]:[]):sql.includes('FROM posvenda.registro')?[assistance(1)]:[]};},release(){released++;}};
 const repository=new AftersalesRepository({async connect(){return client;}});
 const first=await repository.getDashboard('assistencias',{view:'abertas'});assert.equal(first.total,1);
 assert.match(commands[0],/REPEATABLE READ READ ONLY/);assert.equal(commands.at(-1),'COMMIT');
 published=false;await assert.rejects(()=>repository.getDashboard('assistencias',{}),{status:409});assert.equal(commands.at(-1),'ROLLBACK');assert.equal(released,2);
});

test('aftersales HTTP validates filters before reading a database and reports absent publications explicitly',async()=>{
 let connections=0;
 const pool={async connect(){connections++;return {async query(sql){return {rows:sql.includes('to_regclass')?[{available:false}]:[]};},release(){}};}};
 const app=createApp({repository:{pool},logger:{error(){}}});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const url='http://127.0.0.1:'+server.address().port;
 try{
  assert.equal((await fetch(url+'/api/v1/posvenda/assistencias?sort=unsafe')).status,400);assert.equal(connections,0);
  const response=await fetch(url+'/api/v1/posvenda/assistencias');assert.equal(response.status,409);assert.match((await response.json()).error,/publicado/);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('native aftersales SQL uses distinct event bridges and never substitutes return header zeros for returned items',()=>{
 const sql=readFileSync('etl/sql/posvenda/002_publicar.sql','utf8');
 assert.match(sql,/v\.autoinc_docdev,e\.codigo_docfat,o\.codigo_docfat/);
 assert.match(sql,/v\.autoinc_docentdev,d\.codigo_docfat,o\.codigo_docfat/);
 assert.match(sql,/t\.autoinc_docent=v\.autoincdocent_docentdev/);
 assert.match(sql,/i\.autoinc_docitemdet=t\.autoincitemdetdoc_docent/);
 assert.match(sql,/e\.tipo_docfat=1 AND e\.opcao_docfat=2/);
 assert.match(sql,/v\.opcaodocumento_docentdev=4 AND t\.tipo_docent=1/);
 assert.ok(sql.indexOf('COMMIT')>sql.indexOf('INSERT INTO posvenda.publicacao'));
});

test('month, ISO week and day preserve filtered quantities and fill empty periods',()=>{
 const rows=[assistance(1,{data:'2026-08-30'}),assistance(2,{data:'2026-08-31'}),assistance(3,{data:'2026-09-01'})];
 for(const granularity of ['month','week','day']){
  const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{start:'2026-08-30',end:'2026-09-03',granularity}});
  const trend=data.series.find(series=>series.id==='posvenda.monthly');
  assert.equal(trend.rows.reduce((sum,row)=>sum+row.value,0),9);assert.equal(data.meta.granularity,granularity);
  if(granularity==='week')assert.deepEqual(trend.rows.map(row=>row.period),['2026-08-24','2026-08-31']);
  if(granularity==='day'){assert.equal(trend.rows.length,5);assert.equal(trend.rows.at(-1).value,0);}
 }
});

test('dimension analysis groups all filtered records independently of detail pagination and retains missing measures',()=>{
 const rows=[assistance(1,{cliente_id:1,uf:'MG'}),assistance(2,{cliente_id:2,uf:'SP',valor_aberto:null}),assistance(3,{cliente_id:1,uf:'MG'})];
 const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{dimension:'uf',page:2,pageSize:1}});
 assert.equal(data.analysis.table.rows.length,2);assert.equal(data.analysis.table.total.documents,1,'documents may span groups and must not be added twice in the total');
 assert.equal(data.analysis.table.total.quantity,9);assert.equal(data.analysis.table.total.value,null);
 assert.equal(data.analysis.table.rows.find(row=>row.label==='MG').quantity,6);
 const clients=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{dimension:'client'}});
 assert.equal(clients.analysis.table.rows.length,2,'identical anonymized labels do not merge distinct client IDs');
 assert.equal(clients.analysis.table.rows.reduce((sum,row)=>sum+row.quantity,0),9);
 for(const query of [{granularity:'year'},{dimension:'unsafe'},{forecastDate:'2026-02-30'},{section:'unknown'}])assert.throws(()=>validateAftersalesQuery('assistencias',query),{status:400});
 assert.equal(validateAftersalesQuery('cancelamentos',{dimension:'forecastStatus'}).dimension,'forecastStatus');
});

test('post-sale dimensions preserve the order of Abertos, real physical measures and distinct hierarchy totals',()=>{
 const rows=[assistance(1,{pedido_id:1,cliente_id:1,peso_unitario:2,volume_unitario:.1,supervisor:'S',consultor:'C',grupo_cliente:'G'}),assistance(2,{pedido_id:1,cliente_id:1,peso_unitario:2,volume_unitario:.1,uf:'SP',supervisor:'S',consultor:'C',grupo_cliente:'G'})];
 const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{dimension:'supervisor'}});
 const ids=data.analysis.options.map(option=>option.id);
 assert.deepEqual(ids.slice(0,8),['month','forecastMonth','uf','region','delivery','status','supervisor','consultant']);
 assert.ok(ids.indexOf('productGroup')<ids.indexOf('subgroup'));assert.ok(ids.indexOf('aging')<ids.indexOf('city'));
 assert.equal(data.analysis.table.total.weightKg,12);assert.ok(Math.abs(data.analysis.table.total.volumeM3-.6)<1e-12);
 assert.equal(data.analysis.table.total.quantity,6);assert.equal(data.analysis.table.total.documents,1);assert.equal(data.analysis.table.total.orders,1);
 assert.equal(data.analysis.table.tree[0].children[0].label,'C');
 assert.equal(data.analysis.table.tree[0].share,1);
 for(const query of [{metric:'unsafe'},{dimension:'uf',hierarchy:'uf,uf'},{dimension:'uf',hierarchy:'client,uf'},{dimension:'uf',hierarchy:'uf,unsafe'}])assert.throws(()=>validateAftersalesQuery('assistencias',query),{status:400});
 const missing=buildAftersalesDashboard({execution,rows:[assistance(3,{peso_unitario:null,volume_unitario:null})],area:'assistencias',query:{}});
 assert.equal(missing.analysis.table.total.weightKg,null);assert.equal(missing.analysis.table.total.volumeM3,null);
});

test('hierarchy remainder groups preserve amounts and quantities without inflating distinct documents',()=>{
 const rows=Array.from({length:45},(_,i)=>assistance(i,{pedido_id:1,cliente_id:i,uf:'MG'}));
 const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{dimension:'uf',hierarchy:'uf,client'}});
 const children=data.analysis.table.tree[0].children;
 assert.equal(children.length,21);assert.match(children.at(-1).label,/Outros/);
 assert.equal(children.reduce((sum,row)=>sum+row.quantity,0),135);
 assert.equal(children.reduce((sum,row)=>sum+row.value,0),1350);
 assert.equal(data.analysis.table.total.documents,1);
});

test('assistance aging, forecast calendar and forecast status reconcile pending quantities even in the issued view',()=>{
 const rows=[assistance(1,{documento_id:1,previsao:'2026-09-29'}),assistance(2,{documento_id:2,previsao:'2026-09-30'}),assistance(3,{documento_id:3,previsao:'2026-10-05'}),assistance(4,{documento_id:4,previsao:null}),assistance(5,{documento_id:5,quantidade_aberta:0})];
 const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'emitidas'}});
 const extra=data.assistance;
 assert.equal(extra.forecast.rows.reduce((sum,row)=>sum+row.value,0),9);
 assert.equal(extra.forecastStatus.rows.reduce((sum,row)=>sum+row.value,0),12);
 assert.equal(extra.forecastStatus.rows.find(row=>row.label==='Sem previsão').value,3);
 assert.equal(extra.aging.rows.reduce((sum,row)=>sum+row.value,0),50,'issued aging uses emitted quantities, while forecast always describes pending balances');
 const day=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'emitidas',forecastDate:'2026-09-29'}});
 assert.equal(day.total,1);assert.equal(day.table.rows[0].documento_id,1);
 assert.equal(day.assistance.forecast.rows[0].documents,1);
});
