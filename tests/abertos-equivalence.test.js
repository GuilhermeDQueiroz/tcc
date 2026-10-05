import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildOpenDashboard} from '../api-server/domain/open.js';
import {buildDimensionDashboard} from '../api-server/domain/dimensions.js';
const reference=JSON.parse(fs.readFileSync(new URL('../.local/domain-reference.json',import.meta.url),'utf8'));
const rows=JSON.parse(fs.readFileSync(new URL('../.local/normalized-abertos.json',import.meta.url),'utf8'));
function close(a,b,label){if(b==null)return assert.equal(a,b,label);if(typeof b==='number')assert.ok(Math.abs(a-b)<=Math.max(1e-6,Math.abs(b)*1e-8),`${label}: ${a} != ${b}`);else assert.equal(a,b,label);}

test('open card supplementary values retain original numeric precision with explicit display formats',()=>{
 const expected=reference.captures['abertos.resumo'],delivery=reference.captures['abertos.entrega_cards'];
 const payload=buildOpenDashboard({rows,referenceDate:reference.referenceDate,dailyAverage:expected.media_diaria_90});
 const metric=id=>payload.metrics.find(card=>card.id==='abertos.resumo.'+id);
 const detail=(id,label,value,format)=>{
   const card=metric(id),item=card.supplementary?.find(entry=>entry.label===label);
   assert.ok(item,`${id} formatted ${label}`);assert.equal(item.format,format);close(item.value,value,`${id} ${label}`);
   assert.equal(typeof item.value,'number');assert.equal(card.subtitle,undefined,'native floats are formatted by the metric renderer');
 };
 detail('serviceDays','Varejo',expected.ns_without_mm_abertos,'days');
 detail('serviceDays','E-commerce',expected.ns_with_mm_abertos,'days');
 detail('orders60','Participação dos pedidos',expected.pct_pedidos_atraso,'percent');
 detail('value60','Participação do valor',expected.pct_valor_60,'percent');
 for(const [kind,suffix] of [['ENTREGA','e'],['RETIRA','r']]){
   close(metric('entrega.'+kind).value,delivery['val_'+suffix],kind+' native monetary value');
   detail('entrega.'+kind,'Peso',delivery['peso_'+suffix],'weight');
   detail('entrega.'+kind,'Pedidos',delivery['ped_'+suffix],'integer');
   detail('entrega.'+kind,'Participação',delivery['pct_'+suffix],'percent');
 }
});
test('all open cards preserve original published dataset results',()=>{
 const e=reference.captures['abertos.resumo'];
 const p=buildOpenDashboard({rows,referenceDate:reference.referenceDate,dailyAverage:e.media_diaria_90});
 const fields={value:'total_valor',weightKg:'total_peso',volumeM3:'total_m3',quantity:'total_itens',orders:'total_pedidos',groups:'total_grupos',serviceDays:'media_servico',backlogReal:'backlog_days',backlogGeneral:'backlog_geral_days',orders60:'total_pedidos_60',value60:'total_valor_60'};
 for(const [id,key] of Object.entries(fields))close(p.metrics.find(m=>m.id==='abertos.resumo.'+id).value,e[key],key);
 close(p.meta.serviceWithSpecial,e.ns_with_mm_abertos,'NS especial');close(p.meta.serviceWithoutSpecial,e.ns_without_mm_abertos,'NS outros');
 close(p.meta.lateOrdersPct,e.pct_pedidos_atraso,'pct atraso');close(p.meta.lateValuePct,e.pct_valor_60,'pct valor');
 assert.equal(p.meta.backlog.status,e.status_lbl);
 const status=p.series.find(s=>s.id==='abertos.resumo.STATUS').rows,expected=reference.captures['abertos.status_resumo'].status_agg;
 assert.equal(status.length,expected.length,'status resumo top 9 + outros');
 status.forEach((r,i)=>{assert.equal(r.STATUS,expected[i].STATUS);close(r.Valor,expected[i].Valor,'status valor');close(r.Qtd_Pedidos,expected[i].Qtd_Pedidos,'status pedidos');close(r.Part,expected[i].Part,'status participação');});
});
test('all open dimensional numeric rows and totals preserve original pandas results',()=>{
 for(const [id,expected] of Object.entries(reference.captures).filter(([k])=>k.startsWith('abertos.dimensao.'))){
   const dimension=id.split('.').at(-1),table=buildDimensionDashboard({rows,area:'abertos',dimension,referenceDate:reference.referenceDate}).tables[0];
   assert.equal(table.rows.length,expected.summary_display.length,dimension+' rows');
   const lookup=new Map(table.rows.map(r=>[String(r[dimension]),r]));
   for(const row of expected.summary_display){const key=Object.keys(row).find(k=>!['Mes_Sort','Mes_Previsao_Sort','sort_idx'].includes(k)&&typeof row[k]==='string'),actual=lookup.get(String(row[key]));assert.ok(actual,`${dimension} ${row[key]}`);
     for(const column of ['Valor','Peso','Volume_M3','Qtde','NivelServico','Qtd_Pedidos','Grupos_Atendidos','% Part','Ticket Medio','R$/Ton'])if(Object.hasOwn(row,column))close(actual[column],row[column],dimension+' '+column);
   }
   for(const column of ['Valor','Peso','Volume_M3','Qtde','NivelServico','Qtd_Pedidos','Grupos_Atendidos','Ticket Medio','R$/Ton'])if(Object.hasOwn(expected.total_row,column))close(table.total[column],expected.total_row[column],dimension+' total '+column);
 }
});
