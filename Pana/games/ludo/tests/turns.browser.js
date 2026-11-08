// Ludo's real turns between two clients: UI dice and moves, a capture and a
// 3D board click. Split from ludo.browser.js to fit a slow runner's limit.
import assert from 'node:assert/strict';
import { ludoClients } from './ludo-clients.js';
const {browser,errors,sync,pair,startPlaying,fail}=await ludoClients('ludo-turns');
try{
  const [a,b]=await pair();
  await startPlaying(a,b);
  // Deterministic seed gives repeatable real UI turns, including leaving the yard,
  // from the board the opener suite leaves: Ana out on 15, yellow on its start.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=0;g.die=0;g.rng=123;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[1].pieces[0]=15;g.players[2].pieces[0]=0;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  const humans=new Map([[await a.evaluate(()=>ludoDebug.room.id),a],[await b.evaluate(()=>ludoDebug.room.id),b]]);
  // Each step waits for one new revision. A slow poll can miss the moment a
  // forced move is pending, so a human's pieces leaving where they began count
  // as a move too; play at least twelve steps, then on until one lands.
  let moved=false;const began=JSON.stringify((await a.evaluate(()=>ludoDebug.room.state)).players.slice(0,2).map(p=>p.pieces));
  for(let i=0;i<12||!moved&&i<40;i++){
    const s=await a.evaluate(()=>ludoDebug.room.state),p=s.players[s.turn];
    if(JSON.stringify(s.players.slice(0,2).map(p=>p.pieces))!==began)moved=true;
    if(s.turnPause){await a.waitForFunction(()=>!ludoDebug.room.state.turnPause);continue;}
    if(p.id===null){await a.waitForFunction(rev=>ludoDebug.room.state.revision>rev,s.revision);continue;}
    const client=humans.get(p.id);await sync(a,client);
    if(s.autoMove){await a.waitForFunction(rev=>ludoDebug.room.state.revision>rev,s.revision);moved=true;continue;}
    if(!s.die)await client.locator('#roll').click();
    else {const piece=await client.evaluate(()=>ludoDebug.chooseMove(ludoDebug.room.state));await client.locator(`[data-piece="${piece}"]`).click();moved=true;}
    await a.waitForFunction(rev=>ludoDebug.room.state.revision>rev,s.revision);
  }
  moved||=JSON.stringify((await a.evaluate(()=>ludoDebug.room.state)).players.slice(0,2).map(p=>p.pieces))!==began;
  assert.ok(moved,'a human turn moved a piece');await sync(a,b);
  assert.deepEqual(await a.evaluate(()=>ludoDebug.room.state.players),await b.evaluate(()=>ludoDebug.room.state.players));
  // Eating a ficha: the hunter hops onto the cell, the victim flies home and both panas hear it.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.phase='playing';g.turn=0;g.players[0].pieces=[14,-1,-1,-1];g.players[1].pieces=[5,-1,-1,-1];g.die=4;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  await a.locator('[data-piece="0"]').click();
  await b.waitForFunction(()=>ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0).flight);
  await b.waitForFunction(()=>/te comió/.test(document.querySelector('.pk-banner')?.textContent||''));
  await b.waitForFunction(()=>{const p=ludoDebug.world.pawns.find(p=>p.seat===1&&p.piece===0);return !p.flight&&p.model.position.distanceTo(p.target)<.01;});
  console.log('ok: a capture hops, launches the victim home and calls it out');
  // A live board click uses the same validated move as keyboard/touch buttons.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=0;g.players[0].pieces=[5,-1,-1,-1];g.die=2;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  await a.waitForFunction(()=>{const p=ludoDebug.world.pawns.find(p=>p.seat===0&&p.piece===0);return !p.path&&!p.flight&&p.model.position.distanceTo(p.target)<.01;});
  const point=await a.evaluate(()=>ludoDebug.world.projectPiece(0,0));await a.mouse.click(point.x,point.y);
  await b.waitForFunction(()=>ludoDebug.room.state.players[0].pieces[0]===7);
  await a.locator('#view').click();await a.screenshot({path:'art/ludo/desktop-playing.png'});
  console.log('ok: two real clients, saved panas, UI dice/moves and 3D raycast replication');
  assert.deepEqual(errors,[]);
}catch(error){await fail(error);}
finally{await browser.close();}
