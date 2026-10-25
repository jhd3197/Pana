// Reliquia in first person: the camera at your pana's eyes, your two paws
// holding whatever you picked up, the other panas, the enemies, the paint,
// and the light. The camp is sunlit; underground the headlamp, a farol and a
// small pool of torch lights (a fixed number, so shaders never recompile)
// are all there is.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { mummy } from '/engine/models/props/reliquia.js';
import { mineCart } from '/engine/models/props/mine.js';
import { jaguar } from '/engine/models/fauna/jaguar.js';
import { guacharo, caveSpider, cuaima } from '/engine/models/fauna/cave-creatures.js';
import { splatTexture } from '/engine/models/props/paintball.js';
import { createSky } from '/engine/worlds/sky.js';
import { WARM_DAY } from '/engine/worlds/look.js';
import { Puffs, Shockwaves } from '/engine/fx.js';
import { pixelRatio, bindRenderer, shadowSize, rendererOptions } from '/engine/settings.js';
import { createExpeditionWorld, itemModel } from './scene.js';
import { floorOf, HEIGHT } from './deck.js';
import { ITEMS } from './items.js';
import { holds, alive, cartValue, liftView } from './rules.js';

export const COLORS = ['#ffc83d', '#3fd6e0', '#ff7a6b', '#7bdc5a', '#b98bff', '#ff8fc8', '#4a9dff', '#ffa94d'];
const EYE = 1.45, POOL = 5;
const CAMP_LOOK = { background: 0xf6d6a4, fog: [45, 150], hemi: [0xfff1d6, 0x8a6a4a, 2.1], sun: 3, exposure: 1.05 };
const DEEP_LOOK = { background: 0x0d0814, fog: [5, 30], hemi: [0x7a6aa8, 0x3a2a1c, .7], sun: 0, exposure: 1.2 };

function label(text, color, { bubble = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.font = `800 ${bubble ? 38 : 34}px Nunito, sans-serif`;
  const width = Math.min(500, ctx.measureText(text).width + 40);
  ctx.fillStyle = bubble ? '#fffaf0f2' : '#14102ae0'; ctx.beginPath(); ctx.roundRect(256 - width / 2, 10, width, 70, 22); ctx.fill();
  if (bubble) { ctx.beginPath(); ctx.moveTo(240, 78); ctx.lineTo(256, 94); ctx.lineTo(272, 78); ctx.fill(); }
  ctx.fillStyle = bubble ? '#2b1d12' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 46, 480);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(3.2, .6, 1); sprite.renderOrder = 10; return sprite;
}
const disposeSprite = s => { s.material.map.dispose(); s.material.dispose(); s.removeFromParent(); };

