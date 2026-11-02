import * as THREE from 'three';
import { auditColliders } from './collision-audit.js';

// Collision debug view: wireframes over every collider of the current map
// (red = flagged, yellow = lets shots pass, grey = invisible on purpose, green
// = fine), a console table and a JSON report. A game loads this module only
// when its debug mode is switched on, so it costs nothing otherwise.
//
//   const debug = createCollisionDebug(scene);
//   const report = debug.audit({ root: mapGroup, colliders, map, variant, shotHeight, allow });
//   debug.show(true); debug.download(report);

// Every visible triangle under root as a world-space box (six numbers each).
// Baked, merged and instanced meshes count; hidden and see-through ones do not.
export function collectSolids(root) {
  const out = [], a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const opaque = mat => (Array.isArray(mat) ? mat : [mat]).some(x => x && x.visible !== false && !(x.transparent && x.opacity < .05) && x.colorWrite !== false);
  root.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position || !shown(o) || !opaque(o.material)) return;
    const pos = o.geometry.attributes.position, index = o.geometry.index, count = index ? index.count : pos.count;
    for (let n = 0; n < (o.isInstancedMesh ? o.count : 1); n++) {
      if (o.isInstancedMesh) { o.getMatrixAt(n, im); m.multiplyMatrices(o.matrixWorld, im); } else m.copy(o.matrixWorld);
      for (let i = 0; i + 2 < count; i += 3) {
        const at = k => index ? index.getX(i + k) : i + k;
        a.fromBufferAttribute(pos, at(0)).applyMatrix4(m); b.fromBufferAttribute(pos, at(1)).applyMatrix4(m); c.fromBufferAttribute(pos, at(2)).applyMatrix4(m);
        out.push(Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y), Math.min(a.z, b.z, c.z), Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y), Math.max(a.z, b.z, c.z));
      }
    }
  });
  return Float32Array.from(out);
}

const COLORS = { flagged: '#ff2a2a', passable: '#ffd23a', allowed: '#8a8f98', ok: '#3ad16a' };
const tone = c => c.flags.length ? 'flagged' : c.allowed ? 'allowed' : !c.blocksShots ? 'passable' : 'ok';

export function createCollisionDebug(scene) {
  const overlay = new THREE.Group(), edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0)), materials = {};
  overlay.name = 'Collision debug'; overlay.visible = false; overlay.renderOrder = 999; scene.add(overlay);
  for (const [k, color] of Object.entries(COLORS)) materials[k] = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true });
  let last = null;
  function draw(report) {
    overlay.clear();
    for (const c of report.colliders) {
      const line = new THREE.LineSegments(edges, materials[tone(c)]);
      line.position.set(c.position.x, 0, c.position.z); line.scale.set(c.size.w, Math.min(c.size.h ?? 12, 12), c.size.d); line.userData.collider = c.id; overlay.add(line);
    }
  }
  return {
    overlay,
    // Measures the colliders against the visible geometry under root, redraws the overlay and logs the result.
    audit({ root, colliders, map = '', variant = 0, shotHeight = null, allow = [] }) {
      last = { ...auditColliders(colliders, collectSolids(root), { map, variant, shotHeight, allow }), at: new Date().toISOString() };
      draw(last);
      console.groupCollapsed?.(`[collision] ${map} #${variant}: ${last.colliders.length} colliders, ${last.flagged.length} flagged`);
      console.table?.(last.colliders.map(c => ({ id: c.id, source: c.source, x: c.position.x, z: c.position.z, w: c.size.w, d: c.size.d, h: c.size.h, shots: c.blocksShots, moves: c.blocksMovement, health: c.health, coverage: c.mesh.coverage, flags: c.flags.join(' ') })));
      console.groupEnd?.();
      return last;
    },
    show(on = !overlay.visible) { overlay.visible = on; return on; },
    get report() { return last; },
    // Saves a report as JSON (the last audit by default).
    download(report = last, name = `collision-${report?.map || 'map'}-${report?.variant ?? 0}.json`) {
      if (!report) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })), link = document.createElement('a');
      link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    dispose() { overlay.removeFromParent(); overlay.clear(); edges.dispose(); Object.values(materials).forEach(m => m.dispose()); },
  };
}
