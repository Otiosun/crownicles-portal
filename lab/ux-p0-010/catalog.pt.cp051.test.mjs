import test from 'node:test';
import assert from 'node:assert/strict';
import {itemName,UPSTREAM_PT_CATALOG} from './catalog.pt.cp051.mjs';
const categories={weapon:101,armor:112,potion:98,object:95};
const snapshot=()=>Object.entries(categories).map(([cat,len])=>JSON.stringify(Array.from({length:len},(_,id)=>itemName(cat,id)))).join('|');
function fnv32Utf16(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
test('CP051 all 406 source names retain exact upstream order',()=>{assert.equal(UPSTREAM_PT_CATALOG.commit,'64d08c05f11949029317341735f6f73024f19f9b');assert.equal(UPSTREAM_PT_CATALOG.blob,'25cb372dedd822629a69c84eb4f280866ebd80b7');assert.equal(UPSTREAM_PT_CATALOG.entries,406);assert.equal(fnv32Utf16(snapshot()),'89f85230')});
test('CP051 native names include ID0 and real P0 sample',()=>{assert.equal(itemName('weapon',0),'Punho');assert.equal(itemName('weapon',7),'Punhal');assert.equal(itemName('armor',0),'Sem escudo ou armadura');assert.equal(itemName('potion',1),'Poção vermelha');assert.equal(itemName('object',2),'Dado mágico')});
test('CP051 same item ID is distinct across categories',()=>{assert.equal(itemName('armor',7),'Quimono reforçado');assert.equal(itemName('potion',7),'Poção duvidosa');assert.equal(itemName('object',7),'Correntes mágicas');assert.notEqual(itemName('weapon',7),itemName('armor',7))});
test('CP051 unknown IDs, categories and prototype names return null',()=>{for(const cat of ['weapon','armor','potion','object'])for(const id of [-1,Infinity,NaN,1.5,99999,'7',null,undefined])assert.equal(itemName(cat,id),null);for(const cat of ['toString','__proto__','constructor','chest',null,2])assert.equal(itemName(cat,7),null)});
test('CP051 names cannot inject markup and remain bounded',()=>{for(const [cat,len] of Object.entries(categories))for(let id=0;id<len;id++){const name=itemName(cat,id);assert.equal(typeof name,'string');assert.ok(name.trim().length>0&&name.length<=72);assert.doesNotMatch(name,/[<>\x00-\x1F\x7F]/)}});
test('CP051 exact upper limit, never invent beyond native IDs',()=>{for(const [cat,len] of Object.entries(categories)){assert.equal(typeof itemName(cat,len-1),'string');assert.equal(itemName(cat,len),null)}});
