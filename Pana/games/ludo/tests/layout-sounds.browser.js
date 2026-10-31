import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launch, openGame } from '../../../tests/browser-kit.js';
const browser=await launch();
await mkdir('art/ludo',{recursive:true});
try {
  const page=await openGame(browser,'ludo',{room:`layout-sounds-${Date.now()}`,query:'debug'});
  await page.evaluate(()=>{const g=ludoDebug.room.game;g.phase='playing';g.turn=0;g.die=0;g.turnPause=null;g.revision++;ludoDebug.room.publish();});
  await page.locator('#pana-lobby-shell').waitFor({state:'hidden'});
  await page.evaluate(async()=>{
    const THREE=await import('three'),{createMomentVisual}=await import('/g/ludo/moment-visual.js'),{createLudoPawn}=await import('/g/ludo/board-model.js');
    const world=ludoDebug.world,visual=createMomentVisual('nomoves');world.scene.add(visual.root);
    const actors=world.pawns.filter(p=>p.seat===3).map(p=>{const actor=createLudoPawn({seat:3});actor.position.copy(p.model.position);return actor;});
    const frame=world.frame;world.frame=dt=>{frame(dt);actors.forEach(p=>{p.rotation.set(0,0,0);p.scale.setScalar(1);});visual.sample(.5,actors,.5);world.renderer.render(world.scene,world.camera);};
    window.layoutVisual=visual;window.layoutThree=THREE;
  });
  for(const top of [false,true]) {
    const gap=await page.evaluate(top=>{
      const world=ludoDebug.world,THREE=layoutThree;world.setView(top);world.frame(.016);
      world.scene.updateMatrixWorld(true);world.camera.updateMatrixWorld(true);
      const cloud=[];layoutVisual.root.traverse(p=>{if(p.name==='rain-cloud'){
        const box=new THREE.Box3().setFromObject(p);
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])cloud.push(new THREE.Vector3(x,y,z).project(world.camera).y);
      }});
      const caption=layoutVisual.root.getObjectByName('moment-caption'),center=caption.getWorldPosition(new THREE.Vector3()),up=new THREE.Vector3(0,1,0).applyQuaternion(world.camera.quaternion);
      const bottom=center.clone().addScaledVector(up,-caption.scale.y/2).project(world.camera).y;
      return bottom-Math.max(...cloud);
    },top);
    assert.ok(gap>.005,`caption clears cloud in ${top?'overhead':'perspective'}: ${gap}`);
    await page.screenshot({path:`art/ludo/layout-${top?'overhead':'perspective'}.png`});
  }
  await page.evaluate(async()=>{
    const {sound}=await import('/engine/fx.js'),{createLudoSounds}=await import('/g/ludo/sounds.js');
    sound.unlock();sound.muted=false;sound.setVolume(.5);
    const audio=createLudoSounds(sound);await audio.prepare();audio.step(0);audio.returnHome();
    if(sound.liveVoices()<2)throw Error('recorded effects did not enter the shared voice budget');
    audio.dispose();
  });
  assert.deepEqual(page.errors,[]);
  console.log('ok: cloud/caption separation in both cameras and decoded sample playback through shared audio');
} finally {await browser.close();}
