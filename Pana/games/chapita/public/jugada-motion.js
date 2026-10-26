// The jugadas locas in motion, adapted from the Studio workbench to the real
// street: the host picks one (jugadas.js), every screen starts it when it
// first sees it, and sample(a) poses the panas, the props, the cap and the
// effects for second `a` of it. Everything is cosmetic: positions the rules
// own (bases, runners, the score) never change, and stop() puts every pana,
// palo and prop back the way the scene left them. Studio's previews sample
// this same code (studio-preview.js), so what you tune there is what plays.
import * as THREE from 'three';
import { createChapita, createPalo, createTuyuyo, createPaloPartido, createPerro, createBolaDePaja, PALO_BREAK } from './studio-set.js';
import { hsh } from './jugada-fx.js';
import { JUGADAS } from './jugadas.js';
import { loc } from '/engine/i18n.js';

const V3 = THREE.Vector3;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = x => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeOut = x => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = x => { x = clamp01(x); return x * x * x; };
const elasticOut = x => { x = clamp01(x); return x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - .75) * 2 * Math.PI / 3) + 1; };
const pulse = (t, a, b, c) => t < b ? smooth((t - a) / (b - a)) : 1 - smooth((t - b) / (c - b));
const lerp = THREE.MathUtils.lerp, clampTo = THREE.MathUtils.clamp;
const up = (p, y) => p.clone().add(new V3(0, y, 0));
const arc = (from, to, q, h) => { const p = from.clone().lerp(to, q); p.y += Math.sin(q * Math.PI) * h; return p; };
// A bouncing, damped flight from p with velocity v after tau seconds.
function ballistic(p0, v0, tau, { g = 9.8, ground = .06, rest = .45 } = {}) {
  const p = p0.clone(), v = v0.clone(); let t = 0;
  while (t < tau) { const s = Math.min(1 / 90, tau - t); v.y -= g * s; p.addScaledVector(v, s); if (p.y < ground) { p.y = ground; v.y = Math.abs(v.y) * rest; v.x *= .7; v.z *= .7; } t += s; }
  return p;
}

// How long each jugada runs on screen (seconds); dance loops until the end screen goes.
export const DURATION = { hit: .9, swing: .4, miss: 2.2, helicopter: 2.4, pitch: 1.3, argue: 2.4, slip: 2.1, boomerang: 2.1,
  bean: 2.2, window: 2.4, catch: 2, broken: 1.6, home: 3, dog: 2.6, roof: 2.6, drain: 2.5, pinball: 2.8, grandpa: 2.7,
  car: 3.4, dinner: 4.2, dance: Infinity };

