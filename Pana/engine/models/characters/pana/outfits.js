import * as THREE from 'three';
import { curve, ovalRing } from '/engine/models/characters/pana/geometry.js';
import { shirtGeometry } from '/engine/models/characters/pana/garment.js';
import { createChefOutfit } from '/engine/models/characters/pana/chef.js';
import { createActionDetails } from '/engine/models/characters/pana/action-outfits.js';
import { createFurFoundation } from '/engine/models/characters/pana/foundation.js';

const DEFAULT_COLORS = { shirt: '#ee3024', chef: '#ee3024', hoodie: '#3479cb', tropical: '#3479cb', sport: '#ee3024' };
const PRESET_HEADWEAR = { shirt: 'none', chef: 'chef', hoodie: 'cap', tropical: 'none', sport: 'band', base: 'none' };
const DEFAULT_HEADWEAR_COLORS = { chef: '#ee3024', cap: '#3479cb', band: '#ee3024' };

// Each top has one connected surface. The original shirt uses unchanged defaults.
function createTop(style, { body, arms, material, texture, foundation }) {
  const group = new THREE.Group(); group.name = `outfit:${style}`; body.add(group);
  const cloth = material(`${style} cotton`, DEFAULT_COLORS[style], { roughness: 0.92, sheen: 0.24, sheenColor: '#ffad87', bumpMap: texture, bumpScale: 0.003, side: THREE.DoubleSide });
  const trim = material(`${style} binding`, DEFAULT_COLORS[style], { roughness: 0.92, bumpMap: texture, bumpScale: 0.002 });
  const root = new THREE.Bone(); root.name = `${style}:root`; body.add(root);
  const { geometry, collar, cuffs } = shirtGeometry(arms, { style });
  if (['sport', 'tropical'].includes(style)) {
    const positions = geometry.attributes.position, weights = geometry.attributes.skinWeight, point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      const armFit = style === 'tropical' ? THREE.MathUtils.smoothstep(weights.getY(i) + weights.getZ(i), 0.01, 0.2) : 0;
      foundation.fitPoint(point.fromBufferAttribute(positions, i), 0.035, armFit);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals();
    collar.forEach(point => foundation.fitPoint(point, 0.039));
    cuffs.flat().forEach(point => foundation.fitPoint(point, 0.039, style === 'tropical' ? 1 : 0));
  }
  const shoulders = arms.map((_, i) => {
    const bone = new THREE.Bone(); bone.name = `${style}:shoulder${i}`; body.add(bone); return bone;
  });
  const positions = geometry.attributes.position, weights = geometry.attributes.skinWeight, indices = geometry.attributes.skinIndex;
  for (let i = 0; i < positions.count && style !== 'sport'; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const outsideCollar = THREE.MathUtils.smoothstep(Math.hypot(x / 0.46, (z + 0.01) / 0.4), 1.02, 1.25);
    const mask = THREE.MathUtils.smoothstep(Math.abs(x), 0.4, 0.52) * THREE.MathUtils.smoothstep(y, style === 'hoodie' ? 1.12 : 1.55, style === 'hoodie' ? 1.62 : 1.78) * outsideCollar;
    const lift = Math.min(weights.getX(i), mask * 0.88);
    weights.setX(i, weights.getX(i) - lift); weights.setW(i, lift); indices.setW(i, x >= 0 ? 3 : 4);
  }
  const garment = new THREE.SkinnedMesh(geometry, cloth);
  garment.name = style === 'shirt' ? 'Continuous shirt and sleeves' : `Continuous ${style}`;
  garment.castShadow = garment.receiveShadow = true; garment.frustumCulled = false; group.add(garment);
  body.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([root, ...arms, ...shoulders]); garment.bind(skeleton);
  const hem = ovalRing(group, 'Hem', trim, 0.794, 0.582, 1.017, style === 'hoodie' ? 0.028 : 0.016, -0.01);
  if (['sport', 'tropical'].includes(style)) {
    const positions = hem.geometry.attributes.position, point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      foundation.fitPoint(point.fromBufferAttribute(positions, i), 0.039);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    hem.geometry.computeVertexNormals();
  }
  curve(group, 'Neck binding', collar.map(p => p.toArray()), style === 'sport' ? 0.025 : 0.018, trim, true, 96);
  const sleeves = arms.map((arm, i) => {
    const layer = new THREE.Group(); layer.name = `${style}:cuff`;
    if (style === 'sport') {
      group.add(layer); curve(layer, 'Armhole binding', cuffs[i].map(p => p.toArray()), 0.025, trim, true, 80);
    } else {
      arm.add(layer);
      const inverse = arm.quaternion.clone().invert();
      const local = cuffs[i].map(p => p.clone().sub(arm.position).applyQuaternion(inverse).toArray());
      curve(layer, 'Sleeve hem', local, style === 'hoodie' ? 0.024 : 0.013, trim, true, 64);
    }
    return layer;
  });
  return {
    group, garment, cloth, trim, sleeves,
    setVisible(value) { group.visible = value; sleeves.forEach(s => { s.visible = value; }); },
    setColor(value) {
      cloth.color.set(style === 'sport' ? '#fff7e4' : value); trim.color.set(value).multiplyScalar(style === 'sport' ? 1 : 0.94);
      cloth.sheenColor.set(value).lerp(new THREE.Color('#ffffff'), 0.3);
    },
    update() {
      if (group.visible) shoulders.forEach((bone, i) => { bone.position.y = (style === 'hoodie' ? 0.38 : 0.28) * THREE.MathUtils.smoothstep(Math.abs(arms[i].rotation.z), 0.7, 2.0); });
    },
    dispose() { skeleton.dispose(); root.removeFromParent(); shoulders.forEach(b => b.removeFromParent()); },
  };
}

