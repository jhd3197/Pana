// Chapita in 3D: the field from street.js, every pana in the team's franela
// with the apodo on the back, the chapita tracing field.js's paths and a
// camera behind the plate that follows the batted cap. Timing comes from the
// HUD's clocks (game.js), so what a batter sees is what they swing at. The
// jugadas locas (jugada-motion.js) play on top: the contact juice on its own
// channel, the host's chosen jugada on the main one.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar, randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { BASES, RELEASE, FIELDERS, FIELD, ROW_Y, pitchPoint, hitPoint } from './field.js';
import { SEATS, teamSeats, ChapitaGame } from './rules.js';
import { createField, crowdSpots, DRAIN, DOOR } from './street.js';
import { createChapita, createPalo, createTuyuyo, createApodo, createPelota, createBate, createPeriodico } from './studio-set.js';
import { createJugadaFx } from './jugada-fx.js';
import { createJugadas } from './jugada-motion.js';
import { playSfx } from './sounds.js';

export const TEAM_COLORS = ['#e8453c', '#2f7fe0'];
const BOT_PALOS = ['escoba', 'coleto', 'teipe', 'tricolor', 'escoba', 'teipe', 'coleto', 'escoba'];
const BRANDS = ['kolita', 'malta', 'uvita', 'tricolor'];
const v3 = (p) => new THREE.Vector3(p.x, p.y, -p.d);
const BENCH = (team, i) => ({ x: -3.9, z: -1.2 - i * 1, angle: Math.PI / 2 });
const FAN = (seat) => ({ x: (seat % 2 ? 1 : -1) * (5.6 + (seat >> 1) * .9), z: -12 - (seat >> 1) * .3, angle: Math.PI });
const STILL = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const HITSTOP = .12;   // the batter's pose freezes this long on contact

