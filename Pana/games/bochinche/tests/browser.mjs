import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
const browser=await launch(), code=`bash-${Date.now().toString(36)}`;
try {
  const host=await openGame(browser,'bochinche',{name:'Ana',room:code,query:'debug'});
  await waitFor(host,()=>bochincheDebug.room.isHost&&bochincheDebug.room.state.players.length===1);
  const guest=await openGame(browser,'bochinche',{name:'Bruno',room:code,query:'debug'});
  await waitFor(host,()=>bochincheDebug.room.state.players.length===2);
  assert(await host.evaluate(()=>bochincheDebug.world.camera.isPerspectiveCamera));
  await guest.locator('[data-style="1"]').click();
  await waitFor(host,()=>bochincheDebug.room.state.players[1].style===1);
  await host.evaluate(()=>bochincheDebug.room.action('options',{options:{stocks:1,items:false,seats:2}}));
  await waitFor(guest,()=>bochincheDebug.room.state.options.stocks===1);
  await host.locator('#start').click();
  await waitFor(guest,()=>bochincheDebug.room.state.fight?.phase==='playing');
  const x=await guest.evaluate(()=>bochincheDebug.room.state.fight.fighters[1].position.x);
  await guest.keyboard.down('a');
  await waitFor(host,x=>bochincheDebug.room.state.fight.fighters[1].position.x<x-35,x);
  await guest.keyboard.up('a');
  await waitFor(host,()=>[...bochincheDebug.room.inputs.values()].every(i=>!i.held.length));
  // Movement can reach a ledge under software-WebGL load; jump from solid ground.
  await host.evaluate(()=>{const f=bochincheDebug.room.game.combat.fighters[1];f.position={x:150,y:f.definition.size.height/2};f.velocity={x:0,y:0};f.state='idle';f.grounded=true;f.ledge=null;});
  // Catch-up ticks may complete a whole jump before Playwright polls again.
  // Record its authoritative event while keeping the real render callback.
  await host.evaluate(()=>{
    const room=bochincheDebug.room, render=room.onState;
    window.guestJumped=false;
    room.onState=function(state){window.guestJumped ||= state.fight?.events.some(e=>e.type==='jump'&&e.slot===1);return render.call(this,state);};
  });
  await guest.keyboard.press('Space');
  await waitFor(host,()=>window.guestJumped);
  // Let jump/release inputs settle before arranging the independent hit check.
  await waitFor(host,()=>bochincheDebug.room.state.fight.fighters[1].grounded && [...bochincheDebug.room.inputs.values()].every(i=>!i.held.length));
  // Place both within jab range, then exercise the guest's actual keyboard.
  await host.evaluate(()=>{
    bochincheDebug.room.game.combat.fighters.forEach((f,i)=>{
      f.position={x:i===0?-30:30,y:f.definition.size.height/2};f.velocity={x:0,y:0};f.launchVelocity={x:0,y:0};f.facing=i===0?1:-1;f.state='idle';f.grounded=true;f.invulnerableFrames=0;f.respawnFrames=0;
    });
  });
  const bursts=await guest.evaluate(()=>bochincheDebug.world.effects.bursts);
  await guest.keyboard.press('j');
  await waitFor(host,()=>bochincheDebug.room.state.fight.fighters[0].percent>0);
  await waitFor(guest,()=>bochincheDebug.room.state.fight.fighters[0].percent>0);
  await waitFor(guest,n=>bochincheDebug.world.effects.bursts>n,bursts);
  assert.match(await guest.locator('#fighter-0 .damage').innerText(),/[1-9]/);
  assert.equal(await guest.evaluate(()=>{const w=bochincheDebug.world,n=w.effects.bursts;w.update(bochincheDebug.room.state);w.update(bochincheDebug.room.state);return w.effects.bursts-n;}),0,'repeated snapshots do not replay impact effects');
  await host.screenshot({path:path.join(os.tmpdir(),'pana-bochinche-desktop.png')});
  await host.evaluate(()=>{bochincheDebug.room.game.combat.fighters[1].position.x=2000;});
  await waitFor(guest,()=>bochincheDebug.room.state.phase==='finished');
  assert.equal(await guest.evaluate(()=>bochincheDebug.room.state.winner),await host.evaluate(()=>bochincheDebug.room.state.winner));
  await host.locator('#again').click();
  await waitFor(guest,()=>bochincheDebug.room.state.round===2&&bochincheDebug.room.state.fight?.phase==='playing');
  const frame=await guest.evaluate(()=>bochincheDebug.room.state.fight.frame);
  await host.evaluate(()=>bochincheDebug.room.cut());
  await waitFor(guest,frame=>bochincheDebug.room.isHost&&bochincheDebug.room.state.fight.frame>frame,frame);
  assert(await guest.evaluate(()=>bochincheDebug.room.state.players.some(p=>p.bot)));
  await host.close(); await guest.close();
  const party=[];
  for(const name of ['Ana','Bruno','Carla','Diego','Elena','Félix']) {
    const page=await openGame(browser,'bochinche',{name,room:code+'-six',query:'debug'});
    party.push(page);
    await waitFor(page,n=>bochincheDebug.room.connected&&bochincheDebug.room.state.players.length===n,party.length);
  }
  const leader=party[0],sixth=party[5];
  await waitFor(leader,()=>bochincheDebug.room.state.players.length===6);
  await leader.evaluate(()=>bochincheDebug.room.action('options',{options:{stocks:1,items:false}}));
  await leader.locator('#start').click();
  for(const page of party) await waitFor(page,()=>bochincheDebug.room.state.fight?.phase==='playing'&&bochincheDebug.room.state.fight.fighters.length===6);
  assert.equal(await sixth.locator('.fighter-panel:visible').count(),6);
  await leader.evaluate(()=>{
    bochincheDebug.room.game.combat.fighters.forEach((f,i)=>{
      f.position={x:[-270,-160,-50,60,170,230][i],y:f.definition.size.height/2};f.velocity={x:0,y:0};f.launchVelocity={x:0,y:0};f.facing=i===5?-1:1;f.state='idle';f.grounded=true;f.invulnerableFrames=0;
    });
  });
  await sixth.keyboard.press('j');
  for(const page of party) await waitFor(page,()=>bochincheDebug.room.state.fight.fighters[4].percent>0);
  await leader.evaluate(()=>{bochincheDebug.room.game.combat.fighters[0].position.x=2000;});
  for(const page of party) {
    await waitFor(page,()=>bochincheDebug.room.state.fight.fighters[0].stocks===0);
    assert.equal(await page.evaluate(()=>bochincheDebug.room.state.phase),'playing',JSON.stringify(await page.evaluate(()=>({phase:bochincheDebug.room.state.phase,players:bochincheDebug.room.state.players,fight:bochincheDebug.room.state.fight.fighters.map(f=>({slot:f.slot,stocks:f.stocks,state:f.state,pos:f.position}))}))));
  }
  await leader.screenshot({path:path.join(os.tmpdir(),'pana-bochinche-six.png')});
  await leader.evaluate(()=>{for(const i of [1,2,3,4])bochincheDebug.room.game.combat.fighters[i].position.x=2000;});
  for(const page of party) {
    await waitFor(page,()=>bochincheDebug.room.state.phase==='finished');
    assert.equal(await page.evaluate(()=>bochincheDebug.room.state.winner===bochincheDebug.room.state.players[5].id),true);
  }
  console.log('Six clients agree on player six winning.');
  await leader.locator('#again').click();
  await waitFor(sixth,()=>bochincheDebug.room.state.round===2&&bochincheDebug.room.state.fight.phase==='playing');
  // A deliberate leave frees the seat; the earlier cut tests the reconnect grace period.
  await leader.evaluate(()=>bochincheDebug.room.dispose());
  await leader.close();
  await waitFor(party[1],()=>bochincheDebug.room.isHost&&bochincheDebug.room.state.players[0].bot);
  console.log('Six-player host migration passed.');
  const late=await openGame(browser,'bochinche',{name:'Gabriela',room:code+'-six',query:'debug'});
  await waitFor(late,()=>bochincheDebug.room.state.players.some(p=>p.name==='Gabriela'&&!p.bot));
  assert.equal(await late.evaluate(()=>bochincheDebug.room.state.fight.fighters.length),6);
  assert.deepEqual(party.flatMap(p=>p.errors).concat(late.errors),[]);
  for(const page of [...party,late])await page.close();
  console.log('Late join replaces the departed fighter.');
  const mobile=await openGame(browser,'bochinche',{name:'Móvil',mobile:true,query:'debug'});
  await mobile.setViewportSize({width:844,height:390});
  await waitFor(mobile,()=>Math.abs(bochincheDebug.world.camera.aspect-innerWidth/innerHeight)<.01);
  assert.equal(await mobile.locator('#world').evaluate(c=>Math.round(c.getBoundingClientRect().width)),844);
  await mobile.locator('#start').click();
  await waitFor(mobile,()=>bochincheDebug.room.state.fight?.phase==='playing');
  await mobile.locator('#jump').tap();
  await waitFor(mobile,()=>!bochincheDebug.room.state.fight.fighters[0].grounded);
  const boxes=await mobile.locator('.fighter-panel:visible').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom};}));
  assert.equal(boxes.length,6);assert(boxes.every(b=>b.left>=0&&b.right<=844&&b.bottom<220));
  for(let i=1;i<boxes.length;i++)assert(boxes[i].left>=boxes[i-1].right);
  await mobile.screenshot({path:path.join(os.tmpdir(),'pana-bochinche-mobile.png')});
  assert.deepEqual([...host.errors,...guest.errors,...mobile.errors],[]);
  console.log('PASS Bochinche: six-client free-for-all, sixth-player attack/win, late join, 3D, styles, guest movement/jump/hit, stocks/results, rematch, host migration and mobile touch.');
} finally {await browser.close();}
