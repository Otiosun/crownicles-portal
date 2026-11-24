/**
 * Crownicles CP053 — one-command, fail-closed P0 LAB evidence gate.
 * Scope: current P0 Node tests + loopback HTTPS protocol + Chromium DOM suite
 * + CP053 synthetic HTTPS portal preview (without real browser TLS).
 * It DOES NOT prove a real browser TLS cookie policy, real WA, OIDC or MariaDB.
 * No external network, game mutation or production access.
 */
import {spawnSync} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const TIMEOUTS=Object.freeze({p0:180000,https:180000,browser:300000,preview:90000});
const browserMarkers=Object.freeze([
 ['UX-P0-010 Chromium checks',46],
 ['CP047 keyboard/accessibility-tree smoke:',10],
 ['CP047 cross-engine HTTP+DOM',14],
 ['CP048 Chromium linking checks',19],
 ['CP050 Chromium inventory search',20],
 ['CP051 BROWSER:',11],
 ['CP052 PR21 real-controller/catalog Chromium journey:',23],
 ['CP054 BROWSER',104],
 ['CP055 Chromium focus regression',24],
 ['CP055 deterministic Chromium focus-race:',14],
 ['CP056 ZOOM BROWSER:',130]
]);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const bad=(code)=>{throw Error(code)};

