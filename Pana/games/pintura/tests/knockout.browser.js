import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';
const browser = await launch();
try {
  const page = await openGame(browser,'pintura',{name:'Prueba',query:'debug'});
  await waitFor(page,()=>window.pinturaDebug?.world && pinturaDebug.room.connected && window.PANA_PREPARED);
  await page.locator('#practice').click();
  await waitFor(page,()=>pinturaDebug.room.local && pinturaDebug.room.state.phase==='playing');
  const result = await page.evaluate(async()=>{
    const {Arena}=await import('/g/pintura/rules.js');
    const {world,room}=pinturaDebug, game=new Arena('plaza');
    room.local=true;room.link?.leave();room.tick=()=>{};
    game.add(71,{name:'Ana'});game.add(72,{name:'Luis'});game.start();
    const [a,b]=game.players;Object.assign(a,{x:-25,z:-15});Object.assign(b,{x:-22,z:-15,shield:0});
    world.setView('cancha');world.draw(game.view(),71,1/60);
    const avatar=world.avatars.get(72),start=avatar.neck.getWorldPosition(avatar.group.position.clone()).y;
    for(let i=0;i<3;i++)game.hit(b,a,a.color,{x:1,z:0});
    for(let i=0;i<90;i++)world.draw(game.view(),71,1/60);
    const end=avatar.neck.getWorldPosition(avatar.group.position.clone()).y;
    const finite=avatar.knockout.physics.points.every(p=>Number.isFinite(p.x+p.y+p.z));
    const boneParents=avatar.legs.every(bone=>bone.parent?.isBone);
    const paintFollowsBody=avatar.stains.every(blob=>blob.parent===avatar.body);
    room.state=game.view();
    const draw=world.draw;
    world.draw=()=>{draw(room.state,71,0);world.camera.position.set(-18,3,-10);world.camera.lookAt(-22,.6,-15);world.renderer.render(world.scene,world.camera);};
    window.knockoutProof={game,avatar,b,draw,after:avatar.body.position.clone()};
    return {start,end,finite,boneParents,paintFollowsBody};
  });
  assert.ok(result.finite && result.boneParents && result.paintFollowsBody);
  assert.ok(result.end<result.start-.2,JSON.stringify(result));
  await mkdir('Pana/games/pintura/qa',{recursive:true});
  await page.screenshot({path:'Pana/games/pintura/qa/knockout-fall.png'});
  assert.equal(await page.evaluate(()=>{const {game,avatar,b,draw,after}=knockoutProof;b.respawn=0;b.paint=0;pinturaDebug.room.state=game.view();draw(game.view(),71,1/60);return avatar.knockout===null && avatar.body.position.distanceTo(after)>.1;}),true);
  await page.screenshot({path:'Pana/games/pintura/qa/knockout-reset.png'});
  // A La Lejana shot with no look pitch (Ver la cancha) through a rival's centre on a streak: the
  // server's derived pitch makes it a head hit and the callout says so over the streak title.
  const head = await page.evaluate(async()=>{
    const {Arena}=await import('/g/pintura/rules.js'), {room}=pinturaDebug, game=new Arena('plaza');
    game.add(1,{name:'Prueba'});game.add(72,{name:'Luis'});game.selectKit(1,{weapon:'sniper'});game.start();game.go();
    Object.defineProperty(game,'cover',{value:[]}); // the open lane, nothing in between
    const [a,b]=game.players;Object.assign(a,{x:-20,z:-14,shield:0,streak:1});Object.assign(b,{x:-8,z:-14,shield:0});
    room.game=game;room.local=true;game.eventSerial=1e4;
    game.step(.05,new Map([[1,{ax:1,az:0,fire:true,aim:true}]]));for(let i=0;i<8;i++)game.step(.05,new Map([[1,{ax:1,az:0}]]));
    room.publish();
    return {headshot:game.events.at(-1)?.headshot,title:document.getElementById('callout-title').textContent,detail:document.getElementById('callout-detail').textContent,called:document.body.classList.contains('called')};
  });
  assert.deepEqual(head,{headshot:true,title:'¡A la cabeza!',detail:'Luis · 12 m · ¡Doble pepazo!',called:true});
  console.log('ok: real sculpt falls, keeps its skinned bone hierarchy and restores on respawn',result);
} finally { await browser.close(); }
