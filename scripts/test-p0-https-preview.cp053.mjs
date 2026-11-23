/** CP053 integration smoke against the real local synthetic CP049 fixture.
 * Explicitly does NOT prove browser SameSite, production OIDC, WA or MariaDB.
 * The generated local certificate is not trusted in this transport-only test;
 * CA verification is separately tested in CP049's native HTTPS suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const runner=new URL('./start-p0-https-preview.cp053.mjs',import.meta.url);

function request(port,path,{method='GET',cookie,origin}={}){
 return new Promise((resolve,reject)=>{
  const headers={Host:`127.0.0.1:${port}`};
  if(cookie)headers.Cookie=cookie;
  if(origin)headers.Origin=origin;
  const req=https.request({hostname:'127.0.0.1',port,path,method,headers,
   rejectUnauthorized:false,timeout:5000},res=>{
   const chunks=[];res.on('data',data=>chunks.push(data));
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text:Buffer.concat(chunks).toString('utf8')}));
  });
  req.once('error',reject);req.once('timeout',()=>req.destroy(Error('CP053_REQUEST_TIMEOUT')));req.end();
 });
}
function sessionCookie(reply,name){
 const header=(reply.headers['set-cookie']??[]).find(value=>value.startsWith(name+'='));
 assert.ok(header,`expected cookie ${name}`);
 assert.match(header,/; Secure; HttpOnly; SameSite=Strict/i);
 assert.doesNotMatch(header,/; Domain=/i);
 return header.split(';',1)[0];
}
async function launch(){
 const child=spawn(process.execPath,[fileURLToPath(runner)],{cwd:root,stdio:['pipe','pipe','pipe']});
 child.stderr.on('data',()=>{}); // Ignore fixture stderr; never echo tokens.
 const ready=await new Promise((resolveReady,rejectReady)=>{
  let buffer='',settled=false;
  const timer=setTimeout(()=>fail(Error('CP053_READY_TIMEOUT')),20000);
  const settle=value=>{if(settled)return;settled=true;clearTimeout(timer);resolveReady(value)};
  const fail=error=>{if(settled)return;settled=true;clearTimeout(timer);rejectReady(error)};
  child.once('error',fail);
  child.once('exit',code=>fail(Error(`CP053_PREMATURE_EXIT_${code}`)));
  child.stdout.on('data',chunk=>{
   buffer+=chunk.toString('utf8');
   if(buffer.length>12000)return fail(Error('CP053_EXCESSIVE_STARTUP_OUTPUT'));
   const lines=buffer.split('\n');buffer=lines.pop();
   for(const line of lines){
    try{const event=JSON.parse(line);
     if(event.ready===true&&Number.isSafeInteger(event.port)&&event.port>0&&
        event.previewUrl===`https://127.0.0.1:${event.port}/lab/ux-p0-010/preview.html`)
      return settle(event);
    }catch{/* Human-readable launcher messages */}
   }
  });
 });
 return {child,...ready};
}
function waitApproval(child){
 return new Promise((resolveReady,rejectReady)=>{
  let buffer='',settled=false;
  const timer=setTimeout(()=>finish(Error('CP053_APPROVAL_TIMEOUT')),5000);
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);child.stdout.off('data',onData);
   error?rejectReady(error):resolveReady(value)};
  const onData=chunk=>{
   buffer+=chunk.toString('utf8');
   if(buffer.length>2000)return finish(Error('CP053_APPROVAL_OUTPUT_LIMIT'));
   const lines=buffer.split('\n');buffer=lines.pop();
   for(const line of lines){try{const event=JSON.parse(line);if(typeof event.ok==='boolean')return finish(null,event.ok)}catch{}}
  };
  child.stdout.on('data',onData);
 });
}
async function stop(child){
 if(!child||child.exitCode!==null)return;
 const finished=new Promise(resolveDone=>child.once('exit',resolveDone));
 child.stdin.write('{"command":"exit"}\n');
 await Promise.race([finished,new Promise(resolveDone=>setTimeout(resolveDone,2500))]);
 if(child.exitCode===null)child.kill('SIGTERM');
}

test('CP053 HTTPS local preview: public P0 assets, private files denied, synthetic binding, read & logout',
 {timeout:35000},async()=>{
  let child;
  try{
   const started=await launch();child=started.child;const port=started.port;
   const origin=`https://127.0.0.1:${port}`;
   const html=await request(port,'/lab/ux-p0-010/preview.html');
   assert.equal(html.status,200);
   assert.match(html.headers['content-type'],/^text\/html/);
   assert.match(html.text,/<script type="module" src="\.\/entry\.cp049\.mjs"><\/script>/);
   assert.match(html.headers['content-security-policy'],/script-src 'self'/);
   assert.match(html.headers['cache-control'],/no-store/);
   for(const path of ['/lab/ux-p0-010/entry.cp049.mjs',
     '/lab/ux-p0-010/controller.mjs','/lab/ux-p0-010/catalog.pt.cp051.mjs',
     '/integration/p0/browser-reader.cp046.mjs']){
    const asset=await request(port,path);assert.equal(asset.status,200,path);
    assert.match(asset.headers['content-type'],/^text\/javascript/,path);
   }
   for(const path of ['/lab/cp014/identity.mjs','/lab/ux-p0-010/https-cookie-fixture.cp049.mjs',
     '/integration/p0/secure-native-read.cp046.mjs']){
    assert.equal((await request(port,path)).status,404,path);
   }
   assert.equal((await request(port,'/v1/me/profile')).status,401);
   assert.equal((await request(port,'/v1/link/start',{method:'POST',origin:'https://wrong.invalid'})).status,403);
   const issued=await request(port,'/v1/link/start',{method:'POST',origin});
   assert.equal(issued.status,201);
   const code=JSON.parse(issued.text).code;
   assert.match(code,/^[2-9A-HJ-NP-Z]{4}(?:-[2-9A-HJ-NP-Z]{4}){2}$/);
   const link=sessionCookie(issued,'__Host-crownicles_link');
   const approval=waitApproval(child);
   child.stdin.write(JSON.stringify({command:'approve',user:'a',code})+'\n');
   assert.equal(await approval,true);
   const state=await request(port,'/v1/link/status',{cookie:link});
   assert.equal(JSON.parse(state.text).status,'approved');
   const redeemed=await request(port,'/v1/link/redeem',{method:'POST',cookie:link,origin});
   assert.equal(redeemed.status,200);
   const session=sessionCookie(redeemed,'__Host-crownicles_session');
   const profile=await request(port,'/v1/me/profile',{cookie:session});
   assert.equal(profile.status,200);
   assert.equal(JSON.parse(profile.text).data.level,12);
   const inventory=await request(port,'/v1/me/inventory',{cookie:session});
   assert.equal(inventory.status,200);
   assert.equal(JSON.parse(inventory.text).data.categories[0].category,'weapon');
   assert.equal((await request(port,'/v1/session/logout',{method:'POST',cookie:session,origin})).status,200);
   assert.equal((await request(port,'/v1/me/profile',{cookie:session})).status,401);
  }finally{await stop(child)}
 });
