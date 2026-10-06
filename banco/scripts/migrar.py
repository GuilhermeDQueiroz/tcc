"""Copy the authorized real PostgreSQL snapshot into the project's own cluster.

Passwords come from environment/getpass. The administrator password is set through stdin in single-user
mode, before opening any TCP listener; never a password file. Refuses to overwrite an existing cluster.
"""
from datetime import datetime, timezone
import getpass
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys

import psycopg2
from psycopg2 import sql

ROOT = Path(__file__).resolve().parents[2]
BANK = ROOT / 'banco'
DATA = BANK / 'data'
BIN = Path(os.environ.get('POSTGRES_BIN', r'C:\Program Files\PostgreSQL\18\bin'))


def run(args, **kwargs):
    result = subprocess.run([str(a) for a in args], check=True,
                            creationflags=subprocess.CREATE_NO_WINDOW, **kwargs)
    return result


def init_cluster(password, locale):
    # initdb opens no listener. The local trust entry is replaced before start.
    run([BIN/'initdb.exe', '-D', DATA, '-U', 'postgres', '-E', 'UTF8',
         '--locale='+locale, '--auth-local=trust', '--auth-host=scram-sha-256',
         '--no-instructions'], timeout=120)
    statement = "ALTER ROLE postgres PASSWORD '" + password.replace("'", "''") + "';\n"
    result = subprocess.run([str(BIN/'postgres.exe'), '--single', '-D', str(DATA), 'postgres'],
        input=statement, text=True, capture_output=True, timeout=60,
        creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode or 'ERROR:' in result.stderr or 'FATAL:' in result.stderr:
        raise RuntimeError('Não foi possível definir a senha em modo single-user: ' + result.stderr.replace(password,'[redigido]'))
    hba = DATA/'pg_hba.conf'
    hba.write_text(hba.read_text(encoding='utf-8').replace('trust','scram-sha-256'),encoding='utf-8')


def fingerprint(connection):
    result = {}
    with connection.cursor() as cursor:
        cursor.execute("SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('staging','dw','etl') ORDER BY 1,2")
        for schema, table in cursor.fetchall():
            cursor.execute(sql.SQL('SELECT count(*), bit_xor(hashtextextended(row_to_json(t)::text,0)), sum(hashtextextended(row_to_json(t)::text,0)::numeric) FROM {}.{} t').format(sql.Identifier(schema),sql.Identifier(table)))
            count, xor, total = cursor.fetchone()
            result[schema+'.'+table] = {'rows':count, 'xor':xor, 'sum':str(total)}
        cursor.execute("SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='S' AND n.nspname IN ('dw','staging','etl') ORDER BY 1,2")
        for schema, sequence in cursor.fetchall():
            cursor.execute(sql.SQL('SELECT last_value,is_called FROM {}.{}').format(sql.Identifier(schema),sql.Identifier(sequence)))
            result[schema+'.'+sequence] = {'sequence':list(cursor.fetchone())}
    return result


def main():
    if os.name != 'nt':
        raise SystemExit('Este instalador usa o PostgreSQL 18 para Windows.')
    initialized = DATA.exists() and any(DATA.iterdir())
    if initialized and '--resume-empty-cluster' not in sys.argv:
        raise SystemExit('banco/data já existe. Não será sobrescrito.')
    if initialized and (DATA/'PG_VERSION').read_text().strip() != '18':
        raise SystemExit('Versão do cluster divergente.')
    with socket.socket() as probe:
        if probe.connect_ex(('127.0.0.1', 5434)) == 0:
            raise SystemExit('Porta 5434 ocupada; nenhuma instância foi alterada.')
    source_password = os.environ.get('PG_PASSWORD') or getpass.getpass('Senha do API na instância de origem: ')
    admin_password = os.environ.get('PROJECT_POSTGRES_PASSWORD') or getpass.getpass('Senha do postgres para a instância do projeto: ')
    source = psycopg2.connect(host=os.environ.get('PG_HOST','localhost'),port=5432,
        dbname='dados',user=os.environ.get('PG_USER','API'),password=source_password,connect_timeout=10)
    source.set_session(isolation_level='REPEATABLE READ', readonly=True)
    started = False
    try:
        with source.cursor() as cursor:
            cursor.execute('SELECT pg_try_advisory_lock(741083,0)')
            if not cursor.fetchone()[0]:
                raise SystemExit('Outra carga está executando; tente depois.')
            cursor.execute("SELECT datcollate,datctype,pg_encoding_to_char(encoding) FROM pg_database WHERE datname=current_database()")
            collate, ctype, encoding = cursor.fetchone()
            if collate != ctype or encoding != 'UTF8':
                raise SystemExit('Locale/encoding da origem requer ajuste explícito.')
            cursor.execute('SELECT pg_export_snapshot()')
            snapshot = cursor.fetchone()[0]
        BANK.mkdir(exist_ok=True)
        backup_dir = BANK/'backups'
        backup_dir.mkdir(exist_ok=True)
        dump = backup_dir/('dados-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.dump')
        env = os.environ.copy()
        env['PGPASSWORD'] = source_password
        print('Exportando snapshot real do PostgreSQL 5432...', flush=True)
        run([BIN/'pg_dump.exe','-h',os.environ.get('PG_HOST','localhost'),'-p','5432',
            '-U',os.environ.get('PG_USER','API'),'-d','dados','-Fc','--snapshot='+snapshot,
            '-f',dump,'--no-password'],env=env,timeout=300)
        original = fingerprint(source)
        print('Inicializando PostgreSQL exclusivo em banco/data...',flush=True)
        if not initialized:
            init_cluster(admin_password,collate)
        with (DATA/'postgresql.conf').open('a',encoding='utf-8') as config:
            config.write("\n# Instância exclusiva do business-intelligence-logistica\nlisten_addresses = 'localhost'\nport = 5434\ntimezone = 'America/Sao_Paulo'\nlog_timezone = 'America/Sao_Paulo'\npassword_encryption = 'scram-sha-256'\n")
        (BANK/'logs').mkdir(exist_ok=True)
        run([BIN/'pg_ctl.exe','start','-D',DATA,'-l',BANK/'logs/postgresql.log','-w','-t','30'])
        started = True
        admin = psycopg2.connect(host='localhost',port=5434,dbname='postgres',user='postgres',password=admin_password)
        admin.autocommit = True
        try:
            with admin.cursor() as cursor:
                cursor.execute("SELECT 1 FROM pg_database WHERE datname='dados'")
                if cursor.fetchone():
                    raise RuntimeError('O destino já contém dados. Não será sobrescrito.')
                cursor.execute(sql.SQL('CREATE ROLE {} LOGIN PASSWORD %s NOSUPERUSER NOCREATEDB NOCREATEROLE').format(sql.Identifier(os.environ.get('PG_USER','API'))),(source_password,))
                cursor.execute(sql.SQL('CREATE DATABASE dados OWNER {} TEMPLATE template0').format(sql.Identifier(os.environ.get('PG_USER','API'))))
        finally:
            admin.close()
        env['PGPASSWORD'] = admin_password
        print('Restaurando dados, modelo e histórico na porta 5434...',flush=True)
        run([BIN/'pg_restore.exe','-h','localhost','-p','5434','-U','postgres','-d','dados',
             '--exit-on-error','--single-transaction','--no-password',dump],env=env,timeout=300)
        with psycopg2.connect(host='localhost',port=5434,dbname='dados',user='API',password=source_password) as target:
            target.set_session(readonly=True)
            restored = fingerprint(target)
            if restored != original:
                raise RuntimeError('Fingerprints/sequências divergentes. A origem permanece preservada.')
        with psycopg2.connect(host='localhost',port=5434,dbname='dados',user='postgres',password=admin_password) as target:
            with target.cursor() as cursor:
                cursor.execute('SHOW data_directory')
                actual_dir = Path(cursor.fetchone()[0]).resolve()
                if actual_dir != DATA.resolve():
                    raise RuntimeError('Diretório físico divergente.')
                cursor.execute('SHOW port')
                if cursor.fetchone()[0] != '5434':
                    raise RuntimeError('Porta divergente.')
        report = {'verifiedAt':datetime.now(timezone.utc).isoformat(),'sourcePort':5432,
            'targetPort':5434,'database':'dados','dataDirectory':str(DATA.resolve()),
            'backup':str(dump),'backupSha256':hashlib.file_digest(dump.open('rb'),'sha256').hexdigest(),
            'synthetic':False,'fingerprintsEqual':True,'objects':restored}
        (ROOT/'.local').mkdir(exist_ok=True)
        (ROOT/'.local/database-migration.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
        print('Migração conferida: 15 tabelas reais, sequências e diretório físico. Origem preservada.',flush=True)
    except BaseException:
        if started:
            run([BIN/'pg_ctl.exe','stop','-D',DATA,'-m','fast','-w','-t','30'])
        raise
    finally:
        source.rollback()
        source.close()


if __name__ == '__main__':
    main()
