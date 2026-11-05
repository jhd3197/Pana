// Reliquia in first person: the camera at your pana's eyes, your two hands
// holding whatever you picked up, the other panas, the enemies, the paint,
// and the light. Everywhere is underground, the camp's cavern too: the headlamp,
// a farol and a small pool of torch lights (a fixed number, so shaders never
// recompile) are all there is.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { mummy } from '/engine/models/props/reliquia.js';
import { blindLibrarian } from '/engine/models/props/blind-librarian.js';
import { libraryStatue } from '/engine/models/props/library-statue.js';
import { mineCart } from '/engine/models/props/mine.js';
import { jaguar } from '/engine/models/fauna/jaguar.js';
import { caveBat, caveSpider, cuaima } from '/engine/models/fauna/cave-creatures.js';
import { silbon } from '/engine/models/props/reliquia-boss.js';
import { splatTexture } from '/engine/models/props/paintball.js';
import { createSky } from '/engine/worlds/sky.js';
import { WARM_DAY } from '/engine/worlds/look.js';
import { Puffs, Shockwaves, capSpotNearField } from '/engine/fx.js';
import { pixelRatio, bindRenderer, rendererOptions, getSettings } from '/engine/settings.js';
import { dustMotes } from '/engine/models/props/reliquia-library.js';
import { createExpeditionWorld, itemModel } from './scene.js';
import { floorOf, HEIGHT } from './deck.js';
import { ITEMS } from './items.js';
import { formatNumber } from '/engine/i18n.js';
import { holds, alive, cartValue, liftView } from './rules.js';
import { HOPPER, packCart } from './carga.js';
import { SILBON } from './silbon.js';
import { SEAT_COLORS, SUIT_HEAD, seatColor, suitedAvatar } from './suit-look.js';
import { dressExplorer, disposeSuits } from './explorer-suit.js';
import { createHeadlamps } from './headlamps.js';
import { createHands } from './hand-view.js';
import { createSwarmView } from './swarm-view.js';
import { flareStick } from '/engine/models/props/fosa-biomes.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';

export const COLORS = SEAT_COLORS;
const EYE = 1.45, POOL = 5, FAR = 220, CAVERN_FAR = 720;
const TAG_Y = 2.85;   // clears the helmet's lamp
const MUSHROOM_LIGHT = { power: 5, reach: 7, within: 13 };
// Real lights for the nearest other divers: fixed, as every light costs every lit pixel.
const DIVER_LAMPS = { baja: 1, media: 2, alta: 3 }, DIVER_LAMP_POWER = .55;
// The camp's cavern: dark navy, warm only around its few lamps, which borrow the pool. The
// fog closes on what is lit; the far hall (camp-vista.js) carries its own haze past it.
const CAMP_LOOK = { background: 0x040816, fog: [8, 60], hemi: [0x5a78a8, 0x2a3850, 1.55], exposure: 1.12, dust: .7, lamp: 0xfff0d8, hand: 0xffa850, lampPower: 26, candle: [0xffa24a, 5.5, 11] };
// Underground: the mine is a dark violet black; the buried library cold and
// grey-blue, a thin haze (no thick fog: the mist is a few rooms' accent), a
// faint moonlight-cold hemisphere over near-black floors. The farol in the
// library is whiter and dimmer; candles are small warm accents with a short
// reach. Both stay readable within the farol's 8 m.
const DEEP_LOOK = { background: 0x0a0710, fog: [3.5, 24], hemi: [0x5c5088, 0x2a1d12, .5], exposure: 1.15, dust: .45, lamp: 0xfff0d8, hand: 0xffa850, lampPower: 58, candle: [0xffa24a, 5.5, 11] };
// The biomes: drowned teal, a violet glow that lets you see further, sun-baked dust.
const FLOODED_LOOK = { background: 0x061418, fog: [3, 21], hemi: [0x5fa8b8, 0x123038, 1.5], exposure: 1.15, dust: .25, lamp: 0xe2f4f4, hand: 0xbfe6e0, lampPower: 50, candle: [0xffa24a, 5.5, 11] };
const GROVE_LOOK = { background: 0x0c0a1e, fog: [4.5, 28], hemi: [0x7560e0, 0x123a30, 1.15], exposure: 1.2, dust: .7, lamp: 0xf0ecff, hand: 0xd8c8ff, lampPower: 44, candle: [0xffa24a, 5.5, 11] };
const TEMPLE_LOOK = { background: 0x140c08, fog: [3.2, 22], hemi: [0xa8865a, 0x2c1a0a, .85], exposure: 1.15, dust: 1.1, lamp: 0xffeed0, hand: 0xffb468, lampPower: 56, candle: [0xffa24a, 5.5, 11] };
const LIBRARY_LOOK = { background: 0x18202a, fog: [2.5, 21], hemi: [0x74849e, 0x0c0c10, 1.8], exposure: 1.1, dust: 1, lamp: 0xe4ebf4, hand: 0xd8dde6, lampPower: 25, lampDecay: 1.15, handPower: .35, candle: [0xff9e52, 1.6, 4.5] };
// How much La Estatua's pale marble dims with the headlamp right on it (2 m).
const STATUE_DIM = .72;
const ROCK_POOL = 8;

