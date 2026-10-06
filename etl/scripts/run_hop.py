"""Run Hop with secrets in environment only; never extract ERP rows in Python."""
from pathlib import Path
import datetime
import json
import os
import subprocess
import sys
import uuid
import argparse
import psycopg2
from psycopg2 import sql
from hop_runtime import prepare_runtime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

root=Path(__file__).resolve().parents[2]
local=root/'.local'
local.mkdir(exist_ok=True)
env=os.environ.copy()
parser=argparse.ArgumentParser()
parser.add_argument('--somente-dw',action='store_true',help='Reprocessa staging existente; não conecta ao Firebird')
options=parser.parse_args()
required=['PG_USER','PG_PASSWORD']
if not options.somente_dw:required+=['FIREBIRD_HOST','FIREBIRD_PORT','FIREBIRD_DATABASE','FIREBIRD_USER','FIREBIRD_PASSWORD']
missing=[k for k in required if not env.get(k)]
if missing:raise SystemExit('Variáveis obrigatórias: '+', '.join(missing))
env,command,hop_home=prepare_runtime(env)
dbname=env.get('PG_DATABASE','dados')
if dbname!='dados':raise SystemExit('Este executor exige o destino separado dados.')
connect_args=dict(host=env['PG_HOST'],port=env['PG_PORT'],user=env['PG_USER'],password=env['PG_PASSWORD'],connect_timeout=10)
admin=psycopg2.connect(dbname='postgres',**connect_args)
admin.autocommit=True
with admin.cursor() as cur:
    cur.execute('SELECT 1 FROM pg_database WHERE datname=%s',(dbname,))
    if cur.fetchone() is None:
        raise SystemExit('Banco dados ausente. Prepare a instância em banco/data antes da carga.')
admin.close()
con=psycopg2.connect(dbname=dbname,**connect_args)
con.autocommit=True
with con.cursor() as cur:
    cur.execute('SELECT pg_try_advisory_lock(741083, 0)')
    if not cur.fetchone()[0]:raise SystemExit('Outra carga já está executando.')
run_id=str(uuid.uuid4());env['ETL_RUN_ID']=run_id
secrets=[env[key] for key in ['FIREBIRD_PASSWORD','PG_PASSWORD'] if env.get(key)]
logfile=local/f'hop-{run_id}.log'
process=None
try:
    prior_report=json.loads((local/'real-load.json').read_text(encoding='utf-8')) if (local/'real-load.json').is_file() else None
    if options.somente_dw:
        backup=root/'banco/backups'/f'dw-antes-tratamento-{run_id}.dump'
        backup.parent.mkdir(parents=True,exist_ok=True)
        backup_env=env.copy();backup_env['PGPASSWORD']=env['PG_PASSWORD']
        subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe','-h',env['PG_HOST'],'-p',env['PG_PORT'],'-U',env['PG_USER'],'-d',dbname,'-Fc','-n','dw','-n','etl','-f',str(backup)],env=backup_env,check=True,creationflags=subprocess.CREATE_NO_WINDOW)
        print('Backup DW/ETL criado: '+str(backup),flush=True)
    workflow='reprocessar_dw' if options.somente_dw else 'main'
    command += ['-j','business-intelligence-logistica','-r','local','-f',str(root/f'etl/workflows/{workflow}.hwf'),'-l','Basic']
    with logfile.open('w',encoding='utf-8') as log:
        process=subprocess.Popen(command,env=env,cwd=hop_home,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace')
        for line in process.stdout:
            for secret in secrets:line=line.replace(secret,'[redigido]')
            log.write(line);log.flush()
            if any(x in line for x in ['ERROR','Finished processing','Finished workflow','Starting action','Java identified']):print(line.rstrip(),flush=True)
        returncode=process.wait()
    with con.cursor() as cur:
        cur.execute('SELECT status,contagens FROM etl.execucao_carga WHERE id=%s',(run_id,))
        result=cur.fetchone()
        if returncode!=0 or result is None or result[0]!='publicado':
            cur.execute("UPDATE etl.execucao_carga SET status='falhou',fim=now() WHERE id=%s AND status='executando'",(run_id,))
            raise SystemExit(f'Hop falhou ({returncode}). Consulte {logfile}')
        tables={}
        for area,view in {'abertos':'pedidos_abertos','emitidos':'pedidos_emitidos','faturados':'pedidos_faturados','carteira':'carteira_clientes','metas':'metas_consultores'}.items():
            cur.execute(sql.SQL('SELECT count(*) FROM dw.{}').format(sql.Identifier(view)))
            count=cur.fetchone()[0]
            assert count==result[1][area],f'Contagem divergente: {area}'
            tables[area]={'rows':count}
    report={'source':'firebird/apache-hop','synthetic':False,'runId':run_id,'validatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'hopVersion':'2.19.0','postgresHost':env['PG_HOST'],'postgresPort':int(env['PG_PORT']),'database':dbname,'tables':tables}
    report['mode']='staging-reprocessed' if options.somente_dw else 'full-extraction'
    report['executionOrigin']='staging/apache-hop' if options.somente_dw else 'firebird/apache-hop'
    report['columnContractVersion']=2
    if options.somente_dw:
        report['rawSourceRunId']=prior_report.get('rawSourceRunId',prior_report['runId']) if prior_report else None
        report['backupBeforeMigration']=str(backup)
    raw_tables={}
    with con.cursor() as cur:
        for item in json.loads((root/'etl/inventario-fontes.json').read_text(encoding='utf-8')):
            cur.execute(sql.SQL('SELECT count(*) FROM staging.{}').format(sql.Identifier(item['staging'])))
            raw_tables[item['staging']]={'rows':cur.fetchone()[0]}
    if options.somente_dw and prior_report:
        assert raw_tables==prior_report['rawTables'],'Staging mudou durante o reprocessamento.'
    report['architecture']='firebird/raw-staging/transformed-dw/dashboard'
    report['rawTables']=raw_tables
    with con.cursor() as cur:
        cur.execute("SELECT tablename FROM pg_tables WHERE schemaname='staging'")
        assert {row[0] for row in cur.fetchall()}==set(raw_tables),'Staging possui tabelas que não são espelhos brutos.'
        timestamp_columns=[]
        metadata=json.loads((root/'etl/sql/fontes/raw-source-schema.json').read_text(encoding='utf-8'))
        for table,document in metadata.items():
            for column in document['columns']:
                if 'datetime.datetime' in column['type']:
                    cur.execute("SELECT data_type FROM information_schema.columns WHERE table_schema='staging' AND table_name=%s AND column_name=%s",('stg_'+table.lower(),column['name'].lower()))
                    assert cur.fetchone()==('timestamp without time zone',),'Tipo temporal divergente: '+column['name']
                    timestamp_columns.append('stg_'+table.lower()+'.'+column['name'].lower())
    report['stagingContainsOnlyRawTables']=True
    report['validatedRawTimestampColumns']=timestamp_columns
    (local/'real-load.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True),flush=True)
finally:
    if process is not None and process.poll() is None:
        process.terminate()
        process.wait(timeout=15)
    con.close()
