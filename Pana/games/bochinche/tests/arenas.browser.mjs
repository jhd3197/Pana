import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
const browser=await launch();
try {
 for(const stage of ['salto-angel','catatumbo','los-roques']) {
  const code=`arena-${stage}-${Date.now()}`,errors=[];
  const host=await openGame(browser,'bochinche',{name:'Ana',room:code,query:'debug'});
  const guest=await openGame(browser,'bochinche',{name:'Bruno',room:code,query:'debug'});
  for(const page of [host,guest]) {page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
  await waitFor(host,()=>bochincheDebug.room.isHost&&bochincheDebug.room.state.players.length===2);
  await host.evaluate(stage=>bochincheDebug.room.action('options',{options:{stage,seats:2,items:false}}),stage);
  await waitFor(guest,stage=>bochincheDebug.room.state.options.stage===stage,stage);
  // The neutral special is each pana's poder; El Trueno's is the 14% Rayo checked below.
  await guest.evaluate(()=>bochincheDebug.room.action('pana',{pana:'trueno',traje:0}));
  await waitFor(host,()=>bochincheDebug.room.state.players[1].pana==='trueno');
  await host.locator('#start').click();
  await waitFor(guest,()=>bochincheDebug.room.state.fight?.phase==='playing');
  assert.equal(await guest.evaluate(()=>bochincheDebug.room.state.fight.stage.id),stage);
  await guest.keyboard.press('Space');
  await waitFor(host,()=>bochincheDebug.room.state.fight.events.some(e=>e.type==='jump'&&e.slot===1));
  for(const [direction,move,damage] of [[null,'neutral-special',14],['a','side-special',12],['s','down-special',10]]) {
    await host.evaluate(()=>{
      const c=bochincheDebug.room.game.combat;
      c.projectiles=[];
      c.fighters.forEach((f,i)=>Object.assign(f,{position:{x:i?50:-50,y:f.definition.size.height/2},velocity:{x:0,y:0},launchVelocity:{x:0,y:0},facing:i?-1:1,state:'idle',grounded:true,action:null,percent:0,hitstopFrames:0,hitstunFrames:0,statusEffect:null,statusResistanceFrames:0,invulnerableFrames:0,respawnFrames:0}));
    });
    if(direction)await guest.keyboard.down(direction);
    await guest.keyboard.down('k');
    await waitFor(host,([move,damage])=>bochincheDebug.room.state.fight.fighters[1].currentMove===move||bochincheDebug.room.state.fight.fighters[0].percent===damage,[move,damage]);
    await guest.keyboard.up('k');
    if(direction)await guest.keyboard.up(direction);
    // Damage persists after the short event history expires on a slow renderer.
    await waitFor(host,damage=>bochincheDebug.room.state.fight.fighters[0].percent===damage,damage);
    await waitFor(guest,damage=>bochincheDebug.room.state.fight.fighters[0].percent===damage,damage);
    await waitFor(host,()=>bochincheDebug.room.state.fight.fighters.every(f=>!f.currentMove&&f.hitstunFrames===0));
  }
  await host.screenshot({path:path.join(os.tmpdir(),`bochinche-${stage}.png`)});
  const frame=await guest.evaluate(()=>bochincheDebug.room.state.fight.frame);
  await host.evaluate(()=>bochincheDebug.room.cut());
  await waitFor(guest,f=>bochincheDebug.room.isHost&&bochincheDebug.room.state.fight.frame>f,frame);
  assert.equal(await guest.evaluate(()=>bochincheDebug.room.state.fight.stage.id),stage);
  assert.deepEqual(errors,[]);
  await host.close();await guest.close();
 }
} finally {await browser.close();}
