// Verdant Grove's collision layout, rebuilt as a floating 3D arena.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { dressArena } from './arena.js';
import { createImpactEffects } from './impact-effects.js';
import { animateFighter } from './fighter-animation.js';
import { getFighterDefinition } from './combat/roster.js';
const SCALE = .014, COLORS = ['#ffc629', '#2ad1b2', '#fa7467', '#a798e8', '#77b8ff', '#f5a552'];
export function createBochincheScene(canvas, { practice = false } = {}) {
  const stage = createTableWorld(canvas, { fit: 'window', arena: false, sky: false, background: '#c8e3df', fog: [48, 115], sun: { box: 23, far: 90 } });
  const { scene, camera, renderer } = stage, own = new THREE.Group(); scene.add(own);
  const scenery = dressArena(own, SCALE), effects = createImpactEffects(own, SCALE);
  const material = color => new THREE.MeshStandardMaterial({color,roughness:.65});
  const panas = new Map(), objects = new Map(), textures = new Map();
  const loader = new THREE.TextureLoader();
  function itemTexture(kind) {
    if (!textures.has(kind)) { const t = loader.load(new URL(`./assets/items/${kind}.svg`, import.meta.url).href); t.colorSpace = THREE.SRGBColorSpace; textures.set(kind,t); }
    return textures.get(kind);
  }
  let time = 0;
  const baseBounds = () => practice
    ? new THREE.Box3(new THREE.Vector3(-4,-.1,-1),new THREE.Vector3(4,2.5,1))
    : new THREE.Box3(new THREE.Vector3(-7,-.5,-1),new THREE.Vector3(7,5,1));
  const framed = baseBounds();
  function update(state) {
    effects.update(state);
    const live = new Set();
    state.players.forEach((p, slot) => {
      live.add(p.id);
      const look = normalizeAvatar(p.bot ? { outfitColor: COLORS[slot], face: 'feliz' } : p.avatar), key = JSON.stringify(look);
      let e = panas.get(p.id);
      if (e?.key !== key) {
        if (e) { e.character.dispose(); disposeModel(e.root); e.root.removeFromParent(); disposeModel(e.slash); }
        const root = new THREE.Group(), character = buildCharacter(look); root.add(character.group); own.add(root);
        const shield = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: COLORS[slot], transparent: true, opacity: .3, roughness: .15, depthWrite: false }));
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.6,.045,6,32), new THREE.MeshBasicMaterial({color:COLORS[slot]})); ring.rotation.x=-Math.PI/2;
        const held = new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42), new THREE.MeshStandardMaterial());
        held.visible=false; root.add(shield, ring, held);
        const slash = new THREE.Mesh(new THREE.RingGeometry(.65,.83,28,1,0,Math.PI*1.2), new THREE.MeshBasicMaterial({color:COLORS[slot],side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
        slash.visible=false;own.add(slash);
        e = { root, character, shield, ring, held, slash, key, initialized: false, poseTime: 0 }; panas.set(p.id,e);
      }
      e.target = state.fight?.fighters[slot] ?? { position:{x: -270+slot*540/Math.max(1,state.players.length-1), y:47}, size:{width:65,height:94}, facing:slot===0?1:-1, state:'idle', velocity:{x:0,y:0}, grounded:true, stocks:3 };
      e.slot = slot; e.poseTime = 0;
      e.held.visible=!!e.target.heldItem;
      if (e.target.heldItem) { const map=itemTexture(e.target.heldItem.kind); if(e.held.material.map!==map){e.held.material.map=map;e.held.material.needsUpdate=true;} }
    });
    for (const [id,e] of panas) if (!live.has(id)) { e.character.dispose(); disposeModel(e.root); e.root.removeFromParent(); disposeModel(e.slash); panas.delete(id); }
    const entities = [...(state.fight?.items ?? []).map(o=>({...o,key:'item-'+o.id,item:true})), ...(state.fight?.projectiles ?? []).map(o=>({...o,key:'shot-'+o.id}))];
    const shown = new Set();
    for (const o of entities) {
      shown.add(o.key); let m = objects.get(o.key);
      if (!m) { m = new THREE.Mesh(o.item ? new THREE.BoxGeometry(1.6,1.6,1.6) : new THREE.SphereGeometry(1,12,8), o.item ? new THREE.MeshStandardMaterial({map:itemTexture(o.kind),color:'#ffffff'}) : material(COLORS[o.owner])); own.add(m); objects.set(o.key,m); }
      m.position.set(o.position.x*SCALE,o.position.y*SCALE,.1); m.scale.setScalar(Math.max(.14,o.radius*SCALE));
    }
    for (const [id,m] of objects) if (!shown.has(id)) { disposeModel(m); m.removeFromParent(); objects.delete(id); }
  }
  function frame(dt, beforeDraw) {
    time += dt; scenery(time);
    const {w,h} = stage.resize(), bounds = baseBounds();
    for (const e of panas.values()) {
      const f=e.target, pos=new THREE.Vector3(f.position.x*SCALE,(f.position.y-f.size.height/2)*SCALE,.2);
      if (!e.initialized || f.state==='respawn') {e.root.position.copy(pos);e.initialized=true;}
      else e.root.position.lerp(pos,1-Math.exp(-dt*22));
      const scale=f.size.height*SCALE/2.16;
      e.character.group.scale.setScalar(scale);
      e.character.group.rotation.y=f.facing*Math.PI/2;
      e.held.position.set(f.facing*.55,f.size.height*SCALE*.55,.15);
      e.root.visible=f.state!=='ko' && (f.stocks>0);
      e.poseTime=Math.min(.05,e.poseTime+dt);
      animateFighter(e,f,dt,time);
      const guarding=f.state==='shield';
      e.shield.visible=guarding; e.shield.position.y=f.size.height*SCALE*.5;
      e.shield.scale.setScalar(f.size.height*SCALE*(.55+.15*(f.shield/(f.maxShield||1))));
      e.ring.position.y=.04; e.ring.visible=f.grounded; e.ring.scale.setScalar(scale);
      e.slash.visible=false;
      if(f.currentMove) {
        const move=getFighterDefinition(f.fighter).attacks[f.currentMove], active=f.moveFrame+e.poseTime*60-move.startup;
        if(active>=0&&active<move.active+5) {
          e.slash.visible=e.root.visible;
          const up=f.currentMove.startsWith('up-'), down=f.currentMove.startsWith('down-');
          e.slash.position.set((f.position.x+(up?0:f.facing*40))*SCALE,(f.position.y+(up?40:down?-25:0))*SCALE,.65);
          e.slash.rotation.z=(up?Math.PI/2:down?-Math.PI/2:f.facing===1?0:Math.PI)-active*.1*f.facing;
          e.slash.scale.setScalar(Math.max(.65,move.radius*SCALE*1.3));
          e.slash.material.opacity=.7*Math.max(0,1-active/(move.active+5));
        }
      }
      if (e.root.visible) bounds.expandByPoint(new THREE.Vector3(Math.max(-17,Math.min(17,pos.x)),Math.max(-5,Math.min(12,pos.y+2)),0));
    }
    const touch = matchMedia('(pointer: coarse)').matches;
    framed.min.lerp(bounds.min,1-Math.exp(-dt*6)); framed.max.lerp(bounds.max,1-Math.exp(-dt*6));
    stage.frameCamera(framed,[0,.14,1],{x:16,y:practice?80:touch?105:100,width:Math.max(160,w-32),height:Math.max(100,h-(practice?145:touch?185:245))});
    for (const m of objects.values()) m.rotation.y+=dt*2;
    effects.frame(dt,camera);
    beforeDraw?.(camera);
    stage.draw(dt);
  }
  function dispose() { panas.forEach(e=>e.character.dispose()); disposeModel(own); textures.forEach(t=>t.dispose()); stage.dispose(); }
  return {renderer,scene,camera,update,frame,dispose,effects};
}
