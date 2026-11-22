/**
 * CP041 optional, source-locked cross-layer test against the ORIGINAL CP014 ZIP.
 * Run with CP014_GATEWAY_DIR=/absolute/extracted/CP014/gateway.
 * Deliberately excluded from production/CI default: original CP014 fixture is
 * separately stored in private Drive; its source is not vendored into this PR.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initialState, transition, canInspect } from '../../lab/ux-p0-003/machine.mjs';
import { startRead, finishRead } from './response-bridge.mjs';

const CP014_PROJECTOR_SHA256 = '987e61c2974eaeeeb510468e2e6fbd877cfb40959807741dec88655f5e74718f';
const CP014_FIXTURE_SHA256 = 'd5edb262a6ef460294e996f27c8f37d55a6cb200256f7ed3d9b49b38d588bae2';
const root = process.env.CP014_GATEWAY_DIR;
if (!root) throw new Error('Set CP014_GATEWAY_DIR to extracted original CP014/gateway; cannot silently use a stand-in');
const projectorPath = resolve(root, 'projection.mjs');
const actual = createHash('sha256').update(await readFile(projectorPath)).digest('hex');
if (actual !== CP014_PROJECTOR_SHA256) throw new Error('CP014 provenance mismatch: refusing unverified projector');
const fixturePath = resolve(root, 'fixture.mjs');
if (createHash('sha256').update(await readFile(fixturePath)).digest('hex') !== CP014_FIXTURE_SHA256) {
  throw new Error('CP014 fixture provenance mismatch: refusing unverified fixture');
}
const {readOwn,projectProfile,projectInventory} = await import(pathToFileURL(projectorPath).href);
const {harness,makeFixture,now} = await import(pathToFileURL(fixturePath).href);
const auth = () => transition(initialState(),{type:'AUTH_ESTABLISHED'});
const reader = async (h,section,actorId='fixture-A') => await readOwn({section,session:{actorId,expiresAt:now+60000},repo:h.repo,now});
const apply = (s,section,id,response) => {const b=startRead(s,section,id);assert.ok(b.token);return finishRead(b.state,b.token,response)};

// Both real CP014 projection functions and UX-P0 machine execute in these tests.
test('CP041-native-01 original CP014 profile produces a ready UX-P0 section',async()=>{
 const h=harness();const resp=await reader(h,'profile');const s=apply(auth(),'profile',1,resp);
 assert.equal(resp.status,200);assert.equal(s.sections.profile.state,'ready');assert.equal(s.sections.profile.data.level,12);
 assert.equal(s.sections.profile.data.effect.timeLeft,-1000);
 assert.deepEqual(h.reads,[['fixture-A','profile']]);
});
test('CP041-native-02 private profile fields do not enter the projection',async()=>{
 const raw=makeFixture().profile.source, projected=projectProfile(raw);
 const output=JSON.stringify(projected);
 assert.ok(!output.includes('secret-identity-A'));assert.ok(!output.includes('never-return'));
 assert.ok(!('keycloakId' in projected));assert.ok(!('phone' in projected));
});
test('CP041-native-03 native inventory has four authentic categories and original capacities',async()=>{
 const h=harness();const s=apply(auth(),'inventory',1,await reader(h,'inventory'));
 assert.equal(s.sections.inventory.state,'ready');
 assert.deepEqual(s.sections.inventory.data.categories.map(c=>c.category),['weapon','armor','potion','object']);
 assert.deepEqual(s.sections.inventory.data.categories.map(c=>c.capacity),[2,2,2,2]);
});
test('CP041-native-04 the original CP014 projector accepts legitimate equipped ID zero',async()=>{
 const h=harness({mutate:f=>{f.inventory.source.data.weapon.id=0}});
 let s=apply(auth(),'inventory',1,await reader(h,'inventory'));
 s=transition(s,{type:'GO_INVENTORY'});s=transition(s,{type:'SELECT_ITEM',category:'weapon',slot:0});
 assert.deepEqual(s.selected,{category:'weapon',slot:0,id:0});assert.ok(canInspect(s));
 s=transition(s,{type:'OPEN_DETAIL'});assert.equal(s.view,'detail');
 s=transition(s,{type:'BACK'});assert.equal(s.focusIntent,'item:weapon:0');
});
test('CP041-native-05 native unbounded item stat retains its semantic discriminator',async()=>{
 const p=projectInventory(makeFixture().inventory.source);
 assert.deepEqual(p.categories[0].active.speed.maximum,{kind:'unbounded'});
 assert.equal(p.categories[0].active.attack.maximum.value,20);
});
test('CP041-native-06 a real CP014 material does not become equipped gear',async()=>{
 const p=projectInventory(makeFixture().inventory.source);
 assert.deepEqual(p.materials,[{materialId:5,quantity:3}]);
 assert.ok(!p.categories.some(c=>c.category==='material'));
 assert.equal(JSON.stringify(p).includes('never-return'),false);
});
test('CP041-native-07 original optional talismans distinguish not reported from false',()=>{
 const packet=makeFixture().inventory.source;
 delete packet.hasTalisman;delete packet.hasCloneTalisman;delete packet.hasRemoteHarvestTalisman;
 assert.deepEqual(projectInventory(packet).talismans,{kind:'not_reported'});
});
test('CP041-native-08 original optional plants distinguish not reported from empty',()=>{
 const packet=makeFixture().inventory.source;delete packet.data.plants;
 assert.deepEqual(projectInventory(packet).plants,{kind:'not_reported'});
});
test('CP041-native-09 a confirmed foreign owner cannot supply a P0 section',async()=>{
 const h=harness({mutate:f=>{f.inventory.actorId='fixture-B'}});
 const response=await reader(h,'inventory');
 assert.equal(response.status,503);
 const s=apply(auth(),'inventory',1,response);
 assert.equal(s.sections.inventory.state,'unavailable');assert.equal(s.sections.inventory.data,null);
});
test('CP041-native-10 SQL/reader exception cannot leak source exception details',async()=>{
 const h=harness({broken:true});const response=await reader(h,'profile');
 const s=apply(auth(),'profile',1,response);assert.equal(response.status,503);
 assert.equal(s.sections.profile.state,'unavailable');assert.equal(s.sections.profile.data,null);
 assert.equal(JSON.stringify(s).includes('never-return'),false);
});
test('CP041-native-11 a missing game record never fabricates an inventory',async()=>{
 const h={repo:{async readSnapshot(){return null}}};
 const response=await reader(h,'inventory'),s=apply(auth(),'inventory',1,response);
 assert.equal(s.sections.inventory.state,'unavailable');assert.equal(s.sections.inventory.data,null);
});
test('CP041-native-12 native restricted response retains its distinct state, not private payload',async()=>{
 const h=harness();h.records['fixture-A'].profile.state='restricted';h.records['fixture-A'].profile.source={private:'do not copy'};
 const s=apply(auth(),'profile',1,await reader(h,'profile'));
 assert.equal(s.sections.profile.state,'restricted');assert.equal(s.sections.profile.data,null);
});
test('CP041-native-13 native not_initialized is not interpreted as empty inventory',async()=>{
 const h=harness({mutate:f=>{f.inventory.state='not_initialized'}});
 const s=apply(auth(),'inventory',1,await reader(h,'inventory'));
 assert.equal(s.sections.inventory.state,'not_initialized');assert.equal(s.sections.inventory.data,null);
});
test('CP041-native-14 native unranked sentinel survives projection and state transition',async()=>{
 const h=harness({mutate:f=>{f.profile.source.playerData.rank.rank=-1;f.profile.source.playerData.rank.unranked=true}});
 const s=apply(auth(),'profile',1,await reader(h,'profile'));
 assert.equal(s.sections.profile.data.rank.rank,-1);assert.equal(s.sections.profile.data.rank.unranked,true);
});
test('CP041-native-15 response from old actor is discarded after new auth epoch',async()=>{
 const h=harness();let s=auth();const older=startRead(s,'inventory',1);
 s=transition(older.state,{type:'AUTH_ESTABLISHED'});const current=startRead(s,'inventory',1);
 const responseA=await reader(h,'inventory','fixture-A');
 s=finishRead(current.state,older.token,responseA);assert.equal(s.sections.inventory.state,'loading');
 s=finishRead(s,current.token,await reader(h,'inventory','fixture-B'));
 assert.equal(s.sections.inventory.data.categories[0].active.id,7);
});
test('CP041-native-16 native expired session HTTP401 clears BOTH profile and inventory',async()=>{
 const h=harness();let s=auth();s=apply(s,'profile',1,await reader(h,'profile'));s=apply(s,'inventory',1,await reader(h,'inventory'));
 let b=startRead(s,'profile',2);const bad=await readOwn({section:'profile',session:{actorId:'fixture-A',expiresAt:now},repo:h.repo,now});
 s=finishRead(b.state,b.token,bad);assert.equal(bad.status,401);assert.equal(s.authorized,false);
 assert.equal(s.sections.profile.data,null);assert.equal(s.sections.inventory.data,null);
});
test('CP041-native-17 invalid source item category is failed closed by original CP014',async()=>{
 const h=harness({mutate:f=>{f.inventory.source.data.weapon.itemCategory=3}});
 const resp=await reader(h,'inventory'),s=apply(auth(),'inventory',1,resp);
 assert.equal(resp.status,503);assert.equal(s.sections.inventory.state,'unavailable');
});
test('CP041-native-18 old request response cannot overwrite more recent original native response',async()=>{
 const h=harness();let s=auth();let old=startRead(s,'profile',1),latest=startRead(old.state,'profile',2);
 s=finishRead(latest.state,old.token,await reader(h,'profile','fixture-B'));
 assert.equal(s.sections.profile.state,'loading');
 s=finishRead(s,latest.token,await reader(h,'profile','fixture-A'));
 assert.equal(s.sections.profile.data.money,2450);
});
