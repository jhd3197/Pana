import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser=await launch(),room=`ludo-pacing-${Date.now()}`;
try {
  const a=await openGame(browser,'ludo',{room,query:'debug',name:'Juan'});
  const b=await openGame(browser,'ludo',{room,query:'debug',name:'Ana'});
  await a.waitForFunction(()=>ludoDebug.room.members.size===2);
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.phase='playing';g.round++;g.turn=0;g.die=0;
    g.rng=1;g.autoMove=g.turnPause=null;g.revision++;ludoDebug.room.publish();
  });
  await b.waitForFunction(()=>ludoDebug.room.state.turn===0);
  await Promise.all([a,b].map(page=>page.evaluate(()=>{window.pacingSample=new Promise((resolve,reject)=>{
    // landedAt, not polling world.tossing: a frame slower than the toss starts and
    // finishes it between two samples.
    const before=ludoDebug.world.landedAt,start=performance.now();
    function sample(){
      const {world,room}=ludoDebug,landed=world.landedAt!==before;
      if(room.state.turnPause && document.querySelector('#turn').textContent.includes('Te toca'))return reject(Error('announced next turn during previous roll'));
      if(landed&&!room.state.turnPause)return resolve(performance.now()-world.landedAt);
      if(performance.now()-start>60000)return reject(Error(`missed roll did not settle: landed=${landed}, pause=${JSON.stringify(room.state.turnPause)}`));
      requestAnimationFrame(sample);
    }sample();
  });})));
  // The hold must come from the guest's report, not from the gate giving up on it.
  await a.evaluate(()=>{const room=ludoDebug.room,receive=room.receive;window.landedFrom=[];room.receive=function(id,data){if(data.kind==='landed')window.landedFrom.push(id);return receive.call(this,id,data);};});
  await a.evaluate(()=>{ludoDebug.room.game.roll(1);ludoDebug.room.publish();});
  const samples=await Promise.all([a,b].map(page=>page.evaluate(()=>window.pacingSample)));
  for(const held of samples)assert.ok(held>750,`result held ${held} ms`);
  assert.deepEqual(await a.evaluate(()=>window.landedFrom),[await b.evaluate(()=>ludoDebug.room.id)]);
  // Hold the cue at full strength for the checks: it runs on the wall clock and a
  // slow WebGL frame or capture can outlast its 3.2 s.
  await b.waitForFunction(()=>{const spot=ludoDebug.world.spotlight;if(!spot.cued)return false;window.spotlightFrame=spot.frame;spot.frame=()=>window.spotlightFrame(1);return true;});
  await b.waitForFunction(()=>ludoDebug.world.spotlight.light.intensity>2.9);
  assert.equal(await a.evaluate(()=>ludoDebug.world.spotlight.active),false);
  assert.equal(await b.evaluate(()=>{
    const {scene,spotlight}=ludoDebug.world;
    const sun=scene.children.find(n=>n.isDirectionalLight);
    return sun.intensity>=1.19&&sun.intensity<1.3&&spotlight.light.target.position.x<0&&spotlight.light.target.position.z<0;
  }),true);
  await mkdir('art/ludo',{recursive:true});await b.screenshot({path:'art/ludo/turn-spotlight.png'});
  await b.evaluate(()=>{ludoDebug.world.spotlight.frame=window.spotlightFrame;});
  await b.waitForFunction(()=>!ludoDebug.world.spotlight.active);
  assert.equal(await a.evaluate(()=>ludoDebug.world.scene.children.find(n=>n.isDirectionalLight).intensity),3);
  // Capture: the HUD and input stay with the mover through the victim's return.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.round++;g.turn=0;g.die=4;g.autoMove=g.turnPause=null;
    g.players[0].pieces[0]=14;g.players[1].pieces[0]=5;g.revision++;ludoDebug.room.publish();
  });
  await b.waitForFunction(()=>ludoDebug.room.state.die===4);
  await a.evaluate(()=>ludoDebug.room.action('move',{piece:0}));
  await Promise.all([a,b].map(page=>page.waitForFunction(()=>{
    if(!ludoDebug.world.pawns[4].flight)return false;
    if(!document.querySelector('#roll').disabled)throw Error('roll unlocked during capture');
    return true;
  })));
  for(const page of [a,b]){
    await page.waitForFunction(()=>!ludoDebug.room.state.turnPause,null,{timeout:60_000});
    assert.equal(await page.evaluate(()=>ludoDebug.world.moving),false);
  }
  await b.waitForFunction(()=>ludoDebug.world.spotlight.cued);
  assert.equal(await a.evaluate(()=>ludoDebug.world.spotlight.cued),false);
  for(const page of [a,b])assert.deepEqual(page.errors,[]);
  console.log('ok: missed-roll hold, capture return, action lock and local corner spotlight on two clients');
} finally {await browser.close();}
