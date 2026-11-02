import * as THREE from 'three';

// Capture the flag in the world (scene.js calls draw every frame): per team a
// square stand pad with a frame at the stand, a flag (pole, square cloth, a faint
// light column to find it from afar) where the flag is: upright at its stand,
// leaning on the ground when dropped, on the carrier's back while carried.
const TEAM = ['#f28b42', '#29c5cd'];
export function createCtfProps(scene) {
  const own = [], mat = (color, extra = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .8, ...extra }); own.push(m); return m; };
  const geo = g => { own.push(g); return g; };
  const pole = geo(new THREE.CylinderGeometry(.05, .05, 2.6, 6)), cloth = geo(new THREE.BoxGeometry(1.1, .7, .05)), beamGeo = geo(new THREE.BoxGeometry(.32, 14, .32));
  const padGeo = geo(new THREE.BoxGeometry(3.2, .08, 3.2)), rimGeo = geo(new THREE.BoxGeometry(3.6, .1, .22)), white = mat('#f8f0d2');
  const teams = TEAM.map((color, team) => {
    const tint = mat(color, { emissive: color, emissiveIntensity: .25 });
    const flag = new THREE.Group(); flag.name = `Bandera ${team}`;
    const stick = new THREE.Mesh(pole, white); stick.position.y = 1.3; stick.castShadow = true;
    const banner = new THREE.Mesh(cloth, tint); banner.position.set(.57, 2.22, 0); banner.castShadow = true;
    const beam = new THREE.Mesh(beamGeo, mat(color, { emissive: color, emissiveIntensity: 1, transparent: true, opacity: .22, depthWrite: false }));
    beam.position.y = 7; beam.name = `Luz bandera ${team}`;
    flag.add(stick, banner, beam);
    const stand = new THREE.Group(); stand.name = `Base bandera ${team}`;
    const pad = new THREE.Mesh(padGeo, mat(color, { roughness: .95 })); pad.position.y = .04; pad.receiveShadow = true; stand.add(pad);
    for (const [x, z, turn] of [[0, 1.7, 0], [0, -1.7, 0], [1.7, 0, 1], [-1.7, 0, 1]]) { const rim = new THREE.Mesh(rimGeo, white); rim.position.set(x, .05, z); rim.rotation.y = turn * Math.PI / 2; stand.add(rim); }
    scene.add(flag, stand); return { flag, banner, beam, stand };
  });
  let time = 0;
  return {
    draw(state, avatars, dt) {
      time += dt; const on = state.options?.mode === 'ctf' && state.phase === 'playing' && (state.flags || []).length === 2;
      teams.forEach((t, team) => {
        const f = on && state.flags[team]; t.flag.visible = t.stand.visible = !!f; if (!f) return;
        t.stand.position.set(f.homeX, 0, f.homeZ);
        t.banner.rotation.y = Math.sin(time * 3 + team) * .25;
        t.beam.visible = f.state !== 'carried';
        if (f.state === 'carried') {
          // On the carrier's back: behind the avatar as drawn, facing where they look.
          const body = avatars.get(f.carrier)?.group, p = state.players.find(q => q.id === f.carrier);
          const x = body ? body.position.x : f.x, z = body ? body.position.z : f.z, yaw = Math.atan2(p?.ax ?? 0, p?.az ?? -1);
          t.flag.position.set(x - Math.sin(yaw) * .35, .5 + (p?.jumpHeight || 0), z - Math.cos(yaw) * .35); t.flag.rotation.set(0, yaw + Math.PI / 2, -.12); t.flag.scale.setScalar(.8);
        } else {
          t.flag.position.set(f.x, 0, f.z); t.flag.scale.setScalar(1);
          t.flag.rotation.set(0, team ? Math.PI : 0, f.state === 'dropped' ? .5 : 0);
        }
      });
    },
    dispose() { teams.forEach(t => { t.flag.removeFromParent(); t.stand.removeFromParent(); }); own.forEach(o => o.dispose()); },
  };
}
