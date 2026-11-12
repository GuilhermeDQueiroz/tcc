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
 assert.equal(open.metrics.find(m=>m.id==='posvenda.documents').value,1);assert.equal(open.metrics.find(m=>m.id==='posvenda.quantity').value,6);
 assert.equal(open.metrics.find(m=>m.id==='posvenda.value').value,30);assert.equal(open.total,2);
 assert.equal(open.metrics.find(m=>m.id==='posvenda.aged').value,1,'age is reference minus emission; duplicate items count one document');
 const issued=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'emitidas'}});
 assert.equal(issued.metrics[0].value,2);assert.equal(issued.metrics.find(m=>m.id==='posvenda.quantity').value,30);assert.equal(issued.total,3);
});
test('billed assistance uses the published billed balance and original emission period',()=>{
 const rows=[
  assistance(1,{quantidade_faturada:'4',valor_unitario:'10',peso_unitario:2,volume_unitario:.5}),
  assistance(2,{documento_id:11,quantidade_faturada:'0'}),
  assistance(3,{documento_id:12,quantidade_faturada:'2',valor_unitario:null,data:'2026-07-01'})
 ];
 const billed=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{view:'faturadas',start:'2026-08-01'}});
 assert.equal(billed.total,1);
 assert.equal(billed.metrics.find(card=>card.id==='posvenda.quantity').value,4);
 assert.equal(billed.metrics.find(card=>card.id==='posvenda.value').value,40);
 assert.equal(billed.metrics.find(card=>card.id==='posvenda.documents').value,1);
 assert.equal(billed.series[0].title,'Quantidade faturada por mês de emissão');
 assert.equal(billed.assistance,undefined);
});
test('assistance cancellation is scoped by origin type and counts event quantities',()=>{
 const rows=[
  assistance(1,{categoria:'cancelamentos',documento_id:20,modalidade:'Venda',quantidade:3,valor:30}),
  assistance(2,{categoria:'cancelamentos',documento_id:21,modalidade:'Assistência',quantidade:2,valor:20})
 ];
 const cancelled=buildAftersalesDashboard({execution,rows,area:'cancelamentos',query:{kind:'Assistência'}});
 assert.equal(cancelled.total,1);
 assert.equal(cancelled.metrics.find(card=>card.id==='posvenda.quantity').value,2);
 assert.equal(cancelled.metrics.find(card=>card.id==='posvenda.value').value,20);
});
test('cancellation counts events and affected sales separately and never sums cumulative balances',()=>{
 const rows=[assistance(1,{categoria:'cancelamentos',documento_id:20,quantidade:2,valor:20,quantidade_cancelada:9}),assistance(2,{categoria:'cancelamentos',documento_id:21,quantidade:3,valor:30,quantidade_cancelada:9})];
 const data=buildAftersalesDashboard({execution,rows,area:'cancelamentos',query:{}});
 const orders=data.metrics.find(m=>m.id==='posvenda.orders');
 assert.equal(orders.supplementary[0].value,2);assert.equal(orders.value,1);
 assert.equal(data.metrics.find(m=>m.id==='posvenda.quantity').value,5);assert.equal(data.metrics.find(m=>m.id==='posvenda.value').value,50);
});
test('cancellation cards and analysis use event quantities and valid elapsed days from original sales',()=>{
 const cancellation=(id,extra)=>assistance(id,{categoria:'cancelamentos',documento_id:id,data:'2026-09-15',
  emissao_original:'2026-08-15',quantidade:2,valor:20,peso_unitario:3,volume_unitario:.5,grupo_cliente:'Grupo A',...extra});
 const rows=[
  cancellation(1,{}),
  cancellation(2,{valor:0}),
  cancellation(3,{pedido_id:11,emissao_original:'2026-08-16',grupo_cliente:'Grupo B'}),
  cancellation(4,{pedido_id:12,emissao_original:'2026-09-16'}),
  cancellation(5,{pedido_id:13,emissao_original:null})
 ];
 const data=buildAftersalesDashboard({execution,rows,area:'cancelamentos',query:{dimension:'aging',pageSize:1}});
 const cards=Object.fromEntries(data.metrics.map(card=>[card.id.replace('posvenda.',''),card.value]));
 assert.deepEqual(cards,{value:80,weightKg:30,volumeM3:5,quantity:10,orders:4,groups:2,serviceDays:92/3,orders30:1,value30:20});
 assert.equal(data.quality.missingLeadTime,2);
 assert.equal(data.table.rows.length,1);
 assert.equal(data.analysis.table.rows.find(row=>row.label==='Não informado').orders,2);
 const reasons=data.series.find(series=>series.id==='posvenda.reasons');
 assert.deepEqual(Object.keys(reasons.metricOptions),['value','weightKg','volumeM3','quantity','orders']);
 assert.deepEqual(reasons.nonAdditiveMetrics,['orders']);
 assert.equal(reasons.rows[0].orders,4);
 const unknown=buildAftersalesDashboard({execution,rows:rows.slice(3),area:'cancelamentos'});
 assert.equal(unknown.metrics.find(card=>card.id==='posvenda.orders30').value,null);
});
test('open assistance cards and chart measures reconcile pending items, distinct documents and the strict 30 day cut',()=>{
 const rows=[
  assistance(1,{data:'2026-08-30',valor_aberto:20,peso_unitario:2,volume_unitario:.5,grupo_cliente:'Grupo A'}),
  assistance(2,{data:'2026-08-30',valor_aberto:0,peso_unitario:0,volume_unitario:.5,grupo_cliente:'Grupo A'}),
  assistance(3,{documento_id:11,data:'2026-08-31',valor_aberto:10,peso_unitario:1,volume_unitario:null,grupo_cliente:'Grupo B'}),
  assistance(4,{documento_id:12,quantidade_aberta:0,valor_aberto:100,peso_unitario:1,grupo_cliente:'Grupo C'}),
 ];
 const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{pageSize:1}});
 const cards=Object.fromEntries(data.metrics.map(card=>[card.id.replace('posvenda.',''),card]));
 assert.deepEqual(Object.keys(cards),['value','weightKg','volumeM3','quantity','documents','groups','serviceDays','aged','value30']);
 assert.equal(cards.weightKg.value,9);
 assert.equal(cards.volumeM3.value,null);
 assert.equal(cards.groups.value,2);
 assert.equal(cards.serviceDays.value,92/3);
 assert.equal(cards.documents.value,2);
 assert.equal(cards.aged.value,1);
 assert.equal(cards.aged.supplementary[0].value,50);
 assert.equal(cards.value30.value,20);
 assert.equal(cards.value30.supplementary[0].value,20/30*100);
 assert.equal(data.table.rows.length,1);
 const forecast=data.assistance.forecast.rows[0];
 assert.deepEqual([forecast.value,forecast.quantity,forecast.documents,forecast.weightKg,forecast.volumeM3],[30,9,2,9,null]);
 assert.equal(data.assistance.forecast.metricOptions.documents,'documents');
 assert.equal(data.series.find(series=>series.id==='posvenda.states').rows[0].documents,2);
 assert.equal(data.series.find(series=>series.id==='posvenda.states').dimension,'uf');
 assert.equal(data.series.find(series=>series.id==='posvenda.reasons').dimension,'reason');
 assert.equal(data.series.find(series=>series.id==='posvenda.products').dimension,'product');
});
test('returns keep assistance and sales documents identifiable; filters and pagination preserve totals',()=>{
 const rows=[assistance(1,{categoria:'devolucoes',tipo_documento:1,modalidade:'Venda'}),assistance(2,{categoria:'devolucoes',documento_id:11,tipo_documento:2,modalidade:'Assistência',uf:'SP'})];
 const data=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{uf:'SP',page:1,pageSize:20}});
 assert.equal(data.total,1);assert.equal(data.table.rows[0].modalidade,'Assistência');
 assert.equal(data.metrics.find(card=>card.id==='posvenda.orders').supplementary[0].value,1);
 const empty=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{start:'2026-09-01'}});
 assert.equal(empty.total,0);assert.equal(empty.metrics[0].value,0);
});
test('return cards distinguish original sales and assistance from return documents and keep the strict event-date threshold',()=>{
 const make=(id,extra)=>assistance(id,{categoria:'devolucoes',documento_id:id,data:'2026-09-15',
  emissao_original:'2026-08-15',quantidade:2,valor:20,peso_unitario:3,volume_unitario:.5,modalidade:'Venda',grupo_cliente:'Grupo A',...extra});
 const rows=[
  make(1,{}),
  make(2,{valor:0}),
  make(3,{pedido_id:11,modalidade:'Assistência',emissao_original:'2026-08-16'}),
  make(4,{pedido_id:12,modalidade:'Assistência',emissao_original:null,volume_unitario:null})
 ];
 const data=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{dimension:'aging',pageSize:1}});
 const cards=Object.fromEntries(data.metrics.map(card=>[card.id.replace('posvenda.',''),card]));
 assert.equal(cards.orders.label,'Qtd documentos de origem');
 assert.equal(cards.orders.value,3);
 assert.equal(cards.orders.supplementary[0].value,4);
 assert.equal(cards.orders30.value,1);
 assert.equal(cards.value30.value,20);
 assert.equal(cards.serviceDays.value,92/3);
 assert.equal(cards.weightKg.value,24);
 assert.equal(cards.volumeM3.value,null);
 assert.equal(data.quality.missingLeadTime,1);
 assert.equal(data.table.columns.find(column=>column.key==='pedido_id').label,'Documento de origem');
 assert.equal(data.analysis.table.rows.find(row=>row.label==='Não informado').orders,1);
 assert.equal(data.series[0].metricLabels.orders,'Quantidade de documentos de origem');
 const assistanceOnly=buildAftersalesDashboard({execution,rows,area:'devolucoes',query:{kind:'Assistência'}});
 assert.equal(assistanceOnly.metrics.find(card=>card.id==='posvenda.orders30').value,0);
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
 assert.match(sql,/e\.tipo_docfat IN \(1,2\) AND e\.opcao_docfat=2/);
 assert.match(sql,/o\.tipo_docfat=e\.tipo_docfat AND o\.opcao_docfat=1/);
 assert.match(sql,/v\.opcaodocumento_docentdev=4 AND t\.tipo_docent=1/);
 assert.ok(sql.indexOf('COMMIT')>sql.indexOf('INSERT INTO posvenda.publicacao'));
});

