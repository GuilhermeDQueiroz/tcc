// Read-only application comparison with private original-code captures from the same Hop publication.
import fs from 'node:fs';
import pg from 'pg';
import {PostgresRepository} from '../api-server/repositories/postgres.js';
import {formatValue} from '../src/composables/useFormatters.ts';
const reference=JSON.parse(fs.readFileSync('.local/domain-reference.json','utf8'));
const pool=new pg.Pool({host:process.env.PG_HOST||'localhost',port:Number(process.env.PG_PORT||5434),database:'dados',user:process.env.PG_USER,password:process.env.PG_PASSWORD,max:1,statement_timeout:120000});
const repository=new PostgresRepository(pool),results=[],failures=[];
const keys=['Valor','Peso','Qtde','Volume_M3','NS','OTIF','Grupos Atendidos','Qtd Pedidos','Valor_Prev','Ticket Medio','R$/Ton','Diff_Raw','% Part'];
let comparisons=0,centComparisons=0;
const check=(actual,expected,path)=>{
  comparisons++;
  if(typeof expected==='number'){
    if(typeof actual!=='number'||!Number.isFinite(actual)||Math.abs(actual-expected)>Math.max(1e-6,Math.abs(expected)*1e-8))failures.push({path,actual,expected});
    if(['Valor','Valor_Prev','Ticket Medio','R$/Ton','Diff_Raw'].some(key=>path.endsWith('.'+key))){
      centComparisons++;
      if(formatValue(actual,'currency')!==formatValue(expected,'currency'))failures.push({path:path+'.centavos',actual:formatValue(actual,'currency'),expected:formatValue(expected,'currency')});
    }
  }else if(actual!==expected)failures.push({path,actual,expected});
};
try{
  if(await repository.getVersion()!==reference.version)throw new Error('A referência deve ser regenerada para a publicação atual.');
  for(const area of ['emitidos','faturados']){
    for(const [capture,expected] of Object.entries(reference.captures).filter(([key])=>key.startsWith(area+'.dimensao.'))){
      const dimension=capture.slice((area+'.dimensao.').length),before=failures.length;
      const payload=await repository.getDashboard({area,referenceDate:reference.referenceDate,filters:{},dimension,hierarchy:[dimension],metric:'value',chartType:'table'},'dimensoes');
      if(payload.dataVersion!==reference.version)throw new Error('A versão mudou durante a comparação.');
      const table=payload.tables[0],lookup=new Map(table.rows.map(row=>[row[dimension],row]));
      check(table.rows.length,expected.summary.length,capture+'.rows');
      for(const row of expected.summary){
        const actual=lookup.get(row[dimension]);
        if(!actual){failures.push({path:capture+'.dimension',expected:row[dimension]});continue;}
        for(const key of keys)if(Object.hasOwn(row,key))check(actual[key],row[key],`${capture}.${row[dimension]}.${key}`);
      }
      for(const key of keys.filter(key=>key!=='Valor_Prev'))if(Object.hasOwn(expected.tot_dict,key))check(table.total[key],expected.tot_dict[key],`${capture}.TOTAL.${key}`);
      results.push({area,dimension,rows:table.rows.length,failures:failures.length-before});
      fs.writeFileSync('.local/dimensions-real-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),complete:false,source:reference.source,version:reference.version,comparisons,centComparisons,results,failures},null,2));
      console.log(`${capture}: ${table.rows.length} grupos, ${failures.length-before} diferenças`);
    }
  }
  fs.writeFileSync('.local/dimensions-real-verification.json',JSON.stringify({verifiedAt:new Date().toISOString(),complete:true,source:reference.source,version:reference.version,comparisons,centComparisons,results,failures},null,2));
  console.log(`${comparisons} comparações numéricas e ${centComparisons} de centavos; ${failures.length} diferenças.`);
  if(failures.length)process.exitCode=1;
}finally{await pool.end();}
