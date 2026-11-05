"""Publish frozen after-sales dimensions through the native Apache Hop workflow."""
import os
from pathlib import Path
import subprocess
import uuid
from hop_runtime import prepare_runtime

ROOT=Path(__file__).resolve().parents[2]

def main():
 env=os.environ.copy()
 for key in ['PG_USER','PG_PASSWORD']:
  if not env.get(key):raise SystemExit('Configure '+key+' no ambiente local.')
 bundled=ROOT/'.local/runtime/apache-hop-2.19.0/hop'
 if (bundled/'lib/core').is_dir():env.setdefault('HOP_HOME',str(bundled))
 env,command,hop_home=prepare_runtime(env)
 version=str(uuid.uuid4());env['AFTERSALES_DIMENSION_RUN_ID']=version
 command+=['-j','business-intelligence-logistica','-r','local','-f',str(ROOT/'etl/workflows/posvenda_dimensoes_local.hwf'),'-l','Basic']
 log_path=ROOT/'.local'/('hop-posvenda-dimensoes-'+version+'.log')
 with log_path.open('w',encoding='utf-8') as log:
  result=subprocess.run(command,env=env,cwd=hop_home,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,encoding='utf-8',errors='replace',creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
  output=result.stdout.replace(env['PG_PASSWORD'],'[redigido]')
  log.write(output)
  for line in output.splitlines():
   if 'ERROR' in line or 'Finished workflow' in line:print(line)
 if result.returncode:raise SystemExit('Falha na publicação. Consulte '+str(log_path))
 print('Dimensões publicadas pelo Hop: '+version)

if __name__=='__main__':main()
