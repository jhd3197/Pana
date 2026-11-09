// Ludo host handoff: a pending move survives migration, a late arrival takes
// the bot's seat, the solo menu pauses bots, then win and rematch. Split from
// ludo.browser.js to fit a slow runner's limit.
import assert from 'node:assert/strict';
import { ludoClients } from './ludo-clients.js';
const {browser,errors,open,sync,pair,startPlaying,fail}=await ludoClients('ludo-handoff');
try{
  const [a,b]=await pair();
  await startPlaying(a,b,'cacho');
  // Keep a pending HUMAN move across host handoff so no bot races the assertion.
  // Ana's six has two choices (move out or enter), so the host never plays it for her.
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.players[0].pieces=[7,-1,-1,-1];g.players[1].pieces=[10,-1,-1,-1];g.turn=1;g.die=6;g.revision++;ludoDebug.room.publish();});await sync(a,b);
  const before=await b.evaluate(()=>({pieces:ludoDebug.room.state.players.map(p=>p.pieces),rng:ludoDebug.room.state.rng}));
  await a.close();await b.waitForFunction(()=>ludoDebug.room.isHost);
  assert.deepEqual(await b.evaluate(()=>ludoDebug.room.state.players.map(p=>p.pieces)),before.pieces);
  assert.equal(await b.evaluate(()=>ludoDebug.room.state.rng),before.rng);assert.equal(await b.evaluate(()=>ludoDebug.room.state.die),6);
  const c=await open('Luis');await c.waitForFunction(()=>ludoDebug.room.seat===0);await sync(b,c);
  assert.deepEqual(await c.evaluate(()=>ludoDebug.room.state.players[0].pieces),before.pieces[0]);await c.close();
  await b.locator('#menu').click();
  await b.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.autoMove=null;g.turn=0;g.die=0;g.revision++;ludoDebug.room.publish();});
  const rev=await b.evaluate(()=>ludoDebug.room.state.revision);await b.waitForTimeout(1200);assert.equal(await b.evaluate(()=>ludoDebug.room.state.revision),rev);
  await b.locator('#pana-resume').click();
  await b.waitForFunction(rev=>ludoDebug.room.state.revision>rev,rev);
  console.log('ok: migration preserves pending dice/board, late arrival inherits bot, solo menu pauses bots');
  await b.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.autoMove=null;g.turn=1;g.die=1;g.players[1].pieces=[56,56,56,55];g.revision++;ludoDebug.room.publish();});
  await b.locator('[data-piece="3"]').click();await b.locator('#results').waitFor({state:'visible'});
  assert.match(await b.locator('#result-title').textContent(),/Ana/);await b.screenshot({path:'art/ludo/results.png'});
  const finishedRound=await b.evaluate(()=>ludoDebug.room.state.round);
  await b.locator('#again').click();assert.equal(await b.evaluate(()=>ludoDebug.room.state.round),finishedRound+1);
  // A rematch shakes the cachos again; the last match's slam doesn't carry over.
  await b.locator('#pana-starter-shake').waitFor();assert.equal(await b.evaluate(()=>ludoDebug.room.state.phase),'starter');
  await b.close();
  console.log('ok: win/rematch shakes the cachos again');
  assert.deepEqual(errors,[]);
}catch(error){await fail(error);}
finally{await browser.close();}
