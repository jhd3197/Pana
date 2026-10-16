import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
const page=await browser.newPage({viewport:{width:1440,height:900}});page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/domino/?room=pick-${Date.now()}&name=Juan&debug`);
 await page.waitForFunction(()=>dominoDebug.world&&dominoDebug.room.connected,null,{timeout:90000});
 await page.locator('#start').click();
 for(let i=0;i<4;i++){if(await page.evaluate(()=>dominoDebug.room.state.turn===dominoDebug.room.seat))break;await page.evaluate(()=>dominoDebug.room.tick(2));}
 await page.waitForTimeout(700);
 const target=await page.evaluate(()=>{
  const {world,room,legalMoves}=dominoDebug;
  for(const move of legalMoves(room.state,room.seat)){
   const tile=world.tiles.get(move.tile).model, p=tile.position.clone();p.y+=.14;p.project(world.camera);
   const x=(p.x*.5+.5)*innerWidth,y=(-p.y*.5+.5)*innerHeight;
   if(document.elementFromPoint(x,y)?.id==='world')return{x,y,id:move.tile,count:room.state.chain.length};
  }return null;
 });
 assert.ok(target,'an unobstructed physical tile is clickable');
 await page.mouse.click(target.x,target.y);
 if(await page.locator('#end-actions').isVisible())await page.locator('#end-actions button:not(:disabled)').first().click();
 await page.waitForFunction(count=>dominoDebug.room.state.chain.length>count,target.count);
 assert.ok(await page.evaluate(id=>dominoDebug.room.state.chain.some(t=>t.id===id),target.id));
 console.log('ok: clicking an actual 3D tile plays it through raycasting');
 await page.locator('#menu').click();await page.locator('#pana-tab-controls').click();assert.match(await page.locator('#pana-panel-controls').textContent(),/doble seis/);await page.keyboard.press('Escape');
 await page.evaluate(()=>dominoDebug.room.practice());await page.setViewportSize({width:390,height:844});
 await page.locator('#start').click();
 for(let i=0;i<4;i++){if(await page.evaluate(()=>dominoDebug.room.state.turn===dominoDebug.room.seat))break;await page.evaluate(()=>dominoDebug.room.tick(2));}
 await page.screenshot({path:'art/domino/final-mobile.png'});
 const bounds=await page.locator('.world-label:not([hidden])').evaluateAll(nodes=>nodes.map(n=>({left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right})));
 assert.ok(bounds.every(b=>b.left>=7.9&&b.right<=382.1),'character labels stay within the mobile viewport');
 console.log('ok: mobile labels stay inside the viewport');
 await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(500);await page.screenshot({path:'art/domino/final-desktop.png'});
 // Build the exact Studio entries and verify their owned geometry has finite bounds.
 const resources=await page.evaluate(async()=>{
  const {DOMINO}=await import('/studio/catalog/domino.js');const {Box3}=await import('three');
  const result=[];for(const asset of DOMINO){const value=await asset.build();const bounds=new Box3().setFromObject(value.group);result.push({id:asset.id,min:bounds.min.toArray(),max:bounds.max.toArray()});value.group.userData.dispose();}return result;
 });
 assert.equal(resources.length,3);for(const model of resources)assert.ok([...model.min,...model.max].every(Number.isFinite));
 console.log('ok: all three registered Studio factories construct and dispose');assert.deepEqual(errors,[]);
}finally{await browser.close();}
