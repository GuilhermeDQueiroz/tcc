import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formationTables,formationMetrics,groupLoadTable,formationOrders,destinationSeries,destinationTable} from '../src/domain/logistics/formation.ts';
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
test('seleção de pedido atualiza os cards com seu saldo completo e carga usa só suas parcelas',()=>{
 const metrics=['orders','none','partial','full','loads','free','valueLoad','valueFree','weightLoad','weightFree','cubeLoad','cubeFree'].map(id=>({id:'logistica.'+id,label:id,value:999}));
 const orderMetrics=Object.fromEntries(formationMetrics(metrics,tables,{kind:'order',id:'1'}).map(metric=>[metric.id,metric.value]));
 assert.equal(orderMetrics['logistica.orders'],1);
 assert.equal(orderMetrics['logistica.loads'],2);
 assert.equal(orderMetrics['logistica.none'],0);
 const loadMetrics=Object.fromEntries(formationMetrics(metrics,tables,{kind:'load',id:'A'}).map(metric=>[metric.id,metric.value]));
 assert.equal(loadMetrics['logistica.orders'],2);
 assert.equal(loadMetrics['logistica.loads'],1);
 assert.equal(Object.hasOwn(loadMetrics,'logistica.valueFree'),false);
 assert.equal(formationMetrics(metrics,tables,null),metrics);
});
test('cargas agrupam por grupo de cliente antes de pedido e preservam as parcelas',()=>{
 const input={...tables[1],rows:[{...tables[1].rows[0],children:[
  {...tables[1].rows[0].children[0],grupo_cliente:'Grupo Alfa'},
  {...tables[1].rows[0].children[1],grupo_cliente:'Grupo Alfa'}]}]};
 const grouped=groupLoadTable(input);
 assert.equal(grouped.rows[0].children.length,1);
 assert.equal(grouped.rows[0].children[0].identificacao,'Grupo Grupo Alfa');
 assert.equal(grouped.rows[0].children[0].pedidos,2);
 assert.equal(grouped.rows[0].children[0].valor_em_carga,70);
 assert.equal(grouped.rows[0].children[0].children[0].children[0].id,'a');
 assert.equal(grouped.rows[0].children[0]._selectable,false);
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
 const items=[{item_id:'7',pedido_id:'1',empresa_id:1,produto_id:9,produto:'Cadeira',cor_codigo:3,cor_descricao:'Azul',grupo_cliente:'8 - Varejo',emissao:'2026-01-01',quantidade_aberta:10,quantidade_alocada:5,quantidade_sem_carga:5,valor_aberto:100,valor_unitario:10,peso_unitario:5,cubagem_unitaria:.2,cliente:'Cliente 1',cidade:'Cidade A',uf:'SP'}];
 const allocations=[{alocacao_id:1,carga_id:'A',pedido_id:'1',item_id:'7',empresa_id:1,empresa_carga_id:1,quantidade_aberta:3,previsao_faturamento:'2026-10-02'},{alocacao_id:2,carga_id:'B',pedido_id:'1',item_id:'7',empresa_id:1,empresa_carga_id:1,quantidade_aberta:2,previsao_faturamento:'2026-10-04'}];
 const args={execution:{id:'test',data_referencia:'2026-09-30'},items,allocations};
 const first=buildLogisticsDashboard(args),second=buildLogisticsDashboard(args);
 assert.deepEqual(first.tables[0].columns,second.tables[0].columns);
 const child=first.tables[1].rows[0].children[0].children[0];
 assert.equal(child.pedido_id,'1');assert.equal(child.item_id,'7');assert.equal(child.carga_id,'A');
 assert.equal(child.quantidade_aberta,3);assert.equal(child.valor_aberto,30);assert.equal(child.cubagem_sem_carga,0);
 assert.equal(first.tables[0].rows[0].children[0].identificacao,'9 - Cadeira · 3 - Azul');
 assert.equal(first.tables[0].rows[0].children[0].produto,'Cadeira');
 assert.equal(child.produto,'Cadeira');
 assert.equal(first.tables[1].rows[0].children[0].previsao,'2026-10-02');
 assert.equal(first.tables[1].rows[0].children[0].grupo_cliente,'8 - Varejo');
 assert.equal(child.identificacao,'9 - Cadeira · 3 - Azul');
 assert.ok(first.tables.every(table=>table.columns.some(column=>column.key==='produto')));
 assert.equal(formationTables(first.tables,{kind:'load',id:'A'}).orders.total.quantidade_aberta,3);
 const selectedLoad=Object.fromEntries(formationMetrics(first.metrics,first.tables,{kind:'load',id:'A'}).map(metric=>[metric.id,metric.value]));
 assert.equal(selectedLoad['logistica.valueLoad'],30);
 assert.equal(selectedLoad['logistica.orders'],1);
 const selectedOrder=Object.fromEntries(formationMetrics(first.metrics,first.tables,{kind:'order',id:'1'}).map(metric=>[metric.id,metric.value]));
 assert.equal(selectedOrder['logistica.valueLoad'],50);
 assert.equal(selectedOrder['logistica.valueFree'],50);
 assert.equal(selectedOrder['logistica.loads'],2);
});
