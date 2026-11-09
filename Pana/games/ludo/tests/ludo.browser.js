// Ludo's lobby options, seating and ¿Quién empieza? opener between two real
// clients. Real turns and handoff have their own suites (turns, handoff) so
// each fits a slow runner's per-suite limit.
import assert from 'node:assert/strict';
import { ludoClients } from './ludo-clients.js';
const {browser,errors,sync,pair,fail}=await ludoClients('ludo');
try{
  const [a,b]=await pair();
  assert.ok(await b.locator('#start').isDisabled());
  await a.locator('[data-room-option="entry"][data-value="one-six"]').click();
  await a.locator('#pana-room-more').click();
  await a.locator('[data-room-option="captureBonus"][data-value="true"]').click();
  await a.locator('[data-room-option="threeSixes"][data-value="false"]').click();
  await b.waitForFunction(()=>ludoDebug.room.state.options.threeSixes===false);
  assert.deepEqual(await b.evaluate(()=>ludoDebug.room.state.options),{seats:4,entry:'one-six',extraOnOne:true,captureBonus:true,threeSixes:false,assistedEntry:true,turnSeconds:60,starter:'cacho'});
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
  // A reproducible, untied opener; tie rules have their own shared tests.
  await a.evaluate(()=>{ludoDebug.room.game.rng=1;});
  // A pana who never shakes slams on their own after SHAKE_LIMIT seconds of the
  // host's clock (quien-empieza.test.js covers that). On a slow runner the guest
  // can see the host's state that late, so the starter's clock stands still
  // until both panas have slammed; the bots and the lift then run as usual.
  const holdStarter=hold=>a.evaluate(hold=>{const room=ludoDebug.room;room.realStep??=room.step;
    room.step=hold?function(seconds){return this.game.phase==='starter'?false:this.realStep(seconds);}:room.realStep;},hold);
  await holdStarter(true);
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
  await holdStarter(false);
  await a.waitForFunction(()=>ludoDebug.world.starter.revealed||ludoDebug.room.state.phase==='playing',null,{timeout:90000});
  await b.waitForFunction(()=>ludoDebug.world.starter.revealed||ludoDebug.room.state.phase==='playing',null,{timeout:90000});
  await a.screenshot({path:'art/ludo/desktop-starter-lift.png'});
  await a.waitForFunction(()=>ludoDebug.room.state.phase==='playing',null,{timeout:60000});await sync(a,b);
  const opened=await a.evaluate(()=>ludoDebug.room.state);
  assert.equal(opened.turn,opened.starter.order[0]);assert.match(JSON.stringify(opened.event),/Empieza/);
  assert.equal(await b.evaluate(()=>ludoDebug.world.starter.active),false,'the cachos leave the table');
  // A guest's forced move is performed by the host, without a second click.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=1;g.die=0;g.autoMove=null;g.rng=1;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[1].pieces[0]=8;
    g.revision++;ludoDebug.room.publish();
  });await sync(a,b);
  await b.evaluate(()=>ludoDebug.room.action('roll',{power:.5}));
  await a.waitForFunction(()=>ludoDebug.room.state.players[1].pieces[0]===10,null,{timeout:60000});
  await b.waitForFunction(()=>ludoDebug.room.state.players[1].pieces[0]===10,null,{timeout:60000});
  // A stranded player receives the same visible entry help late in the match.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=1;g.die=0;g.autoMove=null;g.rng=1;
    g.players[1].pieces=[56,56,-1,-1];g.entryMisses[1]=3;g.entryLimits[1]=3;
    g.revision++;ludoDebug.room.publish();
  });await sync(a,b);await b.evaluate(()=>ludoDebug.room.action('roll',{power:.5}));
  await b.waitForFunction(()=>ludoDebug.room.state.lastDie===6&&ludoDebug.room.state.autoMove);
  // The next event can replace the banner right after, so check the text the wait saw.
  const assisted=await (await b.waitForFunction(()=>{const text=document.querySelector('#event').textContent;return !ludoDebug.world.tossing&&text.includes('Salida asistida')&&text;})).jsonValue();
  assert.match(assisted,/Salida asistida/);
  await b.waitForFunction(()=>ludoDebug.room.state.players[1].pieces[2]===0);
  // Reproduce green and yellow sharing yellow's safe starting square.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.autoMove=null;g.phase='playing';g.turn=1;g.die=2;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);
    g.players[1].pieces[0]=13;g.players[2].pieces[0]=0;g.revision++;ludoDebug.room.publish();
  });await sync(a,b);
  for(const page of [a,b]){
    await page.waitForFunction(()=>ludoDebug.world.pawns.every(p=>!p.path&&!p.flight&&p.model.position.distanceTo(p.target)<.01)&&ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0).model.scale.x>.85);
    assert.equal(await page.evaluate(()=>{
      const [green,yellow]=[1,2].map(seat=>ludoDebug.world.pawns.find(p=>p.seat===seat&&p.piece===0));
      return Math.abs(green.model.position.y-yellow.model.position.y)>.4
        &&green.model.position.distanceTo(yellow.model.position)>.14
        &&green.model.scale.x>.85&&yellow.model.scale.x>.85;
    }),true,'small shared groups stack at near-full size');
    assert.equal(await page.evaluate(()=>[0,8,13,21,26,34,39,47].every(i=>ludoDebug.world.scene.getObjectByName(`safe-cell-${i}`)?.children.length===8)),true);
  }
  await b.screenshot({path:'art/ludo/shared-safe-square.png'});
  const sharedPoint=await b.evaluate(()=>ludoDebug.world.projectPiece(1,0));
  await b.mouse.click(sharedPoint.x,sharedPoint.y);
  await a.waitForFunction(()=>ludoDebug.room.state.players[1].pieces[0]===15);
  await a.waitForFunction(()=>{const p=ludoDebug.world.pawns.find(p=>p.seat===2&&p.piece===0);return p.model.scale.x>.99&&p.model.position.distanceTo(p.target)<.01;});
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.round--;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  // Then Ludo's own die: a flick across the table throws hard.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=0;g.die=0;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  const landed=await b.evaluate(()=>ludoDebug.world.landedAt);
  const box=await a.locator('#world').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height*.7;
  await a.mouse.move(cx,cy);await a.mouse.down();
  for(let i=1;i<=6;i++)await a.mouse.move(cx,cy-i*40);
  await a.mouse.up();
  await b.waitForFunction(()=>ludoDebug.room.state.lastDie>0&&ludoDebug.room.state.toss.seat===0);
  assert.ok(await b.evaluate(()=>ludoDebug.room.state.toss.power)>.5,'a flick throws hard');
  // The toss runs on the wall clock: a slow guest may draw it start to finish
  // between two polls, so a die that already landed after the flick counts too.
  await b.waitForFunction(landed=>ludoDebug.world.tossing||ludoDebug.world.landedAt>landed,landed);
  console.log('ok: ¿Quién empieza? decides who starts, everyone shaking at once');
  assert.deepEqual(errors,[]);
}catch(error){await fail(error);}
finally{await browser.close();}
