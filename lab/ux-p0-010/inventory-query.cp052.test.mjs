/** CP052: name lookup is restricted to already-authorized inventory rows. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {filterInventoryQueryRows,filterInventoryIdRows} from './controller.mjs';
const rows=()=>[{slot:0,display:{id:0}},{slot:1,display:{id:7}},{slot:2,display:{id:7}},{slot:3,display:{id:99}}];
const slots=q=>q.rows.map(x=>x.slot);

test('empty query returns local rows without mutation',()=>{
 const data=rows(),original=JSON.stringify(data),out=filterInventoryQueryRows(data,'  ','weapon');
 assert.equal(out.kind,'all');assert.equal(out.valid,true);
 assert.deepEqual(slots(out),[0,1,2,3]);assert.notEqual(out.rows,data);assert.equal(JSON.stringify(data),original);
});
test('exact numeric IDs preserve zero and duplicate-slot identity',()=>{
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'0','weapon')),[0]);
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'000','weapon')),[0]);
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'7','weapon')),[1,2]);
 assert.deepEqual(filterInventoryQueryRows(rows(),'7','weapon').rows,filterInventoryIdRows(rows(),'7').rows);
});
test('partial name matches official titles case- and accent-insensitively',()=>{
 for(const name of ['punhal','PUNHAL','PuNhAl','  punhal  ']){
  const result=filterInventoryQueryRows(rows(),name,'weapon');
  assert.equal(result.kind,'name');assert.equal(result.valid,true);assert.deepEqual(slots(result),[1,2]);
 }
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'punh','weapon')),[0,1,2]);
 assert.deepEqual(slots(filterInventoryQueryRows([{slot:0,display:{id:1}}],'RELaMpAgO','weapon')),[0]);
 assert.deepEqual(slots(filterInventoryQueryRows([{slot:0,display:{id:1}}],'relâmpago','weapon')),[0]);
});
test('lookup is category-specific and never manufactures offscreen items',()=>{
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'Punhal','armor')),[]);
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'Quimono','armor')),[1,2]);
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'Poção','potion')),[0,1,2]);
 assert.deepEqual(slots(filterInventoryQueryRows(rows(),'Correntes','object')),[1,2]);
});
test('invalid numeric syntax stays invalid rather than becoming partial-name search',()=>{
 for(const value of ['7x','7.0','7e0','-7','+7','9999999999999999']){
  const result=filterInventoryQueryRows(rows(),value,'weapon');assert.equal(result.valid,false,value);assert.deepEqual(result.rows,[]);
 }
});
test('unsafe query text and invalid category fail closed',()=>{
 for(const value of ['<script>','\u0000','{name}','`unsafe`','x'.repeat(73)]){
  const result=filterInventoryQueryRows(rows(),value,'weapon');assert.equal(result.valid,false,value);
 }
 for(const category of ['__proto__','chest',null,undefined,{}])assert.throws(()=>filterInventoryQueryRows(rows(),'punhal',category),/INVENTORY_QUERY_INPUT/);
});
test('unknown catalog titles never match, even if row ID exists',()=>{
 const rare=[{slot:12,display:{id:700}},{slot:13,display:{id:7}}];
 assert.deepEqual(slots(filterInventoryQueryRows(rare,'Punhal','weapon')),[13]);
 assert.deepEqual(slots(filterInventoryQueryRows(rare,'700','weapon')),[12]);
});
