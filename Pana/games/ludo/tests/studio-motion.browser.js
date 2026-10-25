import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame, base } from '../../../tests/browser-kit.js';

const browser=await launch(),room=`ludo-studio-${Date.now()}`;
await mkdir('art/ludo',{recursive:true});
try {
  const a=await openGame(browser,'ludo',{room,query:'debug',name:'Juan'});
  const b=await openGame(browser,'ludo',{room,query:'debug',name:'Ana'});
  await a.waitForFunction(()=>ludoDebug.room.members.size===2);
  // Scrub every authored trick across corners and every seat, including crowded
  // endpoints. Sampling backwards is important for Studio's restart/preview use.
  const checked=await a.evaluate(async()=>{
    const THREE=await import('three');
    const {createLudoPawn,boardPoint}=await import('/g/ludo/board-model.js');
    const {createCaminoMotion}=await import('/g/ludo/camino-motion.js');
    const {CAMINO}=await import('/g/ludo/motion-choice.js');
    const {disposeModel}=await import('/engine/models/props/game-table.js');
    let count=0;
    for(let seat=0;seat<4;seat++)for(const style of CAMINO){
      const root=new THREE.Group(),pawn=createLudoPawn({seat}),partner=createLudoPawn({seat});root.add(pawn,partner);
      const path=Array.from({length:6},(_,i)=>{const [x,z]=boardPoint(seat,8+i);return new THREE.Vector3(x,1.67,z);});
      path[5].x+=.075;partner.position.copy(path[2]);const original=partner.position.clone();
      const motion=createCaminoMotion(root,pawn,path,style,'#ff4b4b',partner);
      motion.sample(0);if(pawn.position.distanceTo(path[0])>1e-8)throw Error(`${style}: start`);
      for(const t of [.25,.55,.8,.4,1]){
        motion.sample(t,2,.42);
        if(![...pawn.position,...pawn.scale,pawn.rotation.x,pawn.rotation.y,pawn.rotation.z].every(Number.isFinite))throw Error(`${style}: invalid pose`);
      }
      if(pawn.position.distanceTo(path[5])>1e-8||!pawn.visible||Math.abs(pawn.scale.x-.42)>1e-8)throw Error(`${style}: endpoint`);
      if(partner.position.distanceTo(original)>1e-8)throw Error(`${style}: partner endpoint`);
      motion.sample(.55);motion.dispose();motion.dispose();
      if(root.children.length!==2||!pawn.visible||partner.position.distanceTo(original)>1e-8)throw Error(`${style}: interruption cleanup`);
      disposeModel(root);count++;
    }
    return count;
  });assert.equal(checked,40);
  // A real host action drives the same cosmetic choice on two network clients.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.phase='playing';g.turn=0;g.die=5;g.autoMove=null;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.players[0].pieces[0]=8;g.revision++;ludoDebug.room.publish();
  });
  await b.waitForFunction(()=>ludoDebug.room.state.players[0].pieces[0]===8);
  await a.evaluate(()=>ludoDebug.room.action('move',{piece:0}));
  for(const page of [a,b])await page.waitForFunction(()=>ludoDebug.world.pawns[0].progress===13&&!!ludoDebug.world.pawns[0].lastMotion);
  const styles=await Promise.all([a,b].map(page=>page.evaluate(()=>ludoDebug.world.pawns[0].lastMotion)));
  assert.equal(styles[0],styles[1]);assert.notEqual(styles[0],'hop');
  // A new round arriving mid-trick must clear props and restore every pawn.
  await a.evaluate(()=>{
    const g=ludoDebug.room.game;g.turnPause=null;g.round++;g.phase='lobby';g.die=0;g.autoMove=null;
    g.players.forEach(p=>p.pieces=[-1,-1,-1,-1]);g.revision++;ludoDebug.room.publish();
  });
  for(const page of [a,b]){
    await page.waitForFunction(()=>ludoDebug.world.pawns.every(p=>p.progress===-1&&!p.motion&&!p.path&&!p.flight&&p.model.visible&&p.model.position.distanceTo(p.target)<.001));
    assert.equal(await page.evaluate(()=>ludoDebug.world.pawns.every(p=>p.model.userData.face?.eyes.length===2)),true);
  }
  await a.evaluate(()=>{const g=ludoDebug.room.game;g.turnPause=null;g.phase='playing';g.turn=0;g.revision++;ludoDebug.room.publish();});
  await a.locator('#pana-lobby-shell').waitFor({state:'hidden'});
  await a.waitForFunction(()=>!document.querySelector('.pk-cover')&&window.PANA_PREPARED);
  await a.screenshot({path:'art/ludo/studio-live-board.png'});
  // Real Studio routes use the same factories; render every new prop and face.
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  for(const style of ['highfive','slip','rollbarrel','moonwalk','spring','dodge','piggy','umbrella','tunnel','gum']){
    await page.goto(`${base}/studio/assets/ludo-${style}`);
    await page.waitForFunction(()=>window.panaLibrary?.current&&document.querySelector('#preview-status').hidden,null,{timeout:90000});
    await page.evaluate(()=>{panaLibrary.current.update(1.2,.016);panaLibrary.renderer.render(panaLibrary.scene,panaLibrary.camera);});
    await page.screenshot({path:`art/ludo/studio-${style}.png`});
  }
  assert.deepEqual(errors,[]);assert.deepEqual(a.errors,[]);assert.deepEqual(b.errors,[]);
  console.log('ok: 40 motion paths, two-client selection, round reset, ten rendered Studio previews');
} finally {await browser.close();}
