// Bululú's dice on the board: they wait, spinning, over the pana's head, get
// shaken while a human holds the throw, then fly onto the board in front of the
// pana (toward the camera) with bounces. A throw is a small spec, so online
// screens replay the host's exact flight. The opening roll-off lives here too.
import * as THREE from 'three';
import { createToss } from '/engine/dice-throw.js';
import { rollOffGroups } from '/engine/roll-off.js';
import { sound } from '/engine/fx.js';

export function createDiceTable({ dice, board, camera, puffs }) {
  const axis = new THREE.Vector3(), spin = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // The rolled face (+Z) toward the camera; lookAt's +Z points back at the eye.
  const facing = (at) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position, at, up));
  function hold(p, count) {
    const tk = p.token;
    dice.forEach((d, k) => {
      d.mesh.visible = d.rolling = k < count;
      d.toss = d.spec = null;
      d.mesh.position.set(tk.rest.x + (count === 1 ? 0 : k ? 0.95 : -0.95), tk.rest.y + 4.8, tk.rest.z);
    });
    tk.pin.visible = false;
    sound.unlock();
  }
  function start(d, spec) {
    d.spec = spec; d.value = spec.value; d.show(spec.value); d.rolling = false; d.mesh.visible = true;
    d.toss = { path: createToss({ from: spec.from, to: spec.to, power: spec.power, height: 3.4, gravity: 34, seed: spec.seed }),
      t: -(spec.delay || 0), hit: 0, final: facing(new THREE.Vector3(...spec.to)) };
  }
  // Starts the throw of these values; returns the seconds until every die rests.
  function toss(p, values, power) {
    const tk = p.token, seed = Math.floor(Math.random() * 2 ** 31);
    let longest = 0;
    values.forEach((value, k) => {
      const d = dice[k], side = values.length === 1 ? 0 : k ? 1 : -1;
      const x = tk.rest.x + side * 1.1 + (((seed >>> (k * 5)) & 31) / 31 - 0.5) * 0.8, z = tk.rest.z + 2 + power * 2.4;
      const to = [x, Math.max(board.groundAt(x, z), tk.rest.y - 0.2) + 0.7, z];
      start(d, { serial: `${seed}:${k}`, from: d.mesh.position.toArray(), to, power, seed: seed + k * 7919, value, delay: k * 0.08 });
      longest = Math.max(longest, d.toss.path.duration + k * 0.08);
    });
    sound.whoosh();
    return longest + 0.15;
  }
  function fly(d, dt) {
    const toss = d.toss;
    toss.t += dt;
    if (toss.t < 0) return;
    const s = toss.path.at(toss.t);
    d.mesh.position.fromArray(s.position);
    d.mesh.quaternion.copy(toss.final).premultiply(spin.setFromAxisAngle(axis.fromArray(s.axis), s.turn));
    while (toss.hit < toss.path.impacts.length && toss.t >= toss.path.impacts[toss.hit].t) {
      const hit = toss.path.impacts[toss.hit++];
      sound.bonk(0.3 + hit.strength * 0.5);
      if (hit.strength === 1) puffs.spawn(new THREE.Vector3(s.position[0], s.position[1] - 0.6, s.position[2]), { color: 0xd9c9a3, count: 4, spread: 0.6, size: 0.5, rise: 0.8, life: 0.6 });
    }
    if (s.done) d.toss = null;
  }
  // Every frame; shake is how hard the local human is shaking (0–1).
  function update(dt, t, shake) {
    for (const d of dice) {
      if (!d.mesh.visible) continue;
      if (d.toss) fly(d, dt);
      else if (d.rolling) {
        d.spin(dt * (1 + shake * 2.5));
        if (shake) d.mesh.position.y += Math.sin(t * 40 + d.mesh.position.x) * shake * 0.06;
      } else d.mesh.quaternion.slerp(facing(d.mesh.position), Math.min(1, dt * 12));
    }
  }
  // A host snapshot: replay a new throw, otherwise follow the host.
  function apply(d, v) {
    if (v.toss && v.toss.serial !== d.spec?.serial) start(d, v.toss);
    if (!v.toss) d.spec = d.toss = null;
    if (!d.toss) d.mesh.position.fromArray(v.pos);
    d.mesh.visible = v.visible; d.rolling = v.rolling;
    // Spinning changes the painted face even when consecutive results match.
    if (v.value && !d.toss) { d.value = v.value; if (!v.rolling) d.show(v.value); }
  }
  return { hold, toss, update, apply };
}

// One die per pana; the highest starts. A tie throws again among the tied, so
// the whole turn order comes out of the dice. throwOne(i) → that pana's value;
// tied(ids) announces a tie before it is thrown again.
export async function rollOffOrder(ids, throwOne, tied) {
  const result = [];
  let groups = [ids];
  while (groups.length) {
    const group = groups.shift();
    if (group.length === 1) { result.push(group[0]); continue; }
    const rolls = [];
    for (const id of group) rolls.push({ id, value: await throwOne(id) });
    const split = rollOffGroups(rolls), tie = split.find((g) => g.length > 1);
    if (tie) await tied(tie);
    groups = [...split, ...groups];
  }
  return result;
}
