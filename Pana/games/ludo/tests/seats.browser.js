// Five and six seats on two real clients: the host picks the count in the
// lobby, both screens build the star board with every pana by their own yard,
// and a guest's roll, move and capture land on the same star cells.
import assert from 'node:assert/strict';
import { launch } from '../../../tests/browser-kit.js';
import { mkdir } from 'node:fs/promises';
const base=process.env.PANA_TEST_URL||'http://localhost:8461';
const browser=await launch(),errors=[];
await mkdir('art/ludo',{recursive:true});
async function open(name,code){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  await context.addInitScript(name=>{localStorage.setItem('pana:name',name);localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false}));},name);
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/g/ludo/?room=${code}&debug`);
  await page.waitForFunction(()=>window.ludoDebug?.world&&ludoDebug.room.connected&&window.PANA_PREPARED===true,null,{timeout:90000});
  await page.locator('#loading').waitFor({state:'hidden'});return page;
}
async function sync(a,b){
  const revision=await a.evaluate(()=>ludoDebug.room.state.revision);
  await b.waitForFunction(rev=>ludoDebug.room.state.revision>=rev,revision);
}
// Every pana sits beside their own yard, faces the board, and every pawn rests on its star cell.
const table=page=>page.evaluate(async()=>{
  const {boardPoint}=await import('/g/ludo/board-model.js'),world=ludoDebug.world,seats=ludoDebug.room.state.players.length;
  const seated=world.characters.map((character,seat)=>{
    const yard=[0,1,2,3].map(piece=>boardPoint(seat,-1,piece,seats));
    const x=yard.reduce((s,p)=>s+p[0],0)/4,z=yard.reduce((s,p)=>s+p[1],0)/4,pos=character.group.position,angle=character.group.rotation.y;
    const towards=(x*pos.x+z*pos.z)/Math.hypot(x,z)/Math.hypot(pos.x,pos.z);
    return towards>.99&&(Math.sin(angle)*-pos.x+Math.cos(angle)*-pos.z)/Math.hypot(pos.x,pos.z)>.99;
  });
  const placed=world.pawns.every(p=>{const progress=ludoDebug.room.state.players[p.seat].pieces[p.piece],[x,z]=boardPoint(p.seat,progress,p.piece,seats);return Math.hypot(p.target.x-x,p.target.z-z)<.2;});
  const safe=Array.from({length:seats},(_,s)=>[13*s,13*s+8]).flat().every(i=>world.scene.getObjectByName(`safe-cell-${i}`)?.children.length===8);
  return {seats,characters:world.characters.filter(Boolean).length,pawns:world.pawns.length,seated,placed,safe,plates:document.querySelectorAll('#scoreboard .score:not([hidden])').length};
});
try{
  for(const seats of [6,5]){
    const code=`ludo-seats-${seats}-${Date.now()}`,a=await open('Juan',code),b=await open('Ana',code);
    await a.waitForFunction(()=>ludoDebug.room.members.size===2);await b.waitForFunction(()=>ludoDebug.room.seat===1);
    await a.locator(`[data-room-option="seats"][data-value="${seats}"]`).click();
    for(const page of [a,b])await page.waitForFunction(n=>ludoDebug.room.state.players.length===n&&ludoDebug.world.pawns.length===n*4&&ludoDebug.world.characters.filter(Boolean).length===n,seats);
    assert.equal(await b.evaluate(()=>ludoDebug.room.state.options.seats),seats);
    assert.equal(await b.locator('#lobby-roster li').count(),seats,'the lobby lists every seat');
    for(const page of [a,b]){
      const seen=await table(page);
      assert.deepEqual(seen.seated,Array(seats).fill(true),'every pana sits by their colour and faces the board');
      assert.ok(seen.placed&&seen.safe,`${seats} yards and safe squares on the star board`);
    }
    await a.screenshot({path:`art/ludo/seats-${seats}-lobby.png`});
    await a.evaluate(()=>ludoDebug.room.action('options',{options:{starter:'azar'}}));await sync(a,b);
    await a.locator('#start').click();
    await b.waitForFunction(()=>ludoDebug.room.state.phase==='playing');
    // Ana's piece two cells behind the last seat's on ordinary square 18: her roll of 2 captures it.
    await a.evaluate(n=>{
      const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=1;g.die=0;g.rng=1;
      g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[1].pieces[0]=3;g.players[n-1].pieces[0]=31;
      g.revision++;ludoDebug.room.publish();
    },seats);await sync(a,b);
    assert.equal(await b.evaluate(()=>ludoDebug.room.state.turn),1);
    await b.evaluate(()=>ludoDebug.room.action('roll',{power:.5}));
    for(const page of [a,b])await page.waitForFunction(n=>ludoDebug.room.state.players[1].pieces[0]===5&&ludoDebug.room.state.players[n-1].pieces[0]===-1,seats,{timeout:60000});
    for(const page of [a,b])await page.waitForFunction(()=>!ludoDebug.world.moving&&!ludoDebug.world.tossing,null,{timeout:60000});
    for(const page of [a,b]){const seen=await table(page);assert.ok(seen.placed,'the hop and the capture land on star cells');}
    // A piece one step from home finishes in the centre wedge on both screens.
    await a.evaluate(()=>{const g=ludoDebug.room.game,home=g.players.length*13+4;g.turnPause=null;g.autoMove=null;g.turn=1;g.die=1;g.players[1].pieces=[home-1,home,home,home];g.revision++;ludoDebug.room.publish();});await sync(a,b);
    await b.evaluate(()=>ludoDebug.room.action('move',{piece:0}));
    await a.waitForFunction(()=>ludoDebug.room.state.phase==='finished'&&ludoDebug.room.state.winner===1);
    await b.waitForFunction(()=>ludoDebug.room.state.phase==='finished'&&!ludoDebug.world.moving);
    await b.keyboard.down('Shift');assert.equal((await table(b)).plates,seats,'a progress plate per seat');
    await b.keyboard.up('Shift');await b.screenshot({path:`art/ludo/seats-${seats}-finish.png`});
    await a.context().close();await b.context().close();
    console.log(`ok: ${seats} seats, two clients, star board, capture and finish`);
  }
  assert.deepEqual(errors,[]);
}catch(error){for(const [i,c]of browser.contexts().entries())for(const p of c.pages()){await p.screenshot({path:`art/ludo/seats-failure-${i}.png`}).catch(()=>{});console.log(await p.evaluate(()=>window.ludoDebug?ludoDebug.room.state:location.href).catch(()=>null));}throw error;}
finally{await browser.close();}
