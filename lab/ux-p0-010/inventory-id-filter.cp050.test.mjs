import test from 'node:test';
import assert from 'node:assert/strict';
import {filterInventoryIdRows} from './controller.mjs';
const rows=[{slot:0,display:{id:0}},{slot:1,display:{id:7}},{slot:2,display:{id:7}},{slot:3,display:{id:70}}];
test('empty query preserves ordered entries without mutating input',()=>{
 const snapshot=JSON.stringify(rows),result=filterInventoryIdRows(rows,'');
 assert.deepEqual(result,{valid:true,query:null,rows});
 assert.notStrictEqual(result.rows,rows);assert.equal(JSON.stringify(rows),snapshot);
});
test('ID zero is a real item and never the invalid-input fallback',()=>{
 assert.deepEqual(filterInventoryIdRows(rows,'0').rows.map(x=>x.slot),[0]);
 assert.deepEqual(filterInventoryIdRows(rows,'000').rows.map(x=>x.slot),[0]);
 assert.deepEqual(filterInventoryIdRows(rows,'oops'),{valid:false,query:null,rows:[]});
});
test('identical ID in distinct slots preserves both positions',()=>{
 assert.deepEqual(filterInventoryIdRows(rows,'7').rows.map(x=>x.slot),[1,2]);
 assert.deepEqual(filterInventoryIdRows(rows,'70').rows.map(x=>x.slot),[3]);
 assert.deepEqual(filterInventoryIdRows(rows,'99').rows,[]);
});
test('whitespace is harmless but signs, decimals, exponent, html are invalid',()=>{
 assert.deepEqual(filterInventoryIdRows(rows,' 7 ').rows.map(x=>x.slot),[1,2]);
 for(const bad of ['-0','+7','7.0','7e0','7 x','<script>','٧','9999999999999999']){
  assert.equal(filterInventoryIdRows(rows,bad).valid,false,bad);
 }
});
test('does not fetch, mutate, or accept non-string/array input',()=>{
 assert.throws(()=>filterInventoryIdRows(null,'7'),/INVENTORY_FILTER_INPUT/);
 assert.throws(()=>filterInventoryIdRows(rows,7),/INVENTORY_FILTER_INPUT/);
 assert.equal(rows.length,4);
});
