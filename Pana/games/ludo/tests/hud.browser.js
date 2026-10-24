import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame } from '../../../tests/browser-kit.js';

const browser=await launch(),room=`ludo-hud-${Date.now()}`;
await mkdir('art/ludo',{recursive:true});
try{
  const a=await openGame(browser,'ludo',{room,query:'debug',name:'Juan'});
  const b=await openGame(browser,'ludo',{room,query:'debug',name:'Ana'});
  await a.waitForFunction(()=>ludoDebug.room.members.size===2);
  const revision=await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.round++;g.phase='playing';g.turn=0;g.die=0;g.autoMove=null;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.entryMisses[0]=g.entryLimits[0]=3;g.revision++;ludoDebug.room.publish();return g.revision;
  });
  await b.waitForFunction(rev=>ludoDebug.room.state.revision>=rev,revision);
  await a.locator('#pana-lobby-shell').waitFor({state:'hidden'});await a.waitForFunction(()=>!document.querySelector('.pk-cover'));
  assert.equal(await a.locator('#scoreboard').isVisible(),false);
  await a.keyboard.down('Shift');assert.equal(await a.locator('#scoreboard').isVisible(),true);
  await a.screenshot({path:'art/ludo/hud-shift.png'});
  await a.keyboard.up('Shift');assert.equal(await a.locator('#scoreboard').isVisible(),false);
  await a.keyboard.down('Shift');await a.evaluate(()=>dispatchEvent(new Event('blur')));
  assert.equal(await a.locator('#scoreboard').isVisible(),false);await a.keyboard.up('Shift');
  // Both clients observe the full throw, then the six, before the pawn leaves.
  await a.evaluate(()=>ludoDebug.room.action('roll',{power:1}));
  const checks=await Promise.all([a,b].map(page=>page.evaluate(()=>new Promise((resolve,reject)=>{
    let landed=null,sawFlight=false;const started=performance.now();
    function sample(){
      const {world,room}=ludoDebug;if(world.tossing)sawFlight=true;
      if(sawFlight&&!world.tossing&&landed===null)landed=performance.now();
      if(room.state.players[0].pieces[0]===0){resolve({sawFlight,delay:landed===null?0:performance.now()-landed,pips:document.querySelectorAll('#die .pip.on').length});return;}
      if(performance.now()-started>30000){reject(Error('automatic entry never arrived'));return;}
      requestAnimationFrame(sample);
    }sample();
  }))));
  for(const result of checks){assert.equal(result.sawFlight,true);assert.ok(result.delay>550,`result was readable for ${result.delay}ms`);assert.equal(result.pips,6);}
  // The shared safe cell holds near-full size pieces with separated heights.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.round++;g.turn=0;g.die=0;g.autoMove=null;g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);
    g.players[1].pieces[0]=13;g.players[2].pieces[0]=0;g.revision++;ludoDebug.room.publish();
  });
  await a.waitForFunction(()=>{const p=ludoDebug.world.pawns;return p[4].progress===13&&p[8].progress===0&&p[4].model.scale.x>.85&&p[8].model.position.y-p[4].model.position.y>.4;});
  await a.screenshot({path:'art/ludo/hud-desktop.png'});
  // Holding the actual throw button stays enabled until release.
  await a.locator('#roll').dispatchEvent('pointerdown',{pointerId:9,button:0});
  await a.waitForFunction(()=>ludoDebug.thrower.shaking&&ludoDebug.world.die.position.y>2);
  assert.equal(await a.locator('#roll').isDisabled(),false);
  await a.locator('#roll').dispatchEvent('pointerup',{pointerId:9,button:0});
  await a.waitForFunction(()=>!ludoDebug.thrower.shaking&&ludoDebug.world.tossing);
  const mobile=await openGame(browser,'ludo',{room,query:'debug',name:'Móvil',mobile:true});
  await mobile.locator('#pana-lobby-shell').waitFor({state:'hidden'});await mobile.waitForFunction(()=>!document.querySelector('.pk-cover'));
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await mobile.screenshot({path:'art/ludo/hud-mobile.png'});
  await mobile.locator('#details').tap();assert.equal(await mobile.locator('#scoreboard').isVisible(),true);
  await mobile.screenshot({path:'art/ludo/hud-mobile-details.png'});
  await mobile.locator('#details').tap();assert.equal(await mobile.locator('#scoreboard').isVisible(),false);
  await mobile.setViewportSize({width:844,height:390});
  await mobile.screenshot({path:'art/ludo/hud-landscape.png'});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for(const page of [a,b,mobile])assert.deepEqual(page.errors,[]);
  console.log('ok: held Shift/blur/touch details, two-client result hold, large stacks, throw gesture, responsive HUD');
}finally{await browser.close();}
