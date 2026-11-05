"""Run native Hop against an explicitly selected local anonymized copy only."""
import argparse
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import uuid
import psycopg2
from hop_runtime import prepare_runtime

ROOT = Path(__file__).resolve().parents[2]


def main():
    sys.stdout.reconfigure(encoding='utf-8',errors='replace')
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database',required=True)
    parser.add_argument('--start-date',required=True)
    parser.add_argument('--reference-date',required=True)
    options = parser.parse_args()
    start = datetime.date.fromisoformat(options.start_date); reference = datetime.date.fromisoformat(options.reference_date)
    if start>reference: raise SystemExit('Período inválido.')
    source = Path(options.database).resolve(strict=True)
    if source.suffix.lower() not in ('.fdb','.gdb'): raise SystemExit('Informe a cópia Firebird local.')
    env = os.environ.copy()
    bundled = ROOT/'.local/runtime/apache-hop-2.19.0/hop'
    if (bundled/'lib/core').is_dir(): env.setdefault('HOP_HOME',str(bundled))
    for key in ['FIREBIRD_USER','FIREBIRD_PASSWORD','PG_USER','PG_PASSWORD']:
        if not env.get(key): raise SystemExit('Credencial ausente no ambiente: '+key)
    env.update(FIREBIRD_HOST='localhost',FIREBIRD_PORT=env.get('FIREBIRD_PORT','3050'),FIREBIRD_DATABASE=str(source),
               AFTERSALES_START_DATE=start.isoformat(),AFTERSALES_REFERENCE_DATE=reference.isoformat())
    env, command, hop_home = prepare_runtime(env)
    run_id = str(uuid.uuid4()); env['ETL_RUN_ID']=run_id
    connection = psycopg2.connect(host=env['PG_HOST'],port=env['PG_PORT'],dbname='dados',user=env['PG_USER'],password=env['PG_PASSWORD'])
    connection.autocommit=True
    process=None
    log_path=ROOT/'.local'/('hop-posvenda-'+run_id+'.log')
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(741083,0)')
            if not cursor.fetchone()[0]: raise SystemExit('Outra carga do projeto está executando.')
            cursor.execute("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='posvenda')")
            if cursor.fetchone()[0]:
                backup=ROOT/'banco/backups'/('posvenda-'+run_id+'.dump'); backup.parent.mkdir(parents=True,exist_ok=True)
                backup_env=env.copy();backup_env['PGPASSWORD']=env['PG_PASSWORD']
                subprocess.run([r'C:\Program Files\PostgreSQL\18\bin\pg_dump.exe','-h',env['PG_HOST'],'-p',env['PG_PORT'],'-U',env['PG_USER'],'-d','dados','-Fc','-n','posvenda','-f',str(backup)],env=backup_env,check=True,creationflags=subprocess.CREATE_NO_WINDOW)
        command += ['-j','business-intelligence-logistica','-r','local','-f',str(ROOT/'etl/workflows/posvenda_local.hwf'),'-l','Basic']
        secrets=[env['FIREBIRD_PASSWORD'],env['PG_PASSWORD']]
        with log_path.open('w',encoding='utf-8') as log:
            process=subprocess.Popen(command,env=env,cwd=hop_home,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',creationflags=subprocess.CREATE_NO_WINDOW)
            for line in process.stdout:
                for secret in secrets: line=line.replace(secret,'[redigido]')
                log.write(line);log.flush()
                if any(term in line for term in ['ERROR','Finished processing','Finished workflow','Starting action']): print(line.rstrip(),flush=True)
            code=process.wait()
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('posvenda.execucao')")
            if not cursor.fetchone()[0]: raise RuntimeError('Preparação de pós-venda falhou; consulte '+str(log_path))
            cursor.execute('SELECT status,contagens FROM posvenda.execucao WHERE id=%s',(run_id,))
            result=cursor.fetchone()
            if code!=0 or not result or result[0]!='publicado': raise RuntimeError('Publicação de pós-venda não confirmada; consulte '+str(log_path))
        report={'runId':run_id,'source':'local-anonymized-firebird/apache-hop','synthetic':False,'sourceFile':str(source),
                'startDate':start.isoformat(),'referenceDate':reference.isoformat(),'counts':result[1],'log':str(log_path)}
        (ROOT/'.local/posvenda-publicacao.json').write_text(json.dumps(report,indent=2,ensure_ascii=False),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False),flush=True)
    except BaseException:
        with connection.cursor() as cursor:
            cursor.execute("SELECT to_regclass('posvenda.execucao')")
            if cursor.fetchone()[0]: cursor.execute("UPDATE posvenda.execucao SET status='falhou',fim=now() WHERE id=%s AND status='executando'",(run_id,))
        raise
    finally:
        if process and process.poll() is None: process.terminate();process.wait(timeout=15)
        connection.close()

    # The base workflow owns the project advisory lock through this connection.
    # Publish descriptive dimensions only after releasing it, since the native
    # dimension workflow acquires the same lock on its own SQL connection.
    from run_posvenda_dimensions import main as publish_dimensions
    publish_dimensions()


if __name__ == '__main__': main()
