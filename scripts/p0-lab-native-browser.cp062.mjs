/** CP062 composes the existing CP061 gate with mandatory CP060 native browser TLS.
 * Laboratory only. No production, Core or WA identity; no external server.
 * Logs are checked for completeness, not cryptographically signed. */
import {spawnSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runLabGate} from './p0-lab-convergence.cp053.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const CP060_REQUIRED_CHECKS=Object.freeze([
 "fixture loopback only",
 "untrusted certificate rejected by Chromium",
 "trusted HTTPS navigation secure context",
 "both contexts anonymous",
 "a link cookie native attributes",
 "a HttpOnly link invisible to JS",
 "a preapproval profile denied",
 "a pending UI has no private metrics",
 "a approval is not yet a session",
 "a real network own level",
 "a native session cookie attributes",
 "a session not exposed to JS",
 "a redeemed link cookie removed",
 "a own profile authenticated",
 "independent B still denied",
 "b link cookie native attributes",
 "b HttpOnly link invisible to JS",
 "b preapproval profile denied",
 "b pending UI has no private metrics",
 "b approval is not yet a session",
 "b real network own level",
 "b native session cookie attributes",
 "b session not exposed to JS",
 "b redeemed link cookie removed",
 "b own profile authenticated",
 "A remains isolated",
 "actual inventory and inspection",
 "return restores selected slot",
 "reload retains browser session",
 "logout clears native cookie and server session",
 "revoked synthetic cookie rejected on replay",
 "B unaffected by A logout",
 "cancel removes link cookie and code",
 "private unbind revokes B browser session",
 "revocation removes private DOM",
 "fixture exits cleanly"
]);
const BASE=Object.freeze([['p0',239],['https',16],['browser',415],['preview',1]]);
export function inspectNativeBrowserEvidence(output){
 if(typeof output!=='string')throw Error('CP062_OUTPUT_INVALID');
 const lines=output.split(/\r?\n/);
 if(lines.some(s=>/^CP060 FAIL\b|^FAIL\b/.test(s)))throw Error('CP062_NATIVE_FAILURE_MARKER');
 const summaries=lines.filter(s=>s.startsWith('CP060 NATIVE BROWSER TLS:'));
 if(summaries.length!==1||summaries[0]!=='CP060 NATIVE BROWSER TLS: 36 / 36')throw Error('CP062_NATIVE_SUMMARY_INVALID');
 const observed=lines.filter(s=>s.startsWith('PASS ')).map(s=>s.slice(5));
 if(observed.length!==CP060_REQUIRED_CHECKS.length||observed.some((s,i)=>s!==CP060_REQUIRED_CHECKS[i]))throw Error('CP062_NATIVE_CHECKS_MISSING_DUPLICATE_OR_OUT_OF_ORDER');
 if(lines.indexOf(summaries[0])<lines.lastIndexOf('PASS '+CP060_REQUIRED_CHECKS.at(-1)))throw Error('CP062_NATIVE_SUMMARY_ORDER');
 return Object.freeze({stage:'native-browser-tls',count:observed.length});
}
export function runNativeBrowserLabGate({cwd=ROOT,execute=spawnSync,baseGate=runLabGate,report=console.log,platform=process.platform}={}){
 if(typeof execute!=='function'||typeof baseGate!=='function'||typeof report!=='function')throw Error('CP062_CALLBACK_REQUIRED');
 const base=baseGate({cwd,execute,report,platform});
 if(!Array.isArray(base)||base.length!==BASE.length||BASE.some(([name,min],i)=>base[i]?.stage!==name||!Number.isSafeInteger(base[i].count)||base[i].count<min))throw Error('CP062_BASE_GATE_INCOMPLETE');
 const response=execute(platform==='win32'?'npm.cmd':'npm',['run','test:p0:browser:tls'],{cwd,encoding:'utf8',shell:platform==='win32',maxBuffer:4*1024*1024,timeout:120000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 if(response?.error)throw Error('CP062_NATIVE_SPAWN:'+String(response.error.code??'UNKNOWN'));
 if(response?.signal)throw Error('CP062_NATIVE_SIGNAL:'+response.signal);
 if(response?.status!==0)throw Error('CP062_NATIVE_EXIT:'+String(response?.status??'NONE'));
 const evidence=inspectNativeBrowserEvidence(`${response.stdout??''}\n${response.stderr??''}`);
 const results=Object.freeze([...base,evidence]);
 report('CP062_STAGE_NATIVE_BROWSER_TLS=PASS; CASES='+evidence.count);
 report('CP062_P0_COMBINED_LAB_GATE=PASS; CASES='+results.reduce((n,x)=>n+x.count,0)+'; BROWSER_TLS_LOOPBACK=PASS; AUTH_WA_OIDC_CORE_PRODUCTION=NOT_TESTED');
 return results;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{runNativeBrowserLabGate()}catch(e){console.error('CP062_P0_COMBINED_LAB_GATE=FAIL; '+String(e?.message??'UNKNOWN'));process.exitCode=1}
}
