import test from 'node:test';
import assert from 'node:assert/strict';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
const module=await import('../api-server/domain/cohorts.js').catch(()=>({}));
const emission=(id,date,value=100,extra={})=>({CODIGO_PEDIDO:id,DATA_EMISSAO_PEDIDO_DATE:date,VALOR_EMITIDO_CLEAN:value,PESO_EMITIDO_CLEAN:value/10,VOLUME_M3_EMITIDO_CLEAN:value/100,UF:'SP',TIPO_ENTREGA:'ENTREGA',...extra});
const billing=(id,emitted,date,value=100,extra={})=>({CODIGO_PEDIDO:id,DATA_EMISSAO_PEDIDO_DATE:emitted,DT_FATURA_DATE:date,VALOR_FATURADO_CLEAN:value,PESO_FATURADO_CLEAN:value/10,VOLUME_M3_FATURADO_CLEAN:value/100,QUANTIDADE_FATURADA_CLEAN:value/10,UF:'SP',TIPO_ENTREGA:'ENTREGA',...extra});
const build=options=>{assert.equal(typeof module.buildCohortAnalysis,'function','published emissions must be the conversion denominator');return module.buildCohortAnalysis({referenceDate:'2026-09-30',...options});};

test('cohort conversion retains unbilled orders and counts partial invoices once across month boundaries',()=>{
 const data=build({emissionRows:[emission(1,'2026-08-28',100),emission(1,'2026-08-28',100),emission(2,'2026-08-31',200)],billingRows:[billing(1,'2026-08-28','2026-09-04',50),billing(1,'2026-08-28','2026-09-12',50),billing(99,'2026-07-01','2026-09-30',999)]});
 const row=data.rows[0];assert.equal(row.orders,2);assert.equal(row.value,400);assert.equal(row.weightKg,40);assert.equal(row.volumeM3,4);
 assert.deepEqual(row.windows.map(w=>[w.days,w.mature,w.ordersPercent,w.valuePercent,w.weightPercent,w.volumePercent]),[[7,true,50,12.5,12.5,12.5],[15,true,50,25,25,25],[30,true,50,25,25,25]]);
 assert.equal(row.windows[0].billedOrders,1);assert.equal(row.windows[1].billedValue,100);
});

test('immature cohorts never appear as zero conversion or exclude recent orders from the denominator',()=>{
 const data=build({emissionRows:[emission(1,'2026-09-01'),emission(2,'2026-09-30')],billingRows:[billing(1,'2026-09-01','2026-09-03'),billing(99,'2026-08-01','2026-09-30')]});
 const row=data.rows[0];assert.equal(row.orders,2);
 for(const w of row.windows){assert.equal(w.mature,false);assert.equal(w.valuePercent,null);assert.equal(w.ordersPercent,null);}
 assert.deepEqual(row.windows.map(w=>w.availableOn),['2026-10-07','2026-10-15','2026-10-30']);
});

test('each window matures independently at the last day of the emission month plus its duration',()=>{
 const data=build({referenceDate:'2026-09-15',emissionRows:[emission(1,'2026-08-31')],billingRows:[billing(1,'2026-08-31','2026-09-15')]});
 assert.deepEqual(data.rows[0].windows.map(w=>[w.days,w.mature,w.valuePercent]),[[7,true,0],[15,true,100],[30,false,null]]);
});

test('location and emission filters select the cohort without discarding later or differently located invoices',()=>{
 const emissionRows=[emission(1,'2026-08-28'),emission(2,'2026-08-28',300,{UF:'MG'})];
 const billingRows=[billing(1,'2026-08-28','2026-09-01',50,{UF:'MG'}),billing(2,'2026-08-28','2026-09-01',300),billing(99,'2026-07-01','2026-09-30')];
 const data=build({emissionRows,billingRows,filters:{dimensions:{UF:['SP']},emissionRange:['2026-08-01','2026-08-31'],billingRange:['2026-08-01','2026-08-31']}});
 assert.equal(data.rows[0].orders,1);assert.equal(data.rows[0].windows[0].valuePercent,50);assert.equal(data.billingRangeIgnored,true);
});

test('billing coverage limits observation even when the balance publication is more recent',()=>{
 const data=build({emissionRows:[emission(1,'2026-08-31')],billingRows:[billing(1,'2026-08-31','2026-09-14')]});
 assert.equal(data.observedThrough,'2026-09-14');assert.deepEqual(data.rows[0].windows.map(w=>w.mature),[true,false,false]);
 const empty=build({emissionRows:[emission(1,'2026-08-31')],billingRows:[]});
 assert.equal(empty.observedThrough,null);assert.ok(empty.rows[0].windows.every(w=>w.valuePercent===null));
});

test('zero bases stay unavailable and above-base billing remains visible for reconciliation',()=>{
 const data=build({emissionRows:[emission(1,'2026-08-01',100,{PESO_EMITIDO_CLEAN:0,VOLUME_M3_EMITIDO_CLEAN:0})],billingRows:[billing(1,'2026-08-01','2026-08-02',150),billing(99,'2026-07-01','2026-09-30')]});
 const w=data.rows[0].windows[0];assert.equal(w.valuePercent,150);assert.equal(w.weightPercent,null);assert.equal(w.volumePercent,null);assert.equal(w.exceedsBase,true);
});

