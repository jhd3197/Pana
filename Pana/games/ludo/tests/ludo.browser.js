import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.PANA_TEST_URL||'http://localhost:8461',code=`ludo-${Date.now()}`;
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('art/ludo',{recursive:true});
async function open(name,mobile=false,roomCode=code){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(name=>{localStorage.setItem('pana:name',name);localStorage.setItem('pana:avatar',JSON.stringify({hat:'gorra',outfitColor:'#3d7bf2'}));},name);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/g/ludo/?room=${roomCode}&debug`);
  await page.waitForFunction(()=>window.ludoDebug?.world&&ludoDebug.room.connected,null,{timeout:90000});
  await page.locator('#pana-lobby-ready:not([disabled])').waitFor({timeout:90000});
  await page.locator('#loading').waitFor({state:'hidden'});return page;
}
async function sync(a,b){
  const revision=await a.evaluate(()=>ludoDebug.room.state.revision);
  await b.waitForFunction(rev=>ludoDebug.room.state.revision>=rev,revision);
}
try{
  const a=await open('Juan'),b=await open('Ana');
  await a.waitForFunction(()=>ludoDebug.room.members.size===2);await b.waitForFunction(()=>ludoDebug.room.seat===1);
  assert.ok(await b.locator('#start').isDisabled());
  assert.equal(await a.evaluate(()=>ludoDebug.world.characters[0].group.userData.characterVersion),'studio-v1');
  assert.equal(await a.evaluate(()=>ludoDebug.world.characters[0].avatar.hat),'gorra');
  await a.screenshot({path:'art/ludo/desktop-lobby.png'});
  await a.locator('#start').click();await sync(a,b);
  // Deterministic seed gives repeatable real UI turns, including leaving the yard.
  await a.evaluate(()=>{ludoDebug.room.game.rng=123;ludoDebug.room.publish();});await sync(a,b);
  const humans=new Map([[await a.evaluate(()=>ludoDebug.room.id),a],[await b.evaluate(()=>ludoDebug.room.id),b]]);
  let moved=false;
  for(let i=0;i<24;i++){
    const s=await a.evaluate(()=>ludoDebug.room.state),p=s.players[s.turn];
    if(p.id===null){await a.evaluate(()=>ludoDebug.room.tick(2));continue;}
    const client=humans.get(p.id);await sync(a,client);
    if(!s.die)await client.locator('#roll').click();
    else {const piece=await client.evaluate(()=>ludoDebug.chooseMove(ludoDebug.room.state));await client.locator(`[data-piece="${piece}"]`).click();moved=true;}
    await a.waitForFunction(rev=>ludoDebug.room.state.revision>rev,s.revision);
  }
  assert.ok(moved);await sync(a,b);
  assert.deepEqual(await a.evaluate(()=>ludoDebug.room.state.players),await b.evaluate(()=>ludoDebug.room.state.players));
  // A live board click uses the same validated move as keyboard/touch buttons.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turn=0;g.players[0].pieces=[5,-1,-1,-1];g.die=2;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  await a.waitForTimeout(500);
  const point=await a.evaluate(()=>ludoDebug.world.projectPiece(0,0));await a.mouse.click(point.x,point.y);
  await b.waitForFunction(()=>ludoDebug.room.state.players[0].pieces[0]===7);
  await a.locator('#view').click();await a.screenshot({path:'art/ludo/desktop-playing.png'});
  console.log('ok: two real clients, saved panas, UI dice/moves and 3D raycast replication');
  // Keep a pending HUMAN move across host handoff so no bot races the assertion.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turn=1;g.die=6;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  const before=await b.evaluate(()=>({pieces:ludoDebug.room.state.players.map(p=>p.pieces),rng:ludoDebug.room.state.rng}));
  await a.close();await b.waitForFunction(()=>ludoDebug.room.isHost);
  assert.deepEqual(await b.evaluate(()=>ludoDebug.room.state.players.map(p=>p.pieces)),before.pieces);
  assert.equal(await b.evaluate(()=>ludoDebug.room.state.rng),before.rng);assert.equal(await b.evaluate(()=>ludoDebug.room.state.die),6);
  const c=await open('Luis');await c.waitForFunction(()=>ludoDebug.room.seat===0);await sync(b,c);
  assert.deepEqual(await c.evaluate(()=>ludoDebug.room.state.players[0].pieces),before.pieces[0]);await c.close();
  await b.locator('#menu').click();
  await b.evaluate(()=>{const g=ludoDebug.room.game;g.turn=0;g.die=0;g.revision++;ludoDebug.room.publish();});
  const rev=await b.evaluate(()=>ludoDebug.room.state.revision);await b.waitForTimeout(1200);assert.equal(await b.evaluate(()=>ludoDebug.room.state.revision),rev);
  await b.locator('#pana-resume').click();
  await b.waitForFunction(rev=>ludoDebug.room.state.revision>rev,rev);
  console.log('ok: migration preserves pending dice/board, late arrival inherits bot, solo menu pauses bots');
  await b.evaluate(()=>{const g=ludoDebug.room.game;g.turn=1;g.die=1;g.players[1].pieces=[56,56,56,55];g.revision++;ludoDebug.room.publish();});
  await b.locator('[data-piece="3"]').click();await b.locator('#results').waitFor({state:'visible'});
  assert.match(await b.locator('#result-title').textContent(),/Ana/);await b.screenshot({path:'art/ludo/results.png'});
  await b.locator('#again').click();assert.equal(await b.evaluate(()=>ludoDebug.room.state.round),2);
  await b.close();
  const m=await open('Móvil',true,`${code}-mobile`);await m.screenshot({path:'art/ludo/mobile-lobby.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await m.locator('#start').tap();await m.locator('#roll').tap();
  await m.evaluate(()=>{const g=ludoDebug.room.game;g.turn=0;g.die=6;g.revision++;ludoDebug.room.publish();});
  await m.locator('[data-piece="0"]').tap();assert.equal(await m.evaluate(()=>ludoDebug.room.state.players[0].pieces[0]),0);
  await m.screenshot({path:'art/ludo/mobile-playing.png'});
  await m.setViewportSize({width:844,height:390});await m.screenshot({path:'art/ludo/mobile-landscape.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await m.locator('#world').evaluate(el=>el.getBoundingClientRect().height>250));
  await m.evaluate(()=>ludoDebug.room.cut());await m.locator('#practice').waitFor({state:'visible'});await m.locator('#practice').click();
  assert.ok(await m.locator('#invite').isDisabled());await m.locator('#start').click();assert.equal(await m.evaluate(()=>ludoDebug.room.state.phase),'playing');
  // Build all three Studio factories through the real catalog.
  assert.equal(await m.evaluate(async()=>{const {ASSETS}=await import('/studio/catalog.js');for(const asset of ASSETS.filter(a=>a.id.startsWith('ludo-'))){const {group}=await asset.build();if(!group.children.length)throw Error('empty model');group.userData.dispose();}return ASSETS.filter(a=>a.id.startsWith('ludo-')).length;}),3);
  const response=await m.request.get(`${base}/api/games`);const listing=await response.json();assert.ok(JSON.stringify(listing).includes('Ludo'));
  await m.goto(base);await m.getByRole('heading',{name:'Ludo',exact:true}).waitFor();
  console.log('ok: win/rematch, portrait and landscape touch, local fallback, Studio models and hub discovery');
  assert.deepEqual(errors,[]);
}catch(error){for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){await p.screenshot({path:`art/ludo/failure-${i}.png`}).catch(()=>{});console.log(await p.evaluate(()=>window.ludoDebug?ludoDebug.room.state:location.href).catch(()=>null));}throw error;}
finally{await browser.close();}
