"""Reconcile the published DW with aggregate evidence from the real Firebird copy.

Also exercise publication failures using actual staged rows inside rolled-back
transactions. No synthetic records are created and the current publication stays intact.
"""
import json
import os
from pathlib import Path
import sys
import uuid
from decimal import Decimal
import psycopg2

ROOT=Path(__file__).resolve().parents[1]


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    evidence=json.loads((ROOT/'.local/logistica-vinculos-auditoria.json').read_text(encoding='utf-8'))
    expected=evidence['queries']['publicationCohort']['rows'][0]
    connection=psycopg2.connect(host='localhost',port=5434,dbname='dados',user=os.environ['PG_USER'],password=os.environ['PG_PASSWORD'])
    checks=[]
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_xact_lock(741083,0)');assert cursor.fetchone()[0],'Outra carga está executando.'
            cursor.execute('SELECT execucao_id FROM logistica.publicacao');current=str(cursor.fetchone()[0])
            cursor.execute("SELECT data_inicio::text,data_referencia::text FROM logistica.execucao WHERE id=%s",(current,))
            assert cursor.fetchone()==('2026-01-01','2026-09-30'),'Auditoria desta entrega exige o mesmo recorte de 2026.'
            cursor.execute('SELECT COUNT(*),SUM(quantidade_aberta),SUM(quantidade_alocada),SUM(quantidade_sem_carga),SUM(valor_aberto),COUNT(*) FILTER(WHERE valor_aberto IS NULL) FROM logistica.item_pedido WHERE execucao_id=%s',(current,))
            count,opened,allocated,free,value,unpriced=cursor.fetchone()
            assert count==4685
            for field,actual in [('OPEN_QUANTITY',opened),('ALLOCATED_QUANTITY',allocated),('FREE_QUANTITY',free),('OPEN_VALUE',value)]:
                assert abs(Decimal(str(expected[field]))-actual)<Decimal('0.000001'),(field,actual,expected[field]);checks.append(field)
            assert unpriced==expected['UNPRICED_ITEMS']
            measures=json.loads((ROOT/'.local/logistica-medidas-origem.json').read_text(encoding='utf-8'))['measures']
            for unit,prefix in [('peso_unitario','WEIGHT'),('cubagem_unitaria','CUBE'),('valor_unitario','VALUE')]:
                cursor.execute(f'SELECT SUM(quantidade_aberta*{unit}),SUM(quantidade_alocada*{unit}),SUM(quantidade_sem_carga*{unit}) FROM logistica.item_pedido WHERE execucao_id=%s',(current,))
                values=cursor.fetchone()
                for suffix,actual in zip(['OPEN','LOAD','FREE'],values):
                    field=prefix+'_'+suffix
                    if field not in measures:continue
                    assert abs(actual-Decimal(str(measures[field])))<Decimal('0.000001'),(field,actual,measures[field]);checks.append(field)
            forecast_cte="""WITH forecast AS (
              SELECT a.previsao_faturamento AS date,'em_carga' AS scope,a.quantidade_aberta AS quantity,ip.valor_unitario AS price,ip.peso_unitario AS weight
              FROM logistica.alocacao a JOIN logistica.item_pedido ip ON ip.execucao_id=a.execucao_id AND ip.item_id=a.item_id
              WHERE a.execucao_id=%s AND a.quantidade_aberta>0
              UNION ALL SELECT ip.previsao_faturamento,'sem_carga',ip.quantidade_sem_carga,ip.valor_unitario,ip.peso_unitario
              FROM logistica.item_pedido ip WHERE ip.execucao_id=%s AND ip.quantidade_sem_carga>0) """
            cursor.execute(forecast_cte+"SELECT COALESCE(SUM(quantity) FILTER(WHERE date IS NULL),0),COALESCE(SUM(quantity) FILTER(WHERE date<'2026-09-30'),0),COALESCE(SUM(quantity) FILTER(WHERE date>='2026-09-30'),0) FROM forecast",(current,current))
            expected_forecast=dict(zip(['withoutDateQuantity','overdueQuantity','scheduledQuantity'],cursor.fetchone()))
            cursor.execute(forecast_cte+"SELECT to_char(date,'YYYY-MM') AS month,SUM(quantity*price) FILTER(WHERE scope='em_carga'),SUM(quantity*price) FILTER(WHERE scope='sem_carga') FROM forecast WHERE date IS NOT NULL GROUP BY 1 ORDER BY 1",(current,current))
            months=[{'month':row[0],'em_carga':row[1] or 0,'sem_carga':row[2] or 0} for row in cursor.fetchall()]
            cursor.execute(forecast_cte+"SELECT date::text,COALESCE(SUM(quantity*weight) FILTER(WHERE scope='em_carga'),0),COALESCE(SUM(quantity*weight) FILTER(WHERE scope='sem_carga'),0) FROM forecast WHERE date BETWEEN '2026-09-30' AND '2026-10-06' GROUP BY date ORDER BY date",(current,current))
            daily=[{'date':row[0],'em_carga':row[1],'sem_carga':row[2]} for row in cursor.fetchall()]
            (ROOT/'.local/logistica-previsao-referencia.json').write_text(json.dumps({'runId':current,'forecast':expected_forecast,'monthly':months,'daily':daily},indent=2,default=str),encoding='utf-8')
            cursor.execute("""WITH orders AS (SELECT pedido_id,SUM(quantidade_aberta) AS aberta,SUM(quantidade_alocada) AS alocada
                FROM logistica.item_pedido WHERE execucao_id=%s GROUP BY pedido_id)
                SELECT COUNT(*),COUNT(*) FILTER(WHERE alocada=0),COUNT(*) FILTER(WHERE alocada>0 AND alocada<aberta),COUNT(*) FILTER(WHERE alocada=aberta) FROM orders""",(current,))
            assert cursor.fetchone()==tuple(expected[key] for key in ['ORDERS','ORDERS_NONE','ORDERS_PARTIAL','ORDERS_FULL'])
            checks.append('order-classification')
            cursor.execute('SELECT COUNT(*),COUNT(DISTINCT carga_id) FILTER(WHERE quantidade_aberta>0) FROM logistica.alocacao WHERE execucao_id=%s',(current,))
            assert cursor.fetchone()==(2125,58);checks.append('allocation-bridge')
            # The real staged data contains multi-load items and partial billing.
            cursor.execute('SELECT COUNT(*) FROM (SELECT item_id FROM logistica.alocacao WHERE execucao_id=%s GROUP BY item_id HAVING COUNT(DISTINCT carga_id)>1) multiple_loads',(current,))
            assert cursor.fetchone()[0]>0;checks.append('multiple-load-items')
            cursor.execute('SELECT COUNT(*) FROM logistica.item_pedido WHERE execucao_id=%s AND quantidade_carga_faturada>0',(current,))
            assert cursor.fetchone()[0]>0;checks.append('partially-billed-items')
            mutations=[
                ('inconsistent-net-allocation',"UPDATE logistica_stage.carga_itens SET qtdeaberta_carite=qtdeaberta_carite+1 WHERE autoinc_carite=(SELECT MIN(autoinc_carite) FROM logistica_stage.carga_itens)"),
                ('negative-allocation',"UPDATE logistica_stage.carga_itens SET qtdeaberta_carite=-1 WHERE autoinc_carite=(SELECT MIN(autoinc_carite) FROM logistica_stage.carga_itens)"),
                ('orphan-load',"DELETE FROM logistica_stage.carga WHERE codigo_carga=(SELECT MIN(codigo_carga) FROM logistica_stage.carga)"),
                ('wrong-order-link',"UPDATE logistica_stage.carga_documentos SET documento_cardoc=-1 WHERE autoinc_cardoc=(SELECT MIN(autoinc_cardoc) FROM logistica_stage.carga_documentos)"),
                ('wrong-item-order',"UPDATE logistica_stage.documento_item_detalhe SET documento_docitemdet=-1 WHERE autoinc_docitemdet=(SELECT MIN(autoinc_docitemdet) FROM logistica_stage.documento_item_detalhe)"),
            ]
            publication=(ROOT/'etl/sql/logistica/002_publicar.sql').read_text(encoding='utf-8').removeprefix('BEGIN;').removesuffix('COMMIT;\n')
            for name,mutation in mutations:
                cursor.execute('SAVEPOINT verify_failure')
                run_id=str(uuid.uuid4())
                cursor.execute("INSERT INTO logistica.execucao(id,status,data_inicio,data_referencia,origem) VALUES(%s,'executando','2026-01-01','2026-09-30','validation-rolled-back')",(run_id,))
                cursor.execute(mutation)
                try:
                    cursor.execute(publication.replace('${ETL_RUN_ID}',run_id))
                except psycopg2.Error:
                    cursor.execute('ROLLBACK TO SAVEPOINT verify_failure')
                else:
                    raise AssertionError('Publicação deveria ter sido rejeitada: '+name)
                cursor.execute('SELECT execucao_id FROM logistica.publicacao');assert str(cursor.fetchone()[0])==current
                checks.append(name+'-preserves-publication')
            connection.rollback()
        report={'source':'real-firebird-aggregate-audit','runId':current,'checks':checks,'synthetic':False,'passed':True}
        (ROOT/'.local/logistica-verificacao.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False))
    finally:
        connection.rollback();connection.close()


if __name__=='__main__':main()
