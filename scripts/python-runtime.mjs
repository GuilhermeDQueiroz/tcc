import {existsSync} from 'node:fs';

export function pythonExecutable({root,platform=process.platform,env=process.env,exists=existsSync}){
 if(env.PYTHON)return env.PYTHON;
 const local=`${root.replaceAll('\\','/').replace(/\/$/,'')}/.venv/${platform==='win32'?'Scripts/python.exe':'bin/python'}`;
 return exists(local)?local:'python';
}
