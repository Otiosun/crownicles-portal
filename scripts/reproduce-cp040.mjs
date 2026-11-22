/** CP040 laboratory reproducibility gate; no network, server or DB calls. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';

const root=fileURLToPath(new URL('../',import.meta.url));
const inherited=Object.freeze({
 'integration/candidates/PortalPropertyQuery.ts':'8bd4916731abc776f578c562e77ca54f165ed285',
 'integration/candidates/PortalGardenQuery.ts':'ee186346b6a621619643e31949a876d2ee490720',
 'integration/candidates/PortalCompanionsQuery.ts':'d24acca86199cc9f5d94ffa8562fc79da703c479',
 'integration/candidates/PortalReadBundle.ts':'bf1f3f972401f79339c10721dfebb27bbdaf2b11',
 'integration/tests/fixture.mjs':'43d3d8f3b93f408349bfdb3c51af75baa1d153d7',
 'integration/tests/combined.test.mjs':'67390b0a5179c849a217712bf0e2ff74c8587937',
 'integration/tests/native-projection.test.mjs':'6661787bb251e340dfe25da8b0742d11fe26fcc9',
 'web/contract-adapter.js':'c70b2cde80df8542eff7630470091f05a4e088e4',
 'web/tests/contract.test.cjs':'319b88a3c2868a9c505b4926f2952ed89c73a122'
});
const cp040Tests=[
 'integration/tests/combined.test.mjs','integration/tests/native-projection.test.mjs',
 'scripts/tests/read-boundary.test.mjs','scripts/tests/read-boundary-http.test.mjs',
 'scripts/tests/read-boundary-integration.test.mjs','scripts/tests/read-boundary-deadline.test.mjs',
 'scripts/tests/read-boundary-fuzz.test.mjs','scripts/tests/read-boundary-session-race.test.mjs','web/tests/contract.test.cjs'
];
function blobSha(bytes){
 return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
function resolveTypeScript(){
 const custom=process.env.CROWNICLES_TYPESCRIPT_MODULE;
 const require=createRequire(import.meta.url);
 let dir;
 try {dir=custom?require.resolve(path.join(custom,'package.json')):require.resolve('typescript/package.json');}
 catch {throw Error('TYPESCRIPT_5_8_3_NOT_INSTALLED');}
 const pkg=JSON.parse(fs.readFileSync(dir,'utf8'));
 if(pkg.version!=='5.8.3')throw Error('TYPESCRIPT_VERSION_MISMATCH');
 return path.dirname(dir);
}
function run(){
 if(Number(process.versions.node.split('.')[0])<22)throw Error('NODE_22_REQUIRED');
 for(const [relative,sha] of Object.entries(inherited)){
  const bytes=fs.readFileSync(path.join(root,relative));
  if(blobSha(bytes)!==sha)throw Error('UPSTREAM_BLOB_MISMATCH: '+relative);
 }
 for(const relative of cp040Tests)if(!fs.existsSync(path.join(root,relative)))throw Error('TEST_MISSING: '+relative);
 console.log('CP040_UPSTREAM=9/9');
 const typescript=resolveTypeScript();
 console.log('CP040_TYPESCRIPT=5.8.3');
 const child=spawnSync(process.execPath,['--test',...cp040Tests],{
  cwd:root,env:{...process.env,CROWNICLES_TYPESCRIPT_MODULE:typescript},
  stdio:'inherit',timeout:60000
 });
 if(child.error||child.status!==0)throw Error('CP040_TESTS_FAILED');
 console.log('CP041_SESSION_REVALIDATION=PASS (not a DB/OIDC/CI gate)');
}
try {run();} catch(e){console.error('CP041_SESSION_REVALIDATION=BLOCKED',e.message);process.exitCode=1;}
