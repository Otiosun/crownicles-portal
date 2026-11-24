import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inspectLabEvidence,parseTapSummaries,runLabGate,CP059_REQUIRED_CASES} from '../p0-lab-convergence.cp053.mjs';

const caseName=i=>i>=221&&i<239?CP059_REQUIRED_CASES[i-221]:`fixture-${i+1}`;
const tap=(n,{pass=n,fail=0,skipped=0,todo=0,cancelled=0}={})=>
  `TAP version 13\n${Array.from({length:n},(_,i)=>`# Subtest: ${caseName(i)}\nok ${i+1} - ${caseName(i)}\n`).join('')}1..${n}\n# tests ${n}\n# pass ${pass}\n# fail ${fail}\n# cancelled ${cancelled}\n# skipped ${skipped}\n# todo ${todo}\n`;
const browser=[
 'UX-P0-010 Chromium checks 46 / 46',
 'CP047 keyboard/accessibility-tree smoke: 10 / 10',
 'CP047 cross-engine HTTP+DOM 14 / 14',
 'CP048 Chromium linking checks 19 / 19',
 'CP050 Chromium inventory search 20/20',
 'CP051 BROWSER: 11 / 11',
 'CP052 PR21 real-controller/catalog Chromium journey: 23 / 23',
 'CP054 BROWSER 104 / 104',
 'CP055 Chromium focus regression 24/24',
 'CP055 deterministic Chromium focus-race: 14 / 14',
 'CP056 ZOOM BROWSER: 130 / 130'
].join('\n');
const https=tap(12)+'CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=12; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED\n'+'Ran 4 tests in 1.54s\n\nOK\n';
const preview=tap(1);

test('CP055 positive source-shaped P0, HTTPS, Chromium ledgers',()=>{
 assert.deepEqual([inspectLabEvidence('p0',tap(239)).count,inspectLabEvidence('https',https).count,inspectLabEvidence('browser',browser).count,inspectLabEvidence('preview',preview).count],[239,16,415,1]);
});
test('CP055 fails closed if baseline P0 test count drops even with exit zero',()=>{
 assert.throws(()=>inspectLabEvidence('p0',tap(238)),/P0_BASELINE_DROPPED/);
});
test('CP055 rejects stale, duplicate or missing TAP summaries',()=>{
 assert.throws(()=>parseTapSummaries(''),/SUMMARY/);
 assert.throws(()=>parseTapSummaries(tap(239)+tap(239)),/SUMMARY/);
 assert.throws(()=>parseTapSummaries('1..239\n# tests 239\n# pass 239'),/SUMMARY/);
});
test('CP055 rejects skipped, failed, cancelled and TODO cases',()=>{
 for(const change of [{pass:238,skipped:1},{pass:238,fail:1},{pass:238,cancelled:1},{pass:238,todo:1}])
  assert.throws(()=>inspectLabEvidence('p0',tap(239,change)),/NOT_ALL_EXECUTED/);
});
test('CP055 rejects a fake HTTPS PASS marker with no Python suite',()=>{
 assert.throws(()=>inspectLabEvidence('https',tap(12)+'CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=12; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED'),/PYTHON_NOT_PROVEN/);
});
test('CP055 rejects HTTPS Python 3 tests and Node 11 tests',()=>{
 assert.throws(()=>inspectLabEvidence('https',https.replace('Ran 4 tests','Ran 3 tests')),/PYTHON_NOT_PROVEN/);
 assert.throws(()=>inspectLabEvidence('https',https.replace(tap(12),tap(11))),/NODE_BASELINE_DROPPED/);
});
test('CP055 rejects HTTPS omission of runner terminal confirmation',()=>{
 assert.throws(()=>inspectLabEvidence('https',https.replace('CP049_HTTPS_PROTOCOL_GATE=PASS','CP049_HTTPS_PROTOCOL_GATE=OFF')),/RUNNER_NOT_CONFIRMED/);
});
test('CP055 rejects absent Chromium component even if remaining tests are green',()=>{
 assert.throws(()=>inspectLabEvidence('browser',browser.replace(/^CP052 PR21.*$/m,'')),/MARKER_MISSING/);
});
test('CP055 rejects duplicate Chromium marker and false total',()=>{
 assert.throws(()=>inspectLabEvidence('browser',browser+'\nUX-P0-010 Chromium checks 46 / 46'),/DUPLICATE/);
 assert.throws(()=>inspectLabEvidence('browser',browser.replace('20/20','19/20')),/BASELINE_DROPPED/);
 assert.throws(()=>inspectLabEvidence('browser',browser.replace('20/20','19/19')),/BASELINE_DROPPED/);
});
test('CP055 requires exactly four stage commands without mutations or network',()=>{
 const calls=[],logs=[],data=[tap(239),https,browser,preview];
 const out=runLabGate({execute:(bin,args,opts)=>{
  calls.push([bin,...args]);
  assert.ok(opts.timeout<=300_000);
  assert.equal(opts.env.PYTHONDONTWRITEBYTECODE,'1');
  return {status:0,stdout:data[calls.length-1],stderr:''};
 },report:x=>logs.push(x)});
 assert.deepEqual(calls.map(row=>row.slice(1)),[['run','test:p0'],['run','test:p0:https'],['run','test:p0:browser'],['run','test:p0:preview']]);
 assert.deepEqual(out.map(x=>x.count),[239,16,415,1]);
 assert.match(logs.at(-1),/AUTH_REAL=NOT_TESTED.*MARIADB_REAL=NOT_TESTED.*BROWSER_TLS=NOT_TESTED/);
});
test('CP055 stops immediately if a later stage fails or never ran',()=>{
 const calls=[];
 assert.throws(()=>runLabGate({execute:(bin,args)=>{
  calls.push(args[1]);return calls.length===1?{status:0,stdout:tap(239)}:{status:1,stdout:https};
 },report:()=>{}}),/CP055_https_EXIT/);
 assert.deepEqual(calls,['test:p0','test:p0:https']);
});
test('CP055 stops on dependency errors and timeout signals',()=>{
 assert.throws(()=>runLabGate({execute:()=>({error:{code:'ENOENT'}}),report:()=>{}}),/SPAWN:ENOENT/);
 assert.throws(()=>runLabGate({execute:()=>({signal:'SIGTERM'}),report:()=>{}}),/SIGNAL:SIGTERM/);
});
test('CP055 npm.cmd uses Windows command-shell transport with fixed arguments only',()=>{
 const results=[tap(239),https,browser,preview];let i=0;
 runLabGate({platform:'win32',execute:(bin,args,opts)=>{
  assert.equal(bin,'npm.cmd');
  assert.deepEqual(args,['run',['test:p0','test:p0:https','test:p0:browser','test:p0:preview'][i]]);
  assert.equal(opts.shell,true,'Windows .cmd scripts need the shell transport');
  return {status:0,stdout:results[i++]};
 },report:()=>{}});
 assert.equal(i,4);
});

