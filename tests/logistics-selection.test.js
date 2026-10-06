import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formationTables,formationOrders,destinationSeries,destinationTable} from '../src/domain/logistics/formation.ts';
import {buildLogisticsDashboard} from '../api-server/domain/logistics.js';
const allocation=(id,order,item,qty)=>({id,item_id:item,pedido_id:order,quantidade_aberta:qty,quantidade_alocada:qty,quantidade_sem_carga:0,valor_aberto:qty*10,valor_em_carga:qty*10,valor_sem_carga:0,peso_aberto:qty*5,peso_em_carga:qty*5,peso_sem_carga:0,cubagem_em_carga:qty*.2,cubagem_sem_carga:0});
const order=(id,qty)=>({id:'pedido-'+id,pedido_id:id,uf:'SP',cidade:'Cidade A',cliente:'Cliente '+id,latitude:-23,longitude:-46,children:[allocation('item-'+id,id,'item1',qty)]});
const load=(id,rows)=>({id:'carga-'+id,carga_id:id,children:rows,pedidos:rows.length,quantidade_alocada:rows.flatMap(row=>row.children).reduce((sum,row)=>sum+row.quantidade_alocada,0)});
const tables=[{id:'orders',columns:[],rows:[order('1',10),order('2',4),{...order('3',2),children:[{...allocation('free','3','item3',2),quantidade_alocada:0,quantidade_sem_carga:2,cubagem_em_carga:0,cubagem_sem_carga:.4}]}]},
 {id:'loads',columns:[],rows:[load('A',[{pedido_id:'1',...{children:[allocation('a','1','item1',3)]},quantidade_alocada:3,valor_em_carga:30,peso_em_carga:15,cubagem_em_carga:.6},{pedido_id:'2',children:[allocation('b','2','item2',4)],quantidade_alocada:4,valor_em_carga:40,peso_em_carga:20,cubagem_em_carga:.8}]),load('B',[{pedido_id:'1',children:[allocation('c','1','item1',2)],quantidade_alocada:2,valor_em_carga:20,peso_em_carga:10,cubagem_em_carga:.4}])]}];
test('map preserves CEP provenance and selected-load amounts',()=>{
 const located=[{...tables[0],rows:tables[0].rows.map(row=>({...row,cep:'01001000',geo_origin:'CEP'}))},tables[1]];
 const map=destinationSeries(formationOrders(located,{kind:'load',id:'A'}));
 assert.equal(map.points[0].cep,'01001000');assert.equal(map.points[0].geo_origin,'CEP');
 assert.equal(map.points[0].valor_aberto,30);assert.equal(map.rows[0].value,70);
});
test('selecionar carga preserva tabela de origem e recorta somente seus vínculos, até o item',()=>{
 const result=formationTables(tables,{kind:'load',id:'A'});
 assert.equal(result.loads,tables[1]);assert.equal(result.orders.rows.length,2);
 assert.equal(result.orders.rows[0].quantidade_aberta,3);assert.equal(result.orders.rows[0].quantidade_sem_carga,0);
 assert.equal(result.orders.rows[0].children[0].id,'a');assert.equal(result.orders.total.quantidade_aberta,7);
 assert.equal(result.orders.total.valor_aberto,70);assert.equal(tables[0].rows[0].children[0].quantidade_aberta,10);
 const map=destinationSeries(formationOrders(tables,{kind:'load',id:'A'}));
 assert.equal(map.rows[0].orders,2);assert.equal(map.rows[0].value,70);assert.equal(map.points.length,2);
});
test('pedido dividido em cargas mantém apenas suas quantidades em cada carga',()=>{
 const result=formationTables(tables,{kind:'order',id:'1'});
 assert.equal(result.orders,tables[0]);assert.equal(result.loads.rows.length,2);
 assert.deepEqual(result.loads.rows.map(row=>row.quantidade_alocada),[3,2]);
 assert.equal(result.loads.total.quantidade_alocada,5);assert.equal(result.loads.total.valor_em_carga,50);
 assert.equal(result.loads.total.pedidos,1);
 assert.ok(result.loads.rows.every(row=>row.pedidos===1));
 assert.equal(destinationSeries(formationOrders(tables,{kind:'order',id:'1'})).rows[0].orders,1);
});
test('pedido sem carga exibe contraparte vazia; limpar restaura recorte; seleção obsoleta fica vazia',()=>{
 assert.equal(formationTables(tables,{kind:'order',id:'3'}).loads.rows.length,0);
 assert.equal(formationTables(tables,null).orders,tables[0]);
 assert.equal(formationTables(tables,{kind:'load',id:'X'}).orders.rows.length,0);
 assert.equal(destinationTable(tables[0].rows,'RJ').rows.length,0);
});

test('destinos agrupam cidades por UF e conservam totais sem duplicar pedidos',()=>{
 const rows=[order('1',10),{...order('2',4),cidade:'Cidade B'},{...order('3',2),uf:'RJ'}];
 const result=destinationTable(rows,'');
 assert.equal(result.rows.length,3);assert.equal(result.tree.length,2);
 const sp=result.tree.find(row=>row.uf==='SP');
 assert.equal(sp.pedidos,2);assert.equal(sp.children.length,2);assert.equal(sp.valor_aberto,140);
 assert.equal(result.total.pedidos,3);assert.equal(result.total.valor_aberto,160);
 assert.equal(destinationTable(rows,'SP').tree.length,1);
});
test('API identifica todos os vínculos e não acumula colunas entre requisições',()=>{
 const items=[{item_id:'7',pedido_id:'1',empresa_id:1,produto_id:9,emissao:'2026-01-01',quantidade_aberta:10,quantidade_alocada:5,quantidade_sem_carga:5,valor_aberto:100,valor_unitario:10,peso_unitario:5,cubagem_unitaria:.2,cliente:'Cliente 1',cidade:'Cidade A',uf:'SP'}];
 const allocations=[{alocacao_id:1,carga_id:'A',pedido_id:'1',item_id:'7',empresa_id:1,empresa_carga_id:1,quantidade_aberta:3},{alocacao_id:2,carga_id:'B',pedido_id:'1',item_id:'7',empresa_id:1,empresa_carga_id:1,quantidade_aberta:2}];
 const args={execution:{id:'test',data_referencia:'2026-09-30'},items,allocations};
 const first=buildLogisticsDashboard(args),second=buildLogisticsDashboard(args);
 assert.deepEqual(first.tables[0].columns,second.tables[0].columns);
 const child=first.tables[1].rows[0].children[0].children[0];
 assert.equal(child.pedido_id,'1');assert.equal(child.item_id,'7');assert.equal(child.carga_id,'A');
 assert.equal(child.quantidade_aberta,3);assert.equal(child.valor_aberto,30);assert.equal(child.cubagem_sem_carga,0);
 assert.equal(formationTables(first.tables,{kind:'load',id:'A'}).orders.total.quantidade_aberta,3);
});
