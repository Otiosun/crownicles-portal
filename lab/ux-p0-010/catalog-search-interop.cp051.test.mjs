/** CP051: CP050+CP051 pure-function composability. No game DB, auth, network or DOM. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {filterInventoryIdRows} from './controller.mjs';
import {itemName} from './catalog.pt.cp051.mjs';
const rows=()=>[{slot:0,display:{id:0}},{slot:1,display:{id:7}},{slot:2,display:{id:7}},{slot:3,display:{id:70}}];
test('CP051-INTEROP: ID 7 returns both slots, regardless of translated names',()=>{
  const base=rows();const filtered=filterInventoryIdRows(base,'7');
  assert.deepEqual(filtered.rows.map(x=>x.slot),[1,2]);
  assert.deepEqual(filtered.rows.map(x=>itemName('weapon',x.display.id)),['Punhal','Punhal']);
  assert.deepEqual(base.map(x=>x.slot),[0,1,2,3]);
});
test('CP051-INTEROP: same numeric ID has category-specific official names',()=>{
  const item=filterInventoryIdRows(rows(),'7').rows[0];
  assert.equal(itemName('weapon',item.display.id),'Punhal');
  assert.equal(itemName('armor',item.display.id),'Quimono reforçado');
  assert.equal(itemName('potion',item.display.id),'Poção duvidosa');
  assert.equal(itemName('object',item.display.id),'Correntes mágicas');
});
test('CP051-INTEROP: native ID 0 is not a missing item and stays searchable',()=>{
  for(const s of ['0','000',' 0 ']){
    const filtered=filterInventoryIdRows(rows(),s);
    assert.deepEqual(filtered.rows.map(x=>x.slot),[0]);
    assert.equal(itemName('weapon',filtered.rows[0].display.id),'Punho');
  }
});
test('CP051-INTEROP: invalid text never becomes ID0; absent title never changes query',()=>{
  for(const bad of ['oops','7.0','7x','-7','1e1','<img>']){
    assert.equal(filterInventoryIdRows(rows(),bad).valid,false);
    assert.deepEqual(filterInventoryIdRows(rows(),bad).rows,[]);
  }
  const unknown=filterInventoryIdRows([{slot:1,display:{id:200}}],'200');
  assert.equal(unknown.rows.length,1);
  assert.equal(itemName('weapon',200),null);
});
