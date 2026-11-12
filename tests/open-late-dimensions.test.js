import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDimensionDashboard,OPEN_DRILLDOWN} from '../api-server/domain/dimensions.js';
import {buildOpenDashboard} from '../api-server/domain/open.js';
const rows=[[1,'SP',61,100],[1,'SP',80,50],[2,'MG',60,200],[3,'MG',61,300],[3,'SP',61,20]].map(([CODIGO_PEDIDO,UF,NIVEL_DE_SERVICO_CLEAN,VALOR_EM_ABERTO_CLEAN])=>({CODIGO_PEDIDO,UF,NIVEL_DE_SERVICO_CLEAN,VALOR_EM_ABERTO_CLEAN,DATA_EMISSAO_PEDIDO_DATE:'2026-06-01',GRUPO_CLIENTE:'Grupo',CLIENTE:'Cliente',PESO_EM_ABERTO_CLEAN:10,QTDEABERTA_DOCITEMDET_CLEAN:1,VOLUME_M3_EM_ABERTO_CLEAN:1}));
test('late open-order dimension counts match cards and recompute distinct totals across overlapping groups and hierarchy levels',()=>{
 const input={rows,referenceDate:'2026-09-30'},overview=buildOpenDashboard(input),table=buildDimensionDashboard({...input,area:'abertos',dimension:'UF',hierarchy:['UF','CODIGO_PEDIDO']}).tables[0];
 assert.equal(table.total.Pedidos_60,overview.metrics.find(row=>row.id==='abertos.resumo.orders60').value);
 assert.equal(table.total.Valor_60,overview.metrics.find(row=>row.id==='abertos.resumo.value60').value);
 assert.equal(table.total.Pedidos_60,2);assert.equal(table.total.Valor_60,470);
 assert.equal(table.rows.find(row=>row.UF==='SP').Pedidos_60,2);assert.equal(table.rows.find(row=>row.UF==='MG').Pedidos_60,1);
 assert.equal(table.tree.find(row=>row.UF==='SP').children.find(row=>row.CODIGO_PEDIDO===1).Valor_60,150);
 assert.ok(table.columns.some(column=>column.key==='Pedidos_60'));assert.ok(table.columns.some(column=>column.key==='Valor_60'));
 const filtered=buildDimensionDashboard({...input,rows:rows.filter(row=>row.UF==='MG'),area:'abertos',dimension:'UF'}).tables[0];assert.equal(filtered.total.Pedidos_60,1);assert.equal(filtered.total.Valor_60,300);
});
test('R$/TON uses value divided by total tonnes in the card, dimension and chart',()=>{
 const input={rows,referenceDate:'2026-09-30'};
 const overview=buildOpenDashboard(input);
 const card=overview.metrics.find(metric=>metric.id==='abertos.resumo.revenuePerTon');
 assert.equal(card.value,670/(50/1000));
 const dimension=buildDimensionDashboard({...input,area:'abertos',dimension:'UF',metric:'revenuePerTon',chartType:'bar'});
 assert.equal(dimension.tables[0].total['R$/Ton'],card.value);
 assert.equal(dimension.tables[0].rows.find(row=>row.UF==='SP')['R$/Ton'],170/(30/1000));
 assert.equal(dimension.tables[0].rows.find(row=>row.UF==='MG')['R$/Ton'],500/(20/1000));
 assert.equal(dimension.series[0].y[0],'R$/Ton');
 assert.equal(dimension.series[0].format,'currency');
 const withoutWeight=rows.map(row=>({...row,PESO_EM_ABERTO_CLEAN:0}));
 assert.equal(buildOpenDashboard({...input,rows:withoutWeight}).metrics.find(metric=>metric.id==='abertos.resumo.revenuePerTon').value,null);
 assert.equal(buildDimensionDashboard({...input,rows:withoutWeight,area:'abertos',dimension:'UF'}).tables[0].total['R$/Ton'],null);
});
test('open-order dimension drills from the selected category through delivery, team, orders and order items',()=>{
 const base={...rows[0],REGIAO_UF:'SUDESTE',TIPO_ENTREGA:'ENTREGA',SUPERVISOR:'Supervisor',CONSULTOR:'Consultor',GRUPO_CLIENTE:'Grupo',CODIGO_ITEM:10,DESCRICAO_ITEM:'Mesa',COR:'Azul'};
 const source=[...Array.from({length:25},(_,index)=>({...base,CODIGO_PEDIDO:index+1})),
  {...base,CODIGO_PEDIDO:1,VALOR_EM_ABERTO_CLEAN:50},
  {...base,CODIGO_PEDIDO:1,CODIGO_ITEM:11,DESCRICAO_ITEM:'Cadeira',COR:'Preta',VALOR_EM_ABERTO_CLEAN:75}];
 const table=buildDimensionDashboard({rows:source,area:'abertos',dimension:'REGIAO_UF',referenceDate:'2026-09-30'}).tables[0];
 const expected=['REGIAO_UF',...OPEN_DRILLDOWN];
 let branch=table.tree[0];
 for(const key of expected){assert.equal(branch.col_name,key);if(key!=='ITEM_PEDIDO')branch=branch.children[0];}
 const group=table.tree[0].children[0].children[0].children[0].children[0];
 assert.equal(group.children.length,25,'every order remains available');
 const order=group.children.find(node=>node.CODIGO_PEDIDO===1);
 assert.equal(order.Valor,225);assert.equal(order.children.length,2);
 assert.equal(order.children.find(node=>node.name.includes('Item 10')).Valor,150);
 assert.equal(order.children.find(node=>node.name.includes('Item 11')).Valor,75);
 assert.equal(table.tree[0].Valor,table.total.Valor);
 const missing=buildDimensionDashboard({rows:[{...base,SUPERVISOR:null}],area:'abertos',dimension:'UF',referenceDate:'2026-09-30'}).tables[0];
 assert.equal(missing.tree[0].children[0].children[0].SUPERVISOR,'Não informado');
 assert.equal(missing.tree[0].children[0].children[0].Valor,100);
});

