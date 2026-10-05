import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pythonExecutable} from './python-runtime.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2);
if(!args.length){console.error('Informe o script Python a executar.');process.exitCode=1;}
else{
 const result=spawnSync(pythonExecutable({root}),args,{cwd:root,stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
 if(result.error)console.error('Python indisponível. Crie .venv ou configure PYTHON; consulte docs/reproducao.md.');
 process.exitCode=result.status??1;
}
