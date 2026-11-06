import * as THREE from 'three';
import { zoneColor } from './domination.js';

// Domination in the world (scene.js calls draw every frame): per zone a ground
// ring in its owner's colour, an inner arc that fills with the capture in the
// claimer's colour, a low glass wall marking the edge, a light pillar to find it
// from afar and a square letter board (A, B, C) floating over the middle. A
// contested zone's wall flashes. With the camera inside a ring its board and
// pillar hide, so they never fill the view of the pana standing there. Seen from
// above (Ver la cancha, the spectator's overhead shot) the ring, its fill and the
// letter board draw over roofs, so a zone under El Puerto's shed is never lost.
export const OVERHEAD_Y = 8;
const SEGMENTS = 48;
function letterTexture(letter) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#16161a'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.fillRect(8, 8, 112, 112);
  g.fillStyle = '#16161a'; g.font = '900 88px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(letter, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function createDomProps(scene) {
  const own = [], keep = o => { own.push(o); return o; };
  const wallGeo = keep(new THREE.CylinderGeometry(1, 1, 1.2, SEGMENTS, 1, true)), beamGeo = keep(new THREE.BoxGeometry(.28, 12, .28));
  const zones = ['A', 'B', 'C'].map(letter => {
    const root = new THREE.Group(); root.name = `Zona ${letter}`; root.visible = false;
    const ringMat = keep(new THREE.MeshBasicMaterial({ color: '#f8f0d2', side: THREE.DoubleSide })), fillMat = keep(new THREE.MeshBasicMaterial({ color: '#f8f0d2', side: THREE.DoubleSide, transparent: true, opacity: .85 }));
    const floorMat = keep(new THREE.MeshBasicMaterial({ color: '#f8f0d2', transparent: true, opacity: .14, depthWrite: false }));
    const wallMat = keep(new THREE.MeshBasicMaterial({ color: '#f8f0d2', transparent: true, opacity: .16, side: THREE.DoubleSide, depthWrite: false }));
    const beamMat = keep(new THREE.MeshBasicMaterial({ color: '#f8f0d2', transparent: true, opacity: .22, depthWrite: false }));
    const ring = new THREE.Mesh(undefined, ringMat), fill = new THREE.Mesh(undefined, fillMat), floor = new THREE.Mesh(undefined, floorMat);
    [ring, fill, floor].forEach(m => { m.rotation.x = -Math.PI / 2; m.renderOrder = 2; });
    ring.position.y = .06; fill.position.y = .07; floor.position.y = .05;
    const wall = new THREE.Mesh(wallGeo, wallMat); wall.position.y = .6;
    const beam = new THREE.Mesh(beamGeo, beamMat); beam.position.y = 6;
    const board = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: keep(letterTexture(letter)), depthWrite: false }))); board.position.y = 3.1; board.scale.set(1.1, 1.1, 1);
    board.name = `Letra zona ${letter}`;
    root.add(floor, ring, fill, wall, beam, board); scene.add(root);
    return { root, ring, fill, floor, wall, board, beam, radius: 0, above: false, ringMat, fillMat, floorMat, wallMat, beamMat };
  });
  let time = 0;
  // Ring and floor geometry per radius, shared (all zones are one size in practice); each
  // zone owns its progress arc, since its draw range is that zone's progress.
  const shapes = new Map(), shapeFor = r => {
    if (!shapes.has(r)) shapes.set(r, { ring: keep(new THREE.RingGeometry(r - .28, r, SEGMENTS)), floor: keep(new THREE.CircleGeometry(r, SEGMENTS)) });
    return shapes.get(r);
  };
  return {
    draw(state, dt, camera) {
      time += dt; const on = state.options?.mode === 'dom' && state.phase === 'playing' && (state.zones || []).length === 3;
      zones.forEach((t, i) => {
        const z = on && state.zones[i]; t.root.visible = !!z; if (!z) return;
        if (t.radius !== z.radius) { const s = shapeFor(z.radius); t.ring.geometry = s.ring; t.floor.geometry = s.floor; t.fill.geometry = keep(new THREE.RingGeometry(z.radius - .75, z.radius - .34, SEGMENTS, 1, Math.PI / 2, -Math.PI * 2)); t.wall.scale.set(z.radius, 1, z.radius); t.radius = z.radius; }
        t.root.position.set(z.x, 0, z.z);
        const owner = zoneColor(z.owner), progress = z.owner !== null && z.claim === z.owner ? 1 : z.progress;
        t.ringMat.color.set(owner); t.floorMat.color.set(owner); t.wallMat.color.set(owner); t.beamMat.color.set(owner); t.board.material.color.set(owner);
        t.fillMat.color.set(zoneColor(z.claim));
        // The arc grows clockwise from the top with the progress (6 indices per segment).
        const count = Math.round(progress * SEGMENTS) * 6; t.fill.visible = count > 0; t.fill.geometry.setDrawRange(0, count);
        t.wallMat.opacity = z.contested ? (Math.sin(time * 14) > 0 ? .42 : .12) : .16;
        t.board.position.y = 3.1 + Math.sin(time * 2 + i) * .08;
        const above = !!camera && camera.position.y > OVERHEAD_Y;
        const inside = !above && camera && Math.hypot(camera.position.x - z.x, camera.position.z - z.z) < z.radius + .5; t.board.visible = t.beam.visible = !inside;
        if (t.above !== above) { t.above = above; for (const [mesh, order] of [[t.ring, 21], [t.fill, 22], [t.board, 23]]) { mesh.material.depthTest = !above; mesh.renderOrder = above ? order : mesh === t.board ? 0 : 2; } }
      });
    },
    dispose() { zones.forEach(t => t.root.removeFromParent()); own.forEach(o => o.dispose()); },
  };
}
