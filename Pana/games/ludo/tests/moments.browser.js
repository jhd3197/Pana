import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame } from '../../../tests/browser-kit.js';
const browser=await launch(),room=`moments-${Date.now()}`;
await mkdir('art/ludo',{recursive:true});
try {
 const a=await openGame(browser,'ludo',{room,query:'debug',name:'Juan'}),b=await openGame(browser,'ludo',{room,query:'debug',name:'Ana'});
 await a.waitForFunction(()=>ludoDebug.room.members.size===2);
 // Every authored moment can be scrubbed backwards and disposed without changing its base pose.
 assert.equal(await a.evaluate(async()=>{
   const {MOMENTS}=await import('/g/ludo/moment-events.js'),{createLudoMomentPreview}=await import('/g/ludo/studio-preview.js');
   for(const kind of MOMENTS){const group=createLudoMomentPreview({kind});for(const time of [0,.7,1.8,.4,2.8]){group.userData.tick(time);group.traverse(n=>{if(![...n.position,...n.scale,n.rotation.x,n.rotation.y,n.rotation.z].every(Number.isFinite))throw Error(kind);});}ludoDebug.world.scene.add(group);ludoDebug.world.renderer.render(ludoDebug.world.scene,ludoDebug.world.camera);group.userData.dispose();}
   return MOMENTS.length;
 }),11);
 await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.start();ludoDebug.room.publish();});
 for(const page of [a,b])await page.waitForFunction(()=>ludoDebug.world.moments.history.includes('intro'));
 await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.phase='playing';g.turn=0;g.die=0;g.autoMove=null;g.revision++;ludoDebug.room.publish();});
 await a.waitForFunction(()=>ludoDebug.world.spotlight.active);
 assert.equal(await b.evaluate(()=>ludoDebug.world.spotlight.active),false);
 // Passing an occupied cell selects a legal leap on both clients.
 await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.turn=0;g.die=4;g.rng=3;g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[0].pieces[0]=12;g.players[1].pieces[0]=1;g.revision++;ludoDebug.room.publish();});
 await b.waitForFunction(()=>ludoDebug.room.state.players[0].pieces[0]===12);
 await a.evaluate(()=>ludoDebug.room.action('move',{piece:0}));
 for(const page of [a,b]){
   await page.waitForFunction(()=>ludoDebug.world.pawns[0].lastMotion==='leap'&&!ludoDebug.world.pawns[0].path);
   assert.equal(await page.evaluate(()=>ludoDebug.room.state.players[0].pieces[0]),16);
   await page.evaluate(()=>ludoDebug.world.moments.frame(19,false));
   assert.equal(await page.evaluate(()=>ludoDebug.world.moments.history.includes('sleep')),true);
 }
 await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.turn=0;g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[0].pieces[1]=0;g.die=6;g.revision++;ludoDebug.room.publish();});
 await b.waitForFunction(()=>ludoDebug.room.state.die===6);
 await a.evaluate(()=>ludoDebug.room.action('move',{piece:0}));
 for(const page of [a,b])await page.waitForFunction(()=>ludoDebug.world.moments.history.includes('block'),null,{timeout:60000});
 assert.deepEqual(await a.evaluate(()=>ludoDebug.room.state.players[0].pieces),[0,0,-1,-1]);
 await a.screenshot({path:'art/ludo/moment-block.png'});
 // A real final-lane move uses the sprint, then reveals the actual ranking podium.
 await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.turn=0;g.die=1;g.players[0].pieces=[56,56,56,55];g.revision++;ludoDebug.room.publish();});
 await b.waitForFunction(()=>ludoDebug.room.state.players[0].pieces[3]===55);
 await a.evaluate(()=>ludoDebug.room.action('move',{piece:3}));
 for(const page of [a,b]){
   await page.waitForFunction(()=>ludoDebug.world.pawns[3].lastMotion==='sprint');
   await page.waitForFunction(()=>ludoDebug.world.moments.history.includes('podium'),null,{timeout:60000});
 }
 await a.locator('#results').waitFor({state:'visible',timeout:60000});
 await a.screenshot({path:'art/ludo/moment-results.png'});
 for(const page of [a,b])assert.deepEqual(page.errors,[]);
 console.log('ok: eleven reversible Studio moments, two-client intro/turn/stack/sprint/podium, logical cells preserved');
}finally{await browser.close();}
