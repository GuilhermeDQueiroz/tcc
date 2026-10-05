import fs from 'node:fs';
import path from 'node:path';
const report=JSON.parse(fs.readFileSync('.local/ui-real-playwright.json','utf8'));
if(report.stats.unexpected || report.stats.skipped || report.stats.flaky || report.stats.expected!==19)throw new Error('A rodada completa de 19 testes deve passar antes de publicar a verificação.');
const responses=new Map(),portfolios=new Map();
function walk(suite){
  for(const spec of suite.specs || [])for(const test of spec.tests || [])for(const result of test.results || []){
    if(result.status!=='passed')throw new Error(`Resultado sem aprovação: ${spec.title}`);
    for(const attachment of result.attachments || []){
      if(!attachment.name.startsWith('real-data-')&&!attachment.name.startsWith('portfolio-'))continue;
      const record=JSON.parse(attachment.body ? Buffer.from(attachment.body,'base64').toString() : fs.readFileSync(attachment.path,'utf8'));
      if(attachment.name.startsWith('portfolio-'))portfolios.set(attachment.name.slice(10),record);
      else if(record.filters==='{}')responses.set(`${record.area}/${record.tab}`,record);
    }
  }
  for(const child of suite.suites || [])walk(child);
}
for(const suite of report.suites)walk(suite);
const screenshots=[];
for(const size of ['desktop','mobile'])for(const file of fs.readdirSync(`tests/ui/screenshots/${size}`))if(file.endsWith('.png'))screenshots.push(path.resolve('tests/ui/screenshots',size,file).replaceAll('\\','/'));
const tabs={abertos:['resumo','calendario','geografia','dimensoes','pesquisa'],emitidos:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa'],faturados:['semanal','mensal','evolucao','geografia','carteira','dimensoes','pesquisa']};
const results=Object.entries(tabs).flatMap(([area,list])=>list.map(tab=>{const record=responses.get(`${area}/${tab}`);if(!record?.dataVersion)throw new Error(`Ausente resposta real: ${area}/${tab}`);const {filters,...rest}=record;return rest;}));
if(screenshots.length!==38)throw new Error('São necessárias 38 capturas de tela reais.');
const verification={timestamp:new Date().toISOString(),source:'HTTP original API3002 / Apache Hop / PostgreSQL',tests:{passed:report.stats.expected,failed:report.stats.unexpected,skipped:report.stats.skipped,durationMs:report.stats.duration},results,portfolios:Object.fromEntries(portfolios),screenshots};
fs.writeFileSync('.local/ui-real-verification.json',JSON.stringify(verification,null,2)+'\n');
console.log(JSON.stringify({passed:verification.tests.passed,analyses:results.length,screenshots:screenshots.length,portfolios:verification.portfolios}));
