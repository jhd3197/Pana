// Shared game adapter for the same sculpt edited in Pana Studio.
// Feet/seat at the origin, +Z forward. Public pivots remain compatible with games.
import * as THREE from 'three';
import { normalizeAvatar } from '/engine/avatar.js';
import { buildSoftCharacter } from '/engine/models/characters/pana/model.js';
import { addLegacyHat } from '/engine/models/characters/pana/legacy-accessories.js';
import { dizzyStars } from '/engine/models/effects/dizzy-stars.js';
import { createAccessories } from './accessories.js';
import { applyWardrobe } from './wardrobe-look.js';
import { withDetail } from './detail.js';

const garments = { franela: 'shirt', deportivo: 'sport', hoodie: 'hoodie', hawaiana: 'tropical', chef: 'chef' };
const expressions = { cool: 'natural', feliz: 'smile', lengua: 'talk', ojazos: 'natural', wow: 'laugh' };

export function buildCharacter(input, { head = 0.58, seated = false, chef = false, quality = 'game' } = {}) {
  const avatar = normalizeAvatar(input);
  const headwear = chef || avatar.hat === 'chef' ? 'chef' : avatar.hat === 'band' ? 'band'
    : ['gorra', 'gorra-atras'].includes(avatar.hat) ? 'cap' : 'none';
  const sculpt = buildSoftCharacter({ quality, furColor: avatar.fur, color: avatar.outfitColor,
    outfit: chef ? 'chef' : garments[avatar.outfit] || 'shirt', headwear, headwearColor: avatar.hatColor,
    glasses: avatar.glasses === 'none' ? 'none' : avatar.glasses === 'sol' ? 'sun' : 'round',
    wristbands: avatar.extra === 'pulseras', expression: expressions[avatar.face] || 'natural' });
  const group = new THREE.Group(); group.name = 'Pana · shared studio character';
  group.userData.characterVersion = 'studio-v1'; group.add(sculpt.group);
  // Keep caller-owned scaling separate from the conversion to game world units.
  sculpt.group.scale.setScalar(0.60); sculpt.group.position.y = seated ? -0.28 : 0;
  sculpt.neck.scale.setScalar(head / 0.58);
  if (!avatar.wardrobe && !chef && ['pesca', 'lana', 'corona', 'llanero'].includes(avatar.hat)) {
    addLegacyHat(sculpt.head, 0.82, avatar.hat, avatar.hatColor);
  }
  if (avatar.hat === 'gorra' && !chef) sculpt.wardrobe.details.cap.rotation.y = Math.PI;
  if (avatar.glasses === 'fiesta') sculpt.eyewear.variants.round.traverse(o => {
    if (o.material?.name?.includes('frame')) o.material.color.set('#f15bb5');
  });
  if (!avatar.wardrobe && avatar.extra === 'cadena') {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.024, 6, 32), new THREE.MeshStandardMaterial({ color: '#ffc629', metalness: 0.65, roughness: 0.3 }));
    chain.name = 'Gold chain'; chain.position.set(0, 1.64, 0.34); chain.rotation.x = -0.65;
    sculpt.body.add(chain);
  }
  let accessories = null, accessoryTime = 0;
  if (avatar.wardrobe) {
    const look = chef ? { ...avatar.wardrobe, top: 'chef', hat: 'chef', print: 'none' } : avatar.wardrobe;
    withDetail(quality, () => {
      accessories = createAccessories(sculpt, look);
      applyWardrobe(sculpt, accessories, look);
    });
  }
  const stars = dizzyStars(); stars.position.y = 1.35; sculpt.head.add(stars);
  stars.visible = false;
  const poseSeat = () => {
    sculpt.legs.forEach(leg => leg.rotation.set(-Math.PI / 2, 0, 0));
    sculpt.body.position.set(0, 0, 0); sculpt.body.rotation.set(0, 0, 0);
  };
  if (seated) poseSeat();
  // Squash-and-stretch / wobble overlay, applied after every sculpt.update.
  // sculpt.update rewrites body position/rotation and head rotation each frame,
  // so additive offsets on those channels need no restore. It never touches
  // body.scale or neck.rotation, so the overlay owns them: set absolutely while
  // an impulse is live, restored to identity/zero the frame the impulse settles.
  let squash = 0, squashVel = 0; // squash spring: positive displacement compresses the body
  let rockAge = Infinity, rockPower = 0, rockDir = 0; // wobble envelope
  const applyOverlay = dt => {
    dt = Math.min(0.1, dt);
    if (squash !== 0 || squashVel !== 0) {
      squashVel += (-110 * squash - 10 * squashVel) * dt; // damped spring, semi-implicit Euler
      squash += squashVel * dt;
      if (Math.abs(squash) < 1e-4 && Math.abs(squashVel) < 1e-3) {
        squash = 0; squashVel = 0; sculpt.body.scale.set(1, 1, 1);
      } else {
        const sy = Math.min(1.15, Math.max(0.75, 1 - squash));
        const sxz = Math.min(1.15, 1 / Math.sqrt(sy)); // volume-preserving feel
        sculpt.body.scale.set(sxz, sy, sxz);
      }
    }
    if (rockAge < 1) {
      rockAge += dt;
      const envelope = Math.exp(-rockAge * 6); // settled after ~0.6s
      if (envelope < 0.01) { rockAge = Infinity; sculpt.neck.rotation.z = 0; }
      else {
        const rock = Math.sin(rockAge * 20) * envelope * rockPower * 0.35;
        const rz = rock * Math.cos(rockDir), rx = rock * Math.sin(rockDir);
        sculpt.body.rotation.z += rz; sculpt.body.rotation.x += rx;
        sculpt.head.rotation.z -= rz * 0.7; // head counter-rotation
        sculpt.neck.rotation.z = -rz * 0.4;
      }
    }
  };
  let disposed = false;
  const result = { ...sculpt, group, avatar,
    update(dt, state = {}) {
      if (disposed) return;
      accessoryTime += Math.min(0.1, dt);
      accessories?.update(accessoryTime);
      const locomotion = !seated && ('walk' in state || 'carry' in state || state.pose);
      sculpt.update(dt, { ...state, pose: state.pose || (state.carry ? 'carry' : state.walk ? state.run ? 'run' : 'walk' : 'idle'), manualArms: !locomotion, manualBody: seated });
      if (seated) poseSeat();
      applyOverlay(dt);
      stars.visible = !!state.dizzy; stars.rotation.y += Math.min(0.1, dt) * 6;
      if (state.dizzy) sculpt.eyes.forEach(eye => { eye.scale.y *= 0.45; });
    },
    // Squash-and-stretch impulse: the body squashes, then springs back with a small overshoot.
    bounce(strength = 1) { squashVel += 3.2 * Math.max(0, strength); },
    // Wobble: spine and head rock around the vertical axis, decaying over ~0.6s.
    // dir (radians) tilts the rock from the sideways axis towards forward.
    stagger(power = 1, dir = 0) { rockAge = 0; rockPower = Math.min(1, Math.max(0, power)); rockDir = dir; },
    dispose() {
      if (disposed) return; disposed = true;
      const materials = new Set(), textures = new Set();
      sculpt.group.traverse(o => { for (const material of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) { materials.add(material); for (const value of Object.values(material)) if (value?.isTexture) textures.add(value); } });
      accessories?.dispose(); sculpt.dispose(); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); group.removeFromParent();
    },
  };
  group.userData.dispose = result.dispose;
  return result;
}
