const privatePaths=/^(?:\.local|\.superpowers|\.agents|\.codex|node_modules|dist|test-results|playwright-report|banco\/(?:data|backups|logs)|data\/local|tests\/ui\/(?:results|screenshots)|\$ProjetoCache)(?:\/|$)/i;
const privateExtensions=/\.(?:fdb|gdb|fbk|dump|backup|bak|jar|pyc|pyo|log|pem|pfx|p12|key)$/i;
const sensitiveAssignment=/\b(?:PG_PASSWORD|FIREBIRD_PASSWORD|DB_POSTGRES_PASSWORD|DB_FIREBIRD_PASSWORD|password|senha|api[_-]?key|access[_-]?token)\b["']?[ \t]*[:=][ \t]*(["'])([^"'\r\n]*)\1/gi;
const controlledTestValues=new Set(['runtime-environment','x']);

export function inspectRepositoryFile(filename,buffer){
 const file=filename.replaceAll('\\','/');
 const reasons=[];
 if(privatePaths.test(file)||privateExtensions.test(file)||file==='data/metas-inicial.json'||(/(?:^|\/)\.env(?:\.|$)/i.test(file)&&file!=='.env.example'))
  reasons.push('arquivo de execução, banco ou configuração privada');
 if(buffer.length>5*1024*1024)reasons.push('arquivo acima do limite de 5 MiB do código versionado');
 if(buffer.includes(0)){
  if(file==='.env.example'||/\.(?:[cm]?js|jsx|ts|tsx|vue|json|xml|hpl|hwf|py|ps1|sh|ya?ml|md|txt|sql|html|css|toml|cff)$/i.test(file))
   reasons.push('arquivo textual com bytes NUL; converta para UTF-8 para permitir inspeção');
  return reasons;
 }
 const text=buffer.toString('utf8');
 if(file==='.env.example'&&/^[ \t]*(?:PG_PASSWORD|FIREBIRD_PASSWORD|DB_POSTGRES_PASSWORD|DB_FIREBIRD_PASSWORD)[ \t]*=[ \t]*[^\r\n\s]/m.test(text))
  reasons.push('o modelo de ambiente deve manter senhas vazias');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)||/\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16})\b/.test(text))
  reasons.push('material de autenticação detectado');
 for(const match of text.matchAll(sensitiveAssignment)){
  const value=match[2];
  if(!value||/^\$\{[A-Z_][A-Z0-9_]*\}$/.test(value))continue;
  if(file.startsWith('tests/')&&(controlledTestValues.has(value)||/^\$\{[a-zA-Z_][a-zA-Z0-9_]*\}$/.test(value)))continue;
  reasons.push('credencial literal detectada; use variável de ambiente');break;
 }
 return reasons;
}