test('issued and billed dimension trees show every item within each order',()=>{
 const base={...rows[0],CONSULTOR:'Consultor',CLIENTE:'Cliente',CODIGO_PEDIDO:7,CODIGO_ITEM:10,DESCRICAO_ITEM:'Mesa',COR:'Azul',
  VALOR_EMITIDO_CLEAN:100,PESO_EMITIDO_CLEAN:10,VOLUME_M3_EMITIDO_CLEAN:1,QUANTIDADE_EMITIDA_CLEAN:1,
  VALOR_FATURADO_CLEAN:100,PESO_FATURADO_CLEAN:10,VOLUME_M3_FATURADO_CLEAN:1,QUANTIDADE_FATURADA_CLEAN:1,DT_FATURA_DATE:'2026-09-01'};
 const source=[base,{...base,CODIGO_ITEM:11,DESCRICAO_ITEM:'Cadeira',VALOR_EMITIDO_CLEAN:50,VALOR_FATURADO_CLEAN:50}];
 for(const area of ['emitidos','faturados']){
  const table=buildDimensionDashboard({rows:source,area,dimension:'UF',referenceDate:'2026-09-30'}).tables[0];
  let node=table.tree[0];while(node.children.length&&node.col_name!=='CODIGO_PEDIDO')node=node.children[0];
  assert.equal(node.col_name,'CODIGO_PEDIDO');
  assert.deepEqual(node.children.map(item=>item.col_name),['ITEM_PEDIDO','ITEM_PEDIDO']);
  assert.deepEqual(node.children.map(item=>item.Valor).sort((a,b)=>a-b),[50,100]);
  assert.equal(node.children.reduce((total,item)=>total+item.Valor,0),node.Valor);
 }
});
