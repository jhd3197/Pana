import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser = await launch();
try {
  for (const game of ['galope','curiara']) {
    const room=`options-${game}-${Date.now()}`;
    const host=await openGame(browser,game,{room,name:'Ana',query:'debug&manual'});
    const guest=await openGame(browser,game,{room,name:'Luis',query:'debug&manual'});
    await waitFor(host,g=>window[g].state.players.length===2,game);
    await waitFor(guest,g=>window[g].state.players.length===2,game);
    assert.equal(await guest.locator('[data-room-option]').first().isDisabled(),true);
    const patch=game==='galope'?{course:'morichal',laps:3,weather:'storm',jumps:'crazy',obstacles:'many',shortcuts:true,jumpHelp:true,drafting:true,horse:'random'}:
      {river:'orinoco',crew:'triples',current:'hard',paddling:'tap',falls:false,items:false,collisions:'soft',steeringHelp:true,rapids:'easy'};
    await host.locator('#pana-room-more').click();
    assert.equal(await host.locator('#pana-room-dialog').isVisible(),true);
    if(game==='galope') {
      await host.screenshot({path:path.join(os.tmpdir(),'pana-galope-options-desktop.png')});
      await host.setViewportSize({width:390,height:844});
      await host.screenshot({path:path.join(os.tmpdir(),'pana-galope-options-mobile.png')});
      await host.setViewportSize({width:1280,height:800});
    }
    const [key,value]=game==='galope'?['weather','storm']:['current','hard'];
    await host.locator(`[data-room-option="${key}"][data-value="${value}"]`).click();
    await waitFor(guest,({game,key,value})=>window[game].state.options[key]===value,{game,key,value});
    await host.locator('#pana-room-done').click();
    await host.evaluate(({game,patch})=>window[game].room.configure(patch),{game,patch});
    await waitFor(guest,({game,patch})=>Object.entries(patch).every(([k,v])=>window[game].state.options[k]===v),{game,patch});
    assert.equal(await host.evaluate(g=>window[g].room.game.configure({unexpected:true}),game),false);
    await guest.evaluate(g=>{window[g].room.configure({laps:2,current:'slow'});window[g].room.send({kind:'options',patch:{laps:2,current:'slow'}});},game);
    await host.evaluate(g=>window[g].room.publish(),game);
    assert.equal(await guest.evaluate(({game,key})=>window[game].state.options[key],{game,key}),value);
    await host.locator('#start').click();
    await waitFor(guest,g=>window[g].state.phase==='countdown',game);
    await host.evaluate(g=>window[g].step(3.2),game);
    await waitFor(guest,g=>window[g].state.phase==='racing',game);
    assert.deepEqual(await guest.evaluate(g=>window[g].state.options,game),await host.evaluate(g=>window[g].state.options,game));
    if(game==='curiara') {
      assert.equal(await guest.evaluate(()=>curiara.state.boats.length),3);
      await waitFor(guest,()=>curiara.world.world.river.drops.length===0);
      assert.equal(await guest.evaluate(()=>curiara.world.world.river.rocks.length),0);
    } else {
      assert.equal(await guest.evaluate(()=>galope.state.players.length),6);
      await waitFor(guest,()=>galope.world.course.group.children.filter(o=>o.name==='Jump log'&&o.visible).length===6);
    }
    const options=await guest.evaluate(g=>window[g].state.options,game);
    await host.close();
    await waitFor(guest,g=>window[g].room.isHost,game);
    assert.deepEqual(await guest.evaluate(g=>window[g].room.game.options,game),options);
    await guest.evaluate(g=>window[g].step(.5),game);
    assert.ok(await guest.evaluate(g=>window[g].state.time,game)>.2);
    await guest.evaluate(g=>window[g].room.practice(),game);
    await waitFor(guest,g=>window[g].room.offline&&window[g].state.phase==='lobby',game);
    assert.deepEqual(await guest.evaluate(g=>window[g].state.options,game),options,'local fallback retains selected rules and map');
    assert.deepEqual(host.errors,[]);assert.deepEqual(guest.errors,[]);
    await guest.context().close();
    console.log(`ok: ${game} shared settings UI, guest authority, real snapshots, map changes and host migration`);
  }
} finally {await browser.close();}
