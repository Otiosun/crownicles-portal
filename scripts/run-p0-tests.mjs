/**
 * CP046 — cross-platform P0 regression gate.
 * POSIX `CP042_REQUIRED=1 node ...` is not portable to Windows cmd.exe.
 * This runner enforces CP042_REQUIRED in child environment on all platforms;
 * explicit paths are pinned, missing test files are fatal, no optional skips.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const files=[
  'integration/p0/response-bridge.test.mjs',
  'integration/p0/projection-guard.test.mjs',
  'integration/p0/interop-cp042.test.mjs',
  'integration/p0/native-plant-boundary.cp044.test.mjs',
  'integration/p0/client-plant-boundary.cp044.test.mjs',
  'integration/p0/home-link.cp045.test.mjs',
  'integration/p0/plant-capacity-regression.cp045.test.mjs',
  'integration/p0/secure-native-read.cp046.test.mjs',
  'integration/p0/secure-native-cp014-ledger.cp046.test.mjs',
  'integration/p0/browser-reader.cp046.test.mjs',
  'lab/ux-p0-010/link-flow.cp048.test.mjs',
  'lab/ux-p0-010/link-http-ledger.cp048.test.mjs',
  'lab/ux-p0-010/inventory-id-filter.cp050.test.mjs',
  'lab/ux-p0-010/catalog.pt.cp051.test.mjs'
];
for(const file of files){
  if(!existsSync(new URL('../'+file,import.meta.url))){
    console.error('CP046_REQUIRED_TEST_MISSING: '+file);
    process.exitCode=1;
    throw Error('CP046_REQUIRED_TEST_MISSING');
  }
}
const child=spawnSync(process.execPath,['--test',...files],{
  cwd:new URL('../',import.meta.url),
  stdio:'inherit',
  env:{...process.env,CP042_REQUIRED:'1'}
});
if(child.error)throw child.error;
if(child.signal)throw new Error('CP046_TEST_INTERRUPTED_'+child.signal);
process.exitCode=child.status??1;
