import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser=await launch(),pages=[],code=`domino-six-${Date.now()}`;
try {
 for(let i=0;i<6;i++){
  const page=await openGame(browser,'domino',{room:code,name:`Pana ${i+1}`,query:'debug'});pages.push(page);
  await waitFor(page,()=>dominoDebug.room.connected&&dominoDebug.world);
  await page.evaluate(()=>dominoDebug.quiet(true));
 }
 const host=pages[0],guest=pages[5];
 await waitFor(host,()=>dominoDebug.room.state.players.filter(p=>p.id!==null).length===6);
 await waitFor(guest,()=>dominoDebug.room.state.players.filter(p=>p.id!==null).length===6);
 assert.equal(await host.evaluate(()=>dominoDebug.room.state.options.seats),6);
 assert.equal(await guest.locator('[data-room-option]').first().isDisabled(),true);
 await host.locator('#pana-room-more').click();
 await host.locator('[data-room-option="handSize"][data-value="10"]').click();
 await waitFor(guest,()=>dominoDebug.room.state.options.handSize===10);
 await host.locator('#pana-room-reset').click();
 await waitFor(guest,()=>dominoDebug.room.state.options.handSize===7);
 assert.equal(await guest.evaluate(()=>dominoDebug.room.state.players.filter(p=>p.id!==null).length),6,'reset keeps every seated human');
 await host.locator('[data-room-option="handSize"][data-value="10"]').click();
 await waitFor(guest,()=>dominoDebug.room.state.options.handSize===10);
 await host.locator('#pana-room-done').click();
 const patch={mode:'individual',target:200,turnSeconds:30,opener:'random',passScore:true,blocked:'redeal',capicua:'double',quickChat:true};
 await host.evaluate(patch=>dominoDebug.room.action('options',{patch}),patch);
 await waitFor(guest,()=>dominoDebug.room.state.options.mode==='individual');
 await guest.evaluate(()=>dominoDebug.room.action('options',{patch:{target:100}}));
 await waitFor(host,()=>dominoDebug.world.characters.filter(Boolean).length===6&&dominoDebug.world.tiles.size===91);
 await host.locator('#start').click();await waitFor(guest,()=>dominoDebug.room.state.phase==='playing');
 assert.ok(await guest.evaluate(()=>dominoDebug.room.state.players.every(p=>p.hand.length===10)));
 assert.equal(await guest.evaluate(()=>dominoDebug.room.state.options.target),200,'a guest cannot change the settings');
 assert.equal(await guest.evaluate(()=>dominoDebug.room.state.reserve.length),31);
 const byId=new Map();for(const page of pages)byId.set(await page.evaluate(()=>dominoDebug.room.id),page);
 const turns=new Set();
 for(let i=0;i<6;i++){
  const state=await host.evaluate(()=>dominoDebug.room.state),actor=byId.get(state.players[state.turn].id);turns.add(state.turn);
  await waitFor(actor,revision=>dominoDebug.room.state.revision>=revision,state.revision);
  await actor.evaluate(()=>{const m=dominoDebug.chooseMove(dominoDebug.room.state);m?dominoDebug.room.action('play',m):dominoDebug.room.action('pass');});
  await waitFor(host,revision=>dominoDebug.room.state.revision>revision,state.revision);
 }
 assert.equal(turns.size,6,'all six humans take a real network turn');
 await guest.evaluate(()=>dominoDebug.room.action('chat',{message:0}));
 await waitFor(host,()=>dominoDebug.room.state.chat.length>0);
 const before=await guest.evaluate(()=>dominoDebug.room.state.options);
 await host.close();await waitFor(pages[1],()=>dominoDebug.room.isHost);
 assert.deepEqual(await pages[1].evaluate(()=>dominoDebug.room.state.options),before);
 // The 30 s turn clock runs on the server: whoever is up plays (or a bot does) by itself.
 const revision=await pages[1].evaluate(()=>dominoDebug.room.state.revision);
 await waitFor(guest,revision=>dominoDebug.room.state.revision>revision,revision,45_000);
 for(const page of pages)assert.deepEqual(page.errors,[]);
 console.log('ok: six real Dominó players, double-twelve meshes, settings authority, every human turn, quick chat, timeout and host migration');
}finally{await browser.close();}
