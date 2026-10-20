// A pana in Trifulca: the player's own character with the corner's gloves and
// a moto helmet when fighting, posed from the fight state (guard, jab,
// trompón windup, block, dodge, dizzy, the flop of a caída) and a springy
// head that rocks on every hit. Crowd panas cheer and shove.
import * as THREE from 'three';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar } from '/engine/avatar.js';
import { boxingGlove, motoHelmet, CORNER_COLORS, HELMET_COLORS } from './set.js';
import { T } from './fight-rules.js';

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
    glove.position.set(0, -.86, .04); glove.visible = false; arm.add(glove); return glove;
  });
  const helmet = motoHelmet({ color: HELMET_COLORS[seed % HELMET_COLORS.length] });
  helmet.scale.setScalar(1 / SCULPT * 1.04); helmet.position.set(0, .06, 0); helmet.visible = false; character.head.add(helmet);
  // A ¡! over a pana winding up a trompón: the cue to dodge.
  const warn = nameTag('¡OJO!', { me: true }); warn.scale.set(.7, .175, 1); warn.position.y = 2.95; warn.visible = false; root.add(warn);
  const tag = name ? nameTag(me ? `${name} · tú` : name, { me }) : null;
  if (tag) { tag.position.y = 2.6; root.add(tag); }
  let tagShown = true;
  let corner = null, wobble = 0, wobbleV = 0, sway = 0, swayV = 0, spin = 0, time = 0, shove = 0, cheer = 0, twist = 0;
  const pose = arms.map(() => ({ rx: -.04, rz: 0, s: 1, z: 0 }));

  function setCorner(next) {
    if (next === corner) return;
    corner = next;
    for (const glove of gloves) {
      glove.visible = !!corner;
      if (corner) glove.traverse(o => { if (o.isMesh && o.material.roughness < .35) o.material.color.set(CORNER_COLORS[corner]); });
    }
    helmet.visible = !!corner;
  }

  // An impulse from a hit: the head snaps back and the body sways.
  function hit(power = 1, spinning = false) {
    wobbleV -= 7 * power; swayV += (Math.random() - .5) * 6 * power;
    if (spinning) spin = Math.PI * 2;
  }
  const doShove = () => { shove = .35; };
  const doCheer = () => { cheer = 1.4; };

  // view: { act, at, moving, dodgeDir, guard } from the fight body, or a crowd pana.
  function update(dt, view = {}) {
    time += dt;
    const act = view.act || 'crowd', at = view.at || 0;
    character.update(dt, { walk: (view.moving || 0) > .4 ? 1 : 0, dizzy: act === 'dizzy' || act === 'down', open: ['taunt', 'win', 'trompon', 'stun'].includes(act) || cheer > 0 });
    // Springs: head rock and body sway.
    wobbleV += (-wobble * 90 - wobbleV * 9) * dt; wobble += wobbleV * dt;
    swayV += (-sway * 60 - swayV * 7) * dt; sway += swayV * dt;
    spin = Math.max(0, spin - dt * 14);
    shove = Math.max(0, shove - dt); cheer = Math.max(0, cheer - dt);
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
    if (act === 'jab') twistTo = -.3 * Math.sin(Math.min(1, at / T.jab.total) * Math.PI);
    if (act === 'wind') { twistTo = -.55; leanX = -.08; }
    if (act === 'trompon') { twistTo = .7; leanX = .2; }
    if (act === 'block') { crouch = -.12; leanX = .12; }
    if (act === 'grab') leanX = .3;
    if (act === 'dodge') { leanZ = (view.dodgeDir || 0) * -.55; crouch = view.dodgeDir ? -.08 : -.4; }
    if (act === 'stun') leanX = -.3 * Math.max(0, 1 - at * 2);
    if (act === 'open') leanX = .35;
    if (act === 'dizzy') { leanZ = Math.sin(time * 5) * .25; leanX = Math.sin(time * 3.3) * .12; }
    if (act === 'taunt') crouch = -Math.abs(Math.sin(time * 9)) * .08;
    if (act === 'win') crouch = Math.abs(Math.sin(time * 6)) * .2;
    if (act === 'down') { fall = .62; lift = .12; }
    if (act === 'rise') { fall = .62 * Math.max(0, 1 - at / (T.rise * .8)); lift = .12 * fall / .62; }
    if (act === 'crowd' && cheer > 0) crouch = Math.abs(Math.sin(time * 10)) * .12;
    twist = ease(twist, twistTo, kb);
    b.rotation.y = twist; b.rotation.x = ease(b.rotation.x, leanX, kb) + sway * .05;
    b.rotation.z = ease(b.rotation.z, leanZ, kb) + sway * .1;
    b.position.y = ease(b.position.y, crouch / SCULPT, kb);
    tilt.rotation.x = ease(tilt.rotation.x, -fall * 1.5, 1 - Math.exp(-dt * (fall ? 9 : 5)));
    tilt.position.y = ease(tilt.position.y, lift, kb);
    character.neck.rotation.x = wobble * .5; character.neck.rotation.z = sway * .3;
    character.group.rotation.y = spin;
    if (tag) tag.visible = tagShown && act !== 'down';
    warn.visible = act === 'wind'; if (warn.visible) warn.scale.set(.7 + Math.sin(time * 30) * .06, .175, 1);
  }

  function armTargets(act, at, view) {
    const guard = (i) => ({ rx: -2.15, rz: (i ? 1 : -1) * .38, s: 1 });
    const out = [guard(0), guard(1)];
    const sign = (i) => (i ? -1 : 1);
    if (act === 'crowd' || act === 'idle-crowd') {
      const pump = cheer > 0;
      for (const i of [0, 1]) out[i] = pump ? { rx: -2.7 + Math.sin(time * 12 + i * 3) * .35, rz: sign(i) * .3, s: 1 } : { rx: -.05, rz: sign(i) * .4, s: 1 };
      if (shove > 0) for (const i of [0, 1]) out[i] = { rx: -1.55, rz: -sign(i) * .15, s: 1.3, z: .2 };
      return out;
    }
    if (act === 'jab') {
      const p = at < .1 ? at / .1 : at < .2 ? 1 : Math.max(0, 1 - (at - .2) / .16);
      out[0] = { rx: ease(-2.15, -1.62, p), rz: ease(-.38, -.08, p), s: 1 + .6 * p, z: .3 * p };
    }
    if (act === 'wind') out[1] = { rx: .75 + Math.sin(time * 46) * .14, rz: -.95, s: 1 };
    if (act === 'trompon') {
      const p = at < .12 ? at / .12 : Math.max(0, 1 - (at - .12) / .3);
      out[1] = { rx: ease(.6, -1.58, p), rz: ease(-.9, .3, p), s: 1 + .85 * p, z: .35 * p };
    }
    if (act === 'block') for (const i of [0, 1]) out[i] = { rx: -2.6, rz: -sign(i) * .62, s: .9 };
    if (act === 'grab') {
      const p = Math.min(1, at / .14);
      for (const i of [0, 1]) out[i] = { rx: -1.55, rz: -sign(i) * ease(.1, -.15, p), s: 1 + .45 * p, z: .25 * p };
    }
    if (act === 'stun' || act === 'open') for (const i of [0, 1]) out[i] = { rx: -.7 + Math.sin(time * 18 + i) * .3, rz: sign(i) * 1.1, s: 1 };
    if (act === 'dizzy') for (const i of [0, 1]) out[i] = { rx: -.25 + Math.sin(time * 4 + i * 2) * .25, rz: sign(i) * .55, s: 1 };
    if (act === 'down' || act === 'rise') for (const i of [0, 1]) out[i] = { rx: -.4, rz: sign(i) * 1.5, s: 1 };
    if (act === 'taunt') for (const i of [0, 1]) out[i] = { rx: -1.95, rz: -sign(i) * (.25 + Math.max(0, Math.sin(time * 14)) * .35), s: 1.05, z: .15 };
    if (act === 'win') for (const i of [0, 1]) out[i] = { rx: -3.05, rz: sign(i) * .25, s: 1.05 };
    if (view.holding && ['idle', 'block', 'bench'].includes(act)) for (const i of [0, 1]) out[i] = { rx: -1.75, rz: -sign(i) * .35, s: 1.05, z: .15 };
    if (act === 'throw') { const p = Math.min(1, at / .15); for (const i of [0, 1]) out[i] = { rx: ease(-2.9, -1.3, p), rz: -sign(i) * .2, s: 1.2, z: .2 }; }
    if (act === 'hug') for (const i of [0, 1]) out[i] = { rx: -1.6, rz: -sign(i) * .6, s: 1.1, z: .2 };
    return out;
  }

  function dispose() {
    gloves.forEach(g => g.userData.dispose()); helmet.userData.dispose(); tag?.userData.dispose(); warn.userData.dispose();
    character.dispose(); root.removeFromParent();
  }
  return { root, character, update, setCorner, showTag: (on) => { tagShown = on; }, hit, shove: doShove, cheer: doCheer, dispose, get corner() { return corner; } };
}
