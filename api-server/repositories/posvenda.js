import {AsyncCache,stableKey} from '../cache.js';
import {buildAftersalesDashboard,paginateAftersalesDashboard} from '../domain/posvenda.js';

export class AftersalesRepository {
 constructor(pool,{buildDashboard=buildAftersalesDashboard}={}){
  this.pool=pool;
  this.buildDashboard=buildDashboard;
  this.snapshots=new AsyncCache({maxEntries:1,ttl:1800000});
  this.payloads=new AsyncCache({maxEntries:4,ttl:300000});
 }
 async snapshot(){
  const client=await this.pool.connect();
  try{
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const exists=await client.query("SELECT to_regclass('posvenda.publicacao') IS NOT NULL AS available,to_regclass('posvenda.dimensoes') IS NOT NULL AS dimensions_available");
   if(!exists.rows[0].available)throw Object.assign(new Error('Pós-venda ainda não publicado. Execute o workflow posvenda_local.'),{status:409});
   const result=await client.query("SELECT e.id,e.data_inicio::text,e.data_referencia::text,e.fim FROM posvenda.publicacao p JOIN posvenda.execucao e ON e.id=p.execucao_id WHERE e.status='publicado'");
   const execution=result.rows[0];if(!execution)throw Object.assign(new Error('Não há carga válida de pós-venda.'),{status:409});
   if(exists.rows[0].dimensions_available){
    const dimensions=await client.query('SELECT versao_id::text FROM posvenda.dimensoes WHERE execucao_id=$1 LIMIT 1',[execution.id]);
    execution.dimensionsVersion=dimensions.rows[0]?.versao_id;
   }
   execution.data_version=execution.dimensionsVersion?execution.id+':'+execution.dimensionsVersion:execution.id;
   const rows=await this.snapshots.get(execution.data_version,async()=>{
    const enriched=!!execution.dimensionsVersion;
    const sql=enriched?'SELECT r.*,r.data::text,r.emissao_original::text,r.previsao::text,d.atributos FROM posvenda.registro r LEFT JOIN posvenda.dimensoes d USING(execucao_id,categoria,registro_id) WHERE r.execucao_id=$1 ORDER BY r.categoria,r.registro_id':'SELECT *,data::text,emissao_original::text,previsao::text FROM posvenda.registro WHERE execucao_id=$1 ORDER BY categoria,registro_id';
    const result=await client.query(sql,[execution.id]);
    return result.rows.map(({atributos,...row})=>({...row,...(atributos||{}),previsao:row.previsao??atributos?.previsao_original??null}));
   });
   await client.query('COMMIT');return {execution,rows};
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async getDashboard(area,query={}){
  // Availability is checked on every request, including hits and page changes.
  const {execution,rows}=await this.snapshot();
  const {page,pageSize,export:format,section,...selection}=query;
  const prepared=await this.payloads.get(stableKey([execution.data_version,area,selection]),()=>
   this.buildDashboard({execution,rows,area,query:{...selection,export:'csv'}}));
  // Metrics and charts cover the complete filtered population. Only the detail
  // table is paginated; CSV continues to include every selected record.
  const result=paginateAftersalesDashboard(prepared,{page,pageSize,export:format});
  if(section==='details'){
   const {dataVersion,referenceDate,total,table}=result;
   return {dataVersion,referenceDate,total,table,page:result.page,pageSize:result.pageSize};
  }
  return result;
 }
}
