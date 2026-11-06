import * as THREE from 'three';

// A small chevron over each teammate's head, in the team's colour, so your
// side reads at a glance in a team round (never in todos contra todos, never
// over yourself). It keeps one screen size at any distance and shows through
// cover, like the minimap's teammates.
//
//   const marks = createTeamMarkers();
//   marks.set(avatar.group, isTeammate(me, p, teamRound), p.color);   // each frame
//   marks.dispose();
export { isTeammate } from './team-balance.js';

function chevronTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d');
  g.beginPath(); g.moveTo(8, 14); g.lineTo(32, 38); g.lineTo(56, 14); g.lineTo(56, 30); g.lineTo(32, 54); g.lineTo(8, 30); g.closePath();
  g.lineJoin = 'miter'; g.lineWidth = 6; g.strokeStyle = '#120e2a'; g.stroke();
  g.fillStyle = '#ffffff'; g.fill();
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createTeamMarkers({ height = 2.35, size = .04 } = {}) {
  let map = null; const materials = new Map(), sprites = new Set();
  const material = color => {
    const key = new THREE.Color(color).getHexString();
    if (!materials.has(key)) materials.set(key, new THREE.SpriteMaterial({ map: map ??= chevronTexture(), color: `#${key}`, depthTest: false, depthWrite: false, transparent: true, sizeAttenuation: false }));
    return materials.get(key);
  };
  return {
    // Shows the chevron over `group` (a pana standing at its origin) in `color`, or hides it.
    set(group, show, color) {
      let sprite = group.userData.teamMarker;
      if (!show) { if (sprite) sprite.visible = false; return; }
      if (!sprite) {
        sprite = new THREE.Sprite(material(color)); sprite.name = 'Team marker';
        sprite.scale.set(size, size, 1); sprite.position.y = height; sprite.renderOrder = 20;
        group.add(sprite); group.userData.teamMarker = sprite; sprites.add(sprite);
      }
      sprite.material = material(color); sprite.visible = true;
    },
    dispose() { for (const s of sprites) { if (s.parent) delete s.parent.userData.teamMarker; s.removeFromParent(); } sprites.clear(); materials.forEach(m => m.dispose()); materials.clear(); map?.dispose(); },
  };
}
