import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inspectLabEvidence,parseTapSummaries,runLabGate} from '../p0-lab-convergence.cp053.mjs';

const tap=(n,{pass=n,fail=0,skipped=0,todo=0,cancelled=0}={})=>
  `TAP version 13\nok 1 - fixture\n1..${n}\n# tests ${n}\n# pass ${pass}\n# fail ${fail}\n# cancelled ${cancelled}\n# skipped ${skipped}\n# todo ${todo}\n`;
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
 'CP055 deterministic Chromium focus-race: 14 / 14'
].join('\n');
const https=tap(12)+'CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=12; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED\n'+'Ran 4 tests in 1.54s\n\nOK\n';
const preview=tap(1);

test('CP055 positive source-shaped P0, HTTPS, Chromium ledgers',()=>{
 assert.deepEqual([inspectLabEvidence('p0',tap(210)).count,inspectLabEvidence('https',https).count,inspectLabEvidence('browser',browser).count,inspectLabEvidence('preview',preview).count],[210,16,285,1]);
});
test('CP055 fails closed if baseline P0 test count drops even with exit zero',()=>{
 assert.throws(()=>inspectLabEvidence('p0',tap(209)),/P0_BASELINE_DROPPED/);
});
test('CP055 rejects stale, duplicate or missing TAP summaries',()=>{
 assert.throws(()=>parseTapSummaries(''),/SUMMARY/);
 assert.throws(()=>parseTapSummaries(tap(210)+tap(210)),/SUMMARY/);
 assert.throws(()=>parseTapSummaries('1..210\n# tests 210\n# pass 210'),/SUMMARY/);
});
test('CP055 rejects skipped, failed, cancelled and TODO cases',()=>{
 for(const change of [{pass:209,skipped:1},{pass:209,fail:1},{pass:209,cancelled:1},{pass:209,todo:1}])
  assert.throws(()=>inspectLabEvidence('p0',tap(210,change)),/NOT_ALL_EXECUTED/);
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
 const calls=[],logs=[],data=[tap(210),https,browser,preview];
 const out=runLabGate({execute:(bin,args,opts)=>{
  calls.push([bin,...args]);
  assert.ok(opts.timeout<=300_000);
  assert.equal(opts.env.PYTHONDONTWRITEBYTECODE,'1');
  return {status:0,stdout:data[calls.length-1],stderr:''};
 },report:x=>logs.push(x)});
 assert.deepEqual(calls.map(row=>row.slice(1)),[['run','test:p0'],['run','test:p0:https'],['run','test:p0:browser'],['run','test:p0:preview']]);
 assert.deepEqual(out.map(x=>x.count),[210,16,285,1]);
 assert.match(logs.at(-1),/AUTH_REAL=NOT_TESTED.*MARIADB_REAL=NOT_TESTED.*BROWSER_TLS=NOT_TESTED/);
});
test('CP055 stops immediately if a later stage fails or never ran',()=>{
 const calls=[];
 assert.throws(()=>runLabGate({execute:(bin,args)=>{
  calls.push(args[1]);return calls.length===1?{status:0,stdout:tap(210)}:{status:1,stdout:https};
 },report:()=>{}}),/CP055_https_EXIT/);
 assert.deepEqual(calls,['test:p0','test:p0:https']);
});
test('CP055 stops on dependency errors and timeout signals',()=>{
 assert.throws(()=>runLabGate({execute:()=>({error:{code:'ENOENT'}}),report:()=>{}}),/SPAWN:ENOENT/);
 assert.throws(()=>runLabGate({execute:()=>({signal:'SIGTERM'}),report:()=>{}}),/SIGNAL:SIGTERM/);
});
test('CP055 npm.cmd uses Windows command-shell transport with fixed arguments only',()=>{
 const results=[tap(210),https,browser,preview];let i=0;
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
  fake('p0',tap(210));fake('https',https);fake('browser',browser);fake('preview',preview);
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'cp053-fixture',private:true,scripts:{
   'test:p0':'node fake-p0.cjs','test:p0:https':'node fake-https.cjs',
   'test:p0:browser':'node fake-browser.cjs','test:p0:preview':'node fake-preview.cjs','gate:p0:lab':'node scripts/p0-lab-convergence.cp053.mjs'
  }}));
  const run=()=>spawnSync(process.platform==='win32'?'npm.cmd':'npm',['run','gate:p0:lab'],{
   cwd:root,encoding:'utf8',shell:process.platform==='win32',timeout:30000
  });
  const green=run();
  assert.equal(green.status,0,green.stderr);
  assert.match(green.stdout,/CP055_STAGE_BROWSER=PASS; CASES=285/);
  fake('browser',browser.replace(/^CP052 PR21.*$/m,''));
  const red=run();
  assert.equal(red.status,1);
  assert.match(red.stderr,/CP055_BROWSER_MARKER_MISSING_OR_DUPLICATE/);
  assert.doesNotMatch(red.stdout,/CP055_LOCAL_P0_GATE=PASS/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('CP055 TAP needs a version, a bounded plan and an executed test record',()=>{
 for(const invalid of [tap(210).replace('TAP version 13\n',''),tap(210).replace('1..210','1..999'),tap(210).replace('ok 1 - fixture\n','')])
  assert.throws(()=>inspectLabEvidence('p0',invalid),/TAP_PLAN_MISSING_OR_INCONSISTENT/);
});

test('CP055 refuses missing CP054/focus Chromium markers',()=>{
 for(const marker of [/^CP054 BROWSER.*$/m,/^CP055 Chromium focus regression.*$/m])
  assert.throws(()=>inspectLabEvidence('browser',browser.replace(marker,'')),/MARKER_MISSING/);
});
test('CP055 rejects skipped or missing HTTPS preview',()=>{
 assert.throws(()=>inspectLabEvidence('preview',''),/SUMMARY/);
 assert.throws(()=>inspectLabEvidence('preview',tap(1,{pass:0,skipped:1})),/NOT_ALL_EXECUTED/);
});
