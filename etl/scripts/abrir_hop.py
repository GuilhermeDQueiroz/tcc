"""Open the native Hop GUI with this project's workflows and metadata."""
import argparse
import getpass
import os
import subprocess
from hop_runtime import prepare_runtime, ROOT

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--conectar',action='store_true',help='Pedir senhas em memória para executar/visualizar dados reais')
args=parser.parse_args()
env=os.environ.copy()
if args.conectar:
    env.setdefault('PG_USER','API')
    env.setdefault('FIREBIRD_USER','API')
    if not env.get('PG_PASSWORD'):env['PG_PASSWORD']=getpass.getpass('Senha do API no PostgreSQL do projeto: ')
    if not env.get('FIREBIRD_PASSWORD'):env['FIREBIRD_PASSWORD']=getpass.getpass('Senha do API no Firebird: ')
env,command,hop_home=prepare_runtime(env)
command[0]=command[0].replace('java.exe','javaw.exe')
command += ['--gui','-j','business-intelligence-logistica','-f',str(ROOT/'etl/workflows/main.hwf')]
subprocess.Popen(command,env=env,cwd=hop_home,stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
print('Hop GUI iniciado com o projeto business-intelligence-logistica. Abra os arquivos pelo explorador do projeto.')
