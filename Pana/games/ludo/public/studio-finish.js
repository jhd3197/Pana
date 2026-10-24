import * as THREE from 'three';

// The standalone Ludo Studio's paper, yard print and lacquered pawn finish.
// Textures are owned by each board, so disposing a preview cannot break a game.
export function finishBoard(board) {
  let seed = 7;
  const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  function texture(kind) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 256, 256);
    if (kind === 'yard') {
      ctx.fillStyle = 'rgba(70,30,0,.09)';
      for (let x = -256; x < 512; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 20, 0);
        ctx.lineTo(x - 236, 256); ctx.lineTo(x - 256, 256); ctx.fill();
      }
    }
    for (let i = 0; i < (kind === 'yard' ? 900 : 2600); i++) {
      const c = 200 + random() * 40 | 0;
      ctx.fillStyle = `rgba(${c-20},${c-34},${c-50},${.3*(.4+random()*.6)})`;
      const size = 1 + random() * 2.4; ctx.fillRect(random()*256, random()*256, size, size);
    }
    if (kind === 'wood') for (let y = 0; y < 256; y += 3) {
      ctx.strokeStyle = 'rgba(90,40,5,.18)'; ctx.beginPath();
      for (let x = 0; x <= 256; x += 8) ctx.lineTo(x, y + Math.sin(x*.04+y)*2);
      ctx.stroke();
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; return map;
  }
  const paper = texture('paper'), yard = texture('yard'), wood = texture('wood');
  board.traverse(mesh => {
    if (!mesh.isMesh) return;
    const width = mesh.geometry.parameters?.width, mat = mesh.material;
    mat.map = mat.color.getHexString() === '86522f' ? wood : width > 1.9 && width < 2.2 ? yard : paper;
  });
  board.userData.studioFinish = true;
}

export function finishPawn(pawn, seed) {
  pawn.rotation.order = 'YXZ';
  const [base, body, head] = pawn.children;
  const dark = body.material.color.clone().offsetHSL(0, .04, -.12);
  const light = body.material.color.clone().offsetHSL(-.01, -.02, .07);
  const old = body.material;
  const lacquer = new THREE.MeshPhysicalMaterial({color: '#fff', vertexColors: true, roughness: .3, clearcoat: 1, clearcoatRoughness: .15});
  for (const mesh of [body, head]) {
    const pos = mesh.geometry.attributes.position, colors = new Float32Array(pos.count*3), color = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const t = THREE.MathUtils.clamp((pos.getY(i)+mesh.position.y-.06)/.36, 0, 1);
      color.copy(dark).lerp(light, t*t*(3-2*t)); colors.set([color.r,color.g,color.b],i*3);
    }
    mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3)); mesh.material = lacquer;
  }
  old.dispose();
  base.material.roughness = .4;
  const face = new THREE.Group(); face.name = 'Carita'; pawn.add(face);
  const white = new THREE.MeshStandardMaterial({color:'#fff',roughness:.25});
  const ink = new THREE.MeshStandardMaterial({color:'#1d1622',roughness:.2});
  const eyes = [], pupils = [];
  for (const side of [-1,1]) {
    const eye = new THREE.Group(), normal = new THREE.Vector3(side*.42,.2,.89).normalize().multiplyScalar(.098);
    eye.position.set(normal.x,.3+normal.y,normal.z); face.add(eye);
    eye.add(new THREE.Mesh(new THREE.SphereGeometry(.036,16,12),white));
    const pupil = new THREE.Group(); eye.add(pupil);
    pupil.add(new THREE.Mesh(new THREE.SphereGeometry(.018,12,8),ink));
    const shine = new THREE.Mesh(new THREE.SphereGeometry(.006,8,6),white); shine.position.set(.006,.007,.016); pupil.add(shine);
    eyes.push(eye); pupils.push(pupil);
  }
  const mouth = new THREE.Group(); mouth.position.set(0,.262,.104); mouth.rotation.x=.34; face.add(mouth);
  const smile = new THREE.Mesh(new THREE.TorusGeometry(.026,.0065,6,18,Math.PI),ink);
  const open = new THREE.Mesh(new THREE.TorusGeometry(.014,.006,6,18),ink); mouth.add(smile,open);
  pawn.userData.face = {eyes,pupils,smile,open,seed};
  poseFace(pawn,0);
}

export function poseFace(pawn, time, mood = 'idle', look = 0) {
  const face = pawn.userData.face;
  const blink = (time + face.seed*.37)%4.1 < .12 ? .08 : 1;
  const surprised = mood === 'surprised', happy = mood === 'happy';
  face.eyes.forEach((eye,i) => {
    eye.scale.set(1, (mood==='sleep'?.08:surprised?1.3:happy?.35:1)*blink, 1);
    face.pupils[i].position.set(THREE.MathUtils.clamp(look,-1,1)*.013,0,.024);
    face.pupils[i].scale.setScalar(surprised?.65:1);
  });
  face.smile.visible = !surprised; face.open.visible = surprised;
  face.smile.rotation.z = mood === 'sad' ? 0 : Math.PI;
}
