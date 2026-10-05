import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildDimensionDashboard} from '../api-server/domain/dimensions.js';
const reference=JSON.parse(fs.readFileSync(new URL('../.local/domain-reference.json',import.meta.url),'utf8'));
const close=(a,b,key)=>{if(typeof b==='number')assert.ok(Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-8),`${key}: ${a} != ${b}`);else assert.equal(a,b,key);};
function realRows(area){
 const rows=JSON.parse(fs.readFileSync(new URL(`../.local/normalized-full-${area}.json`,import.meta.url),'utf8'));
 // The oracle fixture uses the legacy commercial FAT aliases for both areas.
 // Restore the native emission aliases at this fixture boundary.
 if(area==='emitidos')for(const row of rows)for(const [emit,fat] of [['VALOR_EMITIDO_CLEAN','VALOR_FATURADO_CLEAN'],['PESO_EMITIDO_CLEAN','PESO_FATURADO_CLEAN'],['QUANTIDADE_EMITIDA_CLEAN','QUANTIDADE_FATURADA_CLEAN'],['VOLUME_M3_EMITIDO_CLEAN','VOLUME_M3_FATURADO_CLEAN']])row[emit]=row[fat];
 return rows;
}
for(const area of ['emitidos','faturados'])test(`${area}: dimensional aggregate totals and LY match original current-year geography`,()=>{
 const rows=realRows(area);
 const expected=reference.captures[`${area}.dimensao.UF`],table=buildDimensionDashboard({rows,history:rows,area,referenceDate:reference.referenceDate,dimension:'UF'}).tables[0];
 assert.equal(table.rows.length,expected.summary.length);
 const lookup=new Map(table.rows.map(r=>[r.UF,r]));
 for(const row of expected.summary){const actual=lookup.get(row.UF);assert.ok(actual);for(const key of ['Valor','Peso','Qtde','Volume_M3','NS','OTIF','Grupos Atendidos','Qtd Pedidos','Valor_Prev','Ticket Medio','R$/Ton','Diff_Raw','% Part'])close(actual[key],row[key],`${area} ${row.UF} ${key}`);}
 for(const key of ['Valor','Peso','Qtde','Volume_M3','NS','OTIF','Grupos Atendidos','Qtd Pedidos','Ticket Medio','R$/Ton','Diff_Raw','% Part'])close(table.total[key],expected.tot_dict[key],`${area} TOTAL ${key}`);
});
for(const area of ['emitidos','faturados'])test(`${area}: previous-only customer groups keep zero current counts from the real oracle merge`,()=>{
 const rows=realRows(area),expected=reference.captures[`${area}.dimensao.GRUPO_CLIENTE`];
 const previousOnly=expected.summary.filter(row=>row.Valor===0&&row.Valor_Prev>0);
 assert.ok(previousOnly.length>0,'actual snapshot has groups with only previous-year sales');
 const table=buildDimensionDashboard({rows,history:rows,area,referenceDate:reference.referenceDate,dimension:'GRUPO_CLIENTE'}).tables[0];
 const lookup=new Map(table.rows.map(row=>[row.GRUPO_CLIENTE,row]));
 for(const row of previousOnly){
   const actual=lookup.get(row.GRUPO_CLIENTE);assert.ok(actual);
   for(const key of ['Valor','Valor_Prev','Diff_Raw','Grupos Atendidos','Qtd Pedidos'])close(actual[key],row[key],`${area} previous-only ${row.GRUPO_CLIENTE} ${key}`);
   assert.equal(actual.Grupos_Atendidos,0);assert.equal(actual.Qtd_Pedidos,0);
 }
});
