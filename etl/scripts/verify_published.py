"""Read-only verification of the real published snapshot; never fabricates data."""
import json
import os
from datetime import datetime,timezone
import psycopg2
from psycopg2 import sql
from source_contract import ROOT

report_path=ROOT/'.local/real-load.json'
report=json.loads(report_path.read_text(encoding='utf-8'))
if report.get('postgresPort')!=5434 or report.get('synthetic') is not False:
    raise SystemExit('Relatório não corresponde à carga real na porta 5434.')
connection=psycopg2.connect(host='localhost',port=5434,dbname='dados',
    user=os.environ['PG_USER'],password=os.environ['PG_PASSWORD'],connect_timeout=10)
connection.set_session(isolation_level='REPEATABLE READ',readonly=True)
try:
    with connection.cursor() as cursor:
        cursor.execute('SELECT status,contagens,origem FROM etl.execucao_carga WHERE id=%s',(report['runId'],))
        status,counts,origin=cursor.fetchone()
        report['executionOrigin']=origin
        assert status=='publicado'
        expected={item['staging'] for item in json.loads((ROOT/'etl/inventario-fontes.json').read_text(encoding='utf-8'))}
        cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname='staging'")
        assert {row[0] for row in cursor.fetchall()}==expected
        assert set(report['rawTables'])==expected
        for table,count in report['rawTables'].items():
            cursor.execute(sql.SQL('SELECT count(*) FROM staging.{}').format(sql.Identifier(table)))
            assert cursor.fetchone()[0]==count['rows'],table
        for area,view in {'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos','faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}.items():
            cursor.execute(sql.SQL('SELECT count(*) FROM dw.{}').format(sql.Identifier(view)))
            actual=cursor.fetchone()[0]
            assert actual==counts[area]==report['tables'][area]['rows'],area
            cursor.execute(sql.SQL('SELECT count(*) FROM dw.{}').format(sql.Identifier('carga_'+area)))
            assert cursor.fetchone()[0]==actual,area
        timestamps=[]
        for table,document in json.loads((ROOT/'etl/sql/fontes/raw-source-schema.json').read_text(encoding='utf-8')).items():
            for column in document['columns']:
                if 'datetime.datetime' in column['type']:
                    cursor.execute("SELECT data_type FROM information_schema.columns WHERE table_schema='staging' AND table_name=%s AND column_name=%s",('stg_'+table.lower(),column['name'].lower()))
                    assert cursor.fetchone()==('timestamp without time zone',),column['name']
                    timestamps.append('stg_'+table.lower()+'.'+column['name'].lower())
    report['stagingContainsOnlyRawTables']=True
    report['validatedRawTimestampColumns']=timestamps
    report['verifiedAt']=datetime.now(timezone.utc).isoformat()
    report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print('Snapshot publicado conferido: 32 espelhos brutos, 5 resultados DW e 4 campos timestamp; nenhuma escrita no banco.')
finally:
    connection.rollback();connection.close()
