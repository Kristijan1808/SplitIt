import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizedQuantity,itemSplitMode,prepareBillItems} from '../src/domain.mjs';
test('empty, zero and one share a single charged line',()=>{
 for(const quantity of ['', '0', 0, '1',1,undefined]){
  assert.equal(normalizedQuantity(quantity),1);
  assert.equal(itemSplitMode(quantity),'shared');
  const [row]=prepareBillItems('items','',[],[{name:'Plata',price:'20.00',quantity,ids:[]}],false);
  assert.equal(row.price,'20.00');assert.equal(row.quantity,1);
 }
});
test('multiple units preserve total and invalid quantities are rejected',()=>{
 assert.equal(itemSplitMode(3),'units');
 assert.equal(prepareBillItems('items','',[],[{name:'Cola',price:'5.00',quantity:3,ids:[]}],false)[0].price,'15.00');
 for(const quantity of [-1,1.5,1000,'abc'])assert.equal(prepareBillItems('items','',[],[{name:'Cola',price:'5',quantity,ids:[]}],false)[0].name,'');
});
