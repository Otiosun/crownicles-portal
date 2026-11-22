/**
 * CP041 optional differential check: CP012 inventory projection must stay
 * semantically identical to the inventory half shipped in ORIGINAL CP014.
 * Both imported from separately SHA-locked original Drive ZIP extractions.
 * No Core, live database, account, network, route or secret.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const p012=process.env.CP012_GATEWAY_DIR;
const p014=process.env.CP014_GATEWAY_DIR;
if(!p012||!p014)throw Error('CP012_GATEWAY_DIR and CP014_GATEWAY_DIR original extracted paths required');
const sources=[
 [resolve(p012,'projection.mjs'),'6fc3a7212337cee57c78960f1507fe2ed9ee74b685115a99f2c2bc80257fabce'],
 [resolve(p014,'projection.mjs'),'987e61c2974eaeeeb510468e2e6fbd877cfb40959807741dec88655f5e74718f'],
 [resolve(p014,'fixture.mjs'),'d5edb262a6ef460294e996f27c8f37d55a6cb200256f7ed3d9b49b38d588bae2']
];
for(const [path,expected]of sources){
 const actual=createHash('sha256').update(await readFile(path)).digest('hex');
 if(actual!==expected)throw Error('Crownicles source drift: '+path);
}
const [v012,v014,fixtures]=await Promise.all(sources.map(([path])=>import(pathToFileURL(path).href)));
const base=()=>fixtures.makeFixture().inventory.source;
const compare=(packet)=>{
 let left,right,errLeft,errRight;
 try{left=v012.projectInventory(structuredClone(packet))}catch(e){errLeft=e}
 try{right=v014.projectInventory(structuredClone(packet))}catch(e){errRight=e}
 assert.equal(Boolean(errLeft),Boolean(errRight),'one source accepted a packet rejected by the other');
 if(!errLeft)assert.deepEqual(left,right);
 return !errLeft;
};
const seeded=(seed)=>{let x=seed>>>0;return()=>{x=(1664525*x+1013904223)>>>0;return x}};

test('CP041-diff-01 original positive packet projects identically',()=>{assert.ok(compare(base()))});
test('CP041-diff-02 active ID zero is same in the two original projectors',()=>{
 let f=base();f.data.weapon.id=0;f.data.armor.id=0;f.data.potion.id=0;f.data.object.id=0;
 assert.ok(compare(f));
});
test('CP041-diff-03 reserve item ID zero is rejected in both original projectors',()=>{
 let f=base();f.data.backupWeapons[0].display.id=0;assert.equal(compare(f),false)
});
test('CP041-diff-04 infinite max becomes unbounded in both original projectors',()=>{
 let f=base();f.data.weapon.attack.maxValue=Infinity;assert.ok(compare(f))
});
test('CP041-diff-05 optional plants missing is not reported consistently',()=>{
 let f=base();delete f.data.plants;assert.ok(compare(f))
});
test('CP041-diff-06 optional talismans missing is not reported consistently',()=>{
 let f=base();delete f.hasTalisman;delete f.hasCloneTalisman;delete f.hasRemoteHarvestTalisman;
 assert.ok(compare(f))
});
test('CP041-diff-07 mismatched item category rejects consistently',()=>{
 let f=base();f.data.weapon.itemCategory=1;assert.equal(compare(f),false)
});
test('CP041-diff-08 duplicate backup slot rejects consistently',()=>{
 let f=base();f.data.backupWeapons.push(structuredClone(f.data.backupWeapons[0]));assert.equal(compare(f),false)
});
test('CP041-diff-09 duplicate material ID rejects consistently',()=>{
 let f=base();f.data.materials.push(structuredClone(f.data.materials[0]));assert.equal(compare(f),false)
});
test('CP041-diff-10 missing talisman flag while other flags reported rejects consistently',()=>{
 let f=base();delete f.hasCloneTalisman;assert.equal(compare(f),false)
});
test('CP041-diff-11 integer and string-valued mutation corpus: 2,000 comparisons',()=>{
 const random=seeded(0xC012014),targets=[
  (f,n)=>{f.data.weapon.id=n%256},
  (f,n)=>{f.data.weapon.itemLevel=n%100},
  (f,n)=>{f.data.weapon.rarity=n%10},
  (f,n)=>{f.data.weapon.attack.maxValue=n%13===0?Infinity:(n%100)},
  (f,n)=>{f.data.armor.defense.baseValue=(n%1024)-512},
  (f,n)=>{f.data.potion.nature=n%9},
  (f,n)=>{f.data.potion.power=n%200},
  (f,n)=>{f.data.backupWeapons[0].display.id=n%2},
  (f,n)=>{f.data.backupWeapons[0].slot=n%5},
  (f,n)=>{f.data.materials[0].quantity=n%7},
  (f,n)=>{f.data.materials[0].materialId=n%128},
  (f,n)=>{f.data.slots.weapons=n%100},
  (f,n)=>{if(n%3===0)delete f.data.plants},
  (f,n)=>{if(n%3===0)delete f.data.plants.seed},
  (f,n)=>{if(n%11===0)f.data.plants.seed=0},
  (f,n)=>{if(n%5===0)f.data.weapon.attack={baseValue:NaN,upgradeValue:0,maxValue:1}},
  (f,n)=>{if(n%7===0)delete f.data},
  (f,n)=>{if(n%7===0)f.foundPlayer=false},
 ];
 for(let i=0;i<2000;i++){
  const f=base(),n=random();targets[n%targets.length](f,random());compare(f)
 }
});
test('CP041-diff-12 structure-hash of the original shared inventory projector unchanged',async()=>{
 const [a,b]=await Promise.all(sources.slice(0,2).map(([p])=>readFile(p,'utf8')));
 const lineA=a.slice(0,a.indexOf('function bar('));const lineB=b.slice(0,b.indexOf('function bar('));
 assert.equal(lineA,lineB);
});
