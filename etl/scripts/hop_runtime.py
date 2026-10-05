"""Shared Hop project bootstrap, with runtime credentials in memory only."""
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def prepare_runtime(env=None):
    env = dict(os.environ if env is None else env)
    local = ROOT/'.local'
    config_dir = local/'hop-config'
    config_dir.mkdir(parents=True,exist_ok=True)
    config = {'projectsConfig':{'enabled':True,'projectMandatory':True,
        'defaultProject':'legacy-refatorado','projectConfigurations':[
            {'projectName':'legacy-refatorado','projectHome':str(ROOT/'etl'),
             'configFilename':'project-config.json'}]}}
    (config_dir/'hop-config.json').write_text(json.dumps(config,indent=2),encoding='utf-8')
    hop_home = Path(env.get('HOP_HOME',str(Path.home()/'Downloads/apache-hop-client-2.19.0/hop')))
    java_home = Path(env.get('HOP_JAVA_HOME',env.get('JAVA_HOME',r'C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot')))
    if not (hop_home/'lib/core').is_dir() or not (java_home/'bin/javac.exe').is_file():
        raise SystemExit('Defina HOP_HOME e HOP_JAVA_HOME com o Hop 2.19 e o JDK 21 instalados.')
    defaults = {'PG_HOST':'localhost','PG_PORT':'5434','PG_DATABASE':'dados',
        'FIREBIRD_HOST':'localhost','FIREBIRD_PORT':'3050',
        'FIREBIRD_DATABASE':''}
    for key,value in defaults.items(): env.setdefault(key,value)
    if env['PG_DATABASE'] != 'dados' or env['PG_PORT'] != '5434' or env['PG_HOST'] not in ['localhost','127.0.0.1','::1']:
        raise SystemExit('O ETL deste projeto exige o destino local dados na porta 5434.')
    env.update(HOP_CONFIG_FOLDER=str(config_dir),HOP_SHARED_JDBC_FOLDERS=str(ROOT/'etl/lib'),
        HOP_AUDIT_FOLDER=str(local/'hop-audit'),HOP_OPTIONS='-Xmx1536m')
    for source,target in [('FIREBIRD','DB_FIREBIRD'),('PG','DB_POSTGRES')]:
        for key in ['HOST','PORT','USER','PASSWORD']:
            if source+'_'+key in env: env[target+'_'+key]=env[source+'_'+key]
    env['DB_FIREBIRD_DB']=env['FIREBIRD_DATABASE']
    env['DB_FIREBIRD_URL']=f"jdbc:firebirdsql://{env['FIREBIRD_HOST']}:{env['FIREBIRD_PORT']}/{env['FIREBIRD_DATABASE']}?encoding=ISO8859_1&columnLabelForName=true&defaultTransactionIsolation=TRANSACTION_READ_COMMITTED"
    env['DB_POSTGRES_DB']=env['PG_DATABASE']
    java_dir=local/'java'
    java_dir.mkdir(exist_ok=True)
    classpath=os.pathsep.join([str(hop_home/'lib/core/*'),str(hop_home/'lib/spark-client/*'),
        str(hop_home/'lib/swt/win64/*'),str(java_dir)])
    subprocess.run([str(java_home/'bin/javac.exe'),'-proc:none','-encoding','UTF-8',
        '-cp',classpath,'-d',str(java_dir),str(ROOT/'etl/scripts/HopLauncher.java')],check=True,
        creationflags=subprocess.CREATE_NO_WINDOW)
    opens=['java.base/java.lang','java.base/java.lang.invoke','java.base/java.lang.reflect',
        'java.base/java.io','java.base/java.net','java.base/java.nio','java.base/java.util',
        'java.base/java.util.concurrent','java.base/sun.nio.ch','java.xml/jdk.xml.internal']
    command=[str(java_home/'bin/java.exe'),'-Xmx1536m','-Dfile.encoding=UTF-8',
        '-Dstdout.encoding=UTF-8','-Dstderr.encoding=UTF-8']
    command += ['--add-opens='+name+'=ALL-UNNAMED' for name in opens]
    command += ['-cp',classpath,'HopLauncher']
    return env,command,hop_home
