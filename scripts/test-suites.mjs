const publicFiles=new Set([
 'api.test.js','cache.test.js','config.test.js','contracts.test.js','dates.test.js',
 'dw-treatment.test.js','etl-organization.test.js','logistics-filter-draft.test.js',
 'logistics-filters.test.js','logistics-repository.test.js','logistics-selection.test.js',
 'python-runtime.test.js','repository-policy.test.js','settings.test.js','strategic-navigation.test.js',
 'strategic.test.js','test-suites.test.js',
]);
const realFiles=new Set([
 'abertos-equivalence.test.js','abertos-payload.test.js','comercial.test.js','customers.test.js',
 'dimensions-equivalence.test.js','etl-raw.test.js','etl.test.js','extractor-sample.test.js',
 'filters.test.js','forecast.test.js','goals.test.js','hierarchy-regression.test.js',
 'metrics.test.js','open-orders.test.js','open-organization.test.js','real-raw-load.test.js',
 'reference-full.test.js','reference.test.js','repositories.test.js','table-rows.test.js',
]);

export function selectTests(profile,files){
 if(!['public','real'].includes(profile))throw new Error('Perfil de testes inválido: public ou real.');
 const unknown=files.filter(file=>!publicFiles.has(file)&&!realFiles.has(file));
 const missing=[...publicFiles,...realFiles].filter(file=>!files.includes(file));
 if(unknown.length||missing.length)throw new Error(`Classificação de testes incompleta: novos [${unknown.join(', ')}]; ausentes [${missing.join(', ')}]. Atualize scripts/test-suites.mjs.`);
 return files.filter(file=>profile==='real'||publicFiles.has(file)).sort();
}
