import { combatPose } from './combat-motion.js';
import { createCombatRig } from './combat-rig.js';
import { attackExtension } from './attack-timing.js';
// A pana in Trifulca: the player's own character with the corner's gloves and
// the wardrobe's kart helmet when fighting, posed from the fight state (guard,
// jab, trompón windup, block, dodge, dizzy, the flop of a caída) in a style
// picked per move, and a springy head that rocks on every hit. Crowd panas
// cheer and shove.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { createAccessories } from '/engine/models/characters/pana/accessories.js';
import { boxingGlove, CORNER_COLORS, HELMET_COLORS } from './set.js';
import { T } from './fight-rules.js';
import { rhythm } from './crowd-life.js';
import { inkOutlines } from './toon.js';

const SCULPT = .6;   // buildCharacter's sculpt scale: bones live in sculpt units
const ease = (a, b, k) => a + (b - a) * k;

// A name tag over a pana's head (yours says TÚ).
export function nameTag(text, { me = false } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 34px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = Math.min(250, ctx.measureText(text).width + 34);
  ctx.fillStyle = me ? '#ffc629' : 'rgba(20,20,30,.72)';
  ctx.beginPath(); ctx.roundRect((256 - w) / 2, 8, w, 48, 24); ctx.fill();
  ctx.fillStyle = me ? '#1f1f24' : '#ffffff'; ctx.fillText(text, 128, 33);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
  sprite.scale.set(1.1, .275, 1); sprite.renderOrder = 10;
  sprite.userData.dispose = () => { texture.dispose(); sprite.material.dispose(); };
  return sprite;
}

