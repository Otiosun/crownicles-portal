/** CP056: prove that a TAP summary cannot invent test points that never ran.
 * These are parser/runner integrity tests, not native game or CI certification. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {parseTapSummaries,inspectLabEvidence,runLabGate} from '../p0-lab-convergence.cp053.mjs';

const summary=(n,records=Array.from({length:n},(_,i)=>`ok ${i+1} - case ${i+1}`))=>
 `TAP version 13\n${records.join('\n')}\n1..${n}\n# tests ${n}\n# pass ${n}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
const normal=summary(210);
const tag=(n,out=normal)=>inspectLabEvidence(n,out);

test('CP056 RED source case: 210 claimed tests with only one executed record are rejected',()=>{
 const fabricated=summary(210,['ok 1 - only test that ran']);
 assert.throws(()=>tag('p0',fabricated),/CP056_TAP_RECORD_COUNT_MISMATCH/);
});
test('CP056 cannot accept omitted or duplicated test points with fake perfect totals',()=>{
 assert.throws(()=>parseTapSummaries(normal.replace('ok 210 - case 210\n','')),/TAP_RECORD_COUNT_MISMATCH/);
 assert.throws(()=>parseTapSummaries(normal.replace('ok 210 - case 210\n','ok 209 - case 209\nok 210 - case 210\n')),/TAP_RECORD_COUNT_MISMATCH/);
});
test('CP056 requires root TAP records to agree with sequential root plan',()=>{
 assert.throws(()=>parseTapSummaries(normal.replace('ok 9 - case 9','ok 99 - case 9')),/TAP_RECORD_COUNT_MISMATCH/);
 assert.throws(()=>parseTapSummaries(normal.replace('1..210','1..209')),/TAP_RECORD_COUNT_MISMATCH/);
});
test('CP056 refuses a not-ok result even when summary falsely claims zero failures',()=>{
 const fabricated=normal.replace('ok 32 - case 32','not ok 32 - case 32');
 assert.throws(()=>parseTapSummaries(fabricated),/TAP_NONPASS_RECORD/);
});
test('CP056 refuses SKIP and TODO annotations even with forged summary pass=tests',()=>{
 for(const annotation of ['# SKIP omitted',' # TODO followup']){
  const fabricated=normal.replace('ok 32 - case 32','ok 32 - case 32 '+annotation);
  assert.throws(()=>parseTapSummaries(fabricated),/TAP_NONPASS_RECORD/);
 }
});
test('CP056 retains a valid 210-point flat Node ledger',()=>{
 assert.equal(tag('p0',normal).count,210);
});
test('CP056 understands actual nested Node TAP with subtests and root plan',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cp056-nested-'));
 try{
  const entry=join(dir,'nested.mjs');
  writeFileSync(entry,`import test from 'node:test';\n`+
    `test('flat 1',()=>{});\n`+
    `test('parent',async t=>{await t.test('child1',()=>{});await t.test('child2',()=>{})});\n`+
    `test('flat 2',()=>{});\n`);
  const {NODE_TEST_CONTEXT: _nestedTestContext,...env}=process.env;
  const run=spawnSync(process.execPath,['--test',entry],{encoding:'utf8',timeout:12000,env});
  assert.equal(run.status,0,run.stderr);
  const parsed=parseTapSummaries(run.stdout);
  assert.equal(parsed.tests,5);
  assert.equal(parsed.pass,5);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('CP056 accepts real Node describe() suites, which are not counted as tests',()=>{
 const dir=mkdtempSync(join(tmpdir(),'cp056-suite-'));
 try{
  const entry=join(dir,'suite.mjs');
  writeFileSync(entry,`import {describe,it} from 'node:test';\n`+
   `describe('suite',()=>{it('first',()=>{});it('second',()=>{});});\n`);
  const {NODE_TEST_CONTEXT: _nestedTestContext,...env}=process.env;
  const run=spawnSync(process.execPath,['--test',entry],{encoding:'utf8',timeout:12000,env});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/^# suites 1$/m);
  const result=parseTapSummaries(run.stdout);
  assert.equal(result.tests,2);
  assert.equal(result.pass,2);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('CP056 fake gate cannot report PASS if P0 summary invents executed records',()=>{
 const stdout=summary(210,['ok 1 - only test']);
 const messages=[];
 assert.throws(()=>runLabGate({execute:()=>({status:0,stdout,stderr:''}),report:x=>messages.push(x)}),/CP056_TAP_RECORD_COUNT_MISMATCH/);
 assert.deepEqual(messages,[]);
});
