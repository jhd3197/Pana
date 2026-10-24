import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const base=process.env.PANA_TEST_URL||'http://localhost:8461',code=`ludo-${Date.now()}`;
const browser=await chromium.launch({headless:true}),errors=[];
await mkdir('art/ludo',{recursive:true});
async function open(name,mobile=false,roomCode=code){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(name=>{localStorage.setItem('pana:name',name);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false}));localStorage.setItem('pana:avatar',JSON.stringify({hat:'gorra',outfitColor:'#3d7bf2'}));},name);
  const page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/g/ludo/?room=${roomCode}&debug`);
  await page.waitForFunction(()=>window.ludoDebug?.world&&ludoDebug.room.connected,null,{timeout:90000});
  // A pana joining mid-game never sees the lobby, so wait for preparation, then for Ready only in the lobby.
  await page.waitForFunction(()=>window.PANA_PREPARED===true,null,{timeout:90000});
  if(await page.locator('#pana-lobby-shell').isVisible())await page.waitForFunction(()=>window.PANA_PREPARED===true&&!document.querySelector('#pana-lobby-ready')?.disabled,null,{timeout:90000});
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
  await a.locator('[data-room-option="entry"][data-value="one-six"]').click();
  await a.locator('#pana-room-more').click();
  await a.locator('[data-room-option="captureBonus"][data-value="true"]').click();
  await a.locator('[data-room-option="threeSixes"][data-value="false"]').click();
  await b.waitForFunction(()=>ludoDebug.room.state.options.threeSixes===false);
  assert.deepEqual(await b.evaluate(()=>ludoDebug.room.state.options),{entry:'one-six',captureBonus:true,threeSixes:false,starter:'cacho'});
  await b.locator('#pana-room-more').click();
  assert.ok(await b.locator('[data-room-option="captureBonus"][data-value="false"]').isDisabled());
  await b.locator('#pana-room-done').click();
  await a.locator('#pana-room-reset').click();await a.locator('#pana-room-done').click();
  await b.waitForFunction(()=>ludoDebug.room.state.options.entry==='six'&&ludoDebug.room.state.options.threeSixes);
  assert.equal(await a.evaluate(()=>ludoDebug.world.characters[0].group.userData.characterVersion),'studio-v1');
  assert.equal(await a.evaluate(()=>ludoDebug.world.characters[0].avatar.hat),'gorra');
  // Each player belongs beside their own yard, on both clients. In particular,
  // green and blue must not be swapped by reversing the chair rotation.
  for (const page of [a, b]) {
    const aligned = await page.evaluate(async () => {
      const { boardPoint } = await import('/g/ludo/board-model.js');
      return ludoDebug.world.characters.map((character, seat) => {
        const yard = Array.from({ length: 4 }, (_, piece) => boardPoint(seat, -1, piece));
        const x = yard.reduce((sum, p) => sum + p[0], 0) / 4;
        const z = yard.reduce((sum, p) => sum + p[1], 0) / 4;
        const pos = character.group.position, angle = character.group.rotation.y;
        return Math.sign(pos.x) === Math.sign(x) && Math.sign(pos.z) === Math.sign(z)
          && (Math.sin(angle) * -pos.x + Math.cos(angle) * -pos.z) / Math.hypot(pos.x, pos.z) > .99;
      });
    });
    assert.deepEqual(aligned, [true, true, true, true], 'every pana sits by their color and faces the board');
  }
  await a.screenshot({path:'art/ludo/desktop-lobby.png'});
  await a.locator('#start').click();await sync(a,b);
  assert.equal(await b.evaluate(()=>ludoDebug.room.state.phase),'starter');
  // ¿Quién empieza?: everyone shakes at once. Juan holds the cacho button, Ana holds Space.
  await a.locator('#pana-starter-shake').waitFor();await b.locator('#pana-starter-shake').waitFor();
  await a.locator('#pana-starter-shake').dispatchEvent('pointerdown',{pointerId:3,button:0});
  await b.waitForFunction(()=>ludoDebug.room.state.starter.shaking.includes(0));
  await b.evaluate(()=>document.activeElement?.blur());await b.keyboard.down(' ');
  await a.waitForFunction(()=>ludoDebug.room.state.starter.shaking.includes(1));
  assert.ok(await a.evaluate(()=>ludoDebug.world.starter.group.visible),'the cachos are on the table');
  await a.screenshot({path:'art/ludo/desktop-starter.png'});
  await a.locator('#pana-starter-shake').dispatchEvent('pointerup',{pointerId:3,button:0});
  await b.keyboard.up(' ');
  await b.waitForFunction(()=>0 in ludoDebug.room.state.starter.slammed&&1 in ludoDebug.room.state.starter.slammed||ludoDebug.room.state.starter.phase!=='shake');
  await a.waitForFunction(()=>ludoDebug.world.starter.revealed,null,{timeout:30000});
  await b.waitForFunction(()=>ludoDebug.world.starter.revealed||ludoDebug.room.state.phase==='playing',null,{timeout:30000});
  await a.screenshot({path:'art/ludo/desktop-starter-lift.png'});
  await a.waitForFunction(()=>ludoDebug.room.state.phase==='playing',null,{timeout:60000});await sync(a,b);
  const opened=await a.evaluate(()=>ludoDebug.room.state);
  assert.equal(opened.turn,opened.starter.order[0]);assert.match(opened.event,/Empieza/);
  assert.equal(await b.evaluate(()=>ludoDebug.world.starter.active),false,'the cachos leave the table');
  // Reproduce green and yellow sharing yellow's safe starting square.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.round++;g.phase='playing';g.turn=1;g.die=2;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);
    g.players[1].pieces[0]=13;g.players[2].pieces[0]=0;g.revision++;ludoDebug.room.publish();
  });await sync(a,b);
  for(const page of [a,b]){
    await page.waitForFunction(()=>ludoDebug.world.pawns.every(p=>!p.path&&!p.flight&&p.model.position.distanceTo(p.target)<.01)&&ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0).model.scale.x<.5);
    assert.equal(await page.evaluate(()=>{
      const [green,yellow]=[1,2].map(seat=>ludoDebug.world.pawns.find(p=>p.seat===seat&&p.piece===0));
      return Math.abs(green.model.position.y-yellow.model.position.y)<.001
        &&green.model.position.distanceTo(yellow.model.position)>.14
        &&green.model.scale.x<.5&&yellow.model.scale.x<.5;
    }),true,'safe-square pieces are side by side, never stacked');
    assert.equal(await page.evaluate(()=>[0,8,13,21,26,34,39,47].every(i=>ludoDebug.world.scene.getObjectByName(`safe-cell-${i}`)?.children.length===8)),true);
  }
  await b.screenshot({path:'art/ludo/shared-safe-square.png'});
  const sharedPoint=await b.evaluate(()=>ludoDebug.world.projectPiece(1,0));
  await b.mouse.click(sharedPoint.x,sharedPoint.y);
  await a.waitForFunction(()=>ludoDebug.room.state.players[1].pieces[0]===15);
  await a.waitForFunction(()=>{const p=ludoDebug.world.pawns.find(p=>p.seat===2&&p.piece===0);return p.model.scale.x>.99&&p.model.position.distanceTo(p.target)<.01;});
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.round--;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  // Then Ludo's own die: a flick across the table throws hard.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turn=0;g.die=0;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  const box=await a.locator('#world').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height*.7;
  await a.mouse.move(cx,cy);await a.mouse.down();
  for(let i=1;i<=6;i++)await a.mouse.move(cx,cy-i*40);
  await a.mouse.up();
  await b.waitForFunction(()=>ludoDebug.room.state.lastDie>0&&ludoDebug.room.state.toss.seat===0);
  assert.ok(await b.evaluate(()=>ludoDebug.room.state.toss.power)>.5,'a flick throws hard');
  await b.waitForFunction(()=>ludoDebug.world.tossing);
  console.log('ok: ¿Quién empieza? decides who starts, everyone shaking at once');
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
  // Eating a ficha: the hunter hops onto the cell, the victim flies home and both panas hear it.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.phase='playing';g.turn=0;g.players[0].pieces=[14,-1,-1,-1];g.players[1].pieces=[5,-1,-1,-1];g.die=4;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  await a.locator('[data-piece="0"]').click();
  await b.waitForFunction(()=>ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0).flight);
  await b.waitForFunction(()=>/te comió/.test(document.querySelector('.pk-banner')?.textContent||''));
  await b.waitForFunction(()=>{const p=ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0);return !p.flight&&p.model.position.distanceTo(p.target)<.01;});
  console.log('ok: a capture hops, launches the victim home and calls it out');
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
  // A rematch shakes the cachos again; the last match's slam doesn't carry over.
  await b.locator('#pana-starter-shake').waitFor();assert.equal(await b.evaluate(()=>ludoDebug.room.state.phase),'starter');
  await b.close();
  const m=await open('Móvil',true,`${code}-mobile`);await m.screenshot({path:'art/ludo/mobile-lobby.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  // A finger on the table shakes the cacho; lifting it slams.
  await m.locator('#start').tap();await m.locator('#pana-starter-shake').waitFor();
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await m.screenshot({path:'art/ludo/mobile-starter.png'});
  await m.locator('#world').tap();
  await m.waitForFunction(()=>0 in ludoDebug.room.state.starter.slammed);
  await m.evaluate(()=>{const g=ludoDebug.room.game;g.phase='playing';g.turn=0;g.die=6;g.revision++;ludoDebug.room.publish();});
  await m.locator('[data-piece="0"]').tap();assert.equal(await m.evaluate(()=>ludoDebug.room.state.players[0].pieces[0]),0);
  await m.screenshot({path:'art/ludo/mobile-playing.png'});
  await m.setViewportSize({width:844,height:390});await m.screenshot({path:'art/ludo/mobile-landscape.png'});
  assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.ok(await m.locator('#world').evaluate(el=>el.getBoundingClientRect().height>250));
  await m.evaluate(()=>ludoDebug.room.cut());await m.locator('#practice').waitFor({state:'visible'});await m.locator('#practice').click();
  assert.ok(await m.locator('#invite').isDisabled());await m.locator('#start').click();assert.equal(await m.evaluate(()=>ludoDebug.room.state.phase),'starter');
  // Build all three Studio factories through the real catalog.
  assert.equal(await m.evaluate(async()=>{const {ASSETS}=await import('/studio/catalog.js');for(const asset of ASSETS.filter(a=>a.id.startsWith('ludo-'))){const {group}=await asset.build();if(!group.children.length)throw Error('empty model');group.userData.dispose();}return ASSETS.filter(a=>a.id.startsWith('ludo-')).length;}),3);
  const response=await m.request.get(`${base}/api/games`);const listing=await response.json();assert.ok(JSON.stringify(listing).includes('Ludo'));
  await m.goto(base);await m.getByRole('heading',{name:'Ludo',exact:true}).waitFor();
  console.log('ok: win/rematch, portrait and landscape touch, local fallback, Studio models and hub discovery');
  assert.deepEqual(errors,[]);
}catch(error){for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){await p.screenshot({path:`art/ludo/failure-${i}.png`}).catch(()=>{});console.log(await p.evaluate(()=>window.ludoDebug?ludoDebug.room.state:location.href).catch(()=>null));}throw error;}
finally{await browser.close();}