test('invalid dates, conflicting emissions and invoices before the order are excluded with quality counts',()=>{
 const data=build({emissionRows:[emission(1,'2026-08-01'),emission(2,'2026-02-30'),emission(3,'2026-08-01'),emission(3,'2026-08-02'),emission(null,'2026-08-01')],billingRows:[billing(1,'2026-08-01','2026-07-31'),billing(1,'2026-08-01','2026-08-32'),billing(1,'2026-08-02','2026-08-03'),billing(99,'2026-07-01','2026-09-30')]});
 assert.equal(data.rows[0].orders,1);assert.equal(data.rows[0].windows[0].valuePercent,0);
 assert.equal(data.quality.invalidEmissionRows,2);assert.equal(data.quality.conflictingOrders,1);assert.equal(data.quality.invalidBillingRows,3);
});

test('empty filtered cohorts return an empty result and never mutate the published sources',()=>{
 const emissionRows=[Object.freeze(emission(1,'2026-08-01'))],billingRows=[Object.freeze(billing(1,'2026-08-01','2026-09-30'))];
 const data=build({emissionRows,billingRows,filters:{dimensions:{UF:['XX']}}});assert.deepEqual(data.rows,[]);
 build({emissionRows,billingRows});assert.equal(emissionRows[0].DATA_EMISSAO_PEDIDO_DATE,'2026-08-01');
});

test('cohort sources are read in one repeatable read transaction with one publication version',async()=>{
 const commands=[];let released=false;
 const meta={id:'same-publication',fim:'2026-10-01',origem:'Firebird'};
 const client={async query(sql){commands.push(sql);return {rows:sql.includes('etl.execucao_carga')?[meta]:sql.includes('dw.pedidos_emitidos')?[emission(1,'2026-08-01')]:sql.includes('dw.pedidos_faturados')?[billing(1,'2026-08-01','2026-09-30')]:[]};},release(){released=true;}};
 const repository=new PostgresRepository({async query(){return {rows:[meta]};},async connect(){return client;}});
 const data=await repository.snapshot('2026-09-30','strategic');
 assert.equal(data.version,'same-publication');assert.equal(data.frames.emitidos[0].VALOR_EMITIDO_CLEAN,100);assert.equal(data.frames.faturados[0].VALOR_FATURADO_CLEAN,100);
 assert.match(commands[0],/REPEATABLE READ READ ONLY/);assert.equal(commands.at(-1),'COMMIT');assert.equal(commands.filter(sql=>sql.startsWith('BEGIN')).length,1);assert.equal(released,true);
 for(const sql of commands.filter(sql=>sql.includes('dw.pedidos_'))){
  if(sql.includes('dw.pedidos_emitidos'))assert.ok(!sql.includes('"DESCRICAO_ITEM"'),'emission sources omit unused product descriptions');
  else assert.ok(!sql.includes('"DESCRICAO_ITEM"'),'initial billing omits product attributes reserved for dimensional analysis');
  for(const column of ['CODIGO_PEDIDO','CODIGO_ITEM','COR','CIDADE','UF','TIPO_ENTREGA','DATA_EMISSAO_PEDIDO_DATE','CONSULTOR','SUPERVISOR','GRUPO_CLIENTE'])assert.ok(sql.includes('"'+column+'"'),column+' remains available for measures, linking or exclusions');
 }
});

test('strategic dimension snapshot retains product and customer attributes',async()=>{
 const commands=[];
 const meta={id:'same-publication',fim:'2026-10-01',origem:'Firebird'};
 const client={async query(sql){commands.push(sql);return {rows:sql.includes('etl.execucao_carga')?[meta]:[]};},release(){}};
 const repository=new PostgresRepository({async query(){return {rows:[meta]};},async connect(){return client;}});
 await repository.snapshot('2026-09-30','strategic-analysis');
 const billingSQL=commands.find(sql=>sql.includes('dw.pedidos_faturados'));
 assert.match(billingSQL,/"DESCRICAO_ITEM"/);
 assert.match(billingSQL,/"CLIENTE"/);
});

test('unknown delivery labels normalize identically in emitted rows and the selected filter',()=>{
 const emissionRows=['NONE','Não informado','não informado',null,''].map((TIPO_ENTREGA,index)=>emission(index+1,'2026-08-01',100,{TIPO_ENTREGA}));
 const data=build({emissionRows,billingRows:[billing(99,'2026-07-01','2026-09-30')],filters:{dimensions:{TIPO_ENTREGA:['Não informado']}}});
 assert.equal(data.rows[0]?.orders,5,'all spellings of an unknown modality must survive its filter');
 assert.equal(data.rows[0].windows[0].valuePercent,0);
});
test('historical orders outside the cohort window are checked for conflicting dates without calculating their amounts',()=>{
 const old=emission(9,'2024-08-01');
 Object.defineProperty(old,'VALOR_EMITIDO_CLEAN',{get(){throw new Error('outside-window amounts must not be accumulated');}});
 const data=build({emissionRows:[old,emission(1,'2024-08-01'),emission(1,'2026-08-01'),emission(2,'2026-08-01')],billingRows:[billing(2,'2026-08-01','2026-08-05'),billing(99,'2024-08-01','2026-09-30')]});
 assert.equal(data.quality.conflictingOrders,1);
 assert.equal(data.rows[0].orders,1);assert.equal(data.rows[0].value,100);assert.equal(data.rows[0].windows[0].valuePercent,100);
});
