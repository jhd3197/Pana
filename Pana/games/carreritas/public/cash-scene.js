import * as THREE from 'three';
import { crateArt, coinArt } from './pickup-art.js';
import { makeMango } from '/engine/models/props/mango.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { loadAvatar } from '/engine/avatar.js';
import { pixelRatio } from '/engine/settings.js';

// The same meshes as race pickups, with presentation-only accounting.
export function createCashScene(canvas, { earned, awards=[earned], sound, progress, complete }) {
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(pixelRatio(1.5));renderer.shadowMap.enabled=true;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,100);
  camera.position.set(8,6,12);camera.lookAt(0,1,0);
  scene.add(new THREE.HemisphereLight(0xfff2d2,0x35305f,2.5));
  const key=new THREE.DirectionalLight(0xfff2d8,4);key.position.set(-3,9,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);scene.add(key);
  const fill=new THREE.DirectionalLight(0x9fa9ff,2);fill.position.set(5,4,-3);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.CircleGeometry(7,64),new THREE.ShadowMaterial({opacity:.3}));floor.rotation.x=-Math.PI/2;floor.position.y=-.1;floor.receiveShadow=true;scene.add(floor);
  const crate=crateArt(),box=crate.visual;box.position.set(2,.85,0);box.scale.setScalar(1.4);box.rotation.y=-.18;scene.add(box);
  const pana=buildCharacter(loadAvatar());pana.group.position.set(3.7,0,-1.2);pana.group.rotation.y=-.4;scene.add(pana.group);
  const coin=coinArt(),mango=makeMango(),count=earned?Math.min(18,earned):0;
  const pieces=Array.from({length:count},(_,i)=>{
    const chip=coin.clone(),fruit=mango.clone();chip.scale.setScalar(.55);fruit.scale.setScalar(.38);
    chip.traverse(o=>{if(o.isMesh)o.castShadow=true;});fruit.traverse(o=>{if(o.isMesh)o.castShadow=true;});
    scene.add(chip,fruit);const weight=Math.floor((i+1)*earned/count)-Math.floor(i*earned/count);let sum=0,row=0;while(row<awards.length-1&&sum+awards[row]<=(i+.5)*earned/count){sum+=awards[row];row++;}return {chip,fruit,i,weight,drop:.15+row*.3+(i%3)*.04,landed:false,dropped:false};
  });
  let elapsed=0,previous=performance.now(),frame=0,disposed=false,ended=false,bumpAt=-Infinity;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const render=()=>{
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio()))renderer.setSize(w,h,false);
    camera.aspect=w/h;camera.updateProjectionMatrix();
    let landed=0,builtValue=0;
    for(const p of pieces){
      const {i,chip,fruit,drop}=p,launch=2+i*.13,fly=1.05,t=THREE.MathUtils.clamp((elapsed-launch)/fly,0,1);
      const built=elapsed>drop,started=elapsed>launch;
      const fall=THREE.MathUtils.clamp((elapsed-drop)/.35,0,1);if(fall===1){builtValue+=p.weight;if(!p.dropped){p.dropped=true;if(elapsed<7)sound?.tick?.(i);}}chip.visible=built&&t<.5;fruit.visible=started&&t>=.5;
      const sx=-2.5+(i%3)*.24,sy=.15+Math.floor(i/3)*.10;
      const ex=2+((i%3)-1)*.48,ey=1.7+Math.floor(i/6)*.35,ez=((Math.floor(i/3)%2)-.5)*.6;
      const x=THREE.MathUtils.lerp(sx,ex,t),y=THREE.MathUtils.lerp(sy,ey,t)+Math.sin(t*Math.PI)*3.5;
      chip.position.set(x,y+(started?0:Math.pow(1-fall,2)*4),THREE.MathUtils.lerp(.3,ez,t));chip.rotation.set(started?t*10:Math.PI/2,t*12,0);
      chip.scale.set(.55*Math.max(.01,Math.abs(Math.cos(t*Math.PI))),.55,.55);fruit.scale.setScalar(.38*Math.max(0,Math.min(1,(t-.5)*4)));
      fruit.position.copy(chip.position);fruit.rotation.set(.25,i*.7+t*6,.25);
      if(t===1){landed+=p.weight;if(!p.landed){p.landed=true;bumpAt=elapsed;if(elapsed<7)sound?.sweep?.(160,70,.08,'triangle',.08);}}
    }
    box.position.y=.85-Math.sin(Math.min(1,Math.max(0,(elapsed-bumpAt)/.16))*Math.PI)*.08;
    pana.update(1/60,{walk:false});
    const bank=THREE.MathUtils.clamp((elapsed-5.5)/1.2,0,1);
    progress({time:elapsed,pile:builtValue-landed,banked:Math.round(earned*(1-Math.pow(1-bank,3)))});
    renderer.render(scene,camera);
    if(elapsed>=7&&!ended){ended=true;complete();}
  };
  const tick=now=>{if(disposed)return;elapsed+=Math.min(.1,(now-previous)/1000);previous=now;render();if(!ended)frame=requestAnimationFrame(tick);};
  const finish=()=>{elapsed=7;render();cancelAnimationFrame(frame);};
  if(reduced)finish();else frame=requestAnimationFrame(tick);
  return {finish,dispose(){disposed=true;cancelAnimationFrame(frame);pana.dispose();const geometries=new Set();for(const root of [scene,crate.pieces,coin,mango])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});geometries.forEach(g=>g.dispose());floor.material.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
