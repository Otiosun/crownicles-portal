/**
 * CP053: explicit, local-only P0 preview launcher. Ephemeral TLS + fictional
 * CP049 ledger; never connects to game/WhatsApp, real accounts, or remote DB.
 * Run: node scripts/start-p0-https-preview.cp053.mjs
 */
import {spawn,spawnSync} from 'node:child_process';
import {chmodSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const projectRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const fixture=join(projectRoot,'lab/ux-p0-010/https-cookie-fixture.cp049.mjs');
const temp=mkdtempSync(join(tmpdir(),'crownicles-cp053-'));
const key=join(temp,'key.pem'),cert=join(temp,'cert.pem');
let child,cleaned=false;
function cleanup(){if(cleaned)return;cleaned=true;rmSync(temp,{recursive:true,force:true});}

try{
 const issued=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes',
   '-keyout',key,'-out',cert,'-days','1','-subj','/CN=127.0.0.1',
   '-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore',timeout:15000});
 if(issued.error||issued.status!==0)throw Error('CP053_OPENSSL_CERTIFICATE_FAILED');
 chmodSync(key,0o600);
 console.log('CP053: laboratório temporário SOMENTE em 127.0.0.1. Não utilize dados reais.');
 console.log('Ao surgir previewUrl, abra o endereço no navegador local.');
 console.log('Para aprovar o código da tela: {"command":"approve","user":"a","code":"XXXX-XXXX-XXXX"}');
 console.log('Para revogar a identidade fictícia: {"command":"unbind","user":"a"}');
 console.log('Para encerrar, pressione Ctrl+C ou envie {"command":"exit"}.');
 child=spawn(process.execPath,[fixture,key,cert],{
  cwd:projectRoot,stdio:'inherit',env:{...process.env,CROWNICLES_P0_LAB_STATIC:'1'}
 });
 child.once('error',error=>{console.error('CP053_FIXTURE_START_FAILED:',error.code??'unknown');cleanup();process.exitCode=1;});
 child.once('exit',(code,signal)=>{cleanup();process.exitCode=code===0?0:1;});
 process.on('SIGINT',()=>{if(child&&!child.killed)child.kill('SIGINT');});
 process.on('SIGTERM',()=>{if(child&&!child.killed)child.kill('SIGTERM');});
}catch(error){cleanup();console.error(error.message);process.exitCode=1;}
