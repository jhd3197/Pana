// Chapita in 3D: the field from street.js, every pana in the team's franela
// with the apodo on the back, the chapita tracing field.js's paths and a
// camera behind the plate that follows the batted cap. Timing comes from the
// HUD's clocks (game.js), so what a batter sees is what they swing at.
import * as THREE from 'three';
import { createTableWorld } from '/engine/worlds/table-world.js';
import { buildCharacter } from '/engine/models/characters/pana/avatar-model.js';
import { normalizeAvatar, randomAvatar } from '/engine/avatar.js';
import { rng } from '/engine/random.js';
import { CAR_BUILDERS } from '/engine/models/vehicles/cars.js';
import { BASES, RELEASE, FIELDERS, pitchPoint, hitPoint } from './field.js';
import { SEATS, teamSeats } from './rules.js';
import { createField, crowdSpots } from './street.js';
import { createChapita, createPalo, createTuyuyo, createApodo } from './studio-set.js';

export const TEAM_COLORS = ['#e8453c', '#2f7fe0'];
const BOT_PALOS = ['escoba', 'coleto', 'teipe', 'tricolor', 'escoba', 'teipe', 'coleto', 'escoba'];
const BRANDS = ['kolita', 'malta', 'uvita', 'tricolor'];
const v3 = (p) => new THREE.Vector3(p.x, p.y, -p.d);
const BENCH = (team, i) => ({ x: -3.9, z: -2.2 - i * 1.15, angle: Math.PI / 2 });
const FAN = (seat) => ({ x: (seat % 2 ? 1 : -1) * (5.6 + (seat >> 1) * .9), z: -12 - (seat >> 1) * .3, angle: Math.PI });

