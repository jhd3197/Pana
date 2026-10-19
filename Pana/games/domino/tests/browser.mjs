import assert from 'node:assert/strict';
import { launch, waitPrepared } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const browser = await launch();
const base = process.env.PANA_QA_URL || 'http://localhost:8461', code = `domino-${Date.now()}`, errors = [];
await mkdir('art/domino',{recursive:true});
const check = text => console.log(`ok: ${text}`);
async function open(name, mobile=false, room=code) {
 const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 await context.addInitScript(() => localStorage.setItem('pana:settings',JSON.stringify({sound:false,music:false,quality:'baja'})));
 const page = await context.newPage(); page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.goto(`${base}/g/domino/?room=${room}&name=${name}&debug`);
 await page.waitForFunction(()=>window.dominoDebug?.world && dominoDebug.room.connected,null,{timeout:90000});
 await page.locator('#loading').waitFor({state:'hidden'}); await waitPrepared(page); return page;
}
async function advance(host, humans) {
 const state = await host.evaluate(()=>dominoDebug.room.state);
 if(state.phase!=='playing')return false;
 const player = state.players[state.turn], human=humans.get(player.id);
 if(player.id===null){await host.evaluate(()=>dominoDebug.room.tick(2));}
 else {
  assert.ok(human,'missing human client');
  await human.waitForFunction(rev=>dominoDebug.room.state.revision>=rev,state.revision);
  const move=await human.evaluate(()=>dominoDebug.chooseMove(dominoDebug.room.state));
  if(move){
   await human.locator(`[data-tile="${move.tile}"]`).click();
   if(await human.locator('#end-actions').isVisible())await human.locator(`#play-${move.end}`).click();
  }else await human.locator('#pass').click();
 }
 await host.waitForFunction(rev=>dominoDebug.room.state.revision>rev,state.revision);
 return true;
}
try {
 const a=await open('Juan'), b=await open('María');
 await a.waitForFunction(()=>dominoDebug.room.members.size===2);
 await b.waitForFunction(()=>dominoDebug.room.seat===1);
 await a.waitForFunction(()=>dominoDebug.room.state.players.every(p=>!!dominoDebug.world.characters[p.seat]));
 assert.equal(await b.locator('#start').isDisabled(),true);
 assert.equal(await a.evaluate(()=>dominoDebug.world.characters[0].group.userData.characterVersion),'studio-v1');
 await a.screenshot({path:'art/domino/desktop-lobby.png'}); check('four actual shared characters, table and chairs load in 3D');
 await a.locator('#start').click(); await b.waitForFunction(()=>dominoDebug.room.state.phase==='playing');
 const humans=new Map([[await a.evaluate(()=>dominoDebug.room.id),a],[await b.evaluate(()=>dominoDebug.room.id),b]]);
 for(let i=0;i<10;i++)if(!await advance(a,humans))break;
 const chain=await a.evaluate(()=>dominoDebug.room.state.chain);
 await b.waitForFunction(count=>dominoDebug.room.state.chain.length>=count,chain.length);
 assert.deepEqual(await b.evaluate(()=>dominoDebug.room.state.chain),chain);
 await a.screenshot({path:'art/domino/desktop-playing.png'}); check('real two-client legal moves replicate with tile animation');
 await a.locator('#camera-view').click(); await a.waitForTimeout(500); await a.screenshot({path:'art/domino/table-view.png'}); check('close table camera works');
 const before=await b.evaluate(()=>({chain:dominoDebug.room.state.chain,scores:dominoDebug.room.state.scores,round:dominoDebug.room.state.round}));
 await a.close(); await b.waitForFunction(()=>dominoDebug.room.isHost);
 assert.deepEqual(await b.evaluate(()=>dominoDebug.room.state.scores),before.scores);
 assert.equal(await b.evaluate(()=>dominoDebug.room.state.round),before.round);
 assert.ok(await b.evaluate(()=>dominoDebug.room.state.chain.length)>=before.chain.length); check('host migration preserves deal, score and round');
 await b.locator('#menu').click(); const revision=await b.evaluate(()=>dominoDebug.room.state.revision); await b.waitForTimeout(1400);
 assert.equal(await b.evaluate(()=>dominoDebug.room.state.revision),revision);
 await b.locator('#pana-resume').click();check('shared menu pauses bots when playing alone');
 humans.clear();humans.set(await b.evaluate(()=>dominoDebug.room.id),b);
 for(let i=0;i<100;i++)if(!await advance(b,humans))break;
 await b.locator('#result').waitFor({state:'visible'}); await b.screenshot({path:'art/domino/results.png'});
 const scores=await b.evaluate(()=>dominoDebug.room.state.scores);assert.ok(scores[0]>0||scores[1]>0);
 await b.locator('#next-round').click(); await b.waitForFunction(()=>dominoDebug.room.state.round===2&&dominoDebug.room.state.phase==='playing'); check('round completes, team points score, and next deal works');
 await b.close();
 const m=await open('Móvil',true,`${code}-touch`); await m.screenshot({path:'art/domino/mobile-lobby.png'});
 assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await m.locator('#start').tap();const mobileHumans=new Map([[await m.evaluate(()=>dominoDebug.room.id),m]]);
 for(let i=0;i<5;i++)if(!await advance(m,mobileHumans))break;
 await m.screenshot({path:'art/domino/mobile-playing.png'});check('390px layout and touch start work without horizontal overflow');
 await m.evaluate(()=>{dominoDebug.room.cut();});await m.waitForFunction(()=>!dominoDebug.room.connected);
 await m.locator('#practice').click();await m.waitForFunction(()=>dominoDebug.room.offline);await m.locator('#start').click();
 assert.equal(await m.evaluate(()=>dominoDebug.room.state.phase),'playing');check('connection failure has working local fallback');
 await m.goto(`${base}/`);await m.getByRole('heading',{name:'Dominó',exact:true}).waitFor();
 assert.equal(await m.getByRole('heading',{name:'Dominó',exact:true}).count(),1);check('hub discovers playable Dominó once');
 assert.deepEqual(errors,[]);check('no uncaught browser errors');
} catch(error){
 for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){
  console.log(await p.evaluate(()=>window.dominoDebug?({phase:dominoDebug.room.state.phase,seat:dominoDebug.room.seat,turn:dominoDebug.room.state.turn,connected:dominoDebug.room.connected,host:dominoDebug.room.isHost}):location.href).catch(()=>null));
  await p.screenshot({path:`art/domino/failure-${i}.png`}).catch(()=>{});
 }throw error;
} finally {await browser.close();}
