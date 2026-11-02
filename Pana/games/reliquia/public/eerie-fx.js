// What a scare looks and sounds like on this screen. engine/eerie.js decides
// when (seeded, with cooldowns, scaled by la codicia, depth, being alone and
// hurt); this turns each event into light (view.mood), sound
// (ambience.eerie) and the odd shape: a pale figure far down an aisle that
// is gone when you look straight at it, a book thrown off a shelf, and the
// rare jump scare. Nothing here is synced: every pana gets their own.
import * as THREE from 'three';
import { createEerie } from '/engine/eerie.js';
import { mummy } from '/engine/models/props/reliquia.js';
import { floorOf } from './deck.js';
import { alive } from './rules.js';

const GRAVITY = 9.8;
// Light patterns, 0…1 over an effect's life.
const flick = t => (Math.sin(t * 37) * Math.sin(t * 23 + 1.3) > .1 ? 1 : .25);
const ease = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export function createEerieFx({ view, ambience, dread = () => {} }) {
  const eerie = createEerie({ seed: 1 });
  let level = -1, time = 0, mode = 'normal', theme = 'mina';
  const effects = [];
  // ---- Shapes: one pale figure and one book, made once and reused.
  // Pale and cold: the figure is grey-blue, lit from within just enough to
  // read in the dark, never warm.
  const ghostMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ae, emissive: 0x1c222c, roughness: 1, transparent: true, opacity: 0, depthWrite: false });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xdfe8f4, transparent: true, opacity: 0 });
  const ghost = mummy(); ghost.name = 'Silueta';
  ghost.traverse(o => { if (o.isMesh) { const eye = o.material.emissiveIntensity >= 1 && o.material.emissive?.getHex(); o.material.dispose?.(); o.material = eye ? eyeMat : ghostMat; o.castShadow = false; } });
  ghost.visible = false; view.scene.add(ghost);
  const book = new THREE.Mesh(new THREE.BoxGeometry(.24, .05, .17), new THREE.MeshStandardMaterial({ color: 0x3a2a2e, roughness: .9 }));
  book.visible = false; view.scene.add(book);
  const bookV = new THREE.Vector3(), spin = new THREE.Vector3(), outAt = { x: 0, z: 0, r: 7, amount: 0 };
  const figure = { on: false, t: 0, away: false, fade: 0, close: false };

  const pan = (me, heading, x, z) => { const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz) || 1; return (dx * -Math.cos(heading) + dz * Math.sin(heading)) / d * .85; };
  const shake = v => { if (mode !== 'apagados') view.shake(v * (mode === 'suaves' ? .4 : 1)); };
  // Somewhere ahead along the line of sight, clear of walls, far enough to be unsure.
  function spotAhead(me, heading, near, far, state) {
    const L = view.world.layout;
    // Just off the centre of the view first: seen from the corner of the eye.
    for (const d of [far, (near + far) / 2, near]) for (const a of [.08, -.08, .16, -.16, .3, -.3, 0]) {
      const x = me.x + Math.sin(heading + a) * d, z = me.z + Math.cos(heading + a) * d;
      if (floorOf(x) === floorOf(me.x) && L.walkable(x, z, state, .45) && L.lineClear(me, { x, z }, state, .2)) return { x, z };
    }
    return null;
  }
  function showFigure(at, me, { close = false, opacity = .55 } = {}) {
    ghost.position.set(at.x, 0, at.z); ghost.rotation.y = Math.atan2(me.x - at.x, me.z - at.z); ghost.visible = true;
    Object.assign(figure, { on: true, t: 0, away: false, fade: opacity, close });
    ghostMat.opacity = opacity; eyeMat.opacity = close ? 1 : opacity * .8;
  }
  const hideFigure = () => { figure.on = false; ghost.visible = false; ghostMat.opacity = eyeMat.opacity = 0; };

  // ---- Events into effects ----
  function start(e, me, heading, state) {
    const s = e.strength, side = e.side, behind = { x: me.x - Math.sin(heading) * 6 + Math.cos(heading) * side * 3, z: me.z - Math.cos(heading) * 6 - Math.sin(heading) * side * 3 };
    switch (e.kind) {
      case 'flicker': effects.push({ kind: 'flicker', t: 0, dur: 2.6, s }); ambience.eerie('gutter', { pan: side * .3, gain: .7 }); break;
      case 'farolStutter': effects.push({ kind: 'stutter', t: 0, dur: 1.3, s }); break;
      case 'candleOut': effects.push({ kind: 'out', t: 0, dur: 7, s, x: me.x, z: me.z }); for (let i = 0; i < 3; i++) setTimeout(() => ambience.eerie('gutter', { pan: (i - 1) * .6, gain: .8 }), i * 140); break;
      case 'fogSurge': effects.push({ kind: 'fog', t: 0, dur: 6, s }); ambience.eerie(theme === 'biblioteca' ? 'wind' : 'sub', { pan: side * .5, strength: .7 }); break;
      case 'slam': ambience.eerie('slam', { pan: side * .6, gain: .9 }); shake(.25 * s); view.puffs.spawn({ x: behind.x, y: 1.5, z: behind.z }, { color: theme === 'biblioteca' ? 0x9aa0a8 : 0xb0a080, count: 6, spread: 1.2, size: .6, rise: -.6, life: 1.2 }); break;
      case 'thud': ambience.eerie('thud', { pan: side * .95, gain: .75 }); break;
      case 'whisper': ambience.eerie('whisperNear', { pan: side * .9, gain: .9 }); ambience.eerie('breath', { pan: side * .35, gain: .8 }); break;
      case 'heartbeat': effects.push({ kind: 'heart', t: 0, dur: 6.5, s, next: 0, beats: 0 }); break;
      case 'silhouette': { const at = spotAhead(me, heading, 7.5, 12, state); if (at) { showFigure(at, me); ambience.eerie('sub', { strength: .45 }); } break; }
      case 'bookFall': throwBook(me, heading, state); break;
      case 'jumpscare': effects.push({ kind: 'scare', t: 0, dur: mode === 'suaves' ? 1.6 : 2.1, s, soft: mode === 'suaves', shown: false }); ambience.eerie('sub', { strength: mode === 'suaves' ? .4 : 1 }); break;
    }
  }
  function throwBook(me, heading, state) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    let best = null, score = -1;
    for (const s of view.world.run.solids || []) {
      if (s.kind !== 'shelf' || floorOf(s.rect[0]) !== floorOf(me.x)) continue;
      const along = s.axis === 'x', cx = (s.rect[0] + s.rect[2]) / 2, cz = (s.rect[1] + s.rect[3]) / 2;
      const x = along ? Math.max(s.rect[0] + .3, Math.min(s.rect[2] - .3, me.x + fx * 3)) : cx + Math.sign(me.x - cx) * .46;
      const z = along ? cz + Math.sign(me.z - cz) * .46 : Math.max(s.rect[1] + .3, Math.min(s.rect[3] - .3, me.z + fz * 3));
      const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz), ahead = (dx * fx + dz * fz) / (d || 1);
      if (d < 1.5 || d > 7 || ahead < .2 || !view.world.layout.lineClear(me, { x: x + Math.sign(me.x - x) * .3 * !along, z: z + Math.sign(me.z - z) * .3 * along }, state, .1)) continue;
      const value = ahead - d * .05; if (value > score) { score = value; best = { x, z, nx: along ? 0 : Math.sign(me.x - cx), nz: along ? Math.sign(me.z - cz) : 0 }; }
    }
    if (!best) { ambience.eerie('book', { pan: (Math.random() - .5), gain: .5 }); return; }
    book.position.set(best.x, 1.7 + Math.random() * .9, best.z); book.rotation.set(0, Math.random() * 3, 0); book.visible = true;
    bookV.set(best.nx * (1.8 + Math.random()), .8 + Math.random(), best.nz * (1.8 + Math.random())); spin.set(Math.random() * 8 - 4, Math.random() * 6 - 3, Math.random() * 8 - 4);
    ambience.eerie('pages', { pan: pan(me, heading, best.x, best.z), gain: .7 });
    book.userData.landed = null;
  }

  // ---- Per frame ----
  function update(dt, { state, me, heading, paused = false, scares = 'normal', run }) {
    mode = scares; theme = run?.theme || 'mina';
    const mood = view.mood; mood.light = 1; mood.farol = 1; mood.fog = 1; mood.out = null;
    if (state.level !== level) { level = state.level; time = 0; eerie.reset(((state.seed || 1) ^ (String(me?.id || '').length * 2654435761 + (me?.seat || 0) * 40503)) >>> 0); clear(); }
    const active = !paused && state.phase === 'playing' && !!me && !me.downed && !me.spectator && floorOf(me.x) > 0 && !me.riding;
    if (!active) { if (effects.length || figure.on) clear(); dread(0); return; }
    time += dt;
    const others = state.players.filter(p => p.id !== me.id && alive(p) && floorOf(p.x) === floorOf(me.x));
    const alone = !others.some(p => Math.hypot(p.x - me.x, p.z - me.z) < 9);
    for (const e of eerie.update(dt, { active: true, time, codicia: state.codicia || 0, depth: state.level || 1, alone, hp: (me.hp ?? 100) / 100, theme, mode })) start(e, me, heading, state);
    let dreadLevel = 0;
    for (let i = effects.length - 1; i >= 0; i--) {
      const f = effects[i]; f.t += dt; const t = f.t, k = f.s;
      if (f.kind === 'flicker') { if (t < 1) mood.light *= 1 - k * .85 * (1 - flick(t)); else if (t < 1.9) mood.light *= mode === 'suaves' ? .5 : .08; else mood.light *= .3 + .7 * ease(t, 1.9, 2.6); }
      if (f.kind === 'stutter') mood.farol *= 1 - k * .85 * (1 - flick(t * 1.4));
      if (f.kind === 'out') { outAt.x = f.x; outAt.z = f.z; outAt.amount = Math.min(1, t * 4) * (1 - ease(t, 5, 7)); mood.out = outAt; mood.light *= 1 - .4 * outAt.amount; }
      if (f.kind === 'fog') mood.fog *= 1 - .45 * k * Math.min(ease(t, 0, 1.2), 1 - ease(t, 4, 6));
      if (f.kind === 'heart') { f.next -= dt; if (f.next <= 0 && f.beats < 8) { ambience.eerie('heartbeat', { gain: .35 + f.beats * .08 }); f.beats++; f.next = .95 - f.beats * .05; } dreadLevel = Math.max(dreadLevel, .35 * Math.sin(Math.min(1, t / f.dur) * Math.PI)); }
      if (f.kind === 'scare') dreadLevel = Math.max(dreadLevel, scare(f, me, heading, state, mood));
      if (t >= f.dur) effects.splice(i, 1);
    }
    // The far figure: gone when looked at straight, when you come close, or after a while.
    if (figure.on) {
      figure.t += dt;
      const dx = ghost.position.x - me.x, dz = ghost.position.z - me.z, d = Math.hypot(dx, dz);
      const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - heading), Math.cos(Math.atan2(dx, dz) - heading)));
      if (off > 1.3) figure.away = true;
      if (!figure.close && (figure.away || d < 5 || figure.t > 6 || (figure.t > .5 && off < .045))) hideFigure();
      else if (!figure.close) { ghostMat.opacity = figure.fade * Math.min(1, figure.t * 3); ghost.userData.animate?.(figure.t, false, false); }
    }
    // Falling book.
    if (book.visible && book.userData.landed != null) { if (time - book.userData.landed > 8) book.visible = false; }
    else if (book.visible) {
      bookV.y -= GRAVITY * dt; book.position.addScaledVector(bookV, dt); book.rotation.x += spin.x * dt; book.rotation.z += spin.z * dt;
      if (book.position.y <= .03) { book.position.y = .03; book.rotation.set(0, book.rotation.y, 0); ambience.eerie('book', { pan: pan(me, heading, book.position.x, book.position.z), gain: .9 }); view.puffs.spawn({ x: book.position.x, y: .1, z: book.position.z }, { color: theme === 'biblioteca' ? 0xa0a6ae : 0xb8a888, count: 5, spread: .4, size: .35, rise: .6, life: .8 }); bookV.set(0, 0, 0); book.userData.landed = time; }
    }
    dread(dreadLevel);
  }
  // The jump scare: the lights die, a sub swell, then the farol comes back on
  // a figure right in front of you with a stinger, and the dark takes it.
  function scare(f, me, heading, state, mood) {
    const t = f.t;
    if (f.soft) {
      mood.farol *= t < .5 ? .4 : 1; mood.light *= t < .5 ? .5 : 1;
      if (t >= .5 && !f.shown) { f.shown = true; const at = spotAhead(me, heading, 3, 4.5, state); if (at) showFigure(at, me, { close: true, opacity: .55 }); ambience.eerie('stinger', { strength: .35 }); }
      if (t >= 1.1 && figure.close) hideFigure();
      return t < 1.1 ? .35 : 0;
    }
    if (t < .75) { mood.light = 0; mood.farol = 0; return .85; }
    if (t < 1.2) {
      if (!f.shown) {
        f.shown = true;
        const x = me.x + Math.sin(heading) * 2.3, z = me.z + Math.cos(heading) * 2.3;
        if (view.world.layout.lineClear(me, { x, z }, state, .1)) showFigure({ x, z }, me, { close: true, opacity: .92 });
        else { const at = spotAhead(me, heading, 2.5, 4, state); if (at) showFigure(at, me, { close: true, opacity: .92 }); }
        ambience.eerie('stinger', { strength: f.s }); shake(.7 * f.s);
      }
      mood.light = .15; mood.farol = .8; return 1;
    }
    if (t < 1.45) { if (figure.close) hideFigure(); mood.light = 0; mood.farol = 0; return .9; }
    const back = ease(t, 1.45, 2.1); mood.light *= back; mood.farol *= .3 + .7 * back; return .6 * (1 - back);
  }
  function clear() { effects.length = 0; hideFigure(); book.visible = false; }
  // ?debug: force an event now (silhouette, jumpscare, bookFall, …).
  function force(kind, { state, me, heading }) { start({ kind, strength: 1, side: Math.random() < .5 ? -1 : 1, intensity: 1, mode }, me, heading, state); }
  function dispose() { clear(); ghost.removeFromParent(); book.removeFromParent(); ghost.traverse(o => o.geometry?.dispose()); ghostMat.dispose(); eyeMat.dispose(); book.geometry.dispose(); book.material.dispose(); }
  return { update, force, dispose, get ghost() { return ghost; } };
}
