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
  let disposed = false;
  const result = { ...sculpt, group, avatar,
    update(dt, state = {}) {
      if (disposed) return;
      accessoryTime += Math.min(0.1, dt);
      accessories?.update(accessoryTime);
      const locomotion = !seated && ('walk' in state || 'carry' in state || state.pose);
      sculpt.update(dt, { ...state, pose: state.pose || (state.carry ? 'carry' : state.walk ? state.run ? 'run' : 'walk' : 'idle'), manualArms: !locomotion, manualBody: seated });
      if (seated) poseSeat();
      stars.visible = !!state.dizzy; stars.rotation.y += Math.min(0.1, dt) * 6;
      if (state.dizzy) sculpt.eyes.forEach(eye => { eye.scale.y *= 0.45; });
    },
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
