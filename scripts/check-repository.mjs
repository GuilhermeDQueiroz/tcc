import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {inspectRepositoryFile} from './repository-policy.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const git=args=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/').replace(/\/$/,'')}`,...args],{cwd:root,maxBuffer:16*1024*1024});
try{
 const files=git(['ls-files','--cached','-z']).toString('utf8').split('\0').filter(Boolean);
 if(!files.length)throw new Error('Nenhum arquivo no índice Git. Prepare os arquivos com git add antes da conferência.');
 const findings=[];
 let bytes=0;
 for(const file of files){
  const content=git(['show',`:${file}`]);bytes+=content.length;
  const reasons=inspectRepositoryFile(file,content);
  if(reasons.length)findings.push({file,reasons});
 }
 if(findings.length){
  for(const finding of findings)console.error(`${finding.file}: ${finding.reasons.join('; ')}`);
  process.exitCode=1;
 }else console.log(`Índice Git conferido: ${files.length} arquivos, ${(bytes/1024/1024).toFixed(2)} MiB; sem ocorrências nas regras verificadas.`);
}catch(error){console.error(error.code?'Não foi possível conferir o índice Git.':error.message);process.exitCode=1;}