test('CP055 real npm subprocess smoke passes and rejects missing browser evidence',()=>{
 const root=mkdtempSync(join(tmpdir(),'cp053-npm-'));
 try{
  mkdirSync(join(root,'scripts'));
  const own=resolve(dirname(fileURLToPath(import.meta.url)),'../p0-lab-convergence.cp053.mjs');
  copyFileSync(own,join(root,'scripts/p0-lab-convergence.cp053.mjs'));
  const fake=(name,output)=>writeFileSync(join(root,`fake-${name}.cjs`),`process.stdout.write(${JSON.stringify(output)});\n`);
  fake('p0',tap(239));fake('https',https);fake('browser',browser);fake('preview',preview);
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'cp053-fixture',private:true,scripts:{
   'test:p0':'node fake-p0.cjs','test:p0:https':'node fake-https.cjs',
   'test:p0:browser':'node fake-browser.cjs','test:p0:preview':'node fake-preview.cjs','gate:p0:lab':'node scripts/p0-lab-convergence.cp053.mjs'
  }}));
  const run=()=>spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','gate:p0:lab'],{
   cwd:root,encoding:'utf8',shell:process.platform==='win32',timeout:30000
  });
  const green=run();
  assert.equal(green.status,0,green.stderr);
  assert.match(green.stdout,/CP055_STAGE_BROWSER=PASS; CASES=415/);
  fake('browser',browser.replace(/^CP052 PR21.*$/m,''));
  const red=run();
  assert.equal(red.status,1);
  assert.match(red.stderr,/CP055_BROWSER_MARKER_MISSING_OR_DUPLICATE/);
  assert.doesNotMatch(red.stdout,/CP055_LOCAL_P0_GATE=PASS/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('CP055 TAP needs a version, a bounded plan and an executed test record',()=>{
 for(const invalid of [tap(239).replace('TAP version 13\n',''),tap(239).replace('1..239','1..999'),tap(239).replace('ok 1 - fixture-1\n','')])
  assert.throws(()=>inspectLabEvidence('p0',invalid),/TAP_(?:PLAN_MISSING_OR_INCONSISTENT|RECORD_COUNT_MISMATCH|NESTING_INVALID)/);
});

test('CP055 refuses missing CP054/focus Chromium markers',()=>{
 for(const marker of [/^CP054 BROWSER.*$/m,/^CP055 Chromium focus regression.*$/m])
  assert.throws(()=>inspectLabEvidence('browser',browser.replace(marker,'')),/MARKER_MISSING/);
});
test('CP055 rejects skipped or missing HTTPS preview',()=>{
 assert.throws(()=>inspectLabEvidence('preview',''),/SUMMARY/);
 assert.throws(()=>inspectLabEvidence('preview',tap(1,{pass:0,skipped:1})),/NOT_ALL_EXECUTED/);
});

test('CP056 fails if TAP claims 239 passed but only one test record exists',()=>{
 const fake='TAP version 13\n# Subtest: one\nok 1 - one\n1..239\n# tests 239\n# pass 239\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.throws(()=>inspectLabEvidence('p0',fake),/CP056_TAP_RECORD_COUNT_MISMATCH/);
});
test('CP056 rejects duplicate ordinal, missing subtest and not-ok amidst green summary',()=>{
 const canonical=tap(239);
 assert.throws(()=>inspectLabEvidence('p0',canonical.replace('ok 110 - fixture-110','ok 109 - fixture-110')),/CP056_TAP_RECORD_ORDER_INVALID/);
 assert.throws(()=>inspectLabEvidence('p0',canonical.replace('# Subtest: fixture-40\n','')),/CP056_TAP_(?:RECORD_(?:COUNT|PAIR)_MISMATCH|NESTING_INVALID)/);
 assert.throws(()=>inspectLabEvidence('p0',canonical.replace('ok 40 - fixture-40','not ok 40 - fixture-40')),/CP056_TAP_RECORD_ORDER_INVALID/);
 assert.throws(()=>inspectLabEvidence('p0',canonical.replace('1..239','1..238')),/CP056_TAP_RECORD_COUNT_MISMATCH/);
});
test('CP056 accepts real flat TAP stream but rejects preview claim without matching record',()=>{
 assert.equal(inspectLabEvidence('p0',tap(239)).count,239);
 assert.equal(inspectLabEvidence('preview',tap(1)).count,1);
 assert.throws(()=>inspectLabEvidence('preview',tap(1).replace('ok 1 - fixture-1','ok 9 - fixture-1')),/CP056_TAP_RECORD_ORDER_INVALID/);
});


test('CP056 real npm subprocess rejects a fabricated 239/239 with one executed test',()=>{
 const root=mkdtempSync(join(tmpdir(),'cp056-npm-red-'));
 try{
  mkdirSync(join(root,'scripts'));
  copyFileSync(resolve(dirname(fileURLToPath(import.meta.url)),'../p0-lab-convergence.cp053.mjs'),
   join(root,'scripts/p0-lab-convergence.cp053.mjs'));
  const fake=(name,output)=>writeFileSync(join(root,`fake-${name}.cjs`),`process.stdout.write(${JSON.stringify(output)});\n`);
  const forged='TAP version 13\n# Subtest: only-one\nok 1 - only-one\n1..239\n# tests 239\n# pass 239\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
  fake('p0',forged);fake('https',https);fake('browser',browser);fake('preview',preview);
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'cp056-replay',private:true,scripts:{
   'test:p0':'node fake-p0.cjs','test:p0:https':'node fake-https.cjs',
   'test:p0:browser':'node fake-browser.cjs','test:p0:preview':'node fake-preview.cjs',
   'gate:p0:lab':'node scripts/p0-lab-convergence.cp053.mjs'
  }}));
  const run=()=>spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','gate:p0:lab'],{
   cwd:root,encoding:'utf8',shell:process.platform==='win32',timeout:30000
  });
  const red=run();assert.equal(red.status,1,red.stdout+'\n'+red.stderr);
  assert.match(red.stderr,/CP056_TAP_RECORD_COUNT_MISMATCH/);
  assert.doesNotMatch(red.stdout,/CP055_STAGE_HTTPS=PASS|CP055_LOCAL_P0_GATE=PASS/);
  fake('p0',tap(239));
  const green=run();assert.equal(green.status,0,green.stderr);
  assert.match(green.stdout,/CP055_LOCAL_P0_GATE=PASS/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('CP056 accepts genuine Node 22 nested TAP with root plan smaller than total tests',()=>{
 const root=mkdtempSync(join(tmpdir(),'cp056-nested-'));
 try{
  const file=join(root,'nested.test.cjs');
  writeFileSync(file,"const test=require('node:test'); const assert=require('node:assert/strict');\n"+
   "test('outer suite',async(t)=>{await t.test('inner one',()=>assert.ok(true));await t.test('inner two',()=>assert.ok(true));});\n"+
   "test('flat',()=>assert.ok(true));\n");
  const childEnv={...process.env};delete childEnv.NODE_TEST_CONTEXT;
  const run=spawnSync(process.execPath,['--test',file],{encoding:'utf8',timeout:10000,env:childEnv});
  assert.equal(run.status,0,run.stderr);
  const output=run.stdout;
  assert.match(output,/1\.\.2\n# tests 4/);
  assert.equal(parseTapSummaries(output).tests,4);
  assert.throws(()=>parseTapSummaries(output.replace('    ok 2 - inner two','    ok 1 - inner two')),/CP056_TAP_RECORD_ORDER_INVALID/);
  assert.throws(()=>parseTapSummaries(output.replace('    1..2','    1..1')),/CP056_TAP_RECORD_COUNT_MISMATCH/);
  assert.throws(()=>parseTapSummaries(output.replace('    1..2\nok 1 - outer suite','ok 1 - outer suite\n    1..2')),/CP056_TAP_NESTING_INVALID/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('CP056 accepts Node describe() TAP with suites separate from counted tests',()=>{
 const root=mkdtempSync(join(tmpdir(),'cp056-describe-'));
 try{
  const file=join(root,'describe.test.cjs');
  writeFileSync(file,"const {describe,it}=require('node:test');const assert=require('node:assert/strict');\n"+
   "describe('block',()=>{it('one',()=>assert.ok(true));it('two',()=>assert.ok(true));});\n"+
   "it('flat',()=>assert.ok(true));\n");
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const run=spawnSync(process.execPath,['--test',file],{encoding:'utf8',timeout:10000,env});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/1\.\.2\n# tests 3\n# suites 1/);
  assert.equal(parseTapSummaries(run.stdout).tests,3);
  assert.throws(()=>parseTapSummaries(run.stdout.replace('# suites 1','# suites 0')),/CP056_TAP_RECORD_COUNT_MISMATCH/);
 }finally{rmSync(root,{recursive:true,force:true});}
});


test('CP057 gate rejects missing or incomplete CP056 zoom evidence',()=>{
 assert.throws(()=>inspectLabEvidence('browser',browser.replace(/^CP056 ZOOM BROWSER:.*$/m,'')),/MARKER_MISSING_OR_DUPLICATE:CP056 ZOOM BROWSER/);
 assert.throws(()=>inspectLabEvidence('browser',browser.replace('130 / 130','129 / 130')),/BASELINE_DROPPED:CP056 ZOOM BROWSER/);
 assert.throws(()=>inspectLabEvidence('browser',browser.replace('130 / 130','129 / 129')),/BASELINE_DROPPED:CP056 ZOOM BROWSER/);
 assert.throws(()=>inspectLabEvidence('browser',browser+'\nCP056 ZOOM BROWSER: 130 / 130'),/MARKER_MISSING_OR_DUPLICATE:CP056 ZOOM BROWSER/);
});
test('CP057 gate rejects old P0 baseline without the new link regression suite',()=>{
 assert.throws(()=>inspectLabEvidence('p0',tap(210)),/P0_BASELINE_DROPPED/);
 assert.equal(inspectLabEvidence('p0',tap(239)).count,239);
});


test('CP061 rejects the previous 221-case gate despite valid TAP',()=>{
 assert.throws(()=>inspectLabEvidence('p0',tap(221)),/P0_BASELINE_DROPPED/);
});
test('CP061 requires every CP059 result exactly once even with sufficient aggregate count',()=>{
 const valid=tap(239);
 assert.equal(CP059_REQUIRED_CASES.length,18);
 for(const name of CP059_REQUIRED_CASES){
  assert.throws(()=>inspectLabEvidence('p0',valid.replaceAll(name,'unrelated passing case')),/CP061_REQUIRED_CASE_MISSING_OR_DUPLICATE/);
 }
 assert.throws(()=>inspectLabEvidence('p0',valid.replaceAll(CP059_REQUIRED_CASES[1],CP059_REQUIRED_CASES[0])),/CP061_REQUIRED_CASE_MISSING_OR_DUPLICATE/);
 assert.equal(inspectLabEvidence('p0',valid.replaceAll('\n','\r\n')).count,239);
});