export function createChapitaScene(canvas) {
  const stage = createTableWorld(canvas, { arena: false, fit: 'window', fov: 48, fog: [60, 170],
    sun: { box: 34, far: 110, position: [-18, 30, 14] } });
  const { renderer, scene, camera } = stage, own = new THREE.Group(); scene.add(own);
  let field = null, mapId = '', current = null, clocks = { pitch: null, hit: null }, equipment = 'chapita';
  const panas = Array.from({ length: SEATS }, () => ({ route: [], base: -1, wasBatter: false, character: null, key: '', pos: null, angle: 0, palo: null, paloKind: 'escoba', back: null, bump: null, swing: 0, throw: 0 }));
  const extras = [];   // the crowd; extras[0] is el abuelo with his paper
  let senora = null, derbyPitcher = null, passing = null, swungPitch = 0, debugView = null, hitstop = 0;

  // The chapita (or the ball) and its fading trail.
  let cap = null, capBrand = '';
  const trailGeometry = new THREE.BufferGeometry(), trailPoints = new Float32Array(3 * 24);
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPoints, 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 }));
  trail.frustumCulled = false; own.add(trail);
  const history = [];

  // Two jugada channels: the swing and contact juice, and the main jugada.
  // Each has its own effect pools so they can overlap; a third draws the
  // pitch flavours (fuego, loca, globito).
  const fxContact = createJugadaFx(own, { text: 1.6 }), fxMain = createJugadaFx(own, { text: 1.6 }), fxPitch = createJugadaFx(own, { text: 1.6 });
  const channels = [
    { player: createJugadas(own, { fx: fxContact, sfx: playSfx }), key: '', at: 0 },
    { player: createJugadas(own, { fx: fxMain, sfx: playSfx }), key: '', at: 0 },
  ];
  const [contactCh, mainCh] = channels;

  // The batter's timing aid at the plate: a ring where the chapita will cross
  // and an approach ring closing on it, green inside the swing window. It
  // drifts to the real arrival point once the break shows (60 % of the way).
  let mySeat = -1, feedback = null;
  const ringMaterial = (color) => new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, depthWrite: false, fog: false });
  const aim = new THREE.Mesh(new THREE.TorusGeometry(.24, .018, 8, 48), ringMaterial('#fffaf0'));
  const approach = new THREE.Mesh(new THREE.TorusGeometry(.24, .03, 8, 48), ringMaterial('#ffd23f'));
  aim.renderOrder = approach.renderOrder = 11; aim.visible = approach.visible = false; own.add(aim, approach);
  const aimAt = new THREE.Vector3();
  function drawAim(state, now) {
    const pitch = state.pitch, mine = mySeat >= 0 && state.batter === mySeat && state.phase === 'flight' && pitch && clocks.pitch && feedback?.id !== pitch.id;
    aim.visible = approach.visible = !!mine; if (!mine) return;
    const elapsed = (now - clocks.pitch) / 1000, T = pitch.time, w = ChapitaGame.prototype.window.call(state, state.batter, pitch), u = elapsed / T;
    const reveal = Math.min(1, Math.max(0, (u - .6) / .2)), end = pitch.target;
    aimAt.set(end.x * reveal, ROW_Y[1] + (end.y - ROW_Y[1]) * reveal, 0);
    const out = !pitch.arrives && reveal > .5, inside = Math.abs(elapsed - T) <= w, late = elapsed > T + w;
    const color = out || late ? '#ff5a3c' : inside ? '#8dff8a' : '#ffd23f';
    aim.material.color.set(inside && !out ? '#8dff8a' : '#fffaf0'); approach.material.color.set(color);
    approach.scale.setScalar(Math.max(1, 1 + 3 * (T - elapsed) / T)); aim.scale.setScalar(inside ? 1.15 + Math.sin(time * 40) * .05 : 1);
    approach.material.opacity = Math.min(1, u * 3); aim.material.opacity = .9;
    for (const ring of [aim, approach]) { ring.position.copy(aimAt); ring.quaternion.copy(camera.quaternion); }
    if (out) fxPitch.text('Déjala pasar', '#ff8f7a', aimAt.clone().add(new THREE.Vector3(0, .5, 0)), elapsed - .6 * T, { life: 2, size: .6, tilt: 0 });
  }
  // After your swing: early, late or right on it, and by how much.
  function drawFeedback() {
    if (!feedback) return;
    const age = time - feedback.at, { dt, w, height } = feedback, off = Math.abs(dt);
    const [word, color] = off <= w * .35 ? ['¡Perfecto!', '#8dff8a'] : off <= w ? ['¡Bien!', '#7cd8ff'] : dt < 0 ? ['¡Temprano!', '#ffb02e'] : ['¡Tarde!', '#ff5a3c'];
    const at = new THREE.Vector3(0, 2.1, -.2);
    fxPitch.text(word, color, at, age, { life: 1.4, size: .9, tilt: 0 });
    if (off > w * .35) fxPitch.text(`${off.toFixed(2).replace('.', ',')} s ${dt < 0 ? 'antes' : 'después'}`, '#ffffff', at.clone().add(new THREE.Vector3(0, -.42, 0)), age - .1, { life: 1.3, size: .45, tilt: 0 });
    if (!height && age < 1.4) fxPitch.text('Otra altura', '#ffb02e', at.clone().add(new THREE.Vector3(0, -.8, 0)), age - .15, { life: 1.2, size: .45, tilt: 0 });
    if (age > 1.6) feedback = null;
  }

  function setMap(id) {
    if (id === mapId) return;
    for (const ch of channels) { ch.player.stop(); ch.key = ''; }
    field?.dispose(); field = createField(id); mapId = id; own.add(field.group);
    for (const e of extras.splice(0)) e.character.dispose();
    crowdSpots(field, id).forEach(([x, y, z, angle, seated], i) => {
      const look = i === 0 ? { ...randomAvatar(rng(5)), hat: 'llanero', fur: '#d4914f', outfit: 'franela', outfitColor: '#f3e9d7' } : randomAvatar(rng(20 + i));
      const character = buildCharacter(normalizeAvatar(look), { seated });
      character.group.position.set(x, y, z); character.group.rotation.y = angle;
      if (i === 1) character.group.scale.setScalar(.72);   // the grandson next to his abuelo
      if (i === 0) { const paper = createPeriodico(); paper.scale.setScalar(1.7); paper.position.set(0, 2.1, 1.2); character.body.add(paper); }
      own.add(character.group); extras.push({ character, cheer: i * 1.3, reading: i === 0 });
    });
    senora?.character.dispose();
    senora = { character: buildCharacter(normalizeAvatar({ fur: '#e0a463', hat: 'lana', hatColor: '#ff6fae', outfit: 'hawaiana', outfitColor: '#ff6fae', face: 'wow', glasses: 'redondos' })), show: 0 };
    senora.character.group.position.set(field.senora.x, field.senora.y, field.senora.z); senora.character.group.visible = false;
    own.add(senora.character.group);
  }
  setMap('calle');

  function look(p) {
    const base = p.id === null ? { ...randomAvatar(rng(p.seat * 13 + 3)) } : normalizeAvatar(p.avatar);
    return normalizeAvatar({ ...base, outfit: 'franela', outfitColor: TEAM_COLORS[p.team] });
  }

  function dressPana(seat, p) {
    const slot = panas[seat], avatar = look(p), key = JSON.stringify([avatar, p.name, p.team, equipment]);
    if (slot.key === key) return;
    if (slot.character) for (const ch of channels) if (ch.player.active) { ch.player.stop(); ch.key = ''; }
    slot.character?.dispose(); slot.key = key;
    const character = buildCharacter(avatar); slot.character = character; character.seed = seat * 1.7 + 1; own.add(character.group);
    // The apodo and number on the back of the franela.
    const back = createApodo({ name: p.name, number: teamSeats(p.team).indexOf(seat) + 1, color: TEAM_COLORS[p.team] });
    back.position.set(0, .86, -.36); back.rotation.y = Math.PI; character.group.add(back); slot.back = back;
    slot.paloKind = p.id === null ? (p.style === 'abuelo' ? 'dorado' : BOT_PALOS[seat]) : 'escoba';
    const palo = equipment === 'pelota' ? createBate() : createPalo({ kind: slot.paloKind });
    palo.scale.setScalar(1.35); palo.position.set(0, -.7, .05); character.armR.add(palo); slot.palo = palo;
    const bump = createTuyuyo(); bump.scale.setScalar(1.6); bump.position.set(.12, 2.62, .52); bump.rotation.x = .5; character.body.add(bump); bump.visible = false; slot.bump = bump;
  }

  // Where each pana stands for this pitch.
  function spotOf(state, p) {
    const seat = p.seat;
    if (state.phase === 'lobby') { const team = teamSeats(p.team).indexOf(seat); return { x: (p.team ? 1.6 : -1.6) + (team - 1.5) * .2, z: -4 - team * 1.2, angle: p.team ? -Math.PI / 2 : Math.PI / 2 }; }
    const onBase = state.bases?.indexOf(seat) ?? -1;
    if (state.batter === seat && onBase < 0) return { x: p.zurdo ? .8 : -.8, z: .15, angle: p.zurdo ? -Math.PI / 2 : Math.PI / 2 };
    if (state.pitcher === seat) return { x: RELEASE.x, z: -RELEASE.d - .4, angle: 0 };
    const f = state.fielders?.indexOf(seat) ?? -1;
    if (f >= 0 && !state.derby) return { x: FIELDERS[f].x, z: -FIELDERS[f].d, angle: Math.atan2(-FIELDERS[f].x, FIELDERS[f].d) * .6 };
    const base = state.bases?.indexOf(seat) ?? -1;
    // A runner stands on the bag, a step outside the diamond, facing the plate.
    if (base >= 0) { const b = BASES[base], out = [[.5, .3], [0, -.5], [-.5, .3]][base]; return { x: b.x + out[0], z: b.z + out[1], angle: Math.atan2(-b.x, -b.z) }; }
    if (!state.derby && p.team === state.half) return BENCH(p.team, teamSeats(p.team).indexOf(seat));
    return FAN(seat);
  }

  function update(state, timing = clocks, me = mySeat) {
    const before = current; current = state; clocks = timing; mySeat = me;
    // A new game: everyone is already in place, nobody walks in from the lobby.
    if (before && before.round !== state.round) for (const s of panas) { s.pos = null; s.route.length = 0; s.base = -1; }
    setMap(state.options?.map || 'calle');
    equipment = state.options?.equipo === 'pelota' ? 'pelota' : 'chapita';
    field.diamond.visible = !state.derby;
    field.bases.forEach((marker, i) => {
      marker.visible = !state.derby;
      marker.material.color.set(state.bases?.[i] != null ? '#ffc629' : '#fffaf0');
    });
    for (const p of state.players) dressPana(p.seat, p);
    // A new cap for each pitch: its brand, bent when doblada; or the ball.
    const pitch = state.pitch, wanted = equipment === 'pelota' ? 'pelota' : pitch ? `${BRANDS[pitch.id % BRANDS.length]}|${pitch.cap}` : capBrand.includes('|') ? capBrand : 'kolita|plana';
    if (wanted !== capBrand) {
      cap?.userData.dispose(); const [brand, kind] = wanted.split('|');
      cap = wanted === 'pelota' ? createPelota() : createChapita({ brand, bent: kind === 'doblada' ? .8 : 0 }); cap.userData.size = wanted === 'pelota' ? 1.6 : 1.8; cap.scale.setScalar(cap.userData.size); own.add(cap); capBrand = wanted;
    }
    if (pitch && before?.pitch?.id !== pitch.id && state.phase === 'flight') {
      const s = panas[state.pitcher ?? -1]; if (s) s.throw = .45; history.length = 0;
      playSfx('throw'); if (pitch.flavor === 'fuego') playSfx('fire');
    }
    if (state.swing && pitch && swungPitch !== pitch.id) { swungPitch = pitch.id; swing(state.batter); }
    if ((state.hold === 'senora' || state.result?.kind === 'window') && senora) senora.show = Math.max(senora.show, 5.5);
    // The derby pitcher is El Abuelo from the bleachers.
    if (state.derby && !derbyPitcher) {
      derbyPitcher = buildCharacter(normalizeAvatar({ ...randomAvatar(rng(3)), hat: 'gorra', outfit: 'deportivo', outfitColor: '#2b2d42' }));
      derbyPitcher.group.position.set(0, 0, -RELEASE.d - .4); own.add(derbyPitcher.group);
    }
    if (derbyPitcher) derbyPitcher.group.visible = !!state.derby;
    direct(state);
  }

  // ---------- jugadas ----------
  const charOf = (seat) => seat === null || seat === undefined ? null : panas[seat]?.character || null;
  const pitcherChar = (state) => state.pitcher !== null && state.pitcher !== undefined ? charOf(state.pitcher) : derbyPitcher;
  function startJugada(channel, key, name, state, extra = {}) {
    if (channel.key === key) return;
    channel.key = key;
    if (!name) { channel.player.stop(); return; }
    if (channel === mainCh) syncSpots();
    const batterSlot = panas[state.batter ?? -1], batter = charOf(state.batter) || derbyPitcher, pitcher = pitcherChar(state);
    if (!batter) return;
    const homes = new Map();
    for (const s of panas) if (s.character) homes.set(s.character, s.character.group.position.clone().setY(0));
    if (derbyPitcher) homes.set(derbyPitcher, derbyPitcher.group.position.clone());
    const hit = state.hit, land = hit?.end?.point ? v3(hit.end.point) : capNow() || new THREE.Vector3(0, .1, -2);
    // The fielder closest to where the chapita ended, for the dog, the roof and the drain.
    const nearest = (to) => (state.fielders || []).map(charOf).filter(Boolean).sort((a, b) => a.group.position.distanceTo(to) - b.group.position.distanceTo(to))[0] || null;
    const crew = [batter, pitcher, ...(state.derby ? [] : (state.fielders || []).map(charOf))].filter(Boolean).map((ch, i) => [ch, ch.group.position.x > .3 ? 1 : ch.group.position.x < -.3 ? -1 : i % 2 ? 1 : -1]);
    const win = new THREE.Vector3((FIELD.window.x0 + FIELD.window.x1) / 2, (FIELD.window.y0 + FIELD.window.y1) / 2, -FIELD.wall + .1);
    const street = mapId !== 'cancha';
    channel.at = time;
    channel.player.start(name, {
      pitcher, batter, fielder: extra.fielder ?? nearest(land), victim: extra.victim, abuelo: extras[0]?.character, homes,
      palo: batterSlot?.palo || null, paloVisible: true, paloKind: batterSlot?.paloKind || 'escoba', crew: extra.crew || crew,
      contact: batter.group.position.clone().add(new THREE.Vector3(0, 1, -.6)), land, big: hit?.end?.kind === 'jonron', hbp: state.result?.kind === 'hbp', diveSide: extra.diveSide,
      batterHome: batter.group.position.clone().setY(0), pitcherHome: (pitcher || batter).group.position.clone().setY(0),
      window: win, wall: -FIELD.wall, wallTop: FIELD.wallTop, drain: new THREE.Vector3(DRAIN.x, .05, DRAIN.z), door: new THREE.Vector3(DOOR.x, 0, DOOR.z),
      bounceWall: new THREE.Vector3(-1.5, 2.4, -FIELD.wall + .2), carTop: new THREE.Vector3((FIELD.car.x0 + FIELD.car.x1) / 2, FIELD.car.h + .2, -(FIELD.car.d0 + FIELD.car.d1) / 2),
      passing: name === 'car' ? passingCar() : null, curb: FIELD.sideStreet - .9,
      carFrom: street ? new THREE.Vector3(1.4, 0, -34) : new THREE.Vector3(11.6, 0, 8), carTo: street ? new THREE.Vector3(1.4, 0, 12) : new THREE.Vector3(11.6, 0, -36),
      capNow, shots, duration: extra.duration,
    });
    if (name === 'dinner' && senora) senora.show = Math.max(senora.show, 4.4);
  }
  // Which jugada this state calls for, on which channel.
  function direct(state) {
    const hit = state.hit;
    if (state.phase === 'lobby') { for (const ch of channels) { ch.player.stop(); ch.key = ''; } return; }
    if (state.phase === 'finished') {
      const winners = state.players.filter(p => state.derby ? p.seat === state.winner : state.winner !== null && p.team === state.winner).map(p => [charOf(p.seat), 0]).filter(([ch]) => ch);
      return startJugada(mainCh, `final:${state.round}`, winners.length ? 'dance' : null, state, { crew: winners });
    }
    if (hit && state.phase === 'hit' && contactCh.key !== `hit:${hit.id}`) { hitstop = HITSTOP; startJugada(contactCh, `hit:${hit.id}`, hit.jugada === 'broken' ? 'broken' : 'hit', state); }
    if (hit?.after && state.phase === 'hit') {
      const seat = hit.chance?.seat, fielder = charOf(seat), at = hit.chance?.point ? v3(hit.chance.point) : null;
      const side = fielder && at ? Math.sign(fielder.group.worldToLocal(at.clone()).x || 1) : 1;
      startJugada(mainCh, `after:${hit.id}`, hit.after, state, { fielder, victim: fielder, diveSide: side });
    }
    if (mainCh.player.id === 'dance') { mainCh.player.stop(); mainCh.key = ''; syncSpots(); }
    if (state.hold === 'carro') startJugada(mainCh, `carro:${state.holdUntil}`, 'car', state);
    if (state.result && state.phase === 'result' && state.result.jugada) {
      const extra = state.result.jugada === 'bean' ? { victim: charOf(state.batter) } : {};
      startJugada(mainCh, `result:${state.result.n}`, state.result.jugada, state, extra);
    }
  }
  // Panas a jugada moved walk back from where it left them.
  function syncSpots() { for (const s of panas) if (s.character && s.pos) s.pos.copy(s.character.group.position).setY(0); }
  function passingCar() {
    if (!passing) { passing = CAR_BUILDERS.chamo(randomAvatar(rng(8))); own.add(passing.root); }
    return passing.root;
  }
  // The camera for each jugada: close on the window, the dog, the drain…
  const P = (x, y, z) => new THREE.Vector3(x, y, z);
  function shots(name, a) {
    const s = current, batter = charOf(s?.batter)?.group.position || P(0, 0, 0), land = s?.hit?.end?.point ? v3(s.hit.end.point) : P(0, 0, -8);
    const near = (target, off, lookUp = 1) => ({ pos: target.clone().add(off), look: target.clone().add(P(0, lookUp, 0)) });
    switch (name) {
      case 'window': return a < 1 ? { pos: P(2.5, 3.2, -FIELD.wall + 9), look: P(1.5, 2.2, -FIELD.wall) } : { pos: P(5, 5.5, 8), look: P(0, .8, -5) };
      case 'dog': return near(land, P(5, 3.6, 7), .4);
      case 'roof': return { pos: P(land.x + 3.5, 4.6, -FIELD.wall + 10), look: P(land.x, 3, -FIELD.wall) };
      case 'drain': return near(P(DRAIN.x, 0, DRAIN.z), P(-4.2, 3.4, 5.5), .3);
      case 'pinball': return { pos: P(0, 10, 7), look: P(-.5, 1, -17) };
      case 'grandpa': { const g = extras[0]?.character.group.position || P(6, 0, -12); return a < 1.1 ? near(g, P(-4.5, 2.6, 5.5), .8) : null; }
      case 'car': return { pos: P(-3, 5.5, 7), look: P(1, .8, -8) };
      case 'dinner': return { pos: P(3.2, 4.2, 7), look: P(-2.6, 1.1, -.5) };
      case 'home': return a < 1.8 ? near(batter, P(3.4, 2, 4.4), 1.3) : null;
      case 'miss': case 'helicopter': case 'bean': return near(batter, P(3, 2.2, 4.6), 1);
      case 'catch': { const f = mainChFielder(); return f ? near(f, P(3.2, 2.6, 5), .8) : null; }
      default: return null;
    }
  }
  const mainChFielder = () => { const seat = current?.hit?.chance?.seat; return seat !== undefined ? charOf(seat)?.group.position : null; };

  function swing(seat) {
    const s = panas[seat]; if (s && s.swing <= 0) s.swing = .42;
    if (current) startJugada(contactCh, `swing:${current.pitch?.id || 0}`, 'swing', current);
  }

  // Where the chapita is right now, from the HUD's clocks.
  const capPos = new THREE.Vector3();
  function capPoint(state, now) {
    if (state.hit && (state.phase === 'hit' || state.phase === 'result') && clocks.hit) {
      const hit = state.hit, t = Math.min((now - clocks.hit) / 1000, hit.end.t + (hit.end.kind === 'jonron' ? .8 : 0));
      if (t <= hit.end.t || hit.end.kind === 'jonron') return v3(hitPoint(hit, t));
      // Off the car, the post or the wall it drops to the street.
      const end = hit.end.point, fall = Math.min(1, (t - hit.end.t) / .5);
      return new THREE.Vector3(end.x, Math.max(.05, end.y * (1 - fall)), -end.d + (hit.end.kind === 'caught' || hit.end.kind === 'chapazo' ? 0 : .4 * fall));
    }
    if (state.pitch && state.phase === 'flight' && clocks.pitch) return v3(pitchPoint(state.pitch, (now - clocks.pitch) / 1000 / state.pitch.time));
    if (state.pitch && state.phase === 'result' && clocks.pitch) return v3(pitchPoint(state.pitch, 1.2));
    const pitcher = pitcherChar(state);
    if (pitcher && ['pitch', 'lobby'].includes(state.phase)) return pitcher.armR.getWorldPosition(capPos).add(new THREE.Vector3(0, -.2, .2));
    return null;
  }
  let lastCap = null;
  const capNow = () => lastCap?.clone() || null;

  // The pitch in the air: fire, a rainbow of stars or a slow little float.
  function drawFlavor(state, point, now) {
    fxPitch.begin(true);
    drawAim(state, now); drawFeedback();
    const flavor = state.pitch?.flavor;
    if (point && flavor && state.phase === 'flight') {
      const recent = history.slice(-7).reverse();
      recent.forEach((p, k) => {
        if (flavor === 'fuego') fxPitch.puff(p, .85 - k * .07, .8 - k * .09, k < 2 ? '#fff0a0' : k < 4 ? '#ffb02e' : '#ff5a1f');
        else if (flavor === 'loca') fxPitch.star(p, .34 - k * .03, time * 6 + k, .9 - k * .11, ['#ff4b4b', '#ffc629', '#2ad1b2', '#9b6bff'][k % 4]);
      });
      if (flavor === 'fuego') fxPitch.puff(point, 1.2 + .12 * Math.sin(time * 30), .6, '#ffcf4a');
      if (flavor === 'globito') fxPitch.text('…', '#ffffff', point.clone().add(new THREE.Vector3(0, .35, 0)), clocks.pitch ? (performance.now() - clocks.pitch) / 1000 : 0, { life: 2, size: .5, tilt: 0 });
    }
    fxPitch.end();
  }

  const lookAt = new THREE.Vector3(0, 1.3, -9), camPos = new THREE.Vector3(0, 2.2, 4.6), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let time = 0;
  function frame(dt) {
    const { w, h } = stage.resize(); time += dt;
    const state = current, now = performance.now();
    if (!state) { stage.draw(dt); return; }
    hitstop = Math.max(0, hitstop - dt);
    // Panas walk to their spots and play their part.
    for (const p of state.players) {
      const slot = panas[p.seat], character = slot.character; if (!character) continue;
      const spot = spotOf(state, p);
      let target = new THREE.Vector3(spot.x, 0, spot.z);
      if (!slot.pos) slot.pos = target.clone();
      // Runners go round the diamond: through every bag on the way, and home
      // when they score, instead of cutting across the street.
      const base = state.bases?.indexOf(p.seat) ?? -1, from = slot.base ?? -1;
      if (base !== from) {
        const at = (i) => new THREE.Vector3(BASES[i].x, 0, BASES[i].z);
        if (base > from && (from >= 0 || slot.wasBatter)) for (let i = from + 1; i < base; i++) slot.route.push(at(i));
        else if (base < 0 && from >= 0 && state.phase === 'result') { for (let i = from + 1; i < 3; i++) slot.route.push(at(i)); slot.route.push(new THREE.Vector3(0, 0, 0)); }
        slot.base = base;
      }
      slot.wasBatter = state.batter === p.seat;
      if (slot.route.length && slot.pos.distanceTo(slot.route[0]) < .25) slot.route.shift();
      if (slot.route.length) target = slot.route[0];
      const gap = target.clone().sub(slot.pos), far = gap.length(), walking = far > .08, running = far > 3 || slot.route.length > 0;
      if (walking) slot.pos.addScaledVector(gap.normalize(), Math.min(far, dt * (running ? 8 : 3.5)));
      const heading = walking ? Math.atan2(gap.x, gap.z) : spot.angle;
      slot.angle += Math.atan2(Math.sin(heading - slot.angle), Math.cos(heading - slot.angle)) * Math.min(1, dt * 8);
      character.group.position.copy(slot.pos);
      const batting = state.batter === p.seat && base < 0 && !walking && state.phase !== 'lobby' && state.phase !== 'finished';
      slot.palo.visible = batting || (state.phase === 'lobby' && p.seat % 2 === 0);
      slot.bump.visible = !!p.tuyuyo;
      let yaw = slot.angle;
      character.update(dt, walking ? { walk: true, run: running } : {});
      if (walking) { character.group.rotation.y = yaw; continue; }
      const [armL, armR] = [character.armL, character.armR];
      if (batting) {
        // Stance: the stick up over the back shoulder; the swing whips through.
        const s = slot.swing > 0 ? 1 - slot.swing / .42 : 0, side = p.zurdo ? -1 : 1;
        if (hitstop <= 0) slot.swing = Math.max(0, slot.swing - dt);
        yaw += side * (s > 0 ? Math.sin(Math.min(1, s * 1.6) * Math.PI / 2) * 1.9 - .2 : -.2);
        armR.rotation.set(-1.9 + s * 1.2, 0, -.6 + s * .9); armL.rotation.set(-1.7 + s * 1.1, 0, .9 - s * .5);
        slot.palo.rotation.set(Math.PI / 2 - .2 + s * 1.3, 0, 0);   // up over the shoulder, then level through the zone
      } else if (state.pitcher === p.seat) {
        slot.throw = Math.max(0, slot.throw - dt);
        const k = slot.throw > 0 ? slot.throw / .45 : 0;
        armR.rotation.set(state.phase === 'pitch' ? -2.6 : -2.6 * k - .4, 0, -.3); armL.rotation.set(-.8, 0, .4);
      } else if (state.hit?.chance?.seat === p.seat && (state.hit.caught || (state.phase === 'hit' && state.hit.caught === null && clocks.hit && Math.abs((now - clocks.hit) / 1000 - state.hit.chance.t) < .25))) {
        armR.rotation.set(-2.4, 0, -.2); armL.rotation.set(-2.4, 0, .2);
      } else {
        const cheer = state.result && ['jonron', 'post', 'car'].includes(state.result.kind) && p.team === state.half && state.phase === 'result';
        const k = cheer ? -2.6 + Math.sin(time * 9 + p.seat) * .3 : -.15;
        armR.rotation.set(k, 0, -.35); armL.rotation.set(k, 0, .35);
      }
      character.group.rotation.y = yaw;
    }
    if (derbyPitcher) derbyPitcher.update(dt, {});
    for (const e of extras) {
      e.character.update(dt, {});
      const loud = current.result && ['jonron', 'window', 'chapazo'].includes(current.result.kind) && current.phase === 'result';
      if (e.reading && !loud) e.character.arms.forEach((arm, i) => arm.rotation.set(-1.3, 0, i ? -.28 : .28));
      else e.character.arms.forEach((arm, i) => { arm.rotation.x = loud ? -2.4 + Math.sin(time * 8 + e.cheer + i) * .4 : -.2; });
    }
    // The señora leans out yelling, then goes back in.
    if (senora) {
      senora.show = Math.max(0, senora.show - dt); senora.character.group.visible = senora.show > 0;
      if (senora.show > 0) {
        senora.character.update(dt, {});
        senora.character.arms.forEach((arm, i) => { arm.rotation.x = -2 + Math.sin(time * 11 + i * 2) * .6; });
      }
    }
    // The chapita, then whatever the jugadas do to it.
    let point = capPoint(state, now), shake = 0, shot = null;
    lastCap = point;
    for (const ch of channels) {
      if (!ch.player.active) continue;
      const out = ch.player.sample(time - ch.at);
      if (out.cap) point = out.cap; if (out.hideCap) point = null;
      shake += out.shake; shot = out.shot || shot;
      if (out.done) { ch.player.stop(); if (ch === mainCh) syncSpots(); }
    }
    cap.visible = !!point;
    if (point) {
      // Bigger in the air so the batter can follow it all the way in.
      cap.position.copy(point); cap.rotation.y += dt * 18; cap.rotation.x = Math.sin(time * 7) * .5;
      cap.scale.setScalar(cap.userData.size * (state.phase === 'flight' ? 1.6 : 1));
      history.push(point.clone()); if (history.length > 24) history.shift();
    } else history.length = 0;
    drawFlavor(state, point, now);
    const flying = state.phase === 'flight' || state.phase === 'hit';
    trail.visible = flying && history.length > 1;
    for (let i = 0; i < 24; i++) { const p = history[Math.max(0, history.length - 24 + i)] || point || camPos; trailPoints.set([p.x, p.y, p.z], i * 3); }
    trailGeometry.attributes.position.needsUpdate = true;
    // The camera: an orbit over the street in the lobby, behind the plate
    // while pitching, up with the batted chapita, and a jugada's own shot.
    if (state.phase === 'lobby' || state.phase === 'finished') {
      const a = Math.sin(time * .12) * .5;
      wantPos.set(Math.sin(a) * 14, 8.5, 9 + Math.cos(a) * 2); wantLook.set(0, 1, -12);
    } else if (shot) {
      wantPos.copy(shot.pos); wantLook.copy(shot.look);
      // Never inside a house: the near street is narrow, the cross street wider.
      const half = mapId === 'cancha' || wantPos.z < -FIELD.acera ? FIELD.crossStreet - .6 : FIELD.sideStreet - .8;
      wantPos.x = Math.max(-half, Math.min(half, wantPos.x)); wantPos.z = Math.max(-FIELD.wall + 1.5, wantPos.z);
    } else if (state.hit && (state.phase === 'hit' || state.phase === 'result') && point && clocks.hit) {
      const far = Math.min(1, Math.max(0, -point.z / 26));
      wantPos.set(point.x * .35, 2.6 + far * 4.5, 4.6 - far * 4); wantLook.copy(point).lerp(new THREE.Vector3(0, 1, -16), .25);
    } else {
      // Behind the plate, a step off the batter's side so they never hide the pitcher.
      const side = state.players[state.batter]?.zurdo ? -1 : 1;
      wantPos.set(side * 1.1, 4.2, 7.6); wantLook.set(side * .2, .6, -6.5);
    }
    if (debugView) { wantPos.set(...debugView[0]); wantLook.set(...debugView[1]); }
    const ease = debugView ? 1 : Math.min(1, dt * 3.2);
    camPos.lerp(wantPos, ease); lookAt.lerp(wantLook, ease);
    camera.fov = w < h ? 72 : 48; camera.aspect = w / h; camera.position.copy(camPos);
    if (shake > 0 && !STILL && !debugView) camera.position.add(new THREE.Vector3(Math.sin(time * 83) * shake, Math.sin(time * 97 + 1) * shake * .7, Math.cos(time * 71) * shake));
    camera.lookAt(lookAt); camera.updateProjectionMatrix();
    field?.update(time);
    stage.draw(dt);
  }

  function dispose() {
    for (const ch of channels) ch.player.dispose();
    [fxContact, fxMain, fxPitch].forEach(f => f.dispose());
    panas.forEach(s => s.character?.dispose()); extras.forEach(e => e.character.dispose());
    senora?.character.dispose(); derbyPitcher?.dispose(); passing?.root.userData.dispose?.();
    cap?.userData.dispose(); trailGeometry.dispose(); trail.material.dispose();
    field?.dispose(); stage.dispose();
  }
  return { renderer, scene, camera, update, frame, swing, dispose, get map() { return mapId; },
    // For the browser suite and Studio checks: what is playing, and a way to play one.
    get jugada() { return { contact: contactCh.player.id, main: mainCh.player.id }; },
    get aim() { return { visible: approach.visible, scale: approach.scale.x, color: '#' + approach.material.color.getHexString(), at: aim.position.toArray().map(n => +n.toFixed(2)) }; },
    swingFeedback(dt, w, height = true) { feedback = { dt, w, height, at: time, id: current?.pitch?.id }; },
    playJugada(name, state = current) { if (state) startJugada(mainCh, `debug:${name}:${time}`, name, state); },
    view(pos, look) { debugView = pos ? [pos, look] : null; } };
}
