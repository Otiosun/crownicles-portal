/** CP047 quick source integrity rules for npm run check; browser tests are opt-in. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {mountP0Portal} from '../../lab/ux-p0-010/controller.mjs';
const html=await readFile(new URL('../../lab/ux-p0-010/preview.html',import.meta.url),'utf8');
const js=await readFile(new URL('../../lab/ux-p0-010/controller.mjs',import.meta.url),'utf8');
const notPresent=['synthetic.profile','synthetic.inventory','localStorage','sessionStorage','document.cookie','Bearer ','keycloakId','JWT_SECRET'];
test('CP047 preview explicitly loads live DOM controller',()=>{
 assert.match(html,/<html lang="pt-BR">/);assert.match(html,/import \{mountP0Portal\} from '\.\/controller\.mjs'/);
});
test('CP047 browser controller wires to CP046 client, not raw game packets',()=>{
 assert.match(js,/import \{createP0BrowserReader\}/);assert.match(js,/createP0BrowserReader\(\{fetcher,onChange:render\}\)/);
});
test('CP047 strips old synthetic controls and arbitrary player selectors',()=>{
 for(const word of notPresent){assert.ok(!html.includes(word),'HTML contained '+word);}
 assert.doesNotMatch(html,/id="scenario"|id="applyScenario"|id="endSession"/);
});
test('CP047 never produces browser Authorization or explicit Cookie header',()=>{
 assert.doesNotMatch(js,/(headers\s*:\s*\{[^}]*Authorization|headers\s*:\s*\{[^}]*Cookie)/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie/);
});
test('CP047 requires private P0 DOM mount points',()=>{
 assert.throws(()=>mountP0Portal({getElementById:()=>null}),/P0_DOM_CONTAINERS_REQUIRED/);
});
test('CP047 fails closed for invalid user-adjustable deadline configuration',()=>{
 const dom={getElementById:()=>({})};
 for(const bad of [0,-1,1.5,Infinity,30001])assert.throws(()=>mountP0Portal(dom,{readTimeoutMs:bad}),/READ_TIMEOUT_INVALID/);
});
test('CP047 gateway unavailable cannot be mistaken for full signed-in status',()=>{
 assert.match(js,/current\.sections\.profile\.state==='unavailable'/);
 assert.match(js,/type:'AUTH_LOST'/);
});
test('CP047 logout requires explicit signed_out contract',()=>{
 assert.match(js,/data\.status==='signed_out'/);
 assert.match(js,/total>1024/);
 assert.match(js,/cancel\.abort\(\)/);
});