export function createWardrobe(context) {
  const { arms } = context;
  const foundation = createFurFoundation(context);
  const tops = Object.fromEntries(['shirt', 'hoodie', 'tropical', 'sport'].map(style => [style, createTop(style, { ...context, foundation })]));
  const chef = createChefOutfit({ ...context, foundation }), details = createActionDetails({ ...context, tops });
  const colors = { ...DEFAULT_COLORS }, headwearColors = { ...DEFAULT_HEADWEAR_COLORS };
  let selected = 'shirt', headwear = 'none', wristbands = false;
  const applyColor = (id, value) => {
    colors[id] = value;
    if (id === 'chef') chef.setColor(value); else tops[id]?.setColor(value);
    details.setColor(id, value);
  };
  const applyHeadwearColor = (id, value) => {
    headwearColors[id] = value;
    if (id === 'chef') chef.setHatColor(value); else details.setHeadwearColor(id, value);
  };
  const syncVisibility = () => {
    Object.entries(tops).forEach(([id, top]) => top.setVisible(id === selected));
    foundation.setVisible(['chef', 'sport', 'tropical'].includes(selected));
    chef.setApronVisible(selected === 'chef'); chef.setHatVisible(headwear === 'chef');
    details.setHeadwear(headwear); details.setWristbands(wristbands, selected === 'hoodie');
    details.setWristColor(colors[selected] || colors.shirt);
    arms.forEach(arm => {
      const skin = arm.getObjectByName('Arm and mitten');
      const start = selected === 'hoodie' ? 25 * 40 * 6 : ['shirt', 'tropical'].includes(selected) ? skin.userData.coveredIndexCount : 0;
      skin.geometry.setDrawRange(start, skin.geometry.index.count - start);
    });
  };
  Object.entries(colors).forEach(([id, color]) => applyColor(id, color));
  Object.entries(headwearColors).forEach(([id, color]) => applyHeadwearColor(id, color));
  return {
    shirt: tops.shirt.group, sleeves: tops.shirt.sleeves, garment: tops.shirt.garment, tops, chef, details, foundation,
    get outfit() { return selected; },
    get headwear() { return headwear; },
    get wristbands() { return wristbands; },
    get preset() { return headwear === PRESET_HEADWEAR[selected] && wristbands === (selected === 'sport') ? selected : null; },
    get color() { return colors[selected] || colors.shirt; },
    get headwearColor() { return headwearColors[headwear] || null; },
    // Presets coordinate the pieces; individual setters preserve the other slots.
    setOutfit(value) {
      if (value !== 'base' && !Object.hasOwn(DEFAULT_COLORS, value)) return;
      selected = value; headwear = PRESET_HEADWEAR[value]; wristbands = value === 'sport';
      if (headwear !== 'none') applyHeadwearColor(headwear, colors[value]);
      syncVisibility();
    },
    setGarment(value) {
      if (!Object.hasOwn(DEFAULT_COLORS, value)) return;
      selected = value; syncVisibility();
    },
    setHeadwear(value) {
      if (value !== 'none' && !Object.hasOwn(DEFAULT_HEADWEAR_COLORS, value)) return;
      headwear = value; syncVisibility();
    },
    setWristbands(value) { if (typeof value === 'boolean') { wristbands = value; syncVisibility(); } },
    setColor(value) {
      if (/^#[0-9a-f]{6}$/i.test(value) && selected !== 'base') {
        applyColor(selected, value.toLowerCase()); details.setWristColor(value);
      }
    },
    setHeadwearColor(value) {
      if (/^#[0-9a-f]{6}$/i.test(value) && headwear !== 'none') applyHeadwearColor(headwear, value.toLowerCase());
    },
    resetColors() {
      Object.entries(DEFAULT_COLORS).forEach(([id, color]) => applyColor(id, color));
      Object.entries(DEFAULT_HEADWEAR_COLORS).forEach(([id, color]) => applyHeadwearColor(id, color));
      details.setWristColor(colors[selected] || colors.shirt);
    },
    update() { Object.values(tops).forEach(top => top.update()); },
    dispose() { Object.values(tops).forEach(top => top.dispose()); foundation.dispose(); details.dispose(); },
  };
}
