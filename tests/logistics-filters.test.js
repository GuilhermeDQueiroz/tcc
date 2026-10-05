import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLogisticsDashboard} from '../api-server/domain/logistics.js';
import {createApp} from '../api-server/app.js';

const items=[
 {pedido_id:1,item_id:11,produto_id:101,produto:'Mesa',empresa_id:1,cliente:'Cliente A',uf:'SP',cidade:'São Paulo',emissao:'2026-09-01',previsao_faturamento:'2026-09-29',quantidade_aberta:10,quantidade_alocada:6,quantidade_sem_carga:4,valor_aberto:100,valor_unitario:10,peso_unitario:5,cubagem_unitaria:.2},
 {pedido_id:1,item_id:12,produto_id:102,produto:'Cadeira',empresa_id:1,cliente:'Cliente A',uf:'SP',cidade:'São Paulo',emissao:'2026-09-01',previsao_faturamento:'2026-09-29',quantidade_aberta:2,quantidade_alocada:2,quantidade_sem_carga:0,valor_aberto:20,valor_unitario:10,peso_unitario:5,cubagem_unitaria:.2},
 {pedido_id:2,item_id:21,produto_id:102,produto:'Cadeira',empresa_id:1,cliente:'Cliente B',uf:'MG',cidade:'Belo Horizonte',emissao:'2026-09-10',previsao_faturamento:'2026-09-30',quantidade_aberta:5,quantidade_alocada:5,quantidade_sem_carga:0,valor_aberto:100,valor_unitario:20,peso_unitario:10,cubagem_unitaria:.5},
 {pedido_id:3,item_id:31,produto_id:103,produto:'Sofá',empresa_id:2,cliente:'Cliente C',uf:'RJ',cidade:'Rio de Janeiro',emissao:'2026-09-20',previsao_faturamento:null,quantidade_aberta:3,quantidade_alocada:0,quantidade_sem_carga:3,valor_aberto:null,valor_unitario:null,peso_unitario:null,cubagem_unitaria:null},
 {pedido_id:4,item_id:41,produto_id:104,produto:'Armário',empresa_id:2,cliente:'Cliente D',uf:'SC',cidade:'Joinville',emissao:'2026-09-20',previsao_faturamento:'2026-10-05',quantidade_aberta:2,quantidade_alocada:0,quantidade_sem_carga:2,valor_aberto:80,valor_unitario:40,peso_unitario:8,cubagem_unitaria:1},
];
const allocations=[
 {alocacao_id:1,carga_id:50,pedido_id:1,item_id:11,empresa_id:1,empresa_carga_id:1,quantidade_aberta:6,inicio_separacao:'2026-09-28'},
 {alocacao_id:2,carga_id:51,pedido_id:1,item_id:12,empresa_id:1,empresa_carga_id:1,quantidade_aberta:2,liberacao_saida:'2026-09-29'},
 {alocacao_id:3,carga_id:51,pedido_id:2,item_id:21,empresa_id:1,empresa_carga_id:1,quantidade_aberta:5,liberacao_saida:'2026-09-29'},
];
const dashboard=filters=>buildLogisticsDashboard({execution:{id:'filters',data_referencia:'2026-09-30'},items,allocations,filters});
const ids=filters=>dashboard(filters).tables[0].rows.map(row=>row.pedido_id);

test('multiple destinations and clients combine with OR within a field and AND between fields',()=>{
 assert.deepEqual(ids({uf:['SP','MG'],client:['Cliente B','Cliente C']}),['2']);
 assert.deepEqual(ids({city:['São Paulo','Joinville']}),['1','4']);
 assert.deepEqual(ids({uf:'SP'}),['1']);
});
test('product and load stage filters preserve complete orders and their allocation totals',()=>{
 const data=dashboard({product:['101'],loadStage:'Em separação'});
 assert.deepEqual(data.tables[0].rows.map(row=>row.pedido_id),['1']);
 assert.equal(data.tables[0].rows[0].children.length,2);
 assert.equal(data.meta.openQuantity,12);assert.equal(data.meta.allocationQuantity,8);assert.equal(data.meta.freeQuantity,4);
 assert.deepEqual(data.tables[1].rows.map(row=>row.carga_id),['50','51']);
 assert.deepEqual(ids({loadStage:'Saída liberada'}),['1','2']);
 assert.deepEqual(ids({loadStage:'Conferência concluída'}),[]);
});
test('forecast situation includes undated orders and boundaries at the publication reference',()=>{
 assert.deepEqual(ids({forecastStatus:'overdue'}),['1']);
 assert.deepEqual(ids({forecastStatus:'today'}),['2']);
 assert.deepEqual(ids({forecastStatus:'upcoming'}),['4']);
 assert.deepEqual(ids({forecastStatus:'undated'}),['3']);
});
test('minimum available quantity, volume, weight and value exclude unknown measures',()=>{
 assert.deepEqual(ids({freeQuantityMin:4}),['1']);
 assert.deepEqual(ids({freeVolumeMin:1}),['4']);
 assert.deepEqual(ids({freeWeightMin:20}),['1']);
 assert.deepEqual(ids({orderValueMin:100}),['1','2']);
 assert.deepEqual(ids({freeVolumeMin:0}),['1','2','4']);
});
test('filter options remain available after applying a narrow or empty cut',()=>{
 const data=dashboard({client:['missing']});
 assert.deepEqual(data.options.clients,['Cliente A','Cliente B','Cliente C','Cliente D']);
 assert.deepEqual(data.options.products,['101','102','103','104']);
 assert.deepEqual(data.options.loadStages,['Em separação','Saída liberada']);
});
test('HTTP validates and forwards operational filters, including repeated categories and zero',async()=>{
 let received;
 const app=createApp({logisticsRepository:{async getDashboard(filters){received=filters;return dashboard(filters);}}});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 const base=`http://127.0.0.1:${server.address().port}/api/v1/logistica/formacao`;
 try{
  const response=await fetch(base+'?uf=SP&uf=MG&client=Cliente+B&product=102&loadStage=Sa%C3%ADda+liberada&forecastStatus=today&freeVolumeMin=0');
  assert.equal(response.status,200);assert.deepEqual(received.uf,['SP','MG']);assert.equal(received.freeVolumeMin,0);
  assert.deepEqual((await response.json()).tables[0].rows.map(row=>row.pedido_id),['2']);
  for(const query of ['freeVolumeMin=-1','freeWeightMin=NaN','orderValueMin=Infinity','freeQuantityMin=','forecastStatus=invalid','loadStage=invalid','client[x]=A','product='+('x'.repeat(151))]){
   assert.equal((await fetch(base+'?'+query)).status,400,query);
  }
 }finally{await new Promise(resolve=>server.close(resolve));}
});