function label(text, color, { bubble = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'); ctx.font = `800 ${bubble ? 38 : 34}px Nunito, sans-serif`;
  const width = Math.min(500, ctx.measureText(text).width + 40);
  ctx.fillStyle = bubble ? '#fffaf0f2' : '#14102ae0'; ctx.fillRect(256 - width / 2, 10, width, 70);
  if (bubble) { ctx.beginPath(); ctx.moveTo(240, 78); ctx.lineTo(256, 94); ctx.lineTo(272, 78); ctx.fill(); }
  ctx.fillStyle = bubble ? '#2b1d12' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 46, 480);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(3.2, .6, 1); sprite.renderOrder = 10; return sprite;
}
const disposeSprite = s => { s.material.map.dispose(); s.material.dispose(); s.removeFromParent(); };

// The lamp on your head stops gaining strength this close: what comes within reach
// (the truck, a wall, a bat) keeps its colour instead of burning to a white disc.
const LAMP_NEAR = 2.5;
export function createView(canvas, { seed = 1, depth = 1 } = {}) {
  capSpotNearField(LAMP_NEAR);
  const renderer = new THREE.WebGLRenderer(rendererOptions({ canvas, antialias: true }));
  renderer.setPixelRatio(pixelRatio(1.5)); const unbind = bindRenderer(renderer, 1.5);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(CAMP_LOOK.background); scene.fog = new THREE.Fog(CAMP_LOOK.background, ...CAMP_LOOK.fog);
  const camera = new THREE.PerspectiveCamera(74, 1, .05, FAR); camera.rotation.order = 'YXZ'; scene.add(camera);
  const sky = createSky(WARM_DAY.sky); scene.add(sky.mesh);
  const hemi = new THREE.HemisphereLight(...CAMP_LOOK.hemi); scene.add(hemi);
  // Headlamp and the farol in your hand ride on the camera.
  const headlamp = new THREE.SpotLight(0xfff0d8, 0, 24, .44, .42, 1.35); headlamp.position.set(0, .05, 0); headlamp.target.position.set(0, -.25, -5); camera.add(headlamp, headlamp.target);
  const handLight = new THREE.PointLight(0xffa850, 0, 12, 1.6); handLight.position.set(.42, -.05, -.8); camera.add(handLight);
  const pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffa04a, 0, 11, 1.7); scene.add(l); return l; });
  const diverLamps = createHeadlamps(scene, DIVER_LAMPS[getSettings().quality] ?? 2);
  // Dust drifting through the headlamp's beam.
  const motes = dustMotes(); motes.visible = false; camera.add(motes);
  // What a scare does to the light, set by eerie-fx.js every frame: the
  // torches and candles (light), your own lamps (farol), the fog distance
  // (fog, a multiplier) and candles blown out around a point (out).
  const mood = { light: 1, farol: 1, fog: 1, out: null };
  // What the world sets off that only makes sound: game.js listens.
  const onFx = e => { if (e.type === 'dust') puffs.spawn({ x: e.x, y: e.y, z: e.z }, { color: lookName === 'biblioteca' ? 0x8e949c : 0xb8a888, count: Math.round(2 + e.strength * 3), spread: .3 + e.strength * .7, size: .16 + e.strength * .14, rise: .55, life: .75 }); else view.onFx?.(e); };
  let world = createExpeditionWorld({ seed, depth, onFx }); scene.add(world.group);
  const shopSign = label('TIENDA · se paga en mangos', '#ffd36a'); shopSign.position.set(-12.5, 3.4, 6); shopSign.scale.set(4.4, .82, 1); scene.add(shopSign); // i18n-ignore: signage painted in the world
  const puffs = new Puffs(scene), waves = new Shockwaves(scene), swarm = createSwarmView({ scene, puffs });
  // The food chain's scenery comes a moment later: nothing in it is needed to start.
  let ecoView = null, ecoGone = false;
  import('./eco-view.js').then(m => { if (!ecoGone) ecoView = m.createEcoView({ scene }); });
  // Your gloves and sleeves: the suit's colour, holding the two hand items in view.
  const hands = createHands({ camera, itemModel });
  // Paint, darts and shots.
  const splatTextures = [1, 2, 3, 4].map(splatTexture), splatGeometry = new THREE.PlaneGeometry(.7, .7), splatMaterials = new Map();
  const splatMaterial = (seat, n) => { const key = `${seat}:${n}`; if (!splatMaterials.has(key)) splatMaterials.set(key, new THREE.MeshBasicMaterial({ color: COLORS[seat % 8], map: splatTextures[n % 4], transparent: true, alphaTest: .4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, side: THREE.DoubleSide })); return splatMaterials.get(key); };
  const splats = new Map(), shots = new Map(), darts = new Map(), flares = new Map();
  // A flare on the floor: its stick and a sprite for the glare, one shared material.
  const flareGlare = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff5a3a, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
  // Falling rocks and the rings under them: one draw each, whatever the rain.
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.55, 0), new THREE.MeshStandardMaterial({ color: 0x8a7a64, roughness: 1, flatShading: true }), ROCK_POOL);
  const rockRings = new THREE.InstancedMesh(new THREE.RingGeometry(.85, 1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: .75, depthWrite: false, side: THREE.DoubleSide }), ROCK_POOL);
  rockMesh.frustumCulled = rockRings.frustumCulled = false; rockMesh.count = rockRings.count = 0; scene.add(rockMesh, rockRings);
  const rockAt = new THREE.Object3D();
  let rippleAt = 0;
  const ballGeometry = new THREE.SphereGeometry(.09, 8, 6), dartGeometry = new THREE.CylinderGeometry(.02, .02, .5, 5).rotateZ(Math.PI / 2), dartMaterial = new THREE.MeshStandardMaterial({ color: 0x7a5a2a });
  const avatars = new Map(), enemies = new Map(), carts = new Map(), tmp = new THREE.Vector3();
  let lastState = null, snapAt = 0;
  let veil = 0, scares = 'normal', dustAt = 0, h = Math.PI, pitch = 0, bob = 0, sway = 0, shake = 0, lift = 0, fov = 74, lookName = '', look = CAMP_LOOK, poolAt = 0, wallPush = 0, shakeScale = 1;
  const baseColor = new THREE.Color();
  const ringGeometry = new THREE.RingGeometry(.85, 1, 40), dangerMaterial = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide });

  function setLook(name) {
    if (name === lookName) return; lookName = name;
    look = { caverna: CAMP_LOOK, biblioteca: LIBRARY_LOOK, inundada: FLOODED_LOOK, hongos: GROVE_LOOK, templo: TEMPLE_LOOK }[name] || DEEP_LOOK;
    scene.background.set(look.background); scene.fog.color.set(look.background); [scene.fog.near, scene.fog.far] = look.fog;
    hemi.color.set(look.hemi[0]); hemi.groundColor.set(look.hemi[1]); hemi.intensity = look.hemi[2];
    sky.mesh.visible = false; renderer.toneMappingExposure = look.exposure;
    headlamp.color.set(look.lamp || 0xfff0d8); headlamp.decay = look.lampDecay ?? 1.35;
  }
  function avatarFor(p, i) {
    const skin = JSON.stringify(p.avatar); let a = avatars.get(p.id);
    if (a && a.skin === skin) return a;
    if (a) removeAvatar(a, p.id);
    const character = buildCharacter(suitedAvatar(p.avatar), { head: SUIT_HEAD }), suit = dressExplorer(character, seatColor(p.seat)), root = new THREE.Group(), tag = label(p.name, COLORS[p.seat % 8]);
    tag.position.y = TAG_Y; root.add(character.group, tag); scene.add(root);
    const slots = [new THREE.Group(), new THREE.Group()]; slots[0].position.set(.42, .95, .36); slots[1].position.set(-.42, .95, .36); slots.forEach(s => character.group.add(s));
    a = { root, character, suit, tag, slots, keys: ['', ''], skin, bubble: null, bubbleT: 0 };
    avatars.set(p.id, a); return a;
  }
  function removeAvatar(a, id) { a.bubble && disposeSprite(a.bubble); disposeSprite(a.tag); a.suit.remove(); a.character.dispose(); a.root.removeFromParent(); avatars.delete(id); }
  function enemyModel(e) {
    if (e.kind === 'bat') { const b = caveBat({ seed: e.id }); b.scale.setScalar(1.3); return b; }
    if (e.kind === 'silbon') return silbon({ seed: e.id });
    if (e.kind === 'spider') { const sp = caveSpider({ seed: e.id }); sp.scale.setScalar(1.15); return sp; }
    if (e.kind === 'snake') { const sn = cuaima({ seed: e.id }); sn.scale.setScalar(1.6); return sn; }
    if (e.kind === 'lector') return blindLibrarian({ seed: e.id });
    if (e.kind === 'estatua') return libraryStatue({ seed: e.id, pose: e.pose ?? 0 });
    if (e.kind === 'jaguar' || e.kind === 'stalker') { const cat = jaguar({ gold: e.kind === 'jaguar', melanistic: e.kind === 'stalker', seed: e.id, pace: 1.4 }); cat.scale.setScalar(e.kind === 'jaguar' ? 1.55 : 1.25); return cat; }
    // Mummies and phantoms are the gaunt figure; the guardian stays stone and gold.
    const m = mummy({ guardian: e.kind === 'guardian', gaunt: true, seed: e.id });
    if (e.kind === 'phantom') m.traverse(o => { if (o.material) { o.material = o.material.clone(); Object.assign(o.material, { transparent: true, opacity: .45, depthWrite: false }); o.material.emissive?.set(0x4a9dff); o.material.emissiveIntensity = .8; } });
    return m;
  }
  function bark(id, text) {
    const a = avatars.get(id); if (!a) return;
    a.bubble && disposeSprite(a.bubble); a.bubble = label(text, '#fff', { bubble: true }); a.bubble.position.y = TAG_Y + .5; a.bubble.scale.set(3.6, .68, 1); a.root.add(a.bubble); a.bubbleT = 3;
  }

  function draw(state, me, dt, { downedLook = false, self = me?.id } = {}) {
    const t = performance.now() / 1000, vf = me ? floorOf(me.x) : 0;
    if (state !== lastState) { lastState = state; snapAt = t; }
    // Riders sink and rise with the cage through the shaft.
    const shaft = liftView(state.lift), rideY = p => state.lift?.moving && state.lift.riders.includes(p.id) ? shaft.y : 0;
    setLook(vf === 0 && rideY(me || {}) > -2.5 ? 'caverna' : world.run.theme);
    // Riding the lift at the camp: the dark of the shaft lifts as you come up (and
    // settles as you go down), so the cavern opens around you. Only ever this screen's picture.
    const inShaft = vf === 0 ? Math.max(0, Math.min(1, -rideY(me || {}) / 6)) : 0, comingUp = vf === 0 && state.lift?.moving && state.lift.to === 0 && state.lift.riders.includes(me?.id);
    veil += (inShaft - veil) * (1 - Math.exp(-dt * (inShaft > veil ? 5 : 2.4)));
    // You turn to face the way out and look up a little; the mouse still has the last word.
    if (comingUp) { const ease = 1 - Math.exp(-dt * 3), turn = Math.atan2(Math.sin(-h), Math.cos(-h)); h += turn * ease; pitch += (.12 - pitch) * ease; }
    // El apagón: every torch stutters and sinks, your lamp with them. "Sustos" softens the show, never the rule.
    const stutter = Math.sin(t * 31) * Math.sin(t * 17 + 1.1) > -.1 ? 1 : .35, out = vf === 0 || state.suceso?.kind !== 'apagon' ? 1 : scares === 'apagados' ? .7 : scares === 'suaves' ? .45 + .2 * stutter : .1 + .3 * stutter;
    // Scares squeeze the fog in; the candles fade with it.
    if (lookName !== 'camp') { scene.fog.near = look.fog[0] * Math.min(1, mood.fog); scene.fog.far = look.fog[1] * mood.fog * (.6 + .4 * out) * (1 - veil * .6); hemi.intensity = look.hemi[2] * (.2 + .8 * Math.min(1, Math.max(mood.light, mood.farol))) * (.25 + .75 * out) * (1 - veil * .7); }
    renderer.toneMappingExposure = look.exposure * (1 - veil * .35);
    world.candles({ level: mood.light * out, out: mood.out, near: scene.fog.near, far: scene.fog.far });
    world.update(t, state, dt, me);
    sky.update(t); shopSign.visible = vf === 0;
    // Other panas.
    const seen = new Set(), divers = [];
    for (const [i, p] of state.players.entries()) {
      seen.add(p.id);
      const a = avatarFor(p, i), body = me?.id === p.id ? me : p;
      a.root.visible = !p.spectator && p.id !== self && floorOf(p.x) === vf;
      if (!a.root.visible) continue;
      // Between snapshots another pana keeps walking the way it was going (at
      // most 0.15 s ahead), so a host that publishes slowly still
      // looks like walking on a guest's screen, not a step and a glide.
      const ahead = body === p && p.moving && !p.downed ? Math.min(.15, t - snapAt) : 0;
      const target = tmp.set(body.x + (p.vx || 0) * ahead, (body.y || 0) + rideY(p), body.z + (p.vz || 0) * ahead);
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
      a.suit.lit(lookName !== 'camp');
      if (me) divers.push({ suit: a.suit, heading: a.character.group.rotation.y, d: Math.hypot(a.root.position.x - me.x, a.root.position.z - me.z) });
      if (a.bubble) { a.bubbleT -= dt; if (a.bubbleT <= 0) { disposeSprite(a.bubble); a.bubble = null; } }
    }
    for (const [id, a] of avatars) if (!seen.has(id)) removeAvatar(a, id);
    diverLamps.update(lookName === 'camp' ? [] : divers, (look.lampPower || 58) * DIVER_LAMP_POWER * mood.farol);
    // Enemies.
    const live = new Set();
    for (const e of state.enemies) {
      live.add(e.id);
      let a = enemies.get(e.id);
      if (!a) {
        const root = new THREE.Group(), model = enemyModel(e), ring = new THREE.Mesh(ringGeometry, dangerMaterial);
        ring.rotation.x = -Math.PI / 2; ring.position.y = .05; ring.visible = false; root.add(model); scene.add(root, ring);
        root.position.set(e.x, 0, e.z); root.rotation.y = e.h || 0;
        a = { root, model, ring, boss: e.kind === 'silbon', fall: 0, cat: e.kind === 'jaguar' || e.kind === 'stalker', critter: ['bat', 'spider', 'snake'].includes(e.kind), stone: e.kind === 'estatua', pose: { frozen: false, look: 0, lit: 'dark', scares, mode: 'prowl', pose: 0 }, speed: 0, x: e.x, z: e.z, steps: e.steps || 0 }; enemies.set(e.id, a);
        // A statue was there all along: no puff when it first appears.
        if (!a.stone) puffs.spawn({ x: e.x, y: .6, z: e.z }, { color: e.kind === 'phantom' ? 0x9fd8ff : lookName === 'biblioteca' ? 0x8e949c : 0xd8c49a, count: 6, spread: .8, size: .7, rise: 1.2, life: .7 });
      }
      a.root.visible = floorOf(e.x) === vf;
      // Stone does not glide: it is wherever the host says, at once, and a
      // stride leaves a little dust behind (none on Sustos apagados).
      if (a.stone) {
        if ((e.steps || 0) !== a.steps) {
          a.steps = e.steps || 0;
          if (scares !== 'apagados' && a.root.visible) puffs.spawn({ x: a.root.position.x, y: .15, z: a.root.position.z }, { color: 0x8e949c, count: scares === 'suaves' ? 3 : 6, spread: .5, size: .35, rise: .4, life: .9 });
        }
        a.root.position.set(e.x, 0, e.z); a.root.rotation.y = e.h || 0;
        a.pose.pose = e.pose ?? 0; a.model.userData.animate(t, a.pose);
        // Pale marble under the headlamp: dimmed when the lamp is right on it
        // (it clips to white within 3 m), full from 8.5 m out where only the
        // cold room light finds the silhouette.
        const near = 1 - Math.min(1, Math.max(0, (Math.hypot(camera.position.x - e.x, camera.position.z - e.z) - 2) / 6.5));
        a.model.userData.setShade(1 - near * near * (3 - 2 * near) * STATUE_DIM * Math.min(1, headlamp.intensity / (look.lampPower || 58)));
        a.ring.visible = e.windup > 0 && a.root.visible; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(1.6);
        continue;
      }
      const target = tmp.set(e.x, 0, e.z);
      a.root.position.lerp(target, Math.min(1, dt * (e.mode === 'leap' ? 30 : 12)));
      const turn = Math.atan2(Math.sin(e.h - a.root.rotation.y), Math.cos(e.h - a.root.rotation.y)); a.root.rotation.y += turn * Math.min(1, dt * 10);
      if (a.boss) {
        // Drawn from the host's own numbers: its pose, and the drop into the pit.
        const step = dt > 0 ? Math.hypot(e.x - a.x, e.z - a.z) / dt : 0; a.x = e.x; a.z = e.z;
        a.speed += (Math.min(1, step / 2) - a.speed) * (1 - Math.exp(-dt * 6));
        a.fall = e.mode === 'fall' ? Math.min(1, (e.modeT || 0) / SILBON.fall) : 0;
        a.root.position.y = -a.fall * a.fall * 9;
        a.model.userData.animate(t, { walk: a.speed, windup: e.windup > 0 ? 1 - e.windup / .8 : 0, peek: e.peek ? 1 : 0, sniff: e.mode === 'sniff' ? 1 : 0, stun: e.stun > 0 ? 1 : 0, fall: a.fall });
        a.ring.visible = e.windup > 0; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(2.2);
      } else if (a.critter) {
        a.root.position.y = e.kind === 'bat' ? (e.hanging ? HEIGHT - .35 : e.y ?? 2) : e.kind === 'spider' && e.hanging ? HEIGHT - .4 : 0;
        if (e.kind === 'bat') a.model.userData.hang = !!e.hanging;
        if (e.kind === 'spider') a.model.rotation.z = e.hanging ? Math.PI : 0;
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
        // Walking only when it actually covers ground (snapshots come at 20 Hz: smoothed).
        const step = dt > 0 ? Math.hypot(e.x - a.x, e.z - a.z) / dt : 0; a.x = e.x; a.z = e.z;
        a.speed += (Math.min(6, step) - a.speed) * (1 - Math.exp(-dt * 6));
        const pose = a.pose; pose.frozen = !!e.frozen; pose.lit = e.lit || 'dark'; pose.scares = scares; pose.mode = e.mode;
        // The head finds you: the yaw from its body to your eyes.
        // The Lector is blind: its head turns toward the sound it heard instead.
        if (e.kind === 'lector') pose.look = e.look || 0;
        else if (me) { const yaw = Math.atan2(me.x - a.root.position.x, me.z - a.root.position.z) - a.root.rotation.y; pose.look = Math.atan2(Math.sin(yaw), Math.cos(yaw)); } else pose.look = 0;
        a.model.userData.animate(t + e.id, !e.frozen && e.windup <= 0 && a.speed > .35, e.windup > 0, pose);
        a.model.position.y = e.hit > 0 ? .1 : 0;
        a.ring.visible = e.windup > 0; a.ring.position.set(e.attackX, .05, e.attackZ); a.ring.scale.setScalar(e.kind === 'guardian' ? 3.8 : e.kind === 'lector' ? 1.7 : 2.1);
      }
      a.ring.visible &&= a.root.visible;
      dangerMaterial.opacity = .55 + Math.sin(t * 16) * .25;
    }
    for (const [id, a] of enemies) if (!live.has(id)) {
      puffs.spawn({ x: a.root.position.x, y: .8, z: a.root.position.z }, { color: 0xe8d8b0, count: 10, spread: 1, size: .8, rise: 1.6, life: .8 });
      if (a.model.userData.dispose) a.model.userData.dispose(); else a.root.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
      a.root.removeFromParent(); a.ring.removeFromParent(); enemies.delete(id);
    }
    // The swarm: one instanced mesh, however many snakes.
    swarm.update(dt, state, me, vf, world.layout);
    ecoView?.update(dt, state, me, vf, world.layout, t);
    // Carritos: their load sits in the hopper and the balance floats above.
    for (const c of state.carts || []) {
      let a = carts.get(c.id);
      if (!a) { const root = new THREE.Group(), model = mineCart({ seed: 41, load: 'empty', hollow: true }), bed = new THREE.Group(); bed.position.y = HOPPER.floor; root.add(model, bed); scene.add(root); root.position.set(c.x, 0, c.z); a = { root, bed, key: null, tag: null }; carts.set(c.id, a); }
      a.root.visible = floorOf(c.x) === vf;
      // A carrito on the montacargas rides it down the shaft with everyone.
      // The cargo lift hauls it up through the ceiling and lowers it back empty.
      const cargo = state.cargo?.cart === c.id ? state.cargo : null, up = cargo ? Math.min(1, cargo.t / 3) : 0;
      const target = tmp.set(c.x, cargo ? (cargo.phase === 'up' ? up : 1 - up) * 7 : 0, c.z); if (a.root.position.distanceTo(target) > 4) a.root.position.copy(target); else a.root.position.lerp(target, Math.min(1, dt * 14));
      a.root.rotation.y = c.h;
      // A load on a rough ride rocks; what is inside is only drawn up close.
      const rock = (c.wobble || 0) * .07; a.root.rotation.z = Math.sin(t * 17) * rock; a.root.rotation.x = Math.cos(t * 13) * rock * .6;
      a.bed.visible = !me || Math.hypot(c.x - me.x, c.z - me.z) < 18;
      // Your own cart's balance is on the HUD, not floating in your face.
      if (a.tag) a.tag.visible = !c.pushers.includes(me?.id) && (!me || Math.hypot(c.x - me.x, c.z - me.z) > 2.2);
      const key = `${c.contents.map(x => x.kind).join()}|${c.big?.kind || ''}`;
      if (key !== a.key) {
        a.key = key; a.bed.clear();
        // Everything at its true size, where carga.js packed it; flat pieces lie on their backs.
        const { slots, top } = packCart(c.contents);
        c.contents.forEach((x, i) => {
          const m = itemModel(x.kind), s = slots[i]; m.position.set(s.x, s.y, s.z);
          if (s.lay) { m.rotation.x = -Math.PI / 2; m.position.y += s.h / 2; } else m.rotation.y = i * 2.4;
          a.bed.add(m);
        });
        // A big treasure sits on the load, edge-on so whoever pushes still sees past it.
        if (c.big) { const m = itemModel(c.big.kind); m.position.y = top * .5; m.rotation.y = Math.PI / 2; a.bed.add(m); }
        a.tag && disposeSprite(a.tag); a.tag = null;
        const value = cartValue(c);
        if (value) { a.tag = label(`Bs. ${formatNumber(Math.round(value))}`, '#ffd36a'); a.tag.position.y = 1.7; a.tag.scale.set(2, .38, 1); a.root.add(a.tag); }
      }
    }
    for (const [id, a] of carts) if (!state.carts?.some(c => c.id === id)) { a.tag && disposeSprite(a.tag); a.root.removeFromParent(); carts.delete(id); }
    // Honda shots, darts and paint.
    syncSimple(shots, state.shots, s => { const m = new THREE.Mesh(ballGeometry, new THREE.MeshBasicMaterial({ color: COLORS[s.seat % 8] })); return m; }, (m, s) => m.position.set(s.x, s.y, s.z), m => m.material.dispose());
    syncSimple(darts, state.darts, () => new THREE.Mesh(dartGeometry, dartMaterial), (m, d) => m.position.set(d.x, 1.1, d.z));
    syncSimple(flares, state.flares || [], () => { const g = new THREE.Group(), glare = new THREE.Sprite(flareGlare); glare.scale.setScalar(1.6); glare.position.y = .3; g.add(flareStick(), glare); g.rotation.z = 1.2; return g; }, (m, s) => { m.position.set(s.x, s.y, s.z); m.children[1].scale.setScalar(1.3 + Math.sin(t * 27 + s.id) * .25); });
    const rocks = state.rocks || []; rockMesh.count = rockRings.count = Math.min(ROCK_POOL, rocks.length);
    rocks.slice(0, ROCK_POOL).forEach((r, i) => {
      const k = Math.min(1, r.t / r.at);
      rockAt.position.set(r.x, HEIGHT * (1 - k * k) + .3, r.z); rockAt.rotation.set(r.id, k * 3, r.id * 2); rockAt.scale.setScalar(1); rockAt.updateMatrix(); rockMesh.setMatrixAt(i, rockAt.matrix);
      rockAt.position.set(r.x, .17, r.z); rockAt.rotation.set(0, 0, 0); rockAt.scale.setScalar(1.5 - k * .4); rockAt.updateMatrix(); rockRings.setMatrixAt(i, rockAt.matrix);
    });
    if (rockMesh.count) { rockMesh.instanceMatrix.needsUpdate = true; rockRings.instanceMatrix.needsUpdate = true; }
    // Wading: rings spread from whoever moves through the flood.
    rippleAt -= dt;
    if (rippleAt <= 0 && me && vf > 0 && world.run.theme === 'inundada') {
      rippleAt = .42;
      for (const p of state.players) if (alive(p) && p.moving && floorOf(p.x) === vf && !(p.y < -1) && Math.hypot(p.x - me.x, p.z - me.z) < 16 && !world.layout.overPit(p.x, p.z)) waves.ring({ x: p.x, y: .15, z: p.z }, { color: 0xbfe8e8, startRadius: .15, maxRadius: 1.3, life: .6, yOffset: .02, opacity: .5 });
    }
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
      shake = Math.max(0, shake - dt * 2.5); const jolt = shake * shake * .06 * shakeScale;
      camera.position.set(me.x, (me.y || 0) + rideY(me) + EYE + lift * 1 + Math.abs(Math.sin(bob)) * .05 * sway, me.z);
      camera.rotation.set(pitch + (Math.random() - .5) * jolt, h + Math.PI + (Math.random() - .5) * jolt, Math.sin(bob) * .01 * sway + lift * -.35 + (me.reversed > 0 ? Math.sin(t * 2) * .06 : 0));
      // Hands: bob with the stride, swing on use, hide when both grip a treasure. A wall
      // just ahead pulls them in, so they never poke through it.
      const wall = world.layout.walkable(me.x + Math.sin(h) * .72, me.z + Math.cos(h) * .72, state, .02) ? 0 : .2;
      wallPush += (wall - wallPush) * (1 - Math.exp(-dt * 12));
      hands.update(dt, me, { bob, sway, push: wallPush, aspect: camera.aspect, color: seatColor(me.seat) });
      headlamp.intensity = lookName === 'camp' ? 0 : (look.lampPower || 58) * mood.farol * (.3 + .7 * out);
      handLight.intensity = (holds(me, 'farol') ? 9 : holds(me, 'sunCrown') ? 12 : 0) * (.4 + .6 * mood.farol) * (look.handPower ?? 1);
      motes.visible = lookName !== 'camp'; motes.userData.tick(t); motes.userData.strength(look.dust * mood.farol); motes.userData.scale(canvas.clientHeight * renderer.getPixelRatio());
      handLight.color.set(holds(me, 'sunCrown') ? 0xffd36a : look.hand || 0xffa850);
    }
    // The light pool: the nearest braziers, lamps and other panas' faroles.
    poolAt -= dt;
    if (poolAt <= 0 && me) {
      poolAt = .25;
      const sources = [];
      const [candleColor, candlePower, candleReach] = look.candle || DEEP_LOOK.candle;
      // A burning flare outranks every torch: it is why you threw it.
      if (vf > 0) for (const s of state.flares || []) if (floorOf(s.x) === vf) sources.push({ x: s.x, y: s.y + .4, z: s.z, color: 0xff4a2a, power: 16, reach: 13, d: Math.hypot(s.x - me.x, s.z - me.z) - 14, flare: true });
      if (vf === 0) for (const l of world.campLamps) sources.push({ ...l, d: Math.hypot(l.x - me.x, l.z - me.z), fire: world.fireAt(0, l.x, l.z) });
      if (vf > 0) for (const l of world.run.lights) if (l.floor === vf) sources.push({ x: l.x, y: l.kind === 'candelabra' ? 1.95 : 1.6, z: l.z, color: l.kind === 'mineLamp' ? 0xffc070 : l.kind === 'candelabra' ? candleColor : 0xff9a3a, power: l.kind === 'candelabra' ? candlePower : 7, reach: l.kind === 'candelabra' ? candleReach : 11, d: Math.hypot(l.x - me.x, l.z - me.z), fire: l.kind === 'brazier' ? world.fireAt(vf, l.x, l.z) : null });
      for (const p of state.players) if (p.id !== me.id && alive(p) && floorOf(p.x) === vf && (holds(p, 'farol') || holds(p, 'sunCrown'))) sources.push({ x: p.x, y: 1.4, z: p.z, color: holds(p, 'sunCrown') ? 0xffd36a : look.hand || 0xffa850, power: 8, reach: 11, d: Math.hypot(p.x - me.x, p.z - me.z) - 6 });
      sources.sort((a, b) => a.d - b.d);
      // The last two slots go to the nearest glowing mushrooms: no extra lights,
      // and the warm sources they displace are the farthest of the five.
      const glows = (world.floors.get(vf)?.glows || []).concat(ecoView?.glows || []).map(g => ({ ...g, power: MUSHROOM_LIGHT.power, reach: MUSHROOM_LIGHT.reach, d: Math.hypot(g.x - me.x, g.z - me.z) })).filter(g => g.d < MUSHROOM_LIGHT.within).sort((a, b) => a.d - b.d).slice(0, 2);
      sources.splice(POOL - glows.length, sources.length, ...glows);
      pool.forEach((light, i) => {
        const s = sources[i], u = light.userData; u.power = s && s.d < 30 ? s.power : 0; u.flare = !!s?.flare; u.fire = s?.fire || null;
        if (s) { u.x = s.x; u.y = s.y; u.z = s.z; u.color = s.color; light.position.set(s.x, s.y, s.z); light.color.set(s.color); light.distance = s.reach; }
      });
    }
    // La codicia shows in the world: torches gutter and dust sifts from the ceiling.
    const greed = Math.min(4, Math.floor((state.codicia || 0) / 25));
    // A slow, uneven breathing on every flame, under the quick gutter.
    // A real fire drives its own light: it wanders so the shadows dance, and spikes when fed.
    pool.forEach((light, i) => {
      const u = light.userData, fire = u.fire?.light, breath = fire ? fire.intensity : (.85 + Math.sin(t * (9 + greed * 4) + i * 2) * (.1 + greed * .06)) * (.9 + .1 * Math.sin(t * 1.3 + i * 1.7) * Math.sin(t * .37 + i));
      light.intensity = (u.power || 0) * mood.light * (u.flare ? 1 : out) * (1 - greed * .1) * breath;
      if (fire) { light.position.set(u.x + fire.x, u.y + fire.y, u.z + fire.z); baseColor.set(u.color); light.color.setRGB(baseColor.r, baseColor.g * (.9 + fire.warmth * .2), baseColor.b * (.75 + fire.warmth * .5)); }
    });
    dustAt -= dt;
    if (me && vf > 0 && greed > 0 && dustAt <= 0) {
      dustAt = 1.6 / greed;
      const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 5;
      puffs.spawn({ x: me.x + Math.cos(a) * r, y: 4.3, z: me.z + Math.sin(a) * r }, { color: lookName === 'biblioteca' ? 0x9ca2aa : 0xc9b48a, count: 3 + greed, spread: .5, size: .35, rise: -2.6, life: 1.4 });
    }
    puffs.update(dt); waves.update(dt);
    // Past the fog's far end everything is the background colour already
    // (fog depth and the far plane are the same view depth), so the far plane
    // sits there: rooms and shelves beyond it are culled instead of drawn.
    camera.far = lookName === 'caverna' ? CAVERN_FAR : Math.min(FAR, scene.fog.far + 1);
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
  const view = {
    onFx: null,
    renderer, scene, camera, puffs, waves, avatars, enemies, swarm, hands, draw, bark, mood,
    get lookName() { return lookName; },
    // The Sustos setting scales every camera shake (0 turns it off).
    set shakeScale(v) { shakeScale = v; },
    // The Sustos setting, for how the mummies twitch and whether their eyes gutter.
    set scares(v) { scares = v; },
    get world() { return world; },
    get heading() { return h; }, set heading(v) { h = v; },
    get pitch() { return pitch; }, set pitch(v) { pitch = v; },
    look(yawDelta, pitchDelta = 0) { h += yawDelta; pitch = THREE.MathUtils.clamp(pitch + pitchDelta, -1.2, 1.1); },
    // WASD relative to where you look: x right, z back.
    movement(x, z) { return { x: -x * Math.cos(h) - z * Math.sin(h), z: x * Math.sin(h) - z * Math.cos(h) }; },
    shake(amount) { shake = Math.min(1.3, shake + amount); },
    // A new run has a new deck: rebuild the world from its seed.
    reseed(next, depth, theme) { if (world.run.seed === next && world.run.depth === depth && (!theme || world.run.theme === theme)) return; scene.remove(world.group); world.dispose(); world = createExpeditionWorld({ seed: next, depth, theme, onFx }); scene.add(world.group); },
    dispose() {
      removeEventListener('resize', resize); unbind?.(); puffs.clear(); waves.clear();
      for (const [id, a] of avatars) removeAvatar(a, id);
      for (const a of carts.values()) { a.tag && disposeSprite(a.tag); a.root.removeFromParent(); }
      disposeSprite(shopSign);
      swarm.dispose(); ecoGone = true; ecoView?.dispose(); motes.userData.dispose(); world.dispose(); sky.dispose(); splatTextures.forEach(t => t.dispose()); splatMaterials.forEach(m => m.dispose());
      [ballGeometry, dartGeometry, splatGeometry, ringGeometry].forEach(g => g.dispose()); [dartMaterial, dangerMaterial].forEach(m => m.dispose()); hands.dispose(); disposeSuits(); diverLamps.dispose();
      renderer.dispose();
    },
  };
  return view;
}