// root: where temporary props go. fx: createJugadaFx. sfx(name): a sound.
export function createJugadas(root, { fx, sfx = () => {}, k = .6 } = {}) {
  const props = new THREE.Group(); props.name = 'Jugadas · utilería'; root.add(props);   // i18n-ignore: object name
  const touched = new Map();   // character → what to restore
  let id = null, c = null, last = -1, shake = 0, cap = null, hideCap = false, shot = null;
  const temp = [];             // props built for this jugada, freed on stop
  const tips = [];             // the swing's palo tip, for the smear

  function own(object) { props.add(object); temp.push(object); return object; }
  function keep(ch) {
    if (!ch || touched.has(ch)) return ch;
    touched.set(ch, { expression: ch.mouth?.expression || 'natural', eyes: ch.eyes.map(e => e.rotation.z), visible: ch.group.visible });
    return ch;
  }
  function restore() {
    for (const [ch, was] of touched) {
      ch.body.rotation.set(0, 0, 0); ch.body.position.set(0, 0, 0); ch.head.rotation.set(0, 0, 0);
      ch.eyes.forEach((e, i) => { e.rotation.z = was.eyes[i]; e.scale.x = e.scale.z = 1; });
      ch.setExpression?.(was.expression, { immediate: true }); ch.group.visible = was.visible;
    }
    touched.clear();
  }

  // ---------- pose helpers (pana units, so offsets scale with k) ----------
  function face(ch, { open = 1, size = 1, mouth = 'natural', spin = 0 } = {}) {
    if (!ch) return; const was = keep(ch) && touched.get(ch);
    if (ch.mouth?.expression !== mouth) ch.setExpression(mouth, { immediate: true });
    ch.eyes.forEach((e, i) => { e.scale.set(size, size * Math.max(.06, open) * (ch.mouth?.eyeScale ?? 1), size); e.rotation.z = was.eyes[i] + spin * (i ? -1 : 1); });
  }
  const talk = (ch, speed = 16, a = 0) => Math.sin(a * speed + (ch.seed || 1) * 5) > 0 ? 'talk' : 'natural';
  const headTop = (ch, y = 1.3) => ch.head.localToWorld(new V3(0, y, 0));
  const tip = ch => ch.armR.localToWorld(new V3(0, -.86, 0));
  const watch = (ch, target) => { ch.group.updateMatrixWorld(true); const local = ch.group.worldToLocal(target.clone()); return Math.atan2(local.x, local.z); };
  const look = (ch, target, limit = 1.2) => { if (ch) ch.head.rotation.y = clampTo(watch(ch, target), -limit, limit); };
  function dizzy(ch, a, n = 3, color = '#ffd23f') {
    const top = headTop(ch, 1.15);
    for (let j = 0; j < n; j++) { const an = a * 4 + j * Math.PI * 2 / n; fx.star(top.clone().add(new V3(Math.cos(an) * .55 * k, Math.sin(an * 2) * .06 * k, Math.sin(an) * .55 * k)), .22, an, 1, color); }
  }
  function runCycle(ch, ph, amp = 1) {
    ch.legs.forEach((l, i) => { l.rotation.x = Math.sin(ph + i * Math.PI) * .8 * amp; });
    ch.arms.forEach((arm, i) => arm.rotation.set(-Math.sin(ph + i * Math.PI) * .9 * amp, 0, i ? -.35 : .35));
    ch.body.position.y = Math.abs(Math.sin(ph)) * .09 * amp; ch.body.rotation.x = .12 * amp;
  }
  // Run from → to between seconds a0 and a1; returns progress 0–1.
  function travel(ch, from, to, a0, a1, a, { arms = true } = {}) {
    if (!ch || a < a0) return 0; keep(ch);
    const q = clamp01((a - a0) / (a1 - a0)); ch.group.position.copy(from).lerp(to, smooth(q));
    if (q < 1) {
      ch.group.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
      if (arms) runCycle(ch, a * 14); else { ch.legs.forEach((l, i) => { l.rotation.x = Math.sin(a * 14 + i * Math.PI) * .8; }); ch.body.position.y = Math.abs(Math.sin(a * 14)) * .09; }
      fx.puff(ch.group.position.clone().setY(.12), .35, .35);
    }
    return q;
  }
  function armsUp(ch, a, wave = .15) { ch.arms.forEach((arm, i) => arm.rotation.set(-2.9 + Math.sin(a * 10 + i) * wave, 0, i ? -.25 : .25)); }
  function handsOnHead(ch) { ch.arms.forEach((arm, i) => arm.rotation.set(-2.7, 0, i ? -1.05 : 1.05)); }
  function sitDown(ch, s) { ch.body.position.y -= .55 * s; ch.legs.forEach(l => { l.rotation.x = -1.35 * s; }); ch.body.rotation.x -= .22 * s; }
  function bump(ch, a) {
    // A tuyuyo grows on the forehead, the same model the scene keeps after.
    let t = temp.find(o => o.userData.on === ch);
    if (!t) { t = createTuyuyo({ size: .16 }); t.userData.on = ch; ch.head.add(t); temp.push(t); }
    t.position.set(0, .62, .95); t.rotation.set(1, 0, 0); t.scale.setScalar(Math.max(.01, elasticOut(a / .7)) * 1.8);
  }
  const feet = ch => ch.group.position.clone().setY(.03);
  const shakeBy = (amount, a, rate = 8) => { if (a >= 0 && a < .6) shake += amount * Math.exp(-a * rate); };

  // ---------- the jugadas ----------
  const PLAYS = {
    // Every contact: the flash, the stars and ¡PRAAA!
    hit(a) {
      const big = c.big; c.cue('hit', 0);
      fx.flash(c.contact, a, big ? 2.4 : 1.7); fx.burst(c.contact, a, { count: big ? 16 : 11, radius: big ? 2 : 1.4, multi: big });
      fx.dust(feet(c.batter), a, { count: 10, size: .5, spread: 1.1, seed: 3 }); shakeBy(big ? .16 : .09, a);
      fx.text(loc('¡PRAAA!'), '#ffd23f', up(c.contact, 1.3 * k), a, { life: 1.3, size: 1.3 });
      face(c.batter, { open: a < .25 ? .4 : 1, mouth: a > .3 ? 'smile' : 'natural' });
      const now = c.capNow(); if (c.pitcher && now) { keep(c.pitcher); look(c.pitcher, now); face(c.pitcher, { open: 1.3, size: 1.15, mouth: 'talk' }); }
    },
    // Every swing: the palo's white smear.
    swing(a) {
      c.cue('swoosh', 0); if (!c.palo?.visible) return;
      tips.push(c.palo.localToWorld(new V3(0, 1.2, 0))); if (tips.length > 7) tips.shift();
      if (a < .3) tips.forEach((p, i) => fx.puff(p, .25 - (tips.length - i) * .025, .45 - (tips.length - i) * .06, '#ffffff'));
    },
    // Strikeout swinging: a spin, onto the floor, stars around the head.
    miss(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('strike', 0); c.cue('land', .38);
      const sp = easeOut(a / .38), sit = smooth((a - .19) / .26);
      b.body.rotation.y = Math.PI * 1.7 * sp; sitDown(b, sit);
      if (a > .38) { dizzy(b, a); face(b, { open: .9, spin: a * 8, mouth: 'talk' }); fx.dust(feet(b), a - .38, { count: 10, size: .5, spread: 1.1, seed: 5 }); }
      if (p) { p.armR.rotation.set(-2.9 + Math.max(0, Math.sin(a * 12)) * .4, 0, -.2); p.group.position.y += Math.abs(Math.sin(a * 6)) * .12 * k * Math.max(0, 1 - a / 1.5); face(p, { open: .4, mouth: 'laugh' }); }
      fx.text(loc('¡PONCHAO!'), '#ff5a3c', up(headTop(b), .5 * k), a - .3, { hold: true, size: 1.5 });
    },
    // Strikeout swinging, the other way: the swing lifts the pana off the floor.
    helicopter(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('bigSwoosh', 0); c.cue('whirr', .13); c.cue('whirr', .38); c.cue('land', .74);
      const lift = a < .58 ? smooth((a - .13) / .3) : 1 - easeIn((a - .58) / .16), home = feet(b);
      b.body.rotation.y = a < .74 ? a * a * 6 + a * 4 : 0; b.group.position.y += 1.5 * k * lift;
      if (a < .74) { face(b, { open: .4, mouth: 'smile' }); for (let j = 0; j < 8; j++) { const an = a * 9 + j * Math.PI / 4; fx.puff(home.clone().add(new V3(Math.cos(an) * 1.4 * k, .12, Math.sin(an) * 1.4 * k)), .5, .35 * lift + .1, '#efe4d0'); } }
      fx.text(loc('¡HELICÓPTERO!'), '#7cd8ff', up(home, 3.9 * k), a - .2, { life: 1.6, size: 1.1 });
      if (p) { p.head.rotation.x = -.35 * lift; face(p, { open: 1.5, size: 1.25, mouth: 'smile' }); }
      if (a > .74) { sitDown(b, smooth((a - .74) / .1)); dizzy(b, a); face(b, { open: .9, spin: a * 8, mouth: 'talk' }); fx.dust(home, a - .74, { count: 12, size: .5, spread: 1.2, seed: 12 }); shakeBy(.06, a - .74, 9); }
    },
    // Strike looking.
    pitch(a) {
      c.cue('strike', 0); fx.text(loc('¡STRIKE!'), '#ffffff', up(headTop(c.batter), .7 * k), a, { life: 1.3, size: 1.1 });
      if (c.pitcher) face(keep(c.pitcher), { open: .5, mouth: 'smile' });
    },
    // ¡Strike! ¡Bola! Both shouting, waving the palo.
    argue(a) {
      const p = keep(c.pitcher), b = keep(c.batter); c.cue('strike', 0);
      const lean = .15 * smooth(a / .3);
      if (p) { p.body.rotation.x += lean; p.armR.rotation.set(-1.6 + Math.sin(a * 10) * .35, 0, -.25); p.armL.rotation.set(-.4, 0, 1 + Math.sin(a * 7) * .3); face(p, { open: .6, mouth: talk(p, 18, a) }); }
      b.body.rotation.x += lean; b.armR.rotation.x += Math.sin(a * 9) * .25; face(b, { open: .6, mouth: talk(b, 17, a) }); b.group.position.y += Math.abs(Math.sin(a * 9)) * .05 * k;
      [[0, loc('¡STRIKE!'), '#7cd8ff', p || b], [.42, loc('¡BOLA!'), '#ff6b5a', b], [.84, loc('¡STRIKE!'), '#7cd8ff', p || b], [1.2, loc('¡QUE FUE BOLA!'), '#ff6b5a', b]].forEach(([o, s, color, ch], j) => {
        fx.text(s, color, up(headTop(ch), (.25 + j * .05) * k), a - o, { life: .6, size: .9 + j * .12, tilt: j % 2 ? .12 : -.12 }); c.cue('pop', o);
      });
    },
    // The palo slips out of the hands and flies at the pitcher.
    slip(a) {
      const b = keep(c.batter), p = keep(c.pitcher), loose = prop('loose', () => createPalo({ kind: c.paloKind }), 1.35 * k);
      c.cue('whirr', 0); c.cue('land', .83); c.cue('yell', .9);
      if (c.palo) c.palo.visible = false;
      const start = c.palo ? c.palo.getWorldPosition(new V3()) : up(feet(b), 1.2), end = (c.pitcherHome || c.contact).clone().add(new V3(.4, .04, -2.4)), q = clamp01(a / .83);
      if (a < .83) { const pos = arc(start, end, q, 2.6); loose.position.copy(pos); loose.rotation.set(Math.PI / 2, 0, 0); loose.rotateOnWorldAxis(new V3(0, 1, 0), q * 40); }
      else { loose.position.copy(end); loose.position.y += Math.abs(Math.sin((a - .83) * 14)) * .1 * Math.exp(-(a - .83) * 5); loose.rotation.set(0, 1.2, Math.PI / 2); }
      b.arms.forEach((arm, i) => arm.rotation.set(-1.25, 0, i ? -.55 : .55)); b.head.rotation.x = .3; face(b, { open: 1.5, size: 1.2, mouth: 'smile' });
      fx.text(loc('¡Ups!'), '#ffffff', up(headTop(b), .3 * k), a - .05, { life: 1.2, size: 1 });
      if (p) {
        const duck = pulse(a, .3, .55, .83); p.body.rotation.x += -1.05 * duck; if (duck > 0) p.arms.forEach((arm, i) => arm.rotation.set(-.3, 0, (i ? -1 : 1) * 1.3 * duck));
        face(p, { open: 1 + .5 * duck, size: 1 + .2 * duck, mouth: 'smile' }); fx.text(loc('¡Ahhh!'), '#ffd23f', up(headTop(p), .3 * k), a - .35, { life: .8, size: .9 });
        if (a > .9) { p.armR.rotation.set(-2.6 + Math.sin(a * 18) * .35, 0, -.3); face(p, { open: .5, mouth: talk(p, 20, a) }); fx.text(loc('¡EPA!'), '#ff5a3c', up(headTop(p), .4 * k), a - .9, { hold: true, size: 1.2 }); }
      }
    },
    // A bent cap that comes back to the pitcher's hand.
    boomerang(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('whirr', 0); c.cue('whirr', .6); c.cue('pop', 1.4); c.cue('tada', 1.5);
      const home = feet(b), hand = p ? tip(p) : up(c.pitcherHome, 1.4);
      c.curve ||= new THREE.CatmullRomCurve3([c.land.clone(), home.clone().add(new V3(-1.8, 1.6, 1.6)), home.clone().add(new V3(2.4, 2, -.6)), home.clone().lerp(hand, .55).add(new V3(2, 1.4, 0)), hand.clone()]);
      const q = clamp01(a / 1.4); cap = a < 1.4 ? c.curve.getPoint(q) : hand;
      for (let j = 1; j <= 5 && a < 1.4; j++) fx.star(c.curve.getPoint(clamp01(q - j * .02)), .3 - j * .04, a * 6 + j, .9 - j * .15, ['#7cd8ff', '#ffd23f', '#ff8fd0'][j % 3]);
      if (a < 1.4) { b.body.rotation.y = q * Math.PI * 2; look(b, cap, 1); face(b, { open: 1.4, size: 1.2, mouth: 'smile' }); }
      else { dizzy(b, a); face(b, { open: .9, spin: a * 8, mouth: 'talk' }); if (p) { p.armR.rotation.set(-1.45, 0, -.15); face(p, { open: .35, mouth: 'smile' }); } fx.text(loc('¡Bumerán!'), '#7cd8ff', up(hand, .8 * k), a - 1.45, { hold: true, size: 1.2 }); }
    },
    // ¡TOING! A chapazo: to the batter's head (hit by pitch) or a fielder's face.
    bean(a) {
      const v = keep(c.victim || c.batter), culprit = keep(v === c.batter ? c.pitcher : c.batter), head = headTop(v, .5);
      c.cue('toing', 0); fx.flash(head, a, 1.3); fx.burst(head, a, { count: 10, radius: 1.1 }); shakeBy(.08, a);
      fx.text(loc('¡TOING!'), '#ff8fd0', up(head, .9 * k), a, { life: 1.2, size: 1.2 }); bump(v, a);
      const st = Math.exp(-a * 2.2); v.body.rotation.x += -.3 * st; v.body.rotation.z += Math.sin(a * 6) * .18 * st; v.body.position.x = -.35 * easeOut(a / .4);
      dizzy(v, a, 4); face(v, { open: .9, spin: a * 7, mouth: 'talk' });
      fx.text(loc('¡Ay, mi madre!'), '#ffffff', up(headTop(v), .4 * k), a - .7, { life: 1.6, size: .9 });
      if (v === c.batter && c.hbp) cap = ballistic(head, new V3(1.2, 3.2, 1.6).multiplyScalar(k), a, { g: 9.8 * k });
      if (culprit && a > .1) {
        if (culprit === c.pitcher) { culprit.arms.forEach((arm, i) => arm.rotation.set(-2.25, 0, i ? .38 : -.38)); face(culprit, { open: 1.4, size: 1.2 }); fx.text(loc('¡Perdón!'), '#7cd8ff', up(headTop(culprit), .4 * k), a - .55, { life: 1.4, size: .9 }); }
        else { culprit.body.rotation.x += .2 + Math.sin(a * 20) * .05; face(culprit, { open: .3, mouth: 'laugh' }); fx.text('jajaja', '#ffffff', up(headTop(culprit), .3 * k), a - .4, { life: 1.6, size: .9 }); }
      }
    },
    // The señora's window: glass everywhere, ¡MUCHACHOS!, ¡CORRAN!
    window(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('crash', 0); c.cue('yell', .2); c.cue('boing', .4);
      fx.text(loc('¡CRASH!'), '#7cd8ff', c.window.clone().add(new V3(1.2 * k, 1.4 * k, 1)), a, { life: .5, size: 1.4 });
      fx.burst(c.window, a, { count: 12, radius: 1.2, color: '#d6f2ff' }); shakeBy(.08, a);
      shards().forEach((s, i) => {
        const pos = ballistic(c.window.clone().add(new V3((hsh(i * 7) - .5) * 1.2 * k, (hsh(i) - .5) * .9 * k, .1)), new V3((hsh(i * 11) - .5) * 3 * k, hsh(i * 5) * 2.5 * k, (1 + hsh(i * 3) * 2.2) * k), a, { ground: .03, rest: .2, g: 9.8 * k });
        s.visible = true; s.position.copy(pos); if (pos.y > .04) s.rotation.set(a * (5 + i), a * (3 + i * .5), 0); else s.rotation.set(-Math.PI / 2, 0, i);
      });
      fx.text(loc('¡MUCHACHOS!'), '#ff6fa8', c.window.clone().add(new V3(0, 1.8 * k, .6)), a - .3, { hold: true, size: 1.4 });
      if (a < .9) { face(b, { open: 1.5, size: 1.25, mouth: 'smile' }); if (p) { face(p, { open: 1.5, size: 1.25, mouth: 'smile' }); handsOnHead(p); } }
      else {
        // ¡Corran! The batter off down the side street, the pitcher the other way.
        const r = a - .9, bh = c.batterHome, ph = c.pitcherHome;
        b.group.position.copy(bh).add(new V3(r * 2.4, 0, r * 2.4)); b.group.rotation.y = Math.PI / 4; runCycle(b, a * 14); if (c.palo) c.palo.visible = false;
        if (p) { p.group.position.copy(ph).add(new V3(0, 0, -r * 2.8)); p.group.rotation.y = Math.PI; runCycle(p, a * 14 + 1); fx.puff(feet(p), .45, .5); }
        fx.puff(feet(b), .45, .5); fx.text(loc('¡CORRAN!'), '#ffd23f', up(bh.clone().lerp(ph, .5), 2.6 * k), r, { life: 1.4, size: 1.3 });
      }
    },
    // A diving catch: ¡OUT!
    catch(a) {
      const f = keep(c.fielder || c.pitcher), b = keep(c.batter); c.cue('land', .12); c.cue('tada', .2);
      const q = smooth(a / .3), s = easeOut((a - .3) / .4), side = c.diveSide || 1;
      f.body.position.x = side * (.6 * q + .2 * s); f.body.position.y += Math.sin(Math.min(q, 1) * Math.PI) * .55 + .42 * q; f.body.rotation.z += -side * 1.42 * easeOut(q);
      f.armR.rotation.set(-.2, 0, -.4 - 2.3 * q); f.armL.rotation.set(-.6, 0, .4 + 1 * q); f.legs[0].rotation.x = -.3 * q; f.legs[1].rotation.x = .4 * q;
      cap = tip(f);
      const at = cap.clone();
      fx.burst(at, a - .3, { count: 10, radius: 1.1 }); fx.dust(feet(f), a - .3, { count: 12, size: .6, spread: 1.3, seed: 8 });
      fx.text(loc('¡OUT!'), '#8dff8a', up(headTop(f), .6 * k), a - .35, { hold: true, size: 1.5 }); face(f, a > .3 ? { open: .35, mouth: 'laugh' } : { open: 1.3, size: 1.15, mouth: 'talk' });
      if (a > .4) { b.body.rotation.x += .22 * smooth((a - .4) / .4); b.head.rotation.x = .35 * smooth((a - .4) / .4); face(b, { open: .4 }); fx.text(loc('¡Nooo!'), '#ffffff', up(headTop(b), .3 * k), a - .7, { life: 1.3, size: .8 }); }
    },
    // ¡CRACK! The palo breaks at contact.
    broken(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('crack', 0); c.cue('land', .9);
      if (!c.palo) return;
      const halves = prop('halves', () => createPaloPartido({ kind: c.paloKind }));
      c.palo.visible = false; const holder = c.palo.parent;
      if (halves.parent !== holder) { holder.add(halves); halves.position.copy(c.palo.position); halves.quaternion.copy(c.palo.quaternion); halves.scale.copy(c.palo.scale); }
      const top = halves.userData.top;
      if (!c.breakAt) { halves.updateMatrixWorld(true); c.breakAt = halves.localToWorld(new V3(0, PALO_BREAK, 0)); c.breakDir = halves.localToWorld(new V3(0, 2, 0)).sub(c.breakAt).normalize(); }
      if (top.parent !== props) { props.add(top); top.scale.setScalar(1.35 * k); }
      const v = c.breakDir.clone().multiplyScalar(2.5 * k).add(new V3(.4, 2.2, -.6).multiplyScalar(k)), pos = ballistic(c.breakAt, v, a, { g: 9.8 * k, ground: .04, rest: .3 });
      top.position.copy(pos); if (pos.y > .05) top.rotation.set(a * 9, a * 4, a * 6); else top.rotation.set(Math.PI / 2, 0, 1.2);
      fx.text(loc('¡CRACK!'), '#d9a46b', up(c.contact, 1.8 * k), a, { life: 1.2, size: 1.3 }); fx.burst(c.breakAt, a, { count: 12, radius: .9, color: '#c9955a', size: .18 });
      b.head.rotation.x = .45 * smooth(a / .3); face(b, { open: 1.5, size: 1.2, mouth: a > 1.2 ? 'laugh' : 'natural' });
      if (p && a > .35) { p.body.rotation.x += .25 + Math.sin(a * 20) * .05; face(p, { open: .3, mouth: 'laugh' }); fx.text('jajaja', '#ffffff', up(headTop(p), .3 * k), a - .35, { life: 1.6, size: .8 }); }
    },
    // ¡JONRÓN! A bat flip, confetti, the pitcher with both hands on the head.
    home(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('tada', .2);
      const at = up(feet(b), 2.4 * k); fx.text(loc('¡JONRÓN!'), '#ff5a3c', up(at, .6 * k), a, { hold: true, size: 1.7 });
      if (c.palo && a > .2) {
        const loose = prop('flip', () => createPalo({ kind: c.paloKind }), 1.35 * k), q = clamp01((a - .2) / .7);
        c.palo.visible = false; c.flipFrom ||= c.palo.getWorldPosition(new V3());
        loose.position.copy(c.flipFrom).add(new V3(.4 * q * k, (4 * q - 4.2 * q * q) * k, 1.2 * q * k)); loose.position.y = Math.max(.05, loose.position.y);
        if (q < 1) loose.rotation.set(q * Math.PI * 6, 0, q * Math.PI * 2); else loose.rotation.set(0, 1, Math.PI / 2);
        armsUp(b, a); if (a > .25 && a < 2.2) b.group.position.y += Math.abs(Math.sin((a - .25) * 7)) * .3 * k;
      }
      face(b, { open: .35, mouth: 'laugh' });
      if (p && a > .15) { handsOnHead(p); p.body.rotation.x += .18; p.head.rotation.x = -.25; face(p, { open: 1.4, size: 1.2, mouth: 'smile' }); }
      fx.confetti(up(feet(b), 2.5 * k), a - .15, { count: 90, seed: 4 });
      [[.35, -1.6, 4.6, -1.4], [.75, .4, 5.2, -2.6], [1.15, -.6, 5.6, -4]].forEach(([ts, x, y, z], j) => fx.burst(feet(b).add(new V3(x, y * k, z)), a - ts, { count: 16, radius: 1.6, color: ['#ff4b4b', '#ffc629', '#2ad1b2'][j], seed: j * 20, life: 1 }));
    },
    // A street dog takes the chapita and runs off with it.
    dog(a) {
      const dog = prop('dog', () => createPerro()), d = dog.userData; c.cue('bark', .26); c.cue('bark', .55);
      const land = c.land.clone().setY(0), start = land.clone().add(new V3(6, 0, 3)), dir = land.clone().sub(start).normalize(), stop = land.clone().addScaledVector(dir, -.4), exit = land.clone().add(new V3(8, 0, -6));
      if (a < .35) { dog.position.copy(start).lerp(stop, a / .35); dog.rotation.y = Math.atan2(dir.x, dir.z); d.pose(a * 16, true, a); }
      else if (a < .48) { dog.position.copy(stop); d.pose(0, false, a); d.head.rotation.x = .5 * Math.sin(clamp01((a - .35) / .13) * Math.PI); }
      else { const q = easeIn((a - .48) / .9), d2 = exit.clone().sub(stop).normalize(); dog.position.copy(stop).lerp(exit, q); dog.rotation.y = Math.atan2(d2.x, d2.z); d.pose(a * 19, true, a); fx.puff(dog.position.clone().setY(.1), .35, .4); }
      if (a >= .42) { dog.updateMatrixWorld(true); cap = d.mouth.getWorldPosition(new V3()); }
      fx.text(loc('¡GUAU!'), '#ffd23f', up(dog.position, 1.1), a - .26, { life: .8, size: .9 });
      const chaser = keep(c.fielder || c.pitcher);
      if (a > .5) {
        fx.text(loc('¡EL PERRO!'), '#ff5a3c', up(headTop(c.batter), .3 * k), a - .5, { life: 1.2, size: 1.1 });
        if (chaser) { const from = chaser.group.position.clone(); travel(chaser, c.startOf(chaser) || from, land.clone().add(new V3(3, 0, -2)), .6, 2.2, a); face(chaser, { open: 1.2, mouth: talk(chaser, 20, a) }); fx.text(loc('¡Suelta eso!'), '#ffffff', up(headTop(chaser), .3 * k), a - .7, { life: 1.2, size: .9 }); }
      }
    },
    // Pa'l techo: the chapita rolls off the azotea onto a pana's head.
    roof(a) {
      const who = keep(c.fielder || c.pitcher), b = keep(c.batter); c.cue('clink', 0); c.cue('clink', .12); c.cue('toing', .62);
      const x = clampTo(c.land.x, -4, 4), top = new V3(x, c.wallTop + .15, c.wall - .8), edge = new V3(x, c.wallTop + .15, c.wall + .05), under = new V3(x, 0, c.wall + 1.1);
      travel(who, c.startOf(who), under, 0, .45, a);
      const head = a > .45 ? headTop(who, .6) : up(under, 1.7);
      fx.text(loc("¡Pa'l techo!"), '#ffd23f', up(top, 1.2), a, { life: 1.2, size: 1.1 });
      if (a < .3) cap = top.clone().lerp(edge, a / .3); else if (a < .62) cap = edge.clone().lerp(head, easeIn((a - .3) / .32)); else cap = ballistic(head, new V3(1.2, 2.2, 1).multiplyScalar(k), a - .62, { g: 9.8 * k });
      if (a > .45 && a < .62) { who.group.rotation.y = Math.PI; who.head.rotation.x = -.55; who.armR.rotation.set(-2.3, 0, .75); face(who, { open: 1.2 }); }
      const ba = a - .62;
      if (ba >= 0) {
        bump(who, ba); dizzy(who, a, 4); face(who, { open: .9, spin: a * 7, mouth: 'talk' }); who.armR.rotation.set(-2.6, 0, .4);
        fx.flash(head, ba, 1.2); fx.burst(head, ba, { count: 10, radius: 1 }); fx.text(loc('¡TOING!'), '#ff8fd0', up(head, .8 * k), ba, { life: 1.2, size: 1.2 }); shakeBy(.06, ba, 9);
        b.body.rotation.x += .2 + Math.sin(a * 20) * .05; face(b, { open: .3, mouth: 'laugh' }); fx.text('jajaja', '#ffffff', up(headTop(b), .3 * k), ba - .2, { life: 1.6, size: .9 });
      }
    },
    // Down the storm drain… ¡Tengo otra!
    drain(a) {
      const p = keep(c.pitcher), b = keep(c.batter); c.cue('plop', .7); c.cue('sad', .75); c.cue('tada', 1);
      const D = c.drain;
      if (a < .55) { const q = a / .55, pos = c.land.clone().setY(.05).lerp(D, easeOut(q)); pos.y = .05 + Math.abs(Math.sin(q * Math.PI * 4)) * .25 * k * (1 - q) * (1 - q); cap = pos; }
      else if (a < .7) cap = D.clone().add(new V3(Math.sin(a * 60) * .02, .05, 0));
      else if (a < .8) cap = D.clone().add(new V3(0, .05 - .4 * easeIn((a - .7) / .1), 0)); else hideCap = true;
      const peek = (ch, spot) => {
        if (!ch) return; const q = travel(ch, c.startOf(ch), spot, 0, .45, a, { arms: ch !== c.batter });
        if (q >= 1) { ch.group.rotation.y = Math.atan2(D.x - spot.x, D.z - spot.z); const s = smooth((a - .45) / .12) * (1 - smooth((a - .95) / .15)); ch.body.rotation.x += .55 * s; ch.body.position.y -= .2 * s; ch.legs.forEach(l => { l.rotation.x = -.5 * s; }); }
      };
      peek(p, D.clone().add(new V3(-.9, -D.y, -.7))); peek(b, D.clone().add(new V3(-.9, -D.y, .8)));
      if (a > .7 && a < 1) { face(p, { open: 1.5, size: 1.25, mouth: 'smile' }); face(b, { open: 1.5, size: 1.25, mouth: 'smile' }); }
      fx.text(loc('¡Nooo!'), '#ffffff', D.clone().add(new V3(0, 2.2 * k, 0)), a - .7, { life: 1, size: 1.1 });
      if (a > 1 && p) {
        const spare = prop('spare', () => createChapita({ brand: 'oro' }), 1.8); p.armR.rotation.set(-2.9, 0, -.2); face(p, { open: .4, mouth: 'laugh' }); face(b, { open: .4, mouth: 'laugh' });
        p.updateMatrixWorld?.(); spare.position.copy(tip(p)).add(new V3(0, .1, 0)); spare.rotation.set(Math.PI / 2, a * 3, 0);
        for (let j = 0; j < 4; j++) { const an = a * 3 + j * Math.PI / 2; fx.star(spare.position.clone().add(new V3(Math.cos(an) * .35 * k, Math.sin(an) * .35 * k, 0)), .18, an, 1, '#ffe08a'); }
        fx.text(loc('¡Tengo otra!'), '#ffe08a', up(spare.position, .9 * k), a - 1, { hold: true, size: 1 });
      }
    },
    // Pinball: the post, the wall, the car, the pitcher's head. ¡JACKPOT!
    pinball(a) {
      const p = keep(c.pitcher), b = keep(c.batter);
      const head = p ? headTop(p, .4) : up(c.pitcherHome, 1.6), pts = [c.land, c.bounceWall, c.carTop, head, (c.pitcherHome || head).clone().add(new V3(.7, .05, 1.2))], T = [0, .3, .62, 1.05, 1.3];
      c.cue('ping', .02); c.cue('ping', .3); c.cue('ping', .62); c.cue('toing', 1.05); c.cue('tada', 1.15);
      if (a < T[4]) { const i = T.findIndex((t, j) => a < T[j + 1]), q = clamp01((a - T[i]) / (T[i + 1] - T[i])); cap = arc(pts[i], pts[i + 1], q, .6); } else cap = pts[4];
      [[0, loc('¡PING!'), '#7cd8ff', '+100'], [.3, loc('¡PONG!'), '#ff8fd0', '+250'], [.62, loc('¡PING!'), '#8dff8a', '+500']].forEach(([ts, s, color, score], j) => {
        const at = pts[j]; fx.flash(at, a - ts, 1.1); fx.burst(at, a - ts, { count: 10, radius: 1, color, seed: j * 7 }); fx.text(s, color, up(at, 1.1), a - ts, { life: .9, size: 1.1 }); fx.text(score, '#ffd23f', up(at, .5), a - ts - .1, { life: .8, size: .7, tilt: 0 });
      });
      if (p && a < 1.05) { look(p, cap, 1.3); face(p, { open: 1.3, size: 1.1, mouth: 'talk' }); }
      const pa = a - 1.05;
      if (pa >= 0) {
        if (p) { p.group.position.y += Math.sin(clamp01(pa / .35) * Math.PI) * .6 * k; p.arms.forEach((arm, i) => arm.rotation.set(.9, 0, i ? -.35 : .35)); face(p, { open: 1.5, size: 1.25, mouth: 'smile' }); fx.text(loc('¡AUCH!'), '#ff5a3c', up(headTop(p), .4 * k), pa, { life: 1.3, size: 1.2 }); }
        shakeBy(.05, pa, 9); fx.text(loc('¡JACKPOT!'), '#ffd23f', up(head, 2.4), pa - .15, { hold: true, size: 1.4 });
        face(b, { open: .35, mouth: 'laugh' }); b.group.position.y += Math.abs(Math.sin(a * 8)) * .12 * k;
      }
    },
    // El abuelo catches it without looking up from the paper, and tosses it back.
    grandpa(a) {
      const g = c.abuelo; if (!g) return; keep(g); c.cue('pop', .35); c.cue('tada', .4); c.cue('pop', 1.1);
      const p = keep(c.pitcher), catchAt = (() => { g.armR.rotation.set(-1.9, 0, -1.2); g.updateMatrixWorld?.(); g.group.updateMatrixWorld(true); return tip(g); })();
      if (a < .35) { cap = arc(c.land, catchAt, a / .35, .4); g.armR.rotation.set(lerp(-1.3, -1.9, smooth(a / .1)), 0, lerp(.28, -1.2, smooth(a / .1))); }
      else if (a < .75) { cap = catchAt; }
      else { const to = p ? tip(p) : up(c.pitcherHome, 1.3), q = clamp01((a - .75) / .4); g.armR.rotation.set(-1.3 - 1.1 * Math.sin(q * Math.PI), 0, -.5 * (1 - q)); cap = q < 1 ? arc(catchAt, to, q, 1.4) : to; }
      fx.burst(catchAt, a - .35, { count: 8, radius: .8 }); fx.text(loc('¡Atrapada del abuelo!'), '#ffd23f', up(catchAt, 1), a - .35, { life: 1.9, size: 1.1 });
      fx.text('mmm…', '#ffffff', up(catchAt, .45), a - .95, { life: 1.2, size: .7, tilt: .1 });
      if (a > .35) for (const ch of [c.batter, p]) if (ch) face(keep(ch), { open: 1.5, size: 1.25, mouth: 'smile' });
      if (p && a > .35 && a < .9) p.arms.forEach((arm, i) => arm.rotation.set(-2.6, 0, i ? -1 : 1));
      if (p && a > 1.15) p.armR.rotation.set(-1.5, 0, -.2);
    },
    // ¡Carro! Everyone to the sidewalk, the car goes by, back to the game.
    car(a) {
      c.cue('yell', 0); c.cue('honk', 1.3);
      fx.text(loc('¡CARRO!'), '#ffd23f', up(headTop(c.pitcher || c.batter), .4 * k), a, { life: 1.3, size: 1.3 });
      for (const [ch, side] of c.crew) {
        const home = c.startOf(ch), aside = home.clone(); aside.x = side * c.curb;
        if (a < 2.6) { if (travel(ch, home, aside, .05, .55, a, { arms: ch !== c.batter }) >= 1) { ch.group.rotation.y = -side * Math.PI / 2; if (c.passing) look(ch, c.passing.position.clone().setY(1), 1.3); face(ch, { open: 1.3, mouth: a > 1 && a < 1.8 ? 'smile' : 'natural' }); if (ch === c.pitcher) ch.armR.rotation.set(-2.5 + Math.sin(a * 12) * .3, 0, -.3); } }
        else travel(ch, aside, home, 2.6, 3.2, a, { arms: ch !== c.batter });
      }
      const q = clamp01((a - .5) / 2.3);
      if (c.passing) {
        c.passing.visible = q > 0 && q < 1; c.passing.position.copy(c.carFrom).lerp(c.carTo, q); c.passing.rotation.y = Math.atan2(c.carTo.x - c.carFrom.x, c.carTo.z - c.carFrom.z);
        if (c.passing.visible) for (let j = 0; j < 4; j++) fx.puff(c.passing.position.clone().add(new V3(j % 2 ? .6 : -.6, .2 + j * .05, 0)).addScaledVector(c.carTo.clone().sub(c.carFrom).normalize(), -2 - j * .5), .6 + j * .1, .4 - j * .08, '#e6d9c3');
        fx.text(loc('¡PI PI!'), '#ffffff', up(c.passing.position, 2.2), a - 1.3, { life: .9, size: 1.1 });
      }
      fx.text(loc('¡Sigue el juego!'), '#8dff8a', up(c.contact, 2.6), a - 2.7, { hold: true, size: 1.1 });
    },
    // ¡A COMEEER! The señora calls, the batter drops the palo and runs home.
    dinner(a) {
      const b = keep(c.batter), p = keep(c.pitcher); c.cue('yell', 0); c.cue('boing', .25); c.cue('land', .4); c.cue('cricket', 1.6);
      fx.text(loc('¡A COMEEER!'), '#ff6fa8', c.window.clone().add(new V3(0, 1.8 * k, .6)), a, { hold: a < 2.4, life: 2.6, size: 1.4 });
      if (a > .15 && a < .38) { b.group.position.y += Math.sin((a - .15) / .23 * Math.PI) * .4 * k; face(b, { open: 1.5, size: 1.25, mouth: 'smile' }); }
      if (a > .3 && c.palo) {
        const loose = prop('dropped', () => createPalo({ kind: c.paloKind }), 1.35 * k), q = clamp01((a - .3) / .2);
        c.palo.visible = false; c.dropFrom ||= c.palo.getWorldPosition(new V3());
        loose.position.copy(c.dropFrom).setY(lerp(c.dropFrom.y, .04, easeIn(q))); loose.rotation.set(0, .4, lerp(.3, Math.PI / 2, q));
      }
      if (a >= .38) { const q = travel(b, c.batterHome, c.door, .38, 1.3, a); b.group.visible = q < 1; if (q < 1) face(b, { open: 1.2, mouth: 'smile' }); fx.text(loc('¡VOY!'), '#ffd23f', up(headTop(b), .3 * k), a - .38, { life: 1, size: 1 }); if (q >= 1) fx.dust(c.door, a - 1.3, { count: 10, size: .5, spread: .8, seed: 6 }); }
      if (p) {
        if (a > .38 && a < 1.4) { look(p, b.group.position.clone().setY(1)); face(p, { open: 1.3, size: 1.1 }); }
        if (a > 1.4) { face(p, { open: .5 }); fx.text('...', '#ffffff', up(headTop(p), .4 * k), a - 1.5, { life: 1.2, size: .9 }); fx.text(loc('¿Y entonces?'), '#ffffff', up(headTop(p), .5 * k), a - 2.4, { hold: true, size: .9 }); }
      }
      const weed = prop('weed', () => createBolaDePaja()), tq = clamp01((a - 1.6) / 2.4), mid = (c.pitcherHome || c.contact).clone().lerp(c.batterHome, .5);
      weed.visible = tq > 0 && tq < 1; weed.position.set(lerp(7, -7, tq), .25 + Math.abs(Math.sin(tq * Math.PI * 5)) * .3, mid.z); weed.rotation.set(0, 0, -tq * 30);
    },
    // The winners dance: music notes, the palo up high, confetti.
    dance(a) {
      if (a < .05) c.cue('melody', 0);
      const loop = a % 5.4; if (loop < .03 && a > 1) sfx('melody');
      c.crew.forEach(([ch], j) => {
        keep(ch); const b = a * 2.6 + j * .5;
        ch.body.rotation.z += Math.sin(b * Math.PI) * .18; ch.body.rotation.y = j % 2 ? Math.sin(b * Math.PI * .5) * .5 : (Math.floor(b) % 4 === 3 ? Math.PI * 2 * smooth(b % 1) : 0);
        ch.legs.forEach((l, i) => { l.rotation.x = Math.max(0, Math.sin(b * Math.PI + i * Math.PI)) * -.5; }); ch.group.position.y += Math.abs(Math.sin(b * Math.PI)) * .08 * k;
        ch.arms.forEach((arm, i) => arm.rotation.set(-2.5 - Math.sin(b * Math.PI + i * Math.PI) * .5, 0, i ? -.5 : .5)); face(ch, { open: .35, mouth: j % 2 ? 'laugh' : 'smile' });
        for (let n = 0; n < 2; n++) { const ag = (a * .7 + n / 2 + j * .17) % 1; fx.text(n ? '♪' : '♫', ['#ffd23f', '#ff8fd0', '#7cd8ff'][(j + n) % 3], headTop(ch, .8).add(new V3(Math.sin(j * 2 + ag * 4) * .7 * k, ag * 1.5 * k, Math.cos(j * 3) * .4 * k)), ag * 1.5, { life: 1.5, size: .55, tilt: Math.sin(j) * .3 }); }
      });
      const centre = c.crew[0]?.[0].group.position || c.contact;
      fx.confetti(centre.clone().setY(3), loop - .4, { count: 80, power: .7, seed: 9 });
    },
  };

  // Props kept for the whole jugada, built on first use.
  function prop(name, make, scale = 1) {
    let o = temp.find(t => t.userData.jugadaProp === name);
    if (!o) { o = own(make()); o.userData.jugadaProp = name; o.scale.setScalar(scale); }
    o.visible = true; return o;
  }
  function shards() {
    let list = temp.filter(t => t.userData.shard);
    if (!list.length) list = Array.from({ length: 18 }, (_, i) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo((.08 + hsh(i) * .1) * k, .02); s.lineTo(.03, (.09 + hsh(i * 3) * .1) * k); s.closePath();
      const m = own(new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshPhysicalMaterial({ color: '#d6f2ff', transparent: true, opacity: .7, roughness: .05, clearcoat: 1, side: THREE.DoubleSide })));
      m.userData.shard = true; m.userData.dispose = () => { m.geometry.dispose(); m.material.dispose(); }; return m;
    });
    return list;
  }

  const player = {
    get id() { return id; },
    get active() { return id !== null; },
    // ctx: the panas (pitcher, batter, fielder, victim, abuelo, crew: [[pana, side]]),
    // the batter's palo and kind, and the street's points (see scene.js).
    start(name, ctx) {
      player.stop();
      if (!PLAYS[name]) return false;
      id = name; last = -1; tips.length = 0;
      c = { startOf: ch => ctx.homes?.get(ch)?.clone() || ch?.group.position.clone(), crew: [], ...ctx };
      c.cue = (sound, at) => { if (c.sound !== false && at > last && at <= c.a) sfx(sound); };
      return true;
    },
    // Pose everything for second a of the jugada (call after the panas' own update).
    sample(a) {
      shake = 0; cap = null; hideCap = false; shot = null;
      if (!id) return { cap, hideCap, shake, shot, done: true };
      c.a = a;
      fx.begin(c.effects !== false);
      try { PLAYS[id](a); } finally { fx.end(); }
      last = a;
      const done = a >= (c.duration ?? DURATION[id] ?? 1.5);
      return { cap, hideCap, shake, shot: c.shots?.(id, a) || null, done };
    },
    stop() {
      if (!id) return;
      if (c?.palo) c.palo.visible = c.paloVisible ?? true;
      if (c?.passing) c.passing.visible = false;
      restore();
      for (const o of temp.splice(0)) { (o.userData.dispose || (() => {}))(); o.removeFromParent(); }
      fx.begin(false); fx.end(); id = null; c = null;
    },
    dispose() { player.stop(); props.removeFromParent(); },
  };
  return player;
}

export const JUGADA_NAMES = Object.fromEntries(Object.entries(JUGADAS).map(([key, j]) => [key, j.label]));
