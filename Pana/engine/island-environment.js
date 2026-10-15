// The same island environment for the board game and driving circuits.
// Games supply path clearance; geography, vegetation and landmarks stay here.
import * as THREE from 'three';
import { M, mesh, box, rng, makeMango, woodSign, watchtower, flagPole, rock } from './props.js';
import { mangoTree, ceiba, pine, banana, bush, casita, bake, palm, foliage, hibiscus, papaya } from './flora.js';
import { riverDist, landMask, beachMask, fbm, SEA, PEAK, HILL } from './island-terrain.js';
import { buildScenery } from './island-scenery.js';
import { beachShade, beachHut, driftwood } from './beach-props.js';
import { placeReefSchools } from './reef-fish.js';

export const ISLAND_LOOP = [[28, 94], [0, 97], [-35, 91], [-70, 75], [-92, 48],
  [-103, 12], [-84, -18], [-49, -36], [-12, -34], [24, -36],
  [63, -20], [95, 9], [108, 40], [84, 70], [58, 84]];

function radiusOf(obj) {
  const bounds = new THREE.Box3().setFromObject(obj);
  return Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.z), Math.abs(bounds.max.z));
}

function mangoTreeBig(gold = true) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.8, 5.5, 7), M(0x7a5232, { roughness: 1 }), 0, 2.75, 0));
  for (const [x, y, z, rot] of [[-0.9, 3.6, 0, 0.7], [1, 3.9, 0.3, -0.6]]) {
    const branch = mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.4, 6), M(0x7a5232, { roughness: 1 }), x, y, z);
    branch.rotation.z = rot;
    g.add(branch);
  }
  for (const [x, y, z, r, dk] of [[0, 6.4, 0, 2.7, 0], [-2.2, 5.6, 0.4, 2, 1], [2.2, 5.7, 0.2, 2.1, 1], [0.4, 7.7, -0.4, 1.9, 0], [-1, 5.4, 1.7, 1.6, 0], [1.3, 5.3, 1.6, 1.5, 1], [0.2, 5.6, -1.8, 1.8, 1]]) {
    const leaves = foliage(r, Math.round(y * 10), dk ? 0x5b9e45 : 0x88b84f);
    leaves.position.set(x, y, z);
    g.add(leaves);
  }
  const hanging = [];
  for (const [x, y, z] of [[-1.6, 4.5, 1.9], [0.3, 4.4, 2.4], [1.9, 4.6, 1.5], [-2.8, 4.8, 0.6], [2.9, 4.9, 0.3], [-0.6, 4.6, -2.1], [1.6, 4.7, -1.6]]) {
    const mg = makeMango({ gold });
    mg.scale.setScalar(0.75);
    mg.position.set(x, y, z);
    g.add(mg);
    hanging.push(mg);
  }
  return { group: g, hanging };
}

