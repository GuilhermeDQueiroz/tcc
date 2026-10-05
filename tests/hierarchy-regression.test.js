import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
import {buildHierarchy,buildDimensionDashboard} from '../api-server/domain/dimensions.js';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../.local/${name}.json`,import.meta.url),'utf8'));
const oracle=read('normalized-reference-trees');
const referenceDate='2026-10-01';
const close=(actual,expected,label)=>assert.ok(typeof actual==='number'&&Math.abs(actual-expected)<=Math.max(1e-6,Math.abs(expected)*1e-8),`${label}: ${actual} != ${expected}`);
const frames=Object.fromEntries(['emitidos','faturados'].map(area=>[area,read(`normalized-${area}`)]));
async function dashboard(area,tab){
  const repository=new PostgresRepository(null);
  repository.snapshot=async()=>({version:'2647add2-e8fe-4c70-a6b5-96d2b0d67d6d',source:'firebird/apache-hop',frames:{[area]:frames[area],carteira:[],metas:[]}});
  return repository.getDashboard({area,filters:{},referenceDate},tab);
}
function rootSummaries(table){
  const count=Math.min(table.rows.length,table.treeSpec.maxRoots);
  assert.equal(table.tree.length,count,`${table.id} roots`);
  table.rows.slice(0,count).forEach((row,i)=>{
    for(const [key,value] of Object.entries(row))assert.deepEqual(table.tree[i][key],value,`${table.id} root ${i} ${key}`);
  });
}
for(const area of ['emitidos','faturados']){
  test(`${area}: weekly drilldown retains ranked summaries and column aliases`,async()=>{
    const payload=await dashboard(area,'semanal');
    for(const table of payload.tables.filter(t=>t.treeSpec)){
      rootSummaries(table);
      for(const root of table.tree)for(const child of root.children){
        for(const [key,canonical] of Object.entries({value:'Valor',weightKg:'Peso',quantity:'Qtde',orders:'Qtd_Pedidos',groups:'Grupos_Atendidos',part_pct:'% Part'}))close(child[key],child[canonical],`${table.id} child ${key}`);
        assert.ok(root.children.length<=Math.min(table.treeSpec.maxChildren,8));
      }
    }
  });
  test(`${area}: customer drilldown preserves RFM, recency, averages and differences`,async()=>{
    const payload=await dashboard(area,'carteira');
    for(const table of payload.tables.filter(t=>t.treeSpec))rootSummaries(table);
  });
  test(`${area}: evolution derives calendar roots and matches original child math and limits`,async()=>{
    const table=(await dashboard(area,'evolucao')).tables[0];
    rootSummaries(table);
    assert.equal(table.tree[0].Mes_Ano,'2026-08');
    const expected=oracle.captures[`${area}.agosto.evolucao.hier_tree`];
    function compare(actual,want){
      assert.equal(actual.length,want.length,'original visible child count');
      want.forEach(row=>{
        // pandas quicksort does not define sibling order for equal values.
        const node=actual.find(item=>item.name===row.name);
        if(!node){
          const extra=actual.filter(item=>!want.some(original=>original.name===item.name));
          assert.ok(extra.length>0,`original child ${row.name}`);
          const cutoff=Math.min(...want.map(item=>item.Valor));
          assert.equal(row.Valor,cutoff,'only tied cutoff children may differ');
          assert.ok(extra.every(item=>item.Valor===cutoff),'replacement children have the exact tied value');
          return;
        }
        for(const key of ['Valor','Peso','Volume_M3','OTIF','Qtde','Ticket','R$/Ton','% Part','Diff_Raw','Qtd_Pedidos','Grupos_Atendidos','NS'])close(node[key],row[key],`${node.node_id} ${key}`);
        for(const [key,canonical] of Object.entries({Pedidos:'Qtd_Pedidos',Clientes:'Grupos_Atendidos',Lead_Time:'NS'}))close(node[key],node[canonical],`${node.node_id} ${key}`);
        compare(node.children,row.children);
      });
    }
    compare(table.tree[0].children,expected[0].children);
  });
}
test('dimension hierarchy keeps previous-only real roots and the original summary order',()=>{
  const source=frames.faturados,uf=source[0].UF;
  const previousRows=source.filter(row=>row.UF===uf),rows=source.filter(row=>row.UF!==uf);
  const table=buildDimensionDashboard({rows,previousRows,area:'faturados',dimension:'UF',referenceDate}).tables[0];
  assert.deepEqual(table.tree.map(row=>row.UF),table.rows.map(row=>row.UF));
  const previousRoot=table.tree.find(row=>row.UF===uf);
  assert.ok(previousRoot);assert.ok(previousRoot.Valor_Prev>0);assert.equal(previousRoot.Valor,0);
  assert.equal(previousRoot.Diff_Raw,-previousRoot.Valor_Prev);assert.deepEqual(previousRoot.children,[]);
});
test('hierarchy limits roots and uses the original deeper child caps on actual orders',()=>{
  const columns=['SUPERVISOR','CONSULTOR','GRUPO_CLIENTE','CLIENTE','CODIGO_PEDIDO'];
  const tree=buildHierarchy(frames.faturados,'faturados',columns,[],{maxRoots:2,maxChildren:2});
  assert.equal(tree.length,2);
  function visit(nodes){for(const node of nodes){if(node.children[0]?.col_name==='CODIGO_PEDIDO')assert.ok(node.children.length<=20);else assert.ok(node.children.length<=2);visit(node.children);}}
  visit(tree);
  const orders=buildHierarchy(frames.faturados,'faturados',['CLIENTE','CODIGO_PEDIDO'],[],{maxRoots:1,maxChildren:2});
  assert.equal(orders[0].children.length,20,'the real largest client shows twenty dated orders');
});
for(const area of ['emitidos','faturados'])test(`${area}: commercial geography shows the original six child consultants per state`,()=>{
 const table=buildDimensionDashboard({rows:frames[area],area,dimension:'UF',referenceDate}).tables[0];
 for(const uf of ['PE','MG','BA'])assert.equal(table.tree.find(row=>row.UF===uf).children.length,6,`${area} ${uf}`);
});
test('previous-only real orders do not fabricate a current order count',()=>{
 const source=frames.faturados,code=source[0].CODIGO_PEDIDO;
 const table=buildDimensionDashboard({rows:source.filter(row=>row.CODIGO_PEDIDO!==code),previousRows:source.filter(row=>row.CODIGO_PEDIDO===code),area:'faturados',dimension:'CODIGO_PEDIDO',hierarchy:['CODIGO_PEDIDO'],referenceDate}).tables[0];
 const actual=table.rows.find(row=>row.CODIGO_PEDIDO===code);assert.ok(actual.Valor_Prev>0);
 assert.equal(actual.Qtd_Pedidos,0);assert.equal(actual['Qtd Pedidos'],0);
});
test('custom hierarchy uses real first-level groups when its root differs from the chart dimension',()=>{
 const table=buildDimensionDashboard({rows:frames.faturados,area:'faturados',dimension:'UF',hierarchy:['SUPERVISOR','CONSULTOR','GRUPO_CLIENTE'],referenceDate}).tables[0];
 const supervisors=[...new Set(frames.faturados.map(row=>row.SUPERVISOR))].sort();
 assert.deepEqual(table.tree.map(row=>row.SUPERVISOR).sort(),supervisors);
 assert.ok(table.tree.every(row=>row.name===row.SUPERVISOR&&row.col_name==='SUPERVISOR'&&row.children.length>0));
});