export function parseTapSummaries(output){
 if(typeof output!=='string')bad('CP055_OUTPUT_INVALID');
 const keys=['tests','pass','fail','cancelled','skipped','todo'];
 const parsed=Object.create(null);
 for(const k of keys)parsed[k]=[...output.matchAll(new RegExp(`^# ${k} ([0-9]+)\\s*$`,'gm'))].map(m=>Number(m[1]));
 if(parsed.tests.length!==1||keys.some(k=>parsed[k].length!==1))bad('CP055_TAP_SUMMARY_MISSING_OR_DUPLICATE');
 const o=Object.fromEntries(keys.map(k=>[k,parsed[k][0]]));
 const version=[...output.matchAll(/^TAP version 13\s*$/gm)];
 const plans=[...output.matchAll(/^1\.\.([0-9]+)\s*$/gm)];
 // Node TAP v13 counts every nested test in `# tests`, while the final
 // root plan counts only top-level tests. Reconcile every `# Subtest` with
 // its `ok N - title`, then verify each indentation scope's 1..N plan.
 // This detects truncated or duplicated case records even with a forged
 // `# tests 210 / # pass 210` summary and exit zero. This is NOT a signature.
 if(version.length!==1||plans.length<1)bad('CP055_TAP_PLAN_MISSING_OR_INCONSISTENT');
 const suites=[...output.matchAll(/^# suites ([0-9]+)\s*$/gm)];
 const suiteCount=suites.length===1?Number(suites[0][1]):suites.length===0?0:NaN;
 if(!Number.isSafeInteger(suiteCount)||suiteCount<0)bad('CP056_TAP_SUITE_SUMMARY_INVALID');
 const expectedRecords=o.tests+suiteCount;
 const declarations=new Map(),results=new Map(),pending=new Map();
 const open=[];
 let allResults=0,rootPlans=0;
 const append=(map,indent,value)=>{if(!map.has(indent))map.set(indent,[]);map.get(indent).push(value)};
 for(const line of output.split(/\r?\n/)){
  const sub=/^( *)# Subtest: (.+)$/.exec(line);
  const rec=/^( *)(ok|not ok) ([0-9]+) - (.+)$/.exec(line);
  const plan=/^( *)1\.\.([0-9]+)\s*$/.exec(line);
  if(!sub&&!rec&&!plan)continue;
  const indent=(sub??rec??plan)[1].length;
  if(indent%4!==0)bad('CP056_TAP_INDENT_INVALID');
  if(sub){
   const parent=open.at(-1);
   if(parent ? indent!==parent.indent+4 : indent!==0)bad('CP056_TAP_NESTING_INVALID');
   open.push({indent,name:sub[2]});
   append(declarations,indent,sub[2]);
  }
  if(rec){
   const current=open.at(-1);
   if(!current||current.indent!==indent||current.name!==rec[4]||
     [...pending.keys()].some(d=>d>indent))bad('CP056_TAP_NESTING_INVALID');
   open.pop();allResults++;
   append(results,indent,{name:rec[4],status:rec[2]});
   append(pending,indent,{number:Number(rec[3]),status:rec[2]});
  }
  if(plan){
   if(indent===0 ? open.length!==0 : open.at(-1)?.indent!==indent-4)bad('CP056_TAP_NESTING_INVALID');
   const count=Number(plan[2]),entries=pending.get(indent)||[];
   if(!Number.isSafeInteger(count)||count<1||entries.length!==count)bad('CP056_TAP_RECORD_COUNT_MISMATCH');
   for(let i=0;i<count;i++)if(entries[i].status!=='ok'||entries[i].number!==i+1)bad('CP056_TAP_RECORD_ORDER_INVALID');
   pending.delete(indent);
   if(indent===0)rootPlans++;
  }
 }
 if(rootPlans!==1||open.length||pending.size||allResults!==expectedRecords)bad('CP056_TAP_RECORD_COUNT_MISMATCH');
 let declarationCount=0;
 for(const [indent,decl] of declarations){
  declarationCount+=decl.length;
  const observed=results.get(indent)||[];
  if(observed.length!==decl.length||decl.some((name,i)=>name!==observed[i].name))bad('CP056_TAP_RECORD_PAIR_MISMATCH');
 }
 if(declarationCount!==expectedRecords||[...results.keys()].some(indent=>!declarations.has(indent)))bad('CP056_TAP_RECORD_COUNT_MISMATCH');
 if(keys.some(k=>!Number.isSafeInteger(o[k]))||o.tests<1||o.pass!==o.tests||
  o.fail!==0||o.cancelled!==0||o.skipped!==0||o.todo!==0)bad('CP055_TAP_NOT_ALL_EXECUTED');
 return Object.freeze(o);
}
export function inspectLabEvidence(stage,output){
 if(!['p0','https','browser','preview'].includes(stage)||typeof output!=='string')bad('CP055_STAGE_INVALID');
 if(stage==='p0'){
  const result=parseTapSummaries(output);
  if(result.tests<221)bad('CP055_P0_BASELINE_DROPPED');
  return Object.freeze({stage,count:result.tests});
 }
 if(stage==='https'){
  const summaries=parseTapSummaries(output);
  if(summaries.tests<12)bad('CP055_HTTPS_NODE_BASELINE_DROPPED');
  if(!/^Ran 4 tests in [^\r\n]+\r?\n\s*\r?\nOK\s*$/m.test(output))bad('CP055_HTTPS_PYTHON_NOT_PROVEN');
  if(!/^CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=12; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED\s*$/m.test(output))bad('CP055_HTTPS_RUNNER_NOT_CONFIRMED');
  return Object.freeze({stage,count:summaries.tests+4});
 }
 if(stage==='preview'){
  const result=parseTapSummaries(output);
  if(result.tests<1)bad('CP055_PREVIEW_NOT_EXECUTED');
  return Object.freeze({stage,count:result.tests});
 }
 let sum=0;
 for(const [prefix,min] of browserMarkers){
  const rx=new RegExp('^'+esc(prefix)+'\\s+([0-9]+)\\s*\\/\\s*([0-9]+)\\s*$','gm');
  const found=[...output.matchAll(rx)];
  if(found.length!==1)bad('CP055_BROWSER_MARKER_MISSING_OR_DUPLICATE:'+prefix);
  const pass=Number(found[0][1]),total=Number(found[0][2]);
  if(!Number.isSafeInteger(pass)||pass!==total||total<min)bad('CP055_BROWSER_BASELINE_DROPPED:'+prefix);
  sum+=total;
 }
 return Object.freeze({stage,count:sum});
}
const stages=Object.freeze([
 {name:'p0',script:'test:p0'},
 {name:'https',script:'test:p0:https'},
 {name:'browser',script:'test:p0:browser'},
 {name:'preview',script:'test:p0:preview'}
]);
/** Captures outputs so tests cannot pass by exiting 0 after silently skipping. */
export function runLabGate({cwd=ROOT,execute=spawnSync,report=console.log,platform=process.platform}={}){
 if(typeof execute!=='function'||typeof report!=='function')bad('CP055_CALLBACK_REQUIRED');
 const results=[];
 for(const stage of stages){
  const bin=platform==='win32'?'npm.cmd':'npm';
  const response=execute(bin,['run',stage.script],{
   cwd,encoding:'utf8',shell:platform==='win32',maxBuffer:32*1024*1024,timeout:TIMEOUTS[stage.name],
   env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}
  });
  if(response?.error)bad(`CP055_${stage.name}_SPAWN:${response.error.code??'UNKNOWN'}`);
  if(response?.signal)bad(`CP055_${stage.name}_SIGNAL:${response.signal}`);
  if(response?.status!==0)bad(`CP055_${stage.name}_EXIT:${response?.status??'NONE'}`);
  const evidence=inspectLabEvidence(stage.name,`${response.stdout??''}\n${response.stderr??''}`);
  results.push(evidence);
  report(`CP055_STAGE_${stage.name.toUpperCase()}=PASS; CASES=${evidence.count}`);
 }
 report('CP055_LOCAL_P0_GATE=PASS; AUTH_REAL=NOT_TESTED; MARIADB_REAL=NOT_TESTED; BROWSER_TLS=NOT_TESTED; CI_RUNNER=NOT_TESTED');
 return Object.freeze(results);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runLabGate()}catch(e){console.error('CP055_LOCAL_P0_GATE=FAIL; '+String(e?.message??'UNKNOWN'));process.exitCode=1}
}
