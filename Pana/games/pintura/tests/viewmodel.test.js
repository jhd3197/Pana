import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewmodel, recoilOf } from '../public/viewmodel.js';

const prop = () => ({ position: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: { x: 0, y: 0, z: 0, set(x, y, z) { Object.assign(this, { x, y, z }); } }, userData: {} });
const base = { weapon: 'pistol', fired: 0, reload: 0, reloadTime: 1.3, sprint: false, bob: 0, sway: 0, down: false, air: 0, push: 0 };
const settle = (vm, held, o, frames = 60) => { for (let i = 0; i < frames; i++) vm.update(1 / 60, { ...base, ...o, held }); };

test('a shot kicks the marker back and up, then it settles', () => {
  const vm = createViewmodel(), held = prop(); settle(vm, held, {});
  const rest = { z: held.position.z, x: held.rotation.x };
  const out = vm.update(1 / 60, { ...base, fired: 1, held });
  assert.ok(held.position.z > rest.z + .03 && held.rotation.x > rest.x + .1 && out.flash > .5);
  settle(vm, held, { fired: 1 }, 90);
  assert.ok(Math.abs(held.position.z - rest.z) < 1e-3);
});

test('weapons recoil differently: the rocket kicks harder than the rapid pair', () => {
  assert.ok(recoilOf('rocket').back > recoilOf('scatter').back && recoilOf('scatter').back > recoilOf('pistol').back && recoilOf('pistol').back > recoilOf('rapid').back);
  assert.equal(recoilOf('nope'), recoilOf('pistol'));
});

test('sprinting lowers the marker and tilts the muzzle down', () => {
  const vm = createViewmodel(), held = prop(); settle(vm, held, {});
  const y = held.position.y, rx = held.rotation.x; settle(vm, held, { sprint: true });
  assert.ok(held.position.y < y - .08 && held.rotation.x < rx - .4 && held.rotation.z < -.3);
  settle(vm, held, { sprint: true, down: true }, 90);
  assert.ok(Math.abs(held.position.y - y) < .02, 'a downed pana holds it up again');
});

test('reloading dips the marker away and brings it back', () => {
  const vm = createViewmodel(), held = prop(); settle(vm, held, {});
  const y = held.position.y; let low = y;
  for (let i = 0; i <= 78; i++) { vm.update(1 / 60, { ...base, held, reload: 1.3 - i / 60 }); low = Math.min(low, held.position.y); }
  assert.ok(low < y - .1);
  settle(vm, held, {}, 30);
  assert.ok(Math.abs(held.position.y - y) < .01);
});

test('switching weapons raises the new one from below', () => {
  const vm = createViewmodel(), held = prop(); settle(vm, held, {});
  const y = held.position.y; vm.update(1 / 60, { ...base, weapon: 'scatter', held });
  assert.ok(held.position.y < y - .2);
  settle(vm, held, { weapon: 'scatter' });
  assert.ok(Math.abs(held.position.y - y) < .01);
});

test('Las Gemelas fire one hand at a time', () => {
  const vm = createViewmodel(), held = prop(); held.userData.hands = [prop(), prop()]; settle(vm, held, { weapon: 'rapid' });
  vm.update(1 / 60, { ...base, weapon: 'rapid', fired: 1, held });
  assert.ok(held.userData.hands[1].position.z > 0 && held.userData.hands[0].position.z === 0);
  vm.update(1 / 60, { ...base, weapon: 'rapid', fired: 2, held });
  assert.ok(held.userData.hands[0].position.z > 0 && held.userData.hands[1].position.z === 0);
});

test('idle breathing stays within a hand-width', () => {
  const vm = createViewmodel(), held = prop(); let lo = 9, hi = -9;
  for (let i = 0; i < 600; i++) { vm.update(1 / 60, { ...base, held }); lo = Math.min(lo, held.position.y); hi = Math.max(hi, held.position.y); }
  assert.ok(hi - lo > .004 && hi - lo < .02);
});

test('the heavy new markers kick hardest: La Bazuca over La Lejana over El Trueno', () => {
  assert.ok(recoilOf('bazooka').back > recoilOf('sniper').back && recoilOf('sniper').back > recoilOf('scatter').back);
  assert.ok(recoilOf('bazooka').shake > recoilOf('pistol').shake && recoilOf('sniper').cam > recoilOf('rocket').cam);
});

test('aiming raises the marker to the middle of the view and steadies it', () => {
  const vm = createViewmodel(), held = prop(); held.userData.sight = .37; settle(vm, held, { weapon: 'sniper' });
  const hip = { x: held.position.x, y: held.position.y };
  settle(vm, held, { weapon: 'sniper', aim: 1 });
  assert.ok(Math.abs(held.position.x) < .01 && held.position.x < hip.x - .15);
  assert.ok(Math.abs(held.position.y + .37 * .3 + .02) < .01, 'the scope sits on the line of sight');
});
