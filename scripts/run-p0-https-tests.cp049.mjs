/** CP049 explicit extended HTTPS protocol gate. Not in default npm test.
 * This requires both local OpenSSL and Python3 stdlib, and fails closed if
 * either executable is unavailable. No workflows or external network calls.
 */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function run(executable,args,env={}){
 const r=spawnSync(executable,args,{cwd:root,stdio:'inherit',env:{...process.env,...env}});
 if(r.error)throw Error(`CP049_DEPENDENCY_MISSING_OR_EXEC_FAILED: ${executable}: ${r.error.code??r.error.message}`);
 if(r.signal)throw Error(`CP049_INTERRUPTED: ${executable} ${r.signal}`);
 if(r.status!==0)throw Error(`CP049_GATE_FAILED: ${executable} exit ${r.status}`);
}
run('openssl',['version']);
run(process.execPath,['--test','lab/ux-p0-010/https-loopback.cp049.test.mjs']);
const python=process.env.CP049_PYTHON??(process.platform==='win32'?'python':'python3');
run(python,['lab/ux-p0-010/https-cookiejar.cp049.py'],{PYTHONDONTWRITEBYTECODE:'1'});
console.log('CP049_HTTPS_PROTOCOL_GATE=PASS; NODE=9; PY_COOKIEJAR=4; BROWSER_TLS=NOT_TESTED');
