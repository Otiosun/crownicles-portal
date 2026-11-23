/** CP054 item facts are a pure, read-only view of already-projected DTOs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeItemFacts} from './controller.mjs';
const cap=(kind,value)=>kind==='value'?{kind,value}:{kind};
const attr=(baseValue,upgradeValue,maximum)=>({baseValue,upgradeValue,maximum});
const weapon=(extra={})=>({id:0,itemCategory:0,rarity:3,itemLevel:0,
 attack:attr(0,2,cap('value',8)),defense:attr(-1,0,cap('unknown')),
 speed:attr(2,0,cap('unbounded')),...extra});
const support=(category,extra={})=>({id:7,itemCategory:category,rarity:1,nature:2,power:0,maximumPower:cap('unknown'),...extra});
const map=(data,cat)=>new Map(nativeItemFacts(data,cat));

test('CP054 weapon ID0 includes native rarity, level 0, all base/upgrade/cap values',()=>{
 const m=map(weapon({itemEnchantmentId:'ench-42'}),'weapon');
 assert.equal(m.get('Raridade (índice nativo)'),3);
 assert.equal(m.get('Nível do item'),0);
 assert.equal(m.get('Encantamento (identificador)'),'ench-42');
 assert.equal(m.get('Ataque · base'),0);
 assert.equal(m.get('Ataque · melhoria'),2);
 assert.equal(m.get('Ataque · limite'),8);
 assert.equal(m.get('Defesa · base'),-1);
 assert.equal(m.get('Defesa · limite'),'Não informado');
 assert.equal(m.get('Velocidade · limite'),'Ilimitado');
 assert.equal(m.size,12);
});
test('CP054 all native weapon/armor stats are displayed without invented equipment properties',()=>{
 const a=weapon({itemCategory:1,rarity:0,itemLevel:11});
 const m=map(a,'armor');
 assert.equal(m.get('Nível do item'),11);
 assert.equal(m.has('Encantamento (identificador)'),false);
 assert.equal(m.has('Natureza (código nativo)'),false);
 assert.equal(m.has('Usos'),false);
});
test('CP054 potion optional usages=0 and maxUsages=0 remain visible',()=>{
 const m=map(support(2,{usages:0,maxUsages:0,maximumPower:cap('value',0)}),'potion');
 assert.equal(m.get('Natureza (código nativo)'),2);
 assert.equal(m.get('Poder'),0);
 assert.equal(m.get('Poder · limite'),0);
 assert.equal(m.get('Usos'),0);
 assert.equal(m.get('Usos · máximo'),0);
 assert.equal(m.size,6);
});
test('CP054 object without optional usage counters does not invent them',()=>{
 const m=map(support(3,{maximumPower:cap('unbounded')}),'object');
 assert.equal(m.get('Poder · limite'),'Ilimitado');
 assert.equal(m.has('Usos'),false);
 assert.equal(m.has('Usos · máximo'),false);
 assert.equal(m.size,4);
});
test('CP054 category mismatch, invalid ID and unsupported category fail closed',()=>{
 assert.throws(()=>nativeItemFacts(weapon(),'armor'),/INVALID_NATIVE_ITEM/);
 assert.throws(()=>nativeItemFacts(weapon({id:-1}),'weapon'),/INVALID_NATIVE_ITEM/);
 assert.throws(()=>nativeItemFacts(weapon(),'chest'),/INVALID_NATIVE_ITEM/);
 assert.throws(()=>nativeItemFacts(null,'weapon'),/INVALID_NATIVE_ITEM/);
});
test('CP054 malformed cap and stat never turn into invented displayed values',()=>{
 assert.throws(()=>nativeItemFacts(weapon({attack:attr(1,0,cap('mystery'))}),'weapon'),/INVALID_NATIVE_ITEM_CAP/);
 assert.throws(()=>nativeItemFacts(weapon({defense:null}),'weapon'),/INVALID_NATIVE_ITEM_STAT/);
 assert.throws(()=>nativeItemFacts(support(2,{maximumPower:{kind:'value',value:Infinity}}),'potion'),/INVALID_NATIVE_ITEM_CAP/);
 assert.throws(()=>nativeItemFacts(support(2,{usages:-1}),'potion'),/INVALID_NATIVE_ITEM_USES/);
});
test('CP054 never echoes unknown private/native fields',()=>{
 const data=weapon({ownerId:'PRIVATE_ACTOR',internalKey:'SECRET',sessionToken:'TO_BE_REJECTED_UPSTREAM'});
 const rendered=JSON.stringify(nativeItemFacts(data,'weapon'));
 for(const x of ['PRIVATE_ACTOR','SECRET','TO_BE_REJECTED_UPSTREAM'])assert.equal(rendered.includes(x),false);
});
test('CP054 output is stable and never mutates source native objects',()=>{
 const source=weapon();Object.freeze(source);Object.freeze(source.attack);Object.freeze(source.attack.maximum);
 const a=nativeItemFacts(source,'weapon');const b=nativeItemFacts(source,'weapon');
 assert.deepEqual(a,b);assert.equal(source.attack.maximum.value,8);
});
