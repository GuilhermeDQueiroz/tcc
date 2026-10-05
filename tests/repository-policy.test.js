import test from 'node:test';
import assert from 'node:assert/strict';

const policy=await import('../scripts/repository-policy.mjs').catch(()=>({}));
const inspect=(file,content)=>{
 assert.equal(typeof policy.inspectRepositoryFile,'function','repository policy must inspect files without printing secrets');
 return policy.inspectRepositoryFile(file,Buffer.from(content));
};

test('repository excludes runtime credentials, database copies and private evidence even when forced into Git',()=>{
 for(const file of ['.env','.env.production','.local/oracle.json','.superpowers/progress.md','banco/data/PG_VERSION','banco/backups/backup.dump','data/local/metas.json','data/metas-inicial.json','DADOS.FDB','nested/database.fbk','etl/lib/driver.jar'])
  assert.ok(inspect(file,'private').length>0,file);
 assert.deepEqual(inspect('.env.example','PG_PASSWORD=\nFIREBIRD_PASSWORD=\n'),[]);
 assert.deepEqual(inspect('data/metas-inicial.example.json','{"default":{}}'),[]);
});

test('repository rejects credential literals but permits environment variables and controlled test inputs',()=>{
 const secret=['not','a','real','credential'].join('-');
 assert.ok(inspect('etl/metadata/rdbms/DW.json',JSON.stringify({password:secret})).length>0);
 assert.ok(inspect('config.py',`PG_PASSWORD = '${secret}'`).length>0);
 assert.ok(inspect('.env.example',`PG_PASSWORD=${secret}\n`).length>0);
 assert.deepEqual(inspect('etl/metadata/rdbms/DW.json','{"password":"${DB_POSTGRES_PASSWORD}"}'),[]);
 assert.deepEqual(inspect('tests/config.test.js',"PG_PASSWORD:'runtime-environment'"),[]);
 assert.deepEqual(inspect('tests/contracts.test.js',"PG_PASSWORD:'x'"),[]);
 assert.deepEqual(inspect('tests/repository-policy.test.js',"PG_PASSWORD:'"+['${','secret}'].join('')+"'"),[]);
 assert.ok(inspect('tests/unsafe.test.js',`PG_PASSWORD:'${secret}'`).length>0);
 assert.ok(inspect('config.js',"PG_PASSWORD:'runtime-environment'").length>0);
});

test('repository detects private keys without echoing their contents and limits large blobs',()=>{
 const keyHeader=['-----BEGIN','PRIVATE KEY-----'].join(' ');
 const findings=inspect('key.txt',keyHeader+'\nPRIVATE-CONTENT');
 assert.ok(findings.length>0);
 assert.ok(!JSON.stringify(findings).includes('PRIVATE-CONTENT'));
 assert.ok(policy.inspectRepositoryFile('large.bin',Buffer.alloc(6*1024*1024)).length>0);
});

test('repository rejects text encoded with NUL bytes instead of bypassing credential inspection',()=>{
 const content=['PG_','PASS','WORD='].join('')+['controlled','test','value'].join('-')+'\n';
 const utf16=Buffer.concat([Buffer.from([0xff,0xfe]),Buffer.from(content,'utf16le')]);
 assert.ok(policy.inspectRepositoryFile('.env.example',utf16).length>0);
 assert.ok(policy.inspectRepositoryFile('config.js',utf16).length>0);
 assert.deepEqual(policy.inspectRepositoryFile('docs/images/example.png',Buffer.from([0x89,0x50,0,0x4e,0x47])),[]);
});