export function createPana(avatar, { seed = 1, name = '', me = false } = {}) {
  const look = normalizeAvatar(avatar);
  const character = buildCharacter(look);
  const root = new THREE.Group(), tilt = new THREE.Group();
  root.add(tilt); tilt.add(character.group);
  const arms = [character.armL, character.armR], base = arms.map(a => a.position.clone());
  const gloves = arms.map((arm, i) => {
    const glove = boxingGlove({ side: i ? -1 : 1 }); glove.scale.setScalar(1 / SCULPT);
    glove.position.set(0, -.86, .04); glove.visible = false; inkOutlines(glove); arm.add(glove); return glove;
  });
  const applyCombat = createCombatRig(character, gloves, base);
  // The wardrobe's kart helmet goes on to fight; the pana's own hat comes off.
  const ownHats = character.head.children.filter(o => o.name.startsWith('hat:'));
  const helmet = createAccessories(character, { hat: 'casco', glasses: null, neck: null, back: null, extras: {} });
  helmet.color('hat', 'casco', 'main', HELMET_COLORS[seed % HELMET_COLORS.length]);
  helmet.color('hat', 'casco', 'stripe', seed % HELMET_COLORS.length === 0 ? '#e8443a' : '#ffffff');
  let ownHeadwear = character.wardrobe.headwear, hatsShown = ownHats.map(o => o.visible);
  // A ¡! over a pana winding up a trompón: the cue to dodge.
  const warn = nameTag('¡OJO!', { me: true }); warn.scale.set(.7, .175, 1); warn.position.y = 2.95; warn.visible = false; root.add(warn);
  const tag = name ? nameTag(me ? `${name} · tú` : name, { me }) : null;
  if (tag) { tag.position.y = 2.6; root.add(tag); }
  let tagShown = true;
  let corner = null, wobble = 0, wobbleV = 0, sway = 0, swayV = 0, spin = 0, time = 0, shove = 0, cheer = 0, cheerWas = 0, twist = 0;
  let recoil = 0, recoilV = 0, jolt = 0;
  const pose = arms.map(() => ({ rx: -.04, rz: 0, s: 1, z: 0 })), bounce = seed * 1.7;
  const idle = rhythm(seed); // the crowd pana's own sway, seeded so peers agree
  // Each punch, block, taunt and win picks its own style when it starts, so
  // a fight is never the same move twice: jabs alternate hands as rectos,
  // ganchos or uppers, the trompón is a volado, an upper or a molino.
  let move = {}, lastAct = '', lastAt = 0, jabs = 0;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  function startMove(act, previous) {
    if (act === 'jab') move = { hand: ++jabs % 2, style: pick(['recto', 'recto', 'gancho', 'upper']) };
    else if (act === 'wind' || (act === 'trompon' && previous !== 'wind')) move = { hand: Math.random() < .7 ? 1 : 0, style: pick(['recto', 'gancho', 'upper']) };
    else if (act === 'block') move = { style: pick(['alta', 'cruz', 'concha']) };
    else if (act === 'taunt') move = { style: pick(['ven', 'baile', 'pecho']) };
    else if (act === 'win') move = { style: pick(['arriba', 'flex', 'baile']) };
  }

  function setCorner(next) {
    if (next === corner) return;
    corner = next;
    for (const glove of gloves) {
      glove.visible = !!corner;
      if (corner) glove.traverse(o => { if (o.isMesh && o.material.roughness < .35) o.material.color.set(CORNER_COLORS[corner]); });
    }
    helmet.show('hat', corner ? 'casco' : 'none');
    if (corner) { ownHeadwear = character.wardrobe.headwear; hatsShown = ownHats.map(o => o.visible); character.wardrobe.setHeadwear('none'); ownHats.forEach(o => { o.visible = false; }); }
    else { character.wardrobe.setHeadwear(ownHeadwear); ownHats.forEach((o, i) => { o.visible = hatsShown[i]; }); }
  }

  // An impulse from a hit: the head snaps back, the body sways and twists
  // away, a different way every time. The engine character adds a decaying
  // spine/head stagger toward the hit's side when it has one.
  function hit(power = 1, spinning = false, dir = 0) {
    wobbleV -= (4 + Math.random() * 5) * power; swayV += (Math.random() - .5) * 7 * power;
    recoilV += (Math.random() < .5 ? -1 : 1) * (3 + Math.random() * 3) * power;
    if (spinning) spin = .3; // A brief recoil, keeping the fighter facing the opponent.
    character.stagger?.(power, dir);
  }
  // A punch landing on the guard knocks the gloves back into the face.
  const blocked = () => { jolt = 1; wobbleV -= 2; };
  const doShove = () => { shove = .35; };
  const doCheer = () => { cheer = 1.4; };

  // view: { act, at, moving, dodgeDir, guard } from the fight body, or a crowd pana.
  function update(dt, view = {}) {
    dt = Math.min(.1, Math.max(0, dt));
    time += dt;
    const act = view.act || 'crowd', at = view.at || 0;
    if (act !== lastAct || at + 1e-4 < lastAt) startMove(act, lastAct);
    if (Number.isInteger(view.motion) && ['jab', 'wind', 'trompon'].includes(act)) {
      move = { style: ['recto', 'gancho', 'upper'][(Math.abs(seed) + view.motion) % 3], hand: view.motion % 2 };
    }
    lastAct = act; lastAt = at;
    character.update(dt, { walk: (view.moving || 0) > .4 ? 1 : 0, dizzy: act === 'dizzy' || act === 'down', open: ['taunt', 'win', 'trompon', 'stun', 'kick', 'sweep', 'toss', 'tumble'].includes(act) || cheer > 0 });
    // Springs: head rock and body sway.
    // Integrate small steps so low frame rates cannot amplify a hit into a spin.
    for (let left = dt; left > 0;) {
      const step = Math.min(left, 1 / 120); left -= step;
      wobbleV += (-wobble * 90 - wobbleV * 9) * step; wobble += wobbleV * step;
      swayV += (-sway * 60 - swayV * 7) * step; sway += swayV * step;
      recoilV += (-recoil * 70 - recoilV * 8) * step; recoil += recoilV * step;
    }
    spin = Math.max(0, spin - dt * 14); jolt = Math.max(0, jolt - dt * 5);
    shove = Math.max(0, shove - dt); cheer = Math.max(0, cheer - dt);
    if (cheer === 0 && cheerWas > 0) character.bounce?.(.7); // landing after the hop
    cheerWas = cheer;
    const targets = armTargets(act, at, view);
    const k = 1 - Math.exp(-dt * (['jab', 'trompon', 'grab'].includes(act) ? 30 : 14));
    arms.forEach((arm, i) => {
      const p = pose[i], t = targets[i];
      p.rx = ease(p.rx, t.rx, k); p.rz = ease(p.rz, t.rz, k); p.s = ease(p.s, t.s, k); p.z = ease(p.z, t.z ?? 0, k);
      arm.rotation.set(p.rx, 0, p.rz); arm.scale.y = p.s;
      arm.position.copy(base[i]); arm.position.z += p.z;
      gloves[i].scale.set(1 / SCULPT, 1 / SCULPT / p.s, 1 / SCULPT);
    });
    // The body: twist into punches, crouch to block or dodge, flop when down.
    const b = character.body, kb = 1 - Math.exp(-dt * 12);
    let twistTo = 0, crouch = 0, leanX = 0, leanZ = 0, fall = 0, lift = 0;
    const hand = move.hand ? 1 : -1, style = move.style;
    if (act === 'idle') crouch = -Math.abs(Math.sin(time * 5.5 + bounce)) * .035;
    if (act === 'jab') {
      twistTo = -hand * (style === 'gancho' ? .5 : .3) * Math.sin(Math.min(1, at / T.jab.total) * Math.PI);
      if (style === 'upper') { crouch = at < .06 ? -.1 : 0; leanX = at < .06 ? .1 : -.06; }
    }
    if (act === 'wind') {
      if (style === 'upper') { twistTo = hand * .3; crouch = -.24; leanX = .12; }
      else if (style === 'molino') { twistTo = hand * (.3 + Math.sin(time * 15) * .15); leanX = -.05; }
      else { twistTo = hand * .55; leanX = -.08; }
    }
    if (act === 'trompon') {
      if (style === 'upper') { twistTo = -hand * .4; crouch = .1 * Math.max(0, 1 - at / .3); leanX = -.14; }
      else if (style === 'molino') { twistTo = -hand * .5; leanX = .32; }
      else { twistTo = -hand * .7; leanX = .2; }
    }
    if (act === 'block') {
      if (style === 'cruz') { crouch = -.06; leanX = .08; }
      else if (style === 'concha') { crouch = -.2; leanX = .22; twistTo = Math.sin(time * 4) * .12; }
      else { crouch = -.12; leanX = .12; }
      leanX -= jolt * .2;
    }
    if (act === 'grab') leanX = .3;
    if (act === 'dodge') { leanZ = (view.dodgeDir || 0) * -.55; crouch = view.dodgeDir ? -.08 : -.4; }
    if (act === 'stun') leanX = -.3 * Math.max(0, 1 - at * 2);
    if (act === 'open') leanX = .35;
    if (act === 'dizzy') { leanZ = Math.sin(time * 5) * .25; leanX = Math.sin(time * 3.3) * .12; }
    if (act === 'taunt') {
      crouch = -Math.abs(Math.sin(time * 9)) * .08;
      if (style === 'baile') twistTo = Math.sin(time * 8) * .4;
      if (style === 'pecho') leanX = -.12;
    }
    if (act === 'win') {
      crouch = Math.abs(Math.sin(time * 6)) * .2;
      if (style === 'flex') twistTo = Math.sin(time * 3) * .35;
      if (style === 'baile') { twistTo = Math.sin(time * 8) * .35; leanZ = Math.sin(time * 8) * .12; }
    }
    if (act === 'down') { fall = .62; lift = .12; }
    if (act === 'rise') { fall = .62 * Math.max(0, 1 - at / (T.rise * .8)); lift = .12 * fall / .62; }
    if (act === 'crowd' && cheer > 0) crouch = Math.abs(Math.sin(time * 10)) * .12;
    // Off-beat idle: each crowd pana sways and shifts weight on its own rhythm.
    if (act === 'crowd' && cheer <= 0) { leanZ = Math.sin(time * idle.pace + idle.phase) * .045; leanX = Math.sin(time * idle.pace * .53 + idle.shift) * .03; }
    twist = ease(twist, twistTo, kb);
    b.rotation.y = twist + recoil * .12; b.rotation.x = ease(b.rotation.x, leanX, kb) + sway * .05;
    b.rotation.z = ease(b.rotation.z, leanZ, kb) + sway * .1;
    b.position.y = ease(b.position.y, crouch / SCULPT, kb);
    tilt.rotation.x = ease(tilt.rotation.x, -fall * 1.5, 1 - Math.exp(-dt * (fall ? 9 : 5)));
    tilt.position.y = ease(tilt.position.y, lift, kb);
    character.neck.rotation.x = THREE.MathUtils.clamp(wobble * .5, -.35, .35); character.neck.rotation.z = THREE.MathUtils.clamp(sway * .3, -.2, .2);
    character.group.rotation.y = spin;
    const authored = view.holding ? null : combatPose(act, at, { ...move, windDuration: T.wind, tumbleKind: view.tumbleKind, stun: view.stun });
    if (authored && act === 'idle') {
      authored['body.y'] += Math.abs(Math.sin(time * 5.4 + bounce)) * .045;
      authored['armL.rx'] += Math.sin(time * 10.8 + bounce) * .04;
    }
    applyCombat(authored, view.moving || 0);
    if (tag) tag.visible = tagShown && act !== 'down';
    warn.visible = act === 'wind' || (['kick', 'sweep', 'toss'].includes(act) && at < T[act].active[0]); if (warn.visible) warn.scale.set(.7 + Math.sin(time * 30) * .06, .175, 1);
  }

  function armTargets(act, at, view) {
    // Left arm (0) turns inward with negative rz, the right arm (1) positive.
    const inward = (k) => (k ? 1 : -1), sign = (k) => -inward(k);
    // The head is huge: guards sit in front of the chin, arms stretched
    // forward, the fists bobbing with the bounce.
    const bob = act === 'idle' ? Math.sin(time * 5.5 + bounce) * .06 : 0;
    const guard = (k) => ({ rx: -1.85 + bob * sign(k), rz: inward(k) * .3, s: 1.15, z: .15 });
    const cover = (k) => ({ rx: -1.97, rz: inward(k) * .42, s: 1.1, z: .1 });
    const out = [guard(0), guard(1)];
    const style = move.style, i = move.hand ?? 1, o = 1 - i;
    if (act === 'crowd' || act === 'idle-crowd') {
      const pump = cheer > 0;
      for (const k of [0, 1]) out[k] = pump ? { rx: -2.7 + Math.sin(time * 12 + k * 3) * .35, rz: sign(k) * .3, s: 1 } : { rx: -.05, rz: sign(k) * .4, s: 1 };
      if (shove > 0) for (const k of [0, 1]) out[k] = { rx: -1.55, rz: inward(k) * .15, s: 1.3, z: .2 };
      return out;
    }
    if (act === 'jab') {
      const p = attackExtension('jab', at);
      out[o] = cover(o);
      if (style === 'gancho') out[i] = { rx: ease(-1.85, -1.5, p), rz: inward(i) * ease(-.4, .95, p), s: 1.15 + .35 * p, z: .15 + .15 * p };
      else if (style === 'upper') out[i] = at < .05 ? { rx: -1.05, rz: inward(i) * .2, s: 1.05, z: .05 } : { rx: ease(-1.2, -2.45, p), rz: inward(i) * .15, s: 1.15 + .35 * p, z: .15 + .1 * p };
      else out[i] = { rx: ease(-1.85, -1.6, p), rz: inward(i) * ease(.3, .06, p), s: 1.15 + .55 * p, z: .15 + .2 * p };
    }
    if (act === 'wind') {
      out[o] = cover(o);
      if (style === 'upper') out[i] = { rx: .25 + Math.sin(time * 46) * .1, rz: inward(i) * .1, s: .95, z: -.1 };
      else if (style === 'molino') out[i] = { rx: -1 + Math.sin(time * 15) * 1.9, rz: -inward(i) * .5, s: 1 };
      else out[i] = { rx: .75 + Math.sin(time * 46) * .14, rz: -inward(i) * .95, s: 1 };
    }
    if (act === 'trompon') {
      const p = attackExtension('trompon', at);
      out[o] = cover(o);
      if (style === 'upper') out[i] = { rx: ease(.2, -2.65, p), rz: inward(i) * .1, s: 1 + .9 * p, z: .3 * p };
      else if (style === 'molino') out[i] = { rx: ease(-3.2, -1.5, p), rz: inward(i) * .2, s: 1 + .8 * p, z: .3 * p };
      else out[i] = { rx: ease(.6, -1.58, p), rz: inward(i) * ease(-.9, .3, p), s: 1 + .85 * p, z: .35 * p };
    }
    // Cubrirse: gloves together at the muzzle (alta), forearms crossed (cruz)
    // or tucked in a shell beside the cheeks (concha).
    if (act === 'block') {
      for (const k of [0, 1]) {
        if (style === 'cruz') out[k] = { rx: k ? -2.2 : -1.5, rz: inward(k) * 1.05, s: 1.3, z: k ? .34 : .28 };
        else if (style === 'concha') out[k] = { rx: -2.3, rz: inward(k) * .2, s: 1.05, z: .12 };
        else out[k] = { rx: -2.02, rz: inward(k) * .6, s: 1.28, z: .3 };
        out[k].rx += jolt * .35; out[k].z -= jolt * .15;
      }
    }
    if (act === 'grab') {
      const p = attackExtension('grab', at);
      for (const k of [0, 1]) out[k] = { rx: -1.55, rz: inward(k) * ease(.1, -.15, p), s: 1 + .45 * p, z: .25 * p };
    }
    if (act === 'stun' || act === 'open') for (const k of [0, 1]) out[k] = { rx: -.7 + Math.sin(time * 18 + k) * .3, rz: sign(k) * 1.1, s: 1 };
    if (act === 'dizzy') for (const k of [0, 1]) out[k] = { rx: -.25 + Math.sin(time * 4 + k * 2) * .25, rz: sign(k) * .55, s: 1 };
    if (act === 'down' || act === 'rise') for (const k of [0, 1]) out[k] = { rx: -.4, rz: sign(k) * 1.5, s: 1 };
    if (act === 'taunt') for (const k of [0, 1]) {
      if (style === 'baile') out[k] = { rx: -1.4 + Math.sin(time * 10 + k * Math.PI) * .6, rz: sign(k) * .5, s: 1.05 };
      else if (style === 'pecho') out[k] = { rx: -1.25 - Math.max(0, Math.sin(time * 9 + k * Math.PI)) * .4, rz: inward(k) * 1.1, s: .9, z: .1 };
      else out[k] = { rx: -1.8, rz: inward(k) * (.25 + Math.max(0, Math.sin(time * 14)) * .35), s: 1.05, z: .15 };
    }
    if (act === 'win') for (const k of [0, 1]) {
      if (style === 'flex') out[k] = { rx: -2.55, rz: sign(k) * 1.2, s: .95 };
      else if (style === 'baile') out[k] = { rx: -2.8 + Math.sin(time * 8 + k * Math.PI) * .5, rz: sign(k) * .4, s: 1.05 };
      else out[k] = { rx: -3.05, rz: sign(k) * .25, s: 1.05 };
    }
    if (view.holding && ['idle', 'block', 'bench'].includes(act)) for (const k of [0, 1]) out[k] = { rx: -1.75, rz: inward(k) * .35, s: 1.05, z: .15 };
    if (act === 'throw') { const p = Math.min(1, at / .15); for (const k of [0, 1]) out[k] = { rx: ease(-2.9, -1.3, p), rz: inward(k) * .2, s: 1.2, z: .2 }; }
    if (act === 'hug') for (const k of [0, 1]) out[k] = { rx: -1.6, rz: inward(k) * .6, s: 1.1, z: .2 };
    return out;
  }

  function dispose() {
    gloves.forEach(g => g.userData.dispose()); helmet.dispose(); tag?.userData.dispose(); warn.userData.dispose();
    character.dispose(); root.removeFromParent();
  }
  return { root, character, update, setCorner, showTag: (on) => { tagShown = on; }, hit, blocked, shove: doShove, cheer: doCheer, dispose, get corner() { return corner; } };
}
