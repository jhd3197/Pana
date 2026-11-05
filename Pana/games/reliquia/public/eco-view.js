// How the food chain looks (ecology.js has the rules, the snapshot the numbers).
// A mushroom thicket and a root thicket per site, their halos in one draw, moths
// over the patches in one draw, the bats without a body on the roosts in one
// more. Nothing collides. Loaded after the first frame: nothing here is needed
// to start, and the first-load budget is tight.
import * as THREE from 'three';
import { mushroomThicket, mushroomHalos } from '/engine/models/props/glow-mushrooms.js';
import { rootThicket } from '/engine/models/props/fosa-biomes.js';
import { batColony } from '/engine/models/fauna/cave-creatures.js';
import { glowTexture } from '/engine/models/props/glow-paintball.js';
import { HEIGHT } from './deck.js';
import { ecoWorldFor, siteShine } from './ecology.js';

const MOTHS = { perSite: 34, most: 240, near: 34, size: .16, color: 0xe8dcae };
const COLONY = 72;
const frac = v => v - Math.floor(v);

export function createEcoView({ scene }) {
  const root = new THREE.Group(); root.name = 'La cadena'; scene.add(root);
  const haloMap = glowTexture();
  let layout = null, sites = [], halos = null, haloColors = null, base = [];
  const moths = new THREE.BufferGeometry(), mothAt = new Float32Array(MOTHS.most * 3);
  moths.setAttribute('position', new THREE.BufferAttribute(mothAt, 3));
  const mothMaterial = new THREE.PointsMaterial({ color: MOTHS.color, map: haloMap, size: MOTHS.size, transparent: true, opacity: .95, depthWrite: false, blending: THREE.AdditiveBlending });
  const mothPoints = new THREE.Points(moths, mothMaterial); mothPoints.frustumCulled = false; mothPoints.name = 'Polillas'; root.add(mothPoints);
  const colony = batColony({ count: COLONY }); colony.name = 'Colonia'; root.add(colony);
  let roostKey = '', list = [], glowsNow = [];

  function clear() {
    for (const s of sites) { s.model.removeFromParent(); s.model.traverse(o => o.geometry?.dispose()); s.model.userData.dispose?.(); }
    sites = [];
    if (halos) { halos.removeFromParent(); halos.geometry.dispose(); halos.material.dispose(); halos = null; }
  }
  function build(L) {
    clear(); layout = L; roostKey = '';
    const W = ecoWorldFor(L), points = [];
    W.sites.forEach((s, i) => {
      if (s.kind !== 'mushroom' && s.kind !== 'roots') return;
      const model = s.kind === 'mushroom' ? mushroomThicket({ seed: s.seed, radius: s.r }) : rootThicket({ seed: s.seed, radius: s.r, height: HEIGHT });
      model.position.set(s.x, 0, s.z); root.add(model);
      const one = { i, s, model, shine: 1, halo: -1 };
      if (s.plant) { one.halo = points.length; points.push({ x: s.x, y: 1.1, z: s.z, color: model.userData.glow.color }); }
      sites.push(one);
    });
    if (points.length) {
      halos = mushroomHalos(points, haloMap, { size: 3.2, opacity: .5 }); root.add(halos);
      haloColors = halos.geometry.attributes.color; base = Array.from(haloColors.array);
    }
  }
  // The roost's numbers: who sleeps there and has no body right now.
  function placeColony(state, W, vf) {
    const eco = state.eco, key = eco ? `${vf}:${eco.t}` : '';
    if (key === roostKey) return; roostKey = key;
    list.length = 0;
    if (eco) {
      const at = {};
      for (const c of eco.pop) if (c.sp === 'bat' && !c.body && c.to < 0 && W.sites[c.at]?.kind === 'roost') at[c.at] = (at[c.at] || 0) + 1;
      for (const [i, n] of Object.entries(at)) {
        const s = W.sites[i]; if ((s.floor ?? 0) !== vf) continue;
        for (let k = 0; k < n && list.length < COLONY; k++) { const a = k * 2.4, r = .25 + Math.sqrt(k) * .34; list.push({ x: s.x + Math.cos(a) * r, y: HEIGHT - .06, z: s.z + Math.sin(a) * r, h: a * 3, s: .9 + frac(k * .37) * .35 }); }
      }
    }
    colony.userData.place(list);
  }

  function update(dt, state, me, vf, L, t) {
    if (L !== layout) build(L);
    const eco = state.eco, W = ecoWorldFor(L), ease = 1 - Math.exp(-dt * 1.4);
    root.visible = vf > 0 && !!eco; if (!root.visible) { glowsNow = []; return; }
    glowsNow = [];
    for (const one of sites) {
      const on = (one.s.floor ?? 0) === vf; one.model.visible = on;
      if (!one.s.plant) continue;
      const want = on ? siteShine(eco, W, one.i) : 0;
      if (Math.abs(want - one.shine) > .005) {
        one.shine += (want - one.shine) * ease; one.model.userData.setGlow(one.shine);
        if (haloColors) { for (let c = 0; c < 3; c++) haloColors.array[one.halo * 3 + c] = base[one.halo * 3 + c] * one.shine; haloColors.needsUpdate = true; }
      }
      if (on && one.shine > .3) glowsNow.push({ x: one.s.x, y: 1.1, z: one.s.z, color: one.model.userData.glow.color });
    }
    if (halos) halos.material.opacity = .42 + Math.sin(t * .9) * .08;
    placeColony(state, W, vf);
    // The moths: only over the patches near this screen.
    let n = 0;
    if (me) for (const one of sites) {
      if (!one.s.plant || (one.s.floor ?? 0) !== vf || Math.hypot(one.s.x - me.x, one.s.z - me.z) > MOTHS.near) continue;
      const count = Math.round((eco.pests[one.i] || 0) * MOTHS.perSite), s = one.s;
      for (let k = 0; k < count && n < MOTHS.most; k++, n++) {
        const a = k * 2.399, r = s.r * (.25 + .85 * frac(k * .618)), wob = t * (1.3 + frac(k * .31) * 1.4) + k;
        mothAt[n * 3] = s.x + Math.cos(a + wob * .4) * r + Math.sin(wob * 3.1) * .12;
        mothAt[n * 3 + 1] = .35 + 1.9 * frac(k * .73) + Math.sin(wob * 2.3) * .22;
        mothAt[n * 3 + 2] = s.z + Math.sin(a + wob * .4) * r + Math.cos(wob * 2.7) * .12;
      }
    }
    moths.setDrawRange(0, n); moths.attributes.position.needsUpdate = n > 0;
  }
  return {
    update,
    // Patches still shining, for the view's pool of real lights.
    get glows() { return glowsNow; },
    dispose() { clear(); colony.userData.dispose(); moths.dispose(); mothMaterial.dispose(); haloMap.dispose(); root.removeFromParent(); },
  };
}
