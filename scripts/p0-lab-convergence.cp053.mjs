/**
 * Crownicles CP053 — one-command, fail-closed P0 LAB evidence gate.
 * Scope: current P0 Node tests + loopback HTTPS protocol + Chromium DOM suite.
 * It DOES NOT prove a real browser TLS cookie policy, real WA, OIDC or MariaDB.
 * Stacked on CP052; no external network, game mutation or production access.
 */
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const TIMEOUTS=Object.freeze({p0:180000,https:180000,browser:300000});
const browserMarkers=Object.freeze([
 ['UX-P0-010 Chromium checks',46],
 ['CP047 keyboard/accessibility-tree smoke:',10],
 ['CP047 cross-engine HTTP+DOM',14],
 ['CP048 Chromium linking checks',19],
 ['CP050 Chromium inventory search',20],
 ['CP051 BROWSER:',11],
 ['CP052 PR21 real-controller/catalog Chromium journey:',23]
]);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const bad=(code)=>{throw Error(code)};

export function parseTapSummaries(output){
 if(typeof output!=='string')bad('CP053_OUTPUT_INVALID');
 const keys=['tests','pass','fail','cancelled','skipped','todo'];
 const parsed=Object.create(null);
 for(const k of keys)parsed[k]=[...output.matchAll(new RegExp(`^# ${k} ([0-9]+)\\s*$`,'gm'))].map(m=>Number(m[1]));
 if(parsed.tests.length!==1||keys.some(k=>parsed[k].length!==1))bad('CP053_TAP_SUMMARY_MISSING_OR_DUPLICATE');
 const o=Object.fromEntries(keys.map(k=>[k,parsed[k][0]]));
 if(keys.some(k=>!Number.isSafeInteger(o[k]))||o.tests<1||o.pass!==o.tests||
  o.fail!==0||o.cancelled!==0||o.skipped!==0||o.todo!==0)bad('CP053_TAP_NOT_ALL_EXECUTED');
 return Object.freeze(o);
}
export function inspectLabEvidence(stage,output){
 if(!['p0','https','browser'].includes(stage)||typeof output!=='string')bad('CP053_STAGE_INVALID');
 if(stage==='p0'){
  const result=parseTapSummaries(output);
  if(result.tests<202)bad('CP053_P0_BASELINE_DROPPED');
  return Object.freeze({stage,count:result.tests});
 }
 if(stage==='https'){
  const summaries=parseTapSummaries(output);
  if(summaries.tests<12)bad('CP053_HTTPS_NODE_BASELINE_DROPPED');
  if(!/^Ran 4 tests in [^\r\n]+\r?\n\s*\r?\nOK\s*$/m.test(output))bad('CP053_HTTPS_PYTHON_NOT_PROVEN');
  if(!/^CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=12; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED\s*$/m.test(output))bad('CP053_HTTPS_RUNNER_NOT_CONFIRMED');
  return Object.freeze({stage,count:summaries.tests+4});
 }
 let sum=0;
 for(const [prefix,min] of browserMarkers){
  const rx=new RegExp('^'+esc(prefix)+'\\s+([0-9]+)\\s*\\/\\s*([0-9]+)\\s*$','gm');
  const found=[...output.matchAll(rx)];
  if(found.length!==1)bad('CP053_BROWSER_MARKER_MISSING_OR_DUPLICATE:'+prefix);
  const pass=Number(found[0][1]),total=Number(found[0][2]);
  if(!Number.isSafeInteger(pass)||pass!==total||total<min)bad('CP053_BROWSER_BASELINE_DROPPED:'+prefix);
  sum+=total;
 }
 return Object.freeze({stage,count:sum});
}
const stages=Object.freeze([
 {name:'p0',script:'test:p0'},
 {name:'https',script:'test:p0:https'},
 {name:'browser',script:'test:p0:browser'}
]);
/** Captures outputs so tests cannot pass by exiting 0 after silently skipping. */
export function runLabGate({cwd=ROOT,execute=spawnSync,report=console.log,platform=process.platform}={}){
 if(typeof execute!=='function'||typeof report!=='function')bad('CP053_CALLBACK_REQUIRED');
 const results=[];
 for(const stage of stages){
  const bin=platform==='win32'?'npm.cmd':'npm';
  const response=execute(bin,['run',stage.script],{
   cwd,encoding:'utf8',maxBuffer:32*1024*1024,timeout:TIMEOUTS[stage.name],
   env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}
  });
  if(response?.error)bad(`CP053_${stage.name}_SPAWN:${response.error.code??'UNKNOWN'}`);
  if(response?.signal)bad(`CP053_${stage.name}_SIGNAL:${response.signal}`);
  if(response?.status!==0)bad(`CP053_${stage.name}_EXIT:${response?.status??'NONE'}`);
  const evidence=inspectLabEvidence(stage.name,`${response.stdout??''}\n${response.stderr??''}`);
  results.push(evidence);
  report(`CP053_STAGE_${stage.name.toUpperCase()}=PASS; CASES=${evidence.count}`);
 }
 report('CP053_LOCAL_P0_GATE=PASS; AUTH_REAL=NOT_TESTED; MARIADB_REAL=NOT_TESTED; BROWSER_TLS=NOT_TESTED; CI_RUNNER=NOT_TESTED');
 return Object.freeze(results);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runLabGate()}catch(e){console.error('CP053_LOCAL_P0_GATE=FAIL; '+String(e?.message??'UNKNOWN'));process.exitCode=1}
}
