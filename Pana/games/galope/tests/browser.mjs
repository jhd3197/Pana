// npm start; node Pana/games/galope/tests/browser.mjs [playwright-package]
import assert from 'node:assert/strict';
import { launch, waitPrepared } from '../../../tests/browser-kit.js';
import {mkdir} from 'node:fs/promises';
const browser=await launch(),base=process.env.PANA_QA_URL||'http://localhost:8461';
const output='art/galope';await mkdir(output,{recursive:true});const errors=[],code=`galope-${Date.now()}`;
const check=text=>console.log(`ok: ${text}`);
async function open(name,mobile=false,room=code){
  const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true}:{viewport:{width:1024,height:720},deviceScaleFactor:1});
  await ctx.addInitScript(() => localStorage.setItem('pana:settings',JSON.stringify({sound:false,music:false,quality:'baja'})));
 const p=await ctx.newPage();p.on('pageerror',e=>{errors.push(e.message);console.log('page error:',e.message);});
  // Three software-WebGL clients share the CPU (two suites per CI runner): state
  // still has to arrive, only later than Playwright's 30 s default.
  p.setDefaultTimeout(60000);
  p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))console.log('console:',m.text());});
  await p.goto(`${base}/g/galope/?room=${room}&name=${name}&debug`);
  await p.waitForFunction(()=>window.galope?.room.connected,null,{timeout:90000});await waitPrepared(p);return p;
}
try{
  const a=await open('Juan');await a.locator('#start').waitFor({state:'visible'});
  await a.screenshot({path:`${output}/lobby.png`});check('course and real mounted avatar render');
  await a.locator('[data-coat="palomino"]').click();assert.equal(await a.evaluate(()=>galope.room.coat),'palomino');
  const b=await open('María');await b.waitForFunction(()=>galope.state.players.length===2);
  assert.equal(await b.locator('#start').isDisabled(),true);await a.locator('#start').click();
  await b.waitForFunction(()=>galope.state.phase==='racing',null,{timeout:90000});
  const ids=await a.evaluate(()=>({host:galope.room.id,guest:galope.state.players.find(p=>!p.bot&&p.id!==galope.room.id).id}));
  await b.bringToFront();await b.keyboard.down('w');await b.waitForFunction(()=>galope.state.players.find(p=>p.id===galope.room.id).progress>3);await b.keyboard.up('w');
  await a.waitForFunction(id=>galope.state.players.find(p=>p.id===id).progress>0,ids.guest);check('two clients share countdown, bots and guest movement');
  // Prediction: with the host's snapshots held back the guest's horse still runs; then it settles on the host's.
  await b.waitForFunction(()=>!!galope.room.predicted);await a.evaluate(()=>{galope.room.publish=()=>{};});
  // The horse still coasts: let snapshots already on the wire land (30 frames with none) before reading.
  await b.evaluate(()=>new Promise(done=>{let last=galope.state,quiet=0;const tick=()=>{if(galope.state===last)quiet++;else{last=galope.state;quiet=0;}if(quiet>30)done();else requestAnimationFrame(tick);};tick();}));
  const stalled=await b.evaluate(()=>({predicted:galope.room.predicted.progress,shown:galope.state.players.find(p=>p.id===galope.room.id).progress}));
  await b.keyboard.down('w');await b.waitForFunction(p=>galope.room.predicted.progress>p+3,stalled.predicted);await b.keyboard.up('w');
  assert.equal(await b.evaluate(()=>galope.state.players.find(p=>p.id===galope.room.id).progress),stalled.shown,'no snapshot arrived while predicting');
  await a.evaluate(()=>{delete galope.room.publish;});
  await b.waitForFunction(()=>{const me=galope.state.players.find(p=>p.id===galope.room.id),p=galope.room.predicted;return p&&Math.hypot(me.x-p.x,me.z-p.z)<1.5;});check('the guest runs its own horse at once and settles on the host position');
  await a.locator('#menu').click();const time=await a.evaluate(()=>galope.state.time);await a.waitForFunction(t=>galope.state.time>t+.15,time);await a.locator('#pana-resume').click();check('multiplayer menu keeps the race moving');
  await a.evaluate(()=>{galope.manual(true);galope.place(galope.room.id,galope.waterS);});await a.keyboard.down('w');
  await a.evaluate(()=>galope.step(1,galope.input()));
  await a.waitForFunction(()=>{const p=galope.state.players.find(p=>p.id===galope.room.id),c=galope.world.camera.position;return p.water>.3&&Math.hypot(c.x-p.x,c.z-p.z)<10;});await a.screenshot({path:`${output}/water.png`});await a.keyboard.up('w');
  assert.ok(await a.evaluate(()=>galope.state.players.find(p=>p.id===galope.room.id).speed)<10);check('visible crossing applies shallow-water drag');
  await a.evaluate(()=>{galope.place(galope.room.id,galope.JUMPS[0].s-4);galope.room.game.players.find(p=>p.id===galope.room.id).speed=12;});
  await a.keyboard.down('w');await a.keyboard.down('Space');await a.evaluate(()=>galope.step(.3,galope.input()));
  await a.waitForFunction(()=>{const p=galope.state.players.find(p=>p.id===galope.room.id),c=galope.world.camera.position;return p.jumpY>.5&&Math.hypot(c.x-p.x,c.z-p.z)<10;});
  await a.screenshot({path:`${output}/jump.png`});await a.keyboard.up('Space');await a.keyboard.up('w');await a.evaluate(()=>galope.manual(false));check('keyboard jump lifts horse and rider');
  const c=await open('Luisa',true);await c.waitForFunction(()=>galope.state.players.find(p=>p.id===galope.room.id)?.spectator);check('late arrival waits for next race');
  await a.close();await b.waitForFunction(()=>galope.room.isHost);assert.equal(await b.evaluate(()=>galope.state.phase),'racing');check('host migration preserves active race');
  await c.close();await b.waitForFunction(()=>galope.room.members.size===1);
  await b.locator('#menu').click();const paused=await b.evaluate(()=>galope.state.time);await b.waitForTimeout(250);assert.equal(await b.evaluate(()=>galope.state.time),paused);await b.locator('#pana-resume').click();check('solo menu pauses simulation');
  await b.evaluate(()=>{galope.place(galope.room.id,galope.LENGTH*2-1);galope.room.game.players.find(p=>p.id===galope.room.id).speed=12;});await b.keyboard.down('w');
  await b.locator('#results').waitFor({state:'visible'});await b.keyboard.up('w');await b.screenshot({path:`${output}/results.png`});
  await b.locator('#again').click();await b.waitForFunction(()=>galope.state.phase==='countdown'&&galope.state.time===0);check('finish and replay reset race');
  await b.close();
  const mobile=await open('Móvil',true,`${code}-touch`);await mobile.screenshot({path:`${output}/mobile-lobby.png`});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // The shared horizontal-game guard intentionally blocks portrait play.
  await mobile.locator('.pana-rotate').waitFor({state:'visible'});
  await mobile.setViewportSize({width:844,height:390});
  await mobile.locator('.pana-rotate').waitFor({state:'hidden'});
  await mobile.locator('#start').click();await mobile.waitForFunction(()=>galope.state.phase==='racing');
  const btn=await mobile.locator('[data-input="go"]').boundingBox(),cdp=await mobile.context().newCDPSession(mobile);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:btn.x+btn.width/2,y:btn.y+btn.height/2}]});
  await mobile.waitForFunction(()=>galope.state.players.find(p=>p.id===galope.room.id).speed>4);
  await mobile.screenshot({path:`${output}/mobile-race.png`});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();check('real held touch accelerates after rotating the 390px mobile screen');
  await mobile.evaluate(()=>{galope.room.cut();});await mobile.waitForFunction(()=>!galope.room.connected);
  await mobile.locator('#menu').click();await mobile.locator('#local-race').click();await mobile.waitForFunction(()=>galope.room.offline&&galope.state.phase==='lobby');
  await mobile.locator('#start').click();await mobile.waitForFunction(()=>galope.state.phase==='countdown');check('offline fallback starts a local race');
  await mobile.goto(`${base}/`);await mobile.getByRole('heading',{name:'Galope',exact:true}).waitFor();check('hub discovers Galope');
  assert.deepEqual(errors,[]);check('no uncaught browser errors');
}catch(error){for(const context of browser.contexts())for(const p of context.pages()){console.log(await p.evaluate(()=>window.galope?({connected:galope.room.connected,host:galope.room.isHost,phase:galope.state.phase,countdown:galope.state.countdown,time:galope.state.time,players:galope.state.players.length}):location.href).catch(()=>null));await p.screenshot({path:`${output}/failure-${browser.contexts().indexOf(context)}.png`}).catch(()=>{});}throw error;}finally{await browser.close();}
