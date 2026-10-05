import test from 'node:test';
import assert from 'node:assert/strict';

const runtime=await import('../scripts/python-runtime.mjs').catch(()=>({}));
test('Python launcher uses explicit environment or the checkout virtual environment without requiring the sibling legacy project',()=>{
 assert.equal(typeof runtime.pythonExecutable,'function','ETL launcher must work after a standalone clone');
 const existing=new Set(['/project/.venv/Scripts/python.exe','/project/.venv/bin/python']);
 assert.equal(runtime.pythonExecutable({root:'/project',platform:'win32',env:{PYTHON:'C:/Python 3/python.exe'},exists:()=>false}),'C:/Python 3/python.exe');
 assert.equal(runtime.pythonExecutable({root:'/project',platform:'win32',env:{},exists:file=>existing.has(file)}),'/project/.venv/Scripts/python.exe');
 assert.equal(runtime.pythonExecutable({root:'/project',platform:'linux',env:{},exists:file=>existing.has(file)}),'/project/.venv/bin/python');
 assert.equal(runtime.pythonExecutable({root:'/project',platform:'linux',env:{},exists:()=>false}),'python');
});
