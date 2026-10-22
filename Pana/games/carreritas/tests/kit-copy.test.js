import test from 'node:test';
import assert from 'node:assert/strict';
import { newWallet, cleanWallet, quoteBuild, kitEntries, CATALOG, paintOf } from '../public/shop.js';
import { cleanCosmetics } from '../public/online-rules.js';

const rival = {def:{id:'chamo'},wheel:'palo',cosmetics:{paint:'caribe',boat:'rayo',air:'turpial',parts:{motor:'carreras',aleron:'gt'},boatParts:{},airParts:{}}};
test('copying one vehicle quotes only its missing parts and never another vehicle',()=>{
  const wallet = newWallet(), price = quoteBuild(wallet,rival,'car');
  assert.equal(price,['wheel','motor','aleron'].reduce((sum,slot)=>sum+CATALOG[slot].find(p=>p.id===({wheel:'palo',motor:'carreras',aleron:'gt'})[slot]).cost,0));
  wallet.owned.push('motor:carreras');
  assert.equal(quoteBuild(wallet,rival,'car'),price-CATALOG.motor.find(p=>p.id==='carreras').cost);
  assert.equal(quoteBuild(wallet,rival,'boat'),0,'the vessel body is excluded from an individual parts quote');
  assert.deepEqual(kitEntries(rival,'boat'),[['boat','rayo']]);
  assert.ok(quoteBuild(wallet,rival)>quoteBuild(wallet,rival,'car'),'a complete kit includes its unowned vessels and paint');
  assert.equal(wallet.coins,0,'copying a recommendation never spends or grants parts');
});
test('copied factory colors survive saves and network cleaning without accepting arbitrary strings',()=>{
  const wallet=cleanWallet({...newWallet(),copiedPaint:'#e0262f'});
  const look=cleanCosmetics({paint:'fabrica',paintColor:wallet.copiedPaint});
  assert.equal(paintOf(look,'#ffffff'),'#e0262f');
  assert.equal(paintOf({...look,paint:'caribe'}),CATALOG.paint.find(p=>p.id==='caribe').color,'explicit paint takes precedence');
  assert.equal(cleanWallet({copiedPaint:'url(unsafe)'}).copiedPaint,null);
  assert.equal(cleanCosmetics({paintColor:'red;anything'}).paintColor,undefined);
  assert.equal(paintOf(cleanCosmetics({paint:'fabrica'}),'#123456'),'#123456','old saves keep their factory colors');
});
