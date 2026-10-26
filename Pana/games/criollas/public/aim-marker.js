import * as THREE from 'three';
import { guideRibbon } from '/engine/play/aim-guide.js';
import { aimFeedback } from './aim-feedback.js';
import { loc } from '/engine/i18n.js';

export function createAimMarker(scene) {
  const root = new THREE.Group(); root.name = 'Throw preview'; scene.add(root);
  // The dark edge remains readable on both pale clay and shadows.
  const border = guideRibbon('#171329', .28, { segments: 256 });
  const line = guideRibbon('#fff1ad', .14, { segments: 256 });
  root.add(border, line);
  const target = new THREE.Group(); target.name = 'Stopping target'; root.add(target);
  const material = new THREE.MeshBasicMaterial({ color: '#fff1ad', side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.48, .62, 48), material);
  ring.rotation.x = -Math.PI / 2; ring.position.y = .07; target.add(ring);
  const edge = new THREE.Mesh(new THREE.RingGeometry(.43, .68, 48), new THREE.MeshBasicMaterial({ color: '#171329', side: THREE.DoubleSide }));
  edge.rotation.x = -Math.PI / 2; edge.position.y = .055; target.add(edge);
  const ghost = new THREE.Mesh(new THREE.SphereGeometry(.25, 16, 12), new THREE.MeshBasicMaterial({ color: '#fff1ad', transparent: true, opacity: .45, depthWrite: false }));
  ghost.position.y = .25; target.add(ghost);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .9, 8), material);
  stem.position.set(0, .8, 0); target.add(stem);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false }));
  label.position.y = 1.45; label.scale.set(3.4, .64, 1); label.renderOrder = 5; target.add(label);
  const arc = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 6), new THREE.MeshBasicMaterial({ color: '#87e7ff' }), 256);
  arc.frustumCulled = false; arc.name = 'Airborne trajectory'; root.add(arc);
  const pose = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  const drop = new THREE.Group(); drop.name = 'Landing target'; root.add(drop);
  const dropRing = new THREE.Mesh(new THREE.RingGeometry(.65, .78, 48), new THREE.MeshBasicMaterial({ color: '#87e7ff', side: THREE.DoubleSide }));
  dropRing.rotation.x = -Math.PI / 2; dropRing.position.y = .09; drop.add(dropRing);
  const dropCanvas = document.createElement('canvas'); dropCanvas.width = 256; dropCanvas.height = 80;
  const dc = dropCanvas.getContext('2d'); dc.fillStyle = '#171329'; dc.fillRect(0, 0, 256, 80);
  dc.fillStyle = '#87e7ff'; dc.font = 'bold 32px sans-serif'; dc.textAlign = 'center'; dc.fillText(loc('CAÍDA', { $ctx: 'criollas' }), 128, 52);
  const dropTexture = new THREE.CanvasTexture(dropCanvas); dropTexture.colorSpace = THREE.SRGBColorSpace;
  const dropLabel = new THREE.Sprite(new THREE.SpriteMaterial({ map: dropTexture, depthTest: false, depthWrite: false }));
  dropLabel.position.set(0, .75, 0); dropLabel.scale.set(1.8, .56, 1); dropLabel.renderOrder = 5; drop.add(dropLabel);
  let status = null, lastLabel = '';
  return {
    update(shot, guide, preview, active) {
      root.visible = active; if (!active) { status = null; return; }
      status = aimFeedback(shot, guide, preview);
      arc.count = Math.min(256, Math.max(0, status.flight.length - 1));
      for (let i = 0; i < arc.count; i++) {
        const a = status.flight[i], b = status.flight[i + 1];
        direction.set(b.x - a.x, (b.height || 0) - (a.height || 0), b.z - a.z);
        pose.position.set((a.x + b.x) / 2, ((a.height || 0) + (b.height || 0)) / 2 + .25, (a.z + b.z) / 2);
        pose.scale.set(.035, direction.length(), .035); pose.quaternion.setFromUnitVectors(up, direction.normalize()); pose.updateMatrix(); arc.setMatrixAt(i, pose.matrix);
      }
      arc.instanceMatrix.needsUpdate = true;
      drop.visible = status.visible && !!status.touchdown;
      if (status.touchdown) drop.position.set(status.touchdown.x, 0, status.touchdown.z);
      border.userData.set(status.path, .065); line.userData.set(status.path, .08);
      target.visible = status.visible; target.position.set(status.end.x, 0, status.end.z);
      const color = status.out ? '#ff725e' : '#fff1ad';
      material.color.set(color); ghost.material.color.set(color); line.material.color.set(color);
      if (lastLabel !== status.label) {
        lastLabel = status.label; ctx.clearRect(0, 0, 512, 96); ctx.fillStyle = '#171329'; ctx.fillRect(0, 0, 512, 96);
        ctx.fillStyle = color; ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(loc(lastLabel), 256, 48); texture.needsUpdate = true;
      }
    },
    get status() { return status; },
  };
}
