import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOpenDashboard} from '../api-server/domain/open.js';
test('overview composes the real legacy calendar, geography and monthly delivery reductions',()=>{
 const rows=JSON.parse(fs.readFileSync('.local/normalized-abertos.json','utf8'));
 const payload=buildOpenDashboard({rows,referenceDate:'2026-10-01',tab:'resumo',year:2026,month:10,backlogType:'real'});
 const reference=JSON.parse(fs.readFileSync('.local/domain-reference.json','utf8'));
 assert.deepEqual(payload.series.find(s=>s.type==='calendar')?.rows,reference.captures['abertos.calendario.real'].map(r=>({...r,date:r.date.slice(0,10)})));
 const map=payload.series.find(s=>s.id==='abertos.resumo.UF');assert.ok(map);
 for(const row of reference.captures['abertos.mapa'].uf_agg)assert.equal(map.rows.find(r=>r.UF===row.UF)?.Valor,row.Valor);
 const delivery=payload.series.find(s=>s.id==='abertos.resumo.entregaMensal');assert.ok(delivery);
 const expected=JSON.parse(fs.readFileSync('.local/open-layout-reference.json','utf8'));
 assert.equal(expected.version,reference.version);
 assert.equal(delivery.rows.length,expected.rows.length);
 for(const row of expected.rows)assert.equal(delivery.rows.find(r=>r.Mes_Grupo===row.Mes_Grupo&&r.TIPO_ENTREGA===row.TIPO_ENTREGA)?.Valor,row.VALOR_EM_ABERTO_CLEAN);
});
