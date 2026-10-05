import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';

const suites=await import('../scripts/test-suites.mjs').catch(()=>({}));
test('public and real test profiles classify every test without silently dropping new files',()=>{
 assert.equal(typeof suites.selectTests,'function','test suites must be explicit for clean clones');
 const files=readdirSync(new URL('./',import.meta.url)).filter(file=>file.endsWith('.test.js'));
 const all=suites.selectTests('real',files);
 assert.deepEqual(all,[...files].sort());
 const publicFiles=suites.selectTests('public',files);
 assert.ok(publicFiles.includes('settings.test.js'));
 assert.ok(publicFiles.includes('strategic.test.js'));
 assert.ok(!publicFiles.includes('reference-full.test.js'));
 assert.throws(()=>suites.selectTests('public',[...files,'unclassified-new.test.js']),/classifica/i);
 assert.throws(()=>suites.selectTests('unknown',files),/perfil/i);
});