test('month, ISO week and day preserve filtered quantities and fill empty periods',()=>{
 const rows=[assistance(1,{data:'2026-08-30'}),assistance(2,{data:'2026-08-31'}),assistance(3,{data:'2026-09-01'})];
 for(const granularity of ['month','week','day']){
  const data=buildAftersalesDashboard({execution,rows,area:'assistencias',query:{start:'2026-08-30',end:'2026-09-03',granularity}});
  const trend=data.series.find(series=>series.id==='posvenda.monthly');
  assert.equal(trend.rows.reduce((sum,row)=>sum+row.quantity,0),9);assert.equal(data.meta.granularity,granularity);
  if(granularity==='week')assert.deepEqual(trend.rows.map(row=>row.period),['2026-08-24','2026-08-31']);
  if(granularity==='day'){assert.equal(trend.rows.length,5);assert.equal(trend.rows.at(-1).quantity,0);}
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

test('every post-sale dimension tree expands documents into their published item records',()=>{
 for(const area of ['assistencias','cancelamentos','devolucoes']){
  const rows=[assistance(101,{categoria:area,documento_id:50,produto_id:10,produto:'Mesa'}),
   assistance(102,{categoria:area,documento_id:50,produto_id:10,produto:'Mesa'})];
  const data=buildAftersalesDashboard({execution,rows,area,query:{dimension:'client'}});
  const document=data.analysis.table.tree[0].children[0];
  assert.equal(document.col_name,'document');
  assert.equal(document.children.length,2,`${area}: distinct records of the same product remain separate`);
  assert.ok(document.children.every(item=>item.col_name==='item'&&item.children.length===0));
  assert.deepEqual(document.children.map(item=>item.label).sort(),[
   'Item 10 - Mesa · Registro 101','Item 10 - Mesa · Registro 102']);
  assert.equal(document.children.reduce((total,item)=>total+item.quantity,0),document.quantity);
  assert.equal(document.children.reduce((total,item)=>total+item.value,0),document.value);
  assert.deepEqual(data.analysis.hierarchy.slice(-2),['document','item']);
  for(const option of data.analysis.options){
   const selected=buildAftersalesDashboard({execution,rows:rows.slice(0,1),area,query:{dimension:option.id}});
   let branch=selected.analysis.table.tree;
   for(const level of selected.analysis.hierarchy){assert.equal(branch.length,1,`${area}/${option.id}/${level}`);assert.equal(branch[0].col_name,level);branch=branch[0].children;}
  }
 }
 const custom=buildAftersalesDashboard({execution,rows:[assistance(1,{produto_id:9})],area:'assistencias',query:{dimension:'uf',hierarchy:'uf,client'}});
 assert.deepEqual(custom.analysis.hierarchy,['uf','client','document','item']);
 assert.equal(custom.analysis.table.tree[0].children[0].children[0].children[0].col_name,'item');
 assert.deepEqual(validateAftersalesQuery('assistencias',{dimension:'uf',hierarchy:'uf,document,item'}).hierarchy,'uf,document,item');
 assert.throws(()=>validateAftersalesQuery('assistencias',{dimension:'uf',hierarchy:'uf,region,delivery,status,supervisor,consultant,clientGroup'}),{status:400});
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
