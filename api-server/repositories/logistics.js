import {buildLogisticsDashboard} from '../domain/logistics.js';
import {AsyncCache,stableKey} from '../cache.js';
export class LogisticsRepository {
  constructor(pool){
    this.pool=pool;
    this.snapshots=new AsyncCache({maxEntries:2,ttl:1800000});
    this.payloads=new AsyncCache({maxEntries:6,ttl:300000});
  }
  async snapshot(){
    const client=await this.pool.connect();
    try{
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      const available=await client.query("SELECT to_regclass('logistica.publicacao') IS NOT NULL AS available");
      if(!available.rows[0].available)throw Object.assign(new Error('Ainda não há publicação logística. Execute o workflow logistica_local.'),{status:409});
      const result=await client.query(`SELECT e.id,e.data_inicio::text,e.data_referencia::text,e.fim,e.origem,e.contagens
        FROM logistica.publicacao p JOIN logistica.execucao e ON e.id=p.execucao_id WHERE e.status='publicado'`);
      const execution=result.rows[0];
      if(!execution)throw Object.assign(new Error('Ainda não há publicação logística válida.'),{status:409});
      const snapshot=await this.snapshots.get(String(execution.id),async()=>{
        const items=await client.query(`SELECT *,emissao::text,previsao_faturamento::text,promessa_entrega::text FROM logistica.item_pedido WHERE execucao_id=$1 ORDER BY pedido_id DESC,item_id`,[execution.id]);
        const allocations=await client.query(`SELECT *,emissao::text,previsao_faturamento::text,inicio_separacao::text,fim_separacao::text,inicio_conferencia::text,fim_conferencia::text,fechamento::text,liberacao_saida::text
          FROM logistica.alocacao WHERE execucao_id=$1 ORDER BY carga_id DESC,pedido_id,item_id`,[execution.id]);
        return {execution,items:items.rows,allocations:allocations.rows};
      });
      await client.query('COMMIT');return snapshot;
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  async getDashboard(filters={}){
    // Always check the active publication. Cached data never masks an outage.
    const snapshot=await this.snapshot();
    return this.payloads.get(stableKey([snapshot.execution.id,filters]),()=>
      buildLogisticsDashboard({...snapshot,filters}));
  }
}
