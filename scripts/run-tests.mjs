import {readdirSync,readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {selectTests} from './test-suites.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
try{
 const profile=process.argv[2]||'public';
 const files=selectTests(profile,readdirSync(path.join(root,'tests')).filter(file=>file.endsWith('.test.js')));
 if(profile==='real'){
  const missing=new Set();
  const publicFiles=new Set(selectTests('public',files));
  for(const file of files.filter(file=>!publicFiles.has(file))){
   const source=readFileSync(path.join(root,'tests',file),'utf8');
   for(const match of source.matchAll(/\.local\/[^'"`\r\n]+/g)){
    const relative=match[0];
    if(relative.includes('${'))continue;
    if(!existsSync(path.join(root,relative)))missing.add(relative);
   }
  }
  if(missing.size)throw new Error(`Validação real exige referências privadas da mesma publicação: ${[...missing].join(', ')}. Consulte docs/reproducao.md; nenhum dado substituto será criado.`);
 }
 console.log(`Perfil ${profile}: ${files.length} arquivos. ${profile==='public'?'Sem acesso aos bancos nem às referências privadas.':'Inclui equivalência e evidências reais; não substitui os testes de navegador.'}`);
 const result=spawnSync(process.execPath,['--max-old-space-size=2048','--test','--test-concurrency=1',...files.map(file=>path.join('tests',file))],{cwd:root,stdio:'inherit'});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
}catch(error){console.error(error.message);process.exitCode=1;}