export function createView(canvas, { seed = 1, depth = 1 } = {}) {
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(CAMP_LOOK.background); scene.fog = new THREE.Fog(CAMP_LOOK.background, ...CAMP_LOOK.fog);
  const camera = new THREE.PerspectiveCamera(74, 1, .05, 220); camera.rotation.order = 'YXZ'; scene.add(camera);
  const sky = createSky(WARM_DAY.sky); scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(...CAMP_LOOK.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffd9a0, CAMP_LOOK.sun); sun.castShadow = true; sun.shadow.mapSize.setScalar(shadowSize(1024));
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); sun.shadow.bias = -.0008; sun.shadow.normalBias = .05; scene.add(sun, sun.target);
  // Headlamp and the farol in your hand ride on the camera.
  const headlamp = new THREE.SpotLight(0xfff0d8, 0, 26, .5, .55, 1.4); headlamp.position.set(0, .05, 0); headlamp.target.position.set(0, -.25, -5); camera.add(headlamp, headlamp.target);
  const handLight = new THREE.PointLight(0xffa850, 0, 12, 1.6); handLight.position.set(.3, -.2, -.4); camera.add(handLight);
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffa04a, 0, 11, 1.7); scene.add(l); return l; });
  let world = createExpeditionWorld({ seed, depth }); scene.add(world.group);
  const shopSign = label('TIENDA · se paga en mangos', '#ffd36a'); shopSign.position.set(-12.5, 3.4, 6); shopSign.scale.set(4.4, .82, 1); scene.add(shopSign);
  const puffs = new Puffs(scene), waves = new Shockwaves(scene);
  // Your paws: fur-coloured, holding the two hand items in view.
  const hands = [new THREE.Group(), new THREE.Group()]; hands[0].position.set(.32, -.36, -.7); hands[1].position.set(-.32, -.36, -.7);
  const pawMaterial = new THREE.MeshStandardMaterial({ color: 0xb07a4a, roughness: .8 }), pawGeometry = new THREE.SphereGeometry(.042, 14, 10);
  for (const h of hands) { const paw = new THREE.Mesh(pawGeometry, pawMaterial); paw.scale.set(1, .8, 1.2); h.add(paw); h.userData.slot = new THREE.Group(); h.userData.slot.position.set(0, .04, -.06); h.add(h.userData.slot); camera.add(h); }
  const heldKeys = ['', ''];
  // Paint, darts and shots.
  const splatTextures = [1, 2, 3, 4].map(splatTexture), splatGeometry = new THREE.PlaneGeometry(.7, .7), splatMaterials = new Map();
  const splatMaterial = (seat, n) => { const key = `${seat}:${n}`; if (!splatMaterials.has(key)) splatMaterials.set(key, new THREE.MeshBasicMaterial({ color: COLORS[seat % 8], map: splatTextures[n % 4], transparent: true, alphaTest: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide })); return splatMaterials.get(key); };
  const splats = new Map(), shots = new Map(), darts = new Map();
  const ballGeometry = new THREE.SphereGeometry(.09, 8, 6), dartGeometry = new THREE.CylinderGeometry(.02, .02, .5, 5).rotateZ(Math.PI / 2), dartMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5a2a });
  const avatars = new Map(), enemies = new Map(), carts = new Map();
  let dustAt = 0, h = Math.PI, pitch = 0, bob = 0, sway = 0, shake = 0, lift = 0, fov = 74, lookName = 'camp', poolAt = 0, swingT = [0, 0];
  const ringGeometry = new THREE.RingGeometry(.85, 1, 40), dangerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });

  function setLook(name) {
    if (name === lookName) return; lookName = name;
    const look = name === 'camp' ? CAMP_LOOK : DEEP_LOOK;
    scene.background.set(look.background); scene.fog.color.set(look.background); [scene.fog.near, scene.fog.far] = look.fog;
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    sun.intensity = look.sun; sky.mesh.visible = name === 'camp'; renderer.toneMappingExposure = look.exposure;
  }
  function heldModel(slot, held, i) {
    const key = held ? `${held.id}:${held.kind}:${held.pile?.length || 0}` : '';
    if (heldKeys[i] === key) return; heldKeys[i] = key;
    slot.clear();
    if (!held) return;
    const model = itemModel(held.kind), info = ITEMS[held.kind];
    if (held.pile) { model.scale.multiplyScalar(.28 + held.pile.length * .05); slot.add(model); model.position.y = -.04; return; }
    const scale = held.kind === 'farol' ? .24 : held.kind === 'machete' ? .5 : held.kind === 'honda' ? .42 : held.kind === 'marcadora' ? 1.1 : info.artifact ? .55 : .42;
    model.scale.multiplyScalar(scale);
    if (held.kind === 'machete') { model.rotation.set(0, Math.PI / 2, .6); model.position.set(0, .02, 0); }
    else if (held.kind === 'honda') model.rotation.set(-.3, Math.PI, 0);
    else if (held.kind === 'marcadora') { model.rotation.set(0, Math.PI, 0); model.position.set(0, -.02, -.05); }
    else model.position.y = -.05;
    slot.add(model);
  }
  function avatarFor(p, i) {
    const skin = JSON.stringify(p.avatar); let a = avatars.get(p.id);
    if (a && a.skin === skin) return a;
    if (a) removeAvatar(a, p.id);
    const character = buildCharacter(p.avatar), root = new THREE.Group(), tag = label(p.name, COLORS[p.seat % 8]);
    tag.position.y = 2.25; root.add(character.group, tag); scene.add(root);
    const slots = [new THREE.Group(), new THREE.Group()]; slots[0].position.set(.42, .95, .36); slots[1].position.set(-.42, .95, .36); slots.forEach(s => character.group.add(s));
    a = { root, character, tag, slots, keys: ['', ''], skin, bubble: null, bubbleT: 0 };
    avatars.set(p.id, a); return a;
  }
  function removeAvatar(a, id) { a.bubble && disposeSprite(a.bubble); disposeSprite(a.tag); a.character.dispose(); a.root.removeFromParent(); avatars.delete(id); }
  function enemyModel(e) {
    if (e.kind === 'bat') { const b = guacharo({ seed: e.id }); b.scale.setScalar(1.3); return b; }
    if (e.kind === 'spider') { const sp = caveSpider({ seed: e.id }); sp.scale.setScalar(1.15); return sp; }
    if (e.kind === 'snake') { const sn = cuaima({ seed: e.id }); sn.scale.setScalar(1.6); return sn; }
    if (e.kind === 'jaguar' || e.kind === 'stalker') { const cat = jaguar({ gold: e.kind === 'jaguar', melanistic: e.kind === 'stalker', seed: e.id, pace: 1.4 }); cat.scale.setScalar(e.kind === 'jaguar' ? 1.55 : 1.25); return cat; }
    const m = mummy({ guardian: e.kind === 'guardian' });
    if (e.kind === 'phantom') m.traverse(o => { if (o.material) { o.material = o.material.clone(); Object.assign(o.material, { transparent: true, opacity: .45, depthWrite: false }); o.material.emissive?.set(0x4a9dff); o.material.emissiveIntensity = .8; } });
    return m;
  }
  function bark(id, text) {
    const a = avatars.get(id); if (!a) return;
    a.bubble && disposeSprite(a.bubble); a.bubble = label(text, '#fff', { bubble: true }); a.bubble.position.y = 2.75; a.bubble.scale.set(3.6, .68, 1); a.root.add(a.bubble); a.bubbleT = 3;
  }

  function draw(state, me, dt, { downedLook = false, self = me?.id } = {}) {
    const t = performance.now() / 1000, vf = me ? floorOf(me.x) : 0;
    // Riders sink and rise with the cage through the shaft.
    const shaft = liftView(state.lift), rideY = p => state.lift?.moving && state.lift.riders.includes(p.id) ? shaft.y : 0;
    setLook(vf === 0 && rideY(me || {}) > -2.5 ? 'camp' : 'deep');
    world.update(t, state, dt, me);
    sky.update(t); shopSign.visible = vf === 0;
    // Other panas.
    const seen = new Set();
    for (const [i, p] of state.players.entries()) {
      seen.add(p.id);
      const a = avatarFor(p, i), body = me?.id === p.id ? me : p;
      a.root.visible = !p.spectator && p.id !== self && floorOf(p.x) === vf;
      if (!a.root.visible) continue;
      const target = new THREE.Vector3(body.x, (body.y || 0) + rideY(p), body.z);
      if (a.root.position.distanceTo(target) > 5) a.root.position.copy(target); else a.root.position.lerp(target, Math.min(1, dt * 14));
      const turn = Math.atan2(Math.sin(body.h - a.character.group.rotation.y), Math.cos(body.h - a.character.group.rotation.y));
      a.character.group.rotation.y += turn * Math.min(1, dt * 12);
      a.character.group.rotation.z = p.downed ? 1.35 : 0; a.character.group.position.y = p.downed ? .35 : 0;
      a.character.update(dt, { walk: p.moving && !p.downed ? 1 : 0, run: p.moving && p.stamina < .98, carry: p.grip != null, dizzy: p.downed || p.stun > 0 });
      p.hands.forEach((held, k) => {
        const key = held ? held.kind : ''; if (a.keys[k] === key) return; a.keys[k] = key;
        a.slots[k].clear(); if (held) { const m = itemModel(held.kind); m.scale.multiplyScalar(ITEMS[held.kind].tool ? 1 : 1.2); a.slots[k].add(m); }
      });
      a.slots.forEach((s, k) => { s.rotation.x = p.swing > 0 && p.swingHand === k ? -1.6 * p.swing / .3 : 0; });
      a.tag.visible = state.phase === 'playing';
      if (a.bubble) { a.bubbleT -= dt; if (a.bubbleT <= 0) { disposeSprite(a.bubble); a.bubble = null; } }
    }
    for (const [id, a] of avatars) if (!seen.has(id)) removeAvatar(a, id);
    // Enemies.
    const live = new Set();
    for (const e of state.enemies) {
      live.add(e.id);
      let a = enemies.get(e.id);
      if (!a) {
        const root = new THREE.Group(), model = enemyModel(e), ring = new THREE.Mesh(ringGeometry, dangerMaterial);
        ring.rotation.x = -Math.PI / 2; ring.position.y = .05; ring.visible = false; root.add(model); scene.add(root, ring);
        root.position.set(e.x, 0, e.z); a = { root, model, ring, cat: e.kind === 'jaguar' || e.kind === 'stalker', critter: ['bat', 'spider', 'snake'].includes(e.kind) }; enemies.set(e.id, a);
        puffs.spawn({ x: e.x, y: .6, z: e.z }, { color: e.kind === 'phantom' ? 0x9fd8ff : 0xd8c49a, count: 6, spread: .8, size: .7, rise: 1.2, life: .7 });
      }
      a.root.visible = floorOf(e.x) === vf;
      const target = new THREE.Vector3(e.x, 0, e.z);
      a.root.position.lerp(target, Math.min(1, dt * (e.mode === 'leap' ? 30 : 12)));
      const turn = Math.atan2(Math.sin(e.h - a.root.rotation.y), Math.cos(e.h - a.root.rotation.y)); a.root.rotation.y += turn * Math.min(1, dt * 10);
      if (a.critter) {
        a.root.position.y = e.kind === 'bat' ? (e.y ?? 2) : e.kind === 'spider' && e.hanging ? HEIGHT - .4 : 0;
        a.model.rotation.z = e.kind === 'spider' && e.hanging ? Math.PI : 0;
        if (e.kind === 'spider') a.model.userData.pace = e.hanging || e.stun > 0 ? .1 : 1;
        a.model.userData.tick(t + e.id, e.kind === 'snake' ? (e.windup > 0 ? 1 - e.windup / .35 : 0) : undefined);
        a.ring.visible = e.kind === 'snake' && e.windup > 0; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(2.5);
      } else if (a.cat) {
        a.model.userData.pace = e.stun > 0 || e.mode === 'crouch' ? .05 : e.mode === 'recover' ? .4 : 1.3;
        a.model.userData.tick(t);
        a.model.scale.y = (e.kind === 'jaguar' ? 1.55 : 1.25) * (e.mode === 'crouch' ? .78 : 1);
        a.root.position.y = e.mode === 'leap' ? Math.sin(Math.min(1, (e.modeT || 0) / .45) * Math.PI) * 1.6 : 0;
        a.ring.visible = e.mode === 'crouch' || e.mode === 'leap'; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(2);
      } else {
        a.model.userData.animate(t + e.id, !e.frozen && e.windup <= 0, e.windup > 0);
        a.model.position.y = e.hit > 0 ? .1 : 0;
        a.ring.visible = e.windup > 0; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(e.kind === 'guardian' ? 3.8 : 2.1);
      }
      a.ring.visible &&= a.root.visible;
      dangerMaterial.opacity = .55 + Math.sin(t * 16) * .25;
    }
    for (const [id, a] of enemies) if (!live.has(id)) {
      puffs.spawn({ x: a.root.position.x, y: .8, z: a.root.position.z }, { color: 0xe8d8b0, count: 10, spread: 1, size: .8, rise: 1.6, life: .8 });
      if (a.model.userData.dispose) a.model.userData.dispose(); else a.root.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
      a.root.removeFromParent(); a.ring.removeFromParent(); enemies.delete(id);
    }
    // Carritos: their load sits in the hopper and the balance floats above.
    for (const c of state.carts || []) {
      let a = carts.get(c.id);
      if (!a) { const root = new THREE.Group(), model = mineCart({ seed: 41, load: 'empty' }), bed = new THREE.Group(); model.scale.setScalar(.7); bed.position.y = .88; bed.scale.setScalar(.7); root.add(model, bed); scene.add(root); root.position.set(c.x, 0, c.z); a = { root, bed, key: null, tag: null }; carts.set(c.id, a); }
      a.root.visible = floorOf(c.x) === vf;
      // A carrito on the montacargas rides it down the shaft with everyone.
      // The cargo lift hauls it up through the ceiling and lowers it back empty.
      const cargo = state.cargo?.cart === c.id ? state.cargo : null, up = cargo ? Math.min(1, cargo.t / 3) : 0;
      const target = new THREE.Vector3(c.x, cargo ? (cargo.phase === 'up' ? up : 1 - up) * 7 : 0, c.z); if (a.root.position.distanceTo(target) > 4) a.root.position.copy(target); else a.root.position.lerp(target, Math.min(1, dt * 14));
      a.root.rotation.y = c.h;
      // Your own cart's balance is on the HUD, not floating in your face.
      if (a.tag) a.tag.visible = !c.pushers.includes(me?.id) && (!me || Math.hypot(c.x - me.x, c.z - me.z) > 2.2);
      const key = `${c.contents.map(x => x.kind).join()}|${c.big?.kind || ''}`;
      if (key !== a.key) {
        a.key = key; a.bed.clear();
        c.contents.slice(-9).forEach((x, i) => { const m = itemModel(x.kind); m.scale.multiplyScalar(ITEMS[x.kind].size === 'small' ? 1 : .45); m.position.set((i % 3 - 1) * .3, Math.floor(i / 3) * .12, (Math.floor(i / 3) % 3 - 1) * .4); m.rotation.y = i; a.bed.add(m); });
        if (c.big) { const m = itemModel(c.big.kind); m.scale.multiplyScalar(.42); m.position.y = .2; a.bed.add(m); }
        a.tag && disposeSprite(a.tag); a.tag = null;
        const value = cartValue(c);
        if (value) { a.tag = label(`Bs. ${Math.round(value).toLocaleString('es-VE')}`, '#ffd36a'); a.tag.position.y = 1.7; a.tag.scale.set(2, .38, 1); a.root.add(a.tag); }
      }
    }
    for (const [id, a] of carts) if (!state.carts?.some(c => c.id === id)) { a.tag && disposeSprite(a.tag); a.root.removeFromParent(); carts.delete(id); }
    // Honda shots, darts and paint.
    syncSimple(shots, state.shots, s => { const m = new THREE.Mesh(ballGeometry, new THREE.MeshBasicMaterial({ color: COLORS[s.seat % 8] })); return m; }, (m, s) => m.position.set(s.x, s.y, s.z), m => m.material.dispose());
    syncSimple(darts, state.darts, () => new THREE.Mesh(dartGeometry, dartMaterial), (m, d) => m.position.set(d.x, 1.1, d.z));
    for (const s of state.splats) if (!splats.has(s.id)) {
      const m = new THREE.Mesh(splatGeometry, splatMaterial(s.seat, s.id)), wall = s.nx || s.nz;
      m.position.set(s.x + (s.nx || 0) * .02, wall ? s.y : .03, s.z + (s.nz || 0) * .02);
      if (wall) m.lookAt(m.position.x - s.nx, m.position.y, m.position.z - s.nz); else m.rotation.x = -Math.PI / 2;
      m.rotation.z += s.id; scene.add(m); splats.set(s.id, m);
      puffs.spawn({ x: s.x, y: wall ? s.y : .2, z: s.z }, { color: COLORS[s.seat % 8], count: 3, spread: .25, size: .12, rise: .5, life: .3 });
    }
    for (const [id, m] of splats) if (!state.splats.some(s => s.id === id)) { m.removeFromParent(); splats.delete(id); }
    for (const m of splats.values()) m.visible = floorOf(m.position.x) === vf;
    // Camera at the eyes.
    if (me) {
      const moving = me.moving && !me.downed;
      sway += ((moving ? 1 : 0) - sway) * (1 - Math.exp(-dt * 8)); bob += dt * (me.stamina < .98 && moving ? 13 : 9) * sway;
      lift += ((me.downed || downedLook ? -1 : 0) - lift) * (1 - Math.exp(-dt * 5));
      fov += ((me.vx ** 2 + me.vz ** 2 > 40 ? 82 : innerWidth < innerHeight ? 80 : 74) - fov) * (1 - Math.exp(-dt * 5)); camera.fov = fov;
      shake = Math.max(0, shake - dt * 2.5); const jolt = shake * shake * .06;
      camera.position.set(me.x, (me.y || 0) + rideY(me) + EYE + lift * 1 + Math.abs(Math.sin(bob)) * .05 * sway, me.z);
      camera.rotation.set(pitch + (Math.random() - .5) * jolt, h + Math.PI + (Math.random() - .5) * jolt, Math.sin(bob) * .01 * sway + lift * -.35 + (me.reversed > 0 ? Math.sin(t * 2) * .06 : 0));
      // Paws: bob with the stride, swing on use, hide when both hands grip a treasure.
      me.hands.forEach((held, i) => heldModel(hands[i].userData.slot, held, i));
      for (let i = 0; i < 2; i++) {
        swingT[i] = me.swing > 0 && me.swingHand === i ? me.swing / .3 : Math.max(0, swingT[i] - dt * 4);
        const s = Math.sin(swingT[i] * Math.PI);
        hands[i].visible = !me.downed && me.grip == null && me.push == null;
        hands[i].position.set((i ? -1 : 1) * (camera.aspect < 1 ? .16 : .32) + Math.sin(bob + i * Math.PI) * .012 * sway - s * (i ? -.12 : .12), -.36 + Math.abs(Math.cos(bob)) * .015 * sway + s * .1, -.7 - s * .18);
        hands[i].rotation.set(-s * 1.2, 0, s * (i ? -.4 : .4));
      }
      pawMaterial.color.set(normalizeAvatar(me.avatar).fur);
      headlamp.intensity = lookName === 'camp' ? 0 : 55;
      handLight.intensity = holds(me, 'farol') ? 9 : holds(me, 'sunCrown') ? 12 : 0;
      handLight.color.set(holds(me, 'sunCrown') ? 0xffd36a : 0xffa850);
      sun.position.set(me.x - 20, 40, me.z + 25); sun.target.position.set(me.x, 0, me.z);
    }
    // The light pool: the nearest braziers, lamps and other panas' faroles.
    poolAt -= dt;
    if (poolAt <= 0 && me) {
      poolAt = .25;
      const sources = [];
      if (vf > 0) for (const l of world.run.lights) if (l.floor === vf) sources.push({ x: l.x, y: 1.6, z: l.z, color: l.kind === 'mineLamp' ? 0xffc070 : 0xff9a3a, power: 7, d: Math.hypot(l.x - me.x, l.z - me.z) });
      for (const p of state.players) if (p.id !== me.id && alive(p) && floorOf(p.x) === vf && (holds(p, 'farol') || holds(p, 'sunCrown'))) sources.push({ x: p.x, y: 1.4, z: p.z, color: holds(p, 'sunCrown') ? 0xffd36a : 0xffa850, power: 8, d: Math.hypot(p.x - me.x, p.z - me.z) - 6 });
      sources.sort((a, b) => a.d - b.d);
      pool.forEach((light, i) => { const s = sources[i]; light.userData.power = s && s.d < 30 ? s.power : 0; if (s) { light.position.set(s.x, s.y, s.z); light.color.set(s.color); } });
    }
    // La codicia shows in the world: torches gutter and dust sifts from the ceiling.
    const greed = Math.min(4, Math.floor((state.codicia || 0) / 25));
    pool.forEach((light, i) => { light.intensity = vf === 0 ? 0 : (light.userData.power || 0) * (1 - greed * .1) * (.85 + Math.sin(t * (9 + greed * 4) + i * 2) * (.1 + greed * .06)); });
    dustAt -= dt;
    if (me && vf > 0 && greed > 0 && dustAt <= 0) {
      dustAt = 1.6 / greed;
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
      puffs.spawn({ x: me.x + Math.cos(a) * r, y: 4.3, z: me.z + Math.sin(a) * r }, { color: 0xc9b48a, count: 3 + greed, spread: .5, size: .35, rise: -2.6, life: 1.4 });
    }
    puffs.update(dt); waves.update(dt);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }
  function syncSimple(map, list, make, set, drop = () => {}) {
    const ids = new Set();
    for (const item of list) { ids.add(item.id); let m = map.get(item.id); if (!m) { m = make(item); scene.add(m); map.set(item.id, m); } set(m, item); }
    for (const [id, m] of map) if (!ids.has(id)) { drop(m); m.removeFromParent(); map.delete(id); }
  }
  function resize() { canvas.style.width = '100vw'; canvas.style.height = '100dvh'; renderer.setSize(canvas.clientWidth, canvas.clientHeight, false); camera.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight); camera.updateProjectionMatrix(); }
  addEventListener('resize', resize); resize();
  return {
    renderer, scene, camera, puffs, waves, avatars, enemies, draw, bark,
    get world() { return world; },
    get heading() { return h; }, set heading(v) { h = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    look(yawDelta, pitchDelta = 0) { h += yawDelta; pitch = THREE.MathUtils.clamp(pitch + pitchDelta, -1.2, 1.1); },
    // WASD relative to where you look: x right, z back.
    movement(x, z) { return { x: -x * Math.cos(h) - z * Math.sin(h), z: x * Math.sin(h) - z * Math.cos(h) }; },
    shake(amount) { shake = Math.min(1.3, shake + amount); },
    // A new run has a new deck: rebuild the world from its seed.
    reseed(next, depth) { if (world.run.seed === next && world.run.depth === depth) return; scene.remove(world.group); world.dispose(); world = createExpeditionWorld({ seed: next, depth }); scene.add(world.group); },
    dispose() {
      removeEventListener('resize', resize); unbind?.(); puffs.clear(); waves.clear();
      for (const [id, a] of avatars) removeAvatar(a, id);
      for (const a of carts.values()) { a.tag && disposeSprite(a.tag); a.root.removeFromParent(); }
      disposeSprite(shopSign);
      world.dispose(); sky.dispose(); splatTextures.forEach(t => t.dispose()); splatMaterials.forEach(m => m.dispose());
      [ballGeometry, dartGeometry, splatGeometry, ringGeometry, pawGeometry].forEach(g => g.dispose()); [dartMaterial, dangerMaterial, pawMaterial].forEach(m => m.dispose());
      renderer.dispose();
    },
  };
}