export function createIslandEnvironment(scene, { island, pathDist = island.pathDist,
  inShot = () => false, clearance = () => true, layoutScale = 1, heightScale = 1 } = {}) {
  const rand = rng(7), groundAt = island.groundAt;
  const assetCounts={};scene.userData.assetCounts=assetCounts;
  const statics = new THREE.Group();
  const plank = M(0x9a6539, { roughness: 0.9 }), post = M(0x5c3a20, { roughness: 0.9 });
  // the sea: see-through enough that the sandy shallows show
  const waterGeo = new THREE.PlaneGeometry(2400, 2400, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const sea = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
    color: 0x279fba, roughness: 0.38, metalness: 0.08, transparent: true, opacity: 0.66, depthWrite:false,
  }));
  sea.position.y = SEA;
  scene.add(sea);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);
  const scenery = buildScenery(scene);
  // ---- decoration ----
  const free = (x, z, d = 5) => pathDist(x, z) > d && riverDist(x, z) > 3.2 && Math.hypot(x - HILL.x, z - HILL.z) > 7;
  // nothing tall between the camera (always in front, +z) and a tile
  const decor = [];   // where props stand, so the moving cart can avoid them
  const harborHomes = [[115, 7], [121, 16], [119, 35]];
  const harborSpace = (x, z) => harborHomes.some(([hx, hz]) => Math.hypot(hx - x, hz - z) < 5.5)
    || (x > 103 && x < 135 && Math.abs(z - 24) < 3.4);
  const place = (obj, x, z, rot = rand() * 6, into = statics) => {
    // The race expands the land, while trees and houses retain their human scale.
    obj.scale.multiply(new THREE.Vector3(1 / layoutScale, 1 / heightScale, 1 / layoutScale));
    if (!clearance(x, z, radiusOf(obj))) return obj;
    decor.push({ x, z, obj });
    obj.position.set(x, groundAt(x, z), z);
    obj.rotation.y = rot;
    into.add(obj);
    if(obj.name)assetCounts[obj.name]=(assetCounts[obj.name]||0)+1;
    return obj;
  };
  const schools=placeReefSchools(scene,{spots:[[138,22],[139,40],[146,58],[-52,119],[18,132]],groundAt,waterY:SEA,clearance:(x,z,r)=>pathDist(x,z)>r+4&&clearance(x,z,r)});
  // Fruit and flowering gardens reuse the library behind the harbor houses.
  for(const [factory,x,z,seed] of [[hibiscus,112,1,87],[hibiscus,116,42,88],[papaya,112,37,89],[papaya,117,13,90]]) {
    if(groundAt(x,z)>.3&&free(x,z,5)&&!inShot(x,z))place(factory({seed}),x,z);
  }

  // plants: what grows depends on where you are
  for (let i = 0; i < 3400 * layoutScale; i++) {
    const x = (rand() - 0.5) * 310, z = -128 + rand() * 260;
    const y = groundAt(x, z);
    if (y < 0.15 || !free(x, z, 4.6) || inShot(x, z) || harborSpace(x, z)) continue;
    const mtn = Math.hypot((x - PEAK.x) * 0.85, z - PEAK.z);
    const woods = fbm(x * 0.035 + 4, z * 0.035);
    const coast = landMask(x, z);
    const s = i + 1;
    if (y > 25) continue;                                                  // open summit and cliff face
    if (beachMask(x, z) > 0.45) {
      if (rand() < 0.16 && z < 91) place(palm({ h: 6 + rand() * 3, seed: s }), x, z);
    } else if (coast < 0.75) {
      if (rand() < 0.5) place(palm({ h: 6 + rand() * 4, seed: s }), x, z);
    } else if (mtn < 40 && y > 7) {
      if (rand() < 0.55) place(pine({ seed: s, h: 5 + rand() * 4 }), x, z);
    } else if (woods > 0.56) {
      const r = rand();
      if (r < 0.3) place(ceiba({ seed: s }), x, z);
      else if (r < 0.6) place(mangoTree({ seed: s, h: 2.6 + rand() * 1.2 }), x, z);
      else if (r < 0.8) place(banana({ seed: s }), x, z);
      else place(bush({ seed: s }), x, z);
    } else if (rand() < 0.16) {
      const r = rand();
      if (r < 0.45) place(bush({ seed: s, flowers: rand() < 0.5 }), x, z);
      else if (r < 0.65) place(palm({ h: 6 + rand() * 3, seed: s }), x, z);
      else if (r < 0.85) place(mangoTree({ seed: s }), x, z);
      else place(rock(0.6 + rand() * 1.2, 0x8b8496, s), x, z);
    }
  }
  // Beach furniture sits behind the promenade; open sand stays in front of
  // the players. Low props near the water cannot obscure their camera line.
  for (const [i, [x, z]] of [[-58,70],[-33,76],[6,82],[47,76],[76,64]].entries()) {
    if (free(x, z, 6) && groundAt(x, z) > 0) place(beachShade(i % 2 ? 0x48a9aa : 0xe77950), x, z, 0.1);
  }
  if (free(-8, 77, 6)) place(beachHut(), -8, 77, 0.05);
  for (const [x, z] of [[-44,101],[8,108],[65,94],[-81,85]]) {
    if (groundAt(x, z) > SEA + 0.5 && free(x, z, 4)) place(driftwood(), x, z);
  }
  for (let i = 0; i < 70; i++) {
    const x = (rand() - 0.5) * 220, z = -100 + rand() * 180;
    if (groundAt(x, z) < 0.5 || !free(x, z, 4) || inShot(x, z) || harborSpace(x, z)) continue;
    place(rock(0.7 + rand() * 1.6, 0x8b8496, 500 + i), x, z);
  }

  // a fishing village on the right shore, with a dock and a rowboat
  for (const [i, [x, z]] of harborHomes.entries()) {
    if (!free(x, z, 5) || inShot(x, z) || groundAt(x, z) < 0.3) continue;
    place(casita({ seed: 200 + i * 17 }), x, z, Math.PI / 2 + (rand() - 0.5) * 0.2);
  }
  const dockY = SEA + 2.7;
  let dockStart = 112;
  while (dockStart < 145 && groundAt(dockStart, 24) > dockY - 0.1) dockStart++;
  // Find the actual shore so changes to the bay cannot leave a floating dock.
  for (let x = 106, k = 0; x < 162; x += 1.5, k++) {
    const y = Math.max(dockY, groundAt(x, 24) + 0.1);
    if (!clearance(x, 24, 2)) continue;
    statics.add(box(1.4, 0.2, 2.6, plank, x, y, 24));
    if (x >= dockStart && k % 2 === 0) for (const s of [-1, 1]) statics.add(mesh(new THREE.CylinderGeometry(0.14, 0.14, 7.5, 6), post, x, y - 3.7, 24 + s * 1.1));
  }

  // signs that face the camera, near the path
  const signs = [
    [['PANAS', 'JUEGAN', 'MEJOR ♥'], -62, -8],
    [['RISAS', 'MANGOS', 'PANAS', 'SIEMPRE ♥'], 60, -14],
    [['PICO', 'PANA', '4.765 m'], 14, -44],
    [['PLAYA', 'COCOTERO'], 34, 80],
    [['PUERTO', 'DE LOS PANAS'], 117, 43],
  ];
  const keep = new THREE.Group();   // things with textures or animation stay live
  scene.add(keep);
  for (const [lines, x, z] of signs) {
    if (free(x, z, 4)) place(woodSign(lines, { w: 4.6, h: 3.4 }), x, z, Math.atan2(-x, 80 - z) * 0.4, keep);
  }
  place(watchtower({ h: 6 }), 44, -30, -0.4);
  // the flag flies on top of Pico Pana
  const flag = place(flagPole({ h: 9 }), PEAK.x, PEAK.z, 0, keep);
  flag.scale.multiplyScalar(1.6);
  const ticks = [flag];

  // the big mango tree crowning the hill, ringed by lantern strings
  const bigTree = mangoTreeBig();
  bigTree.group.scale.setScalar(1.5);
  place(bigTree.group, HILL.x, HILL.z, 0.3, keep);
  // its own materials, so it can turn see-through when it hides the action
  const treeMats = new Map();
  bigTree.group.traverse((m) => {
    if (!m.isMesh || m.parent !== bigTree.group) return;
    if (!treeMats.has(m.material)) treeMats.set(m.material, m.material.clone());
    m.material = treeMats.get(m.material);
    m.material.transparent = true;
  });
  const canopy = new THREE.Vector3(HILL.x, groundAt(HILL.x, HILL.z) + 8.5, HILL.z);
  let treeAlpha = 1;
  const treeGlow = new THREE.PointLight(0xffc04a, 80, 26, 1.5);
  treeGlow.position.set(HILL.x, groundAt(HILL.x, HILL.z) + 7, HILL.z + 2);
  scene.add(treeGlow);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb340, emissiveIntensity: 1.5 });
  const poles = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const x = HILL.x + Math.cos(a) * 8.5, z = HILL.z + Math.sin(a) * 8.5;
    const y = groundAt(x, z);
    const inPath = pathDist(x, z) < 3.2 || !clearance(x, z, 1);   // the shortcut runs through the ring
    if (!inPath) statics.add(box(0.2, 4.5, 0.2, post, x, y + 2.25, z));
    poles.push([x, y + 4.4, z, inPath]);
  }
  for (let i = 0; i < poles.length; i++) {
    const [ax, ay, az, gapA] = poles[i], [bx, by, bz, gapB] = poles[(i + 1) % poles.length];
    if (gapA || gapB) continue;
    for (let k = 1; k < 8; k++) {
      const u = k / 8;
      statics.add(mesh(new THREE.SphereGeometry(0.17, 6, 5), bulbMat, ax + (bx - ax) * u, ay + (by - ay) * u - Math.sin(u * Math.PI) * 0.9, az + (bz - az) * u));
    }
  }

  // merge all the static scenery; the cart hides props by position, so it
  // can't use the merged meshes. It keeps clear of decor instead.
  scene.add(bake(statics, { cellSize: layoutScale > 1 ? 45 : Infinity }));

  return { sea, decor,
    seeThrough(camPos, spots, dt) {
      const seg = new THREE.Line3();
      const p = new THREE.Vector3();
      const hides = spots.some((s) => {
        seg.set(camPos, s);
        seg.closestPointToPoint(canopy, true, p);
        return p.distanceTo(canopy) < 7.5 && s.distanceTo(camPos) > canopy.distanceTo(camPos);
      });
      treeAlpha += ((hides ? 0.22 : 1) - treeAlpha) * Math.min(1, dt * 6);
      for (const m of treeMats.values()) {
        m.opacity = treeAlpha;
        m.depthWrite = treeAlpha > 0.95;
      }
    },
    update(t, dt, daylight = 1) {
      schools.forEach(o=>o.userData.tick(t));
      const wp = waterGeo.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const x = waterBase[i * 3], z = waterBase[i * 3 + 2];
        wp.setY(i, Math.sin(x * 0.05 + t * 1.1) * 0.22 + Math.cos(z * 0.045 + t * 0.8) * 0.22);
      }
      wp.needsUpdate = true;
      island.update(t);
      scenery.update(t, dt, daylight);
      for (const [k, mg] of bigTree.hanging.entries()) mg.rotation.z = Math.sin(t * 1.8 + k) * 0.18;
      treeGlow.intensity = (75 + Math.sin(t * 2) * 10) * (1 - daylight * 0.85);
      bulbMat.emissiveIntensity = 0.35 + (1 - daylight) * 1.65;
      for (const o of ticks) o.userData.tick?.(t, dt);
    },
  };
}