export function createChapitaScene(canvas) {
  const stage = createTableWorld(canvas, { arena: false, fit: 'window', fov: 48, fog: [60, 170],
    sun: { box: 34, far: 110, position: [-18, 30, 14] } });
  const { renderer, scene, camera } = stage, own = new THREE.Group(); scene.add(own);
  let field = null, mapId = '', current = null, clocks = { pitch: null, hit: null };
  const panas = Array.from({ length: SEATS }, () => ({ character: null, key: '', pos: null, angle: 0, palo: null, back: null, bump: null, swing: 0, throw: 0 }));
  const extras = [];   // the señora, the derby pitcher, the crowd
  let senora = null, derbyPitcher = null, passing = null, passT = -1, swungPitch = 0, debugView = null;

  // The chapita and its fading trail.
  let cap = createChapita({ brand: 'kolita' }), capBrand = 'kolita|plana';
  cap.scale.setScalar(1.8); own.add(cap);
  const trailGeometry = new THREE.BufferGeometry(), trailPoints = new Float32Array(3 * 24);
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPoints, 3));
  const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55 }));
  trail.frustumCulled = false; own.add(trail);
  const history = [];

  function setMap(id) {
    if (id === mapId) return;
    field?.dispose(); field = createField(id); mapId = id; own.add(field.group);
    for (const e of extras.splice(0)) e.character.dispose();
    crowdSpots(field, id).forEach(([x, y, z, angle, seated], i) => {
      const look = i === 0 ? { ...randomAvatar(rng(5)), hat: 'llanero', fur: '#d4914f', outfit: 'franela', outfitColor: '#f3e9d7' } : randomAvatar(rng(20 + i));
      const character = buildCharacter(normalizeAvatar(look), { seated });
      character.group.position.set(x, y, z); character.group.rotation.y = angle;
      if (i === 1) character.group.scale.setScalar(.72);   // the grandson next to his abuelo
      own.add(character.group); extras.push({ character, cheer: i * 1.3 });
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
    const slot = panas[seat], avatar = look(p), key = JSON.stringify([avatar, p.name, p.team]);
    if (slot.key === key) return;
    slot.character?.dispose(); slot.key = key;
    const character = buildCharacter(avatar); slot.character = character; own.add(character.group);
    // The apodo and number on the back of the franela.
    const back = createApodo({ name: p.name, number: teamSeats(p.team).indexOf(seat) + 1, color: TEAM_COLORS[p.team] });
    back.position.set(0, .86, -.36); back.rotation.y = Math.PI; character.group.add(back); slot.back = back;
    const palo = createPalo({ kind: p.id === null ? (p.style === 'abuelo' ? 'dorado' : BOT_PALOS[seat]) : 'escoba' });
    palo.scale.setScalar(1.35); palo.position.set(0, -.7, .05); character.armR.add(palo); slot.palo = palo;
    const bump = createTuyuyo(); bump.scale.setScalar(1.6); bump.position.set(.12, 2.62, .52); bump.rotation.x = .5; character.body.add(bump); bump.visible = false; slot.bump = bump;
  }

  // Where each pana stands for this pitch.
  function spotOf(state, p) {
    const seat = p.seat;
    if (state.phase === 'lobby') { const team = teamSeats(p.team).indexOf(seat); return { x: (p.team ? 1.6 : -1.6) + (team - 1.5) * .2, z: -4 - team * 1.2, angle: p.team ? -Math.PI / 2 : Math.PI / 2 }; }
    if (state.batter === seat) return { x: p.zurdo ? .8 : -.8, z: .15, angle: p.zurdo ? -Math.PI / 2 : Math.PI / 2 };
    if (state.pitcher === seat) return { x: RELEASE.x, z: -RELEASE.d - .4, angle: 0 };
    const f = state.fielders?.indexOf(seat) ?? -1;
    if (f >= 0 && !state.derby) return { x: FIELDERS[f].x, z: -FIELDERS[f].d, angle: Math.atan2(-FIELDERS[f].x, FIELDERS[f].d) * .6 };
    const base = state.bases?.indexOf(seat) ?? -1;
    if (base >= 0) return { x: BASES[base].x + .85, z: BASES[base].z, angle: -Math.PI / 2 };
    if (!state.derby && p.team === state.half) return BENCH(p.team, teamSeats(p.team).indexOf(seat));
    return FAN(seat);
  }

  function update(state, timing = clocks) {
    const before = current; current = state; clocks = timing;
    // A new game: everyone is already in place, nobody walks in from the lobby.
    if (before && before.round !== state.round) for (const s of panas) s.pos = null;
    setMap(state.options?.map || 'calle');
    field.bases.forEach((marker, i) => {
      marker.visible = !state.derby;
      marker.material.color.set(state.bases?.[i] != null ? '#ffc629' : '#fffaf0');
    });
    for (const p of state.players) dressPana(p.seat, p);
    // A new cap for each pitch: its brand, bent when doblada.
    const pitch = state.pitch, wanted = pitch ? `${BRANDS[pitch.id % BRANDS.length]}|${pitch.cap}` : capBrand;
    if (wanted !== capBrand) {
      cap.userData.dispose(); const [brand, kind] = wanted.split('|');
      cap = createChapita({ brand, bent: kind === 'doblada' ? .8 : 0 }); cap.scale.setScalar(1.8); own.add(cap); capBrand = wanted;
    }
    if (pitch && before?.pitch?.id !== pitch.id && state.phase === 'flight') { const s = panas[state.pitcher ?? -1]; if (s) s.throw = .45; history.length = 0; }
    if (state.swing && pitch && swungPitch !== pitch.id) { swungPitch = pitch.id; swing(state.batter); }
    if (state.hold === 'carro' && before?.hold !== 'carro') passT = 0;
    if ((state.hold === 'senora' || state.result?.kind === 'window') && senora) senora.show = 5.5;
    // The derby pitcher is El Abuelo from the bleachers.
    if (state.derby && !derbyPitcher) {
      derbyPitcher = buildCharacter(normalizeAvatar({ ...randomAvatar(rng(3)), hat: 'gorra', outfit: 'deportivo', outfitColor: '#2b2d42' }));
      derbyPitcher.group.position.set(0, 0, -RELEASE.d - .4); own.add(derbyPitcher.group);
    }
    if (derbyPitcher) derbyPitcher.group.visible = !!state.derby;
  }

  function swing(seat) { const s = panas[seat]; if (s && s.swing <= 0) s.swing = .42; }

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
    const pitcher = state.pitcher !== null && state.pitcher !== undefined ? panas[state.pitcher].character : derbyPitcher;
    if (pitcher && ['pitch', 'lobby'].includes(state.phase)) return pitcher.armR.getWorldPosition(capPos).add(new THREE.Vector3(0, -.2, .2));
    return null;
  }

  const lookAt = new THREE.Vector3(0, 1.3, -9), camPos = new THREE.Vector3(0, 2.2, 4.6), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  let time = 0;
  function frame(dt) {
    const { w, h } = stage.resize(); time += dt;
    const state = current, now = performance.now();
    if (!state) { stage.draw(dt); return; }
    // Panas walk to their spots and play their part.
    for (const p of state.players) {
      const slot = panas[p.seat], character = slot.character; if (!character) continue;
      const spot = spotOf(state, p), target = new THREE.Vector3(spot.x, 0, spot.z);
      if (!slot.pos) slot.pos = target.clone();
      const gap = target.clone().sub(slot.pos), far = gap.length(), walking = far > .08, running = far > 3;
      if (walking) slot.pos.addScaledVector(gap.normalize(), Math.min(far, dt * (running ? 8 : 3.5)));
      const heading = walking ? Math.atan2(gap.x, gap.z) : spot.angle;
      slot.angle += Math.atan2(Math.sin(heading - slot.angle), Math.cos(heading - slot.angle)) * Math.min(1, dt * 8);
      character.group.position.copy(slot.pos);
      const batting = state.batter === p.seat && !walking && state.phase !== 'lobby' && state.phase !== 'finished';
      slot.palo.visible = batting || (state.phase === 'lobby' && p.seat % 2 === 0);
      slot.bump.visible = !!p.tuyuyo;
      let yaw = slot.angle;
      character.update(dt, walking ? { walk: true, run: running } : {});
      if (walking) { character.group.rotation.y = yaw; continue; }
      const [armL, armR] = [character.armL, character.armR];
      if (batting) {
        // Stance: the stick up over the back shoulder; the swing whips through.
        const s = slot.swing > 0 ? 1 - slot.swing / .42 : 0, side = p.zurdo ? -1 : 1;
        slot.swing = Math.max(0, slot.swing - dt);
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
      e.character.arms.forEach((arm, i) => { arm.rotation.x = loud ? -2.4 + Math.sin(time * 8 + e.cheer + i) * .4 : -.2; });
    }
    // The señora leans out yelling, then goes back in.
    if (senora) {
      senora.show = Math.max(0, senora.show - dt); senora.character.group.visible = senora.show > 0;
      if (senora.show > 0) {
        senora.character.update(dt, {});
        senora.character.arms.forEach((arm, i) => { arm.rotation.x = -2 + Math.sin(time * 11 + i * 2) * .6; });
      }
    }
    // A car rolls through: ¡tiempo!
    if (passT >= 0) {
      if (!passing) { passing = CAR_BUILDERS.chamo(randomAvatar(rng(8))); own.add(passing.root); }
      passT += dt; passing.root.visible = passT < 3.4;
      // Across the cross street; on the court, down the street outside the fence.
      const k = passT / 3.4;
      if (mapId === 'cancha') { passing.root.position.set(11.6, 0, 8 - k * 44); passing.root.rotation.y = Math.PI; }
      else { passing.root.position.set(-18 + k * 36, 0, -17.5); passing.root.rotation.y = Math.PI / 2; }
      if (passT >= 3.4) passT = -1;
    }
    // The chapita, spinning, with its trail.
    const point = capPoint(state, now);
    cap.visible = !!point;
    if (point) {
      cap.position.copy(point); cap.rotation.y += dt * 18; cap.rotation.x = Math.sin(time * 7) * .5;
      history.push(point.clone()); if (history.length > 24) history.shift();
    } else history.length = 0;
    const flying = state.phase === 'flight' || state.phase === 'hit';
    trail.visible = flying && history.length > 1;
    for (let i = 0; i < 24; i++) { const p = history[Math.max(0, history.length - 24 + i)] || point || camPos; trailPoints.set([p.x, p.y, p.z], i * 3); }
    trailGeometry.attributes.position.needsUpdate = true;
    // The camera: an orbit over the street in the lobby, behind the plate
    // while pitching, and up with the batted chapita.
    if (state.phase === 'lobby' || state.phase === 'finished') {
      const a = Math.sin(time * .12) * .5;
      wantPos.set(Math.sin(a) * 14, 8.5, 9 + Math.cos(a) * 2); wantLook.set(0, 1, -12);
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
    camera.fov = w < h ? 72 : 48; camera.aspect = w / h; camera.position.copy(camPos); camera.lookAt(lookAt); camera.updateProjectionMatrix();
    field?.update(time);
    stage.draw(dt);
  }

  function dispose() {
    panas.forEach(s => s.character?.dispose()); extras.forEach(e => e.character.dispose());
    senora?.character.dispose(); derbyPitcher?.dispose();
    cap.userData.dispose(); trailGeometry.dispose(); trail.material.dispose();
    field?.dispose(); stage.dispose();
  }
  return { renderer, scene, camera, update, frame, swing, dispose, get map() { return mapId; },
    view(pos, look) { debugView = pos ? [pos, look] : null; } };
}
