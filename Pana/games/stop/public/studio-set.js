// The plaza set for ¡Stop!: a round toy-bright table, the letter wheel the
// turn pana stops, a spiral notebook and a pencil for every pana, the plastic
// plaza chairs and the purple wall of painted slang from the reel. Registered
// in Pana Studio (web/studio/catalog/stop.js). Each factory returns a group
// whose userData.dispose frees what it built. Canvas-painted faces live here
// so scene.js stays pure 3D.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';

export const STOP_RED = '#e5383b';
export const PAPER = '#fffaf0';
export const WHEEL_LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const SECTOR_COLORS = ['#ff4b4b', '#ffc629', '#2ad1b2', '#3d7bf2', '#ff8a3d', '#9b5de5', '#6bbf59', '#ff6fae', '#00b4d8'];
const DISPLAY = '"Luckiest Guy", "Nunito", system-ui, sans-serif';

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .55, ...extra });
function part(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
const owned = (group) => { group.userData.dispose = () => disposeModel(group); return group; };
// A canvas texture plus a repaint that also runs once the kit fonts arrive.
function paintedTexture(width, height, draw) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  const paint = (...args) => { ctx.clearRect(0, 0, width, height); draw(ctx, width, height, ...args); texture.needsUpdate = true; };
  return { canvas, ctx, texture, paint };
}
const afterFonts = (fn) => { try { document.fonts?.ready?.then(fn); } catch { /* no font API */ } };

// Round plaza table, 3 m radius, top at 1,42 m: a sunny painted top with a
// sunburst, a striped toy edge and one fat pedestal so knees fit underneath.
export function createStopTable({ radius = 3 } = {}) {
  const group = new THREE.Group(); group.name = 'Mesa redonda de ¡Stop!';
  const top = paintedTexture(1024, 1024, (ctx, w, h) => {
    const c = w / 2;
    ctx.fillStyle = '#fff1c7'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) {
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c, i / 24 * Math.PI * 2, (i + 1) / 24 * Math.PI * 2); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#ffe08a' : '#fff1c7'; ctx.fill();
    }
    ctx.lineWidth = 26; ctx.strokeStyle = '#2ad1b2'; ctx.beginPath(); ctx.arc(c, c, c - 60, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([30, 26]); ctx.lineWidth = 10; ctx.strokeStyle = '#ff4b4b'; ctx.beginPath(); ctx.arc(c, c, c - 100, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#e5383b'; ctx.beginPath(); ctx.arc(c, c, 210, 0, Math.PI * 2); ctx.fill();
  });
  top.paint(); const edge = edgeMaterial();
  part(group, new THREE.CylinderGeometry(radius, radius, .14, 64), [edge, mat('#ffffff', { map: top.texture, roughness: .7 }), edge], 0, 1.35, 0);
  part(group, new THREE.CylinderGeometry(radius - .1, radius - .25, .16, 48), mat('#c4572a'), 0, 1.22, 0);
  part(group, new THREE.CylinderGeometry(.34, .42, 1.15, 24), mat('#2a9d8f', { roughness: .4 }), 0, .6, 0);
  part(group, new THREE.CylinderGeometry(1.1, 1.25, .12, 32), mat('#21867a', { roughness: .45 }), 0, .06, 0);
  group.userData.top = 1.42;
  return owned(group);
}
function edgeMaterial() {
  const stripes = paintedTexture(512, 64, (ctx, w, h) => {
    for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#ffc629' : '#ff4b4b'; ctx.fillRect(i * w / 16, 0, w / 16 + 1, h); }
  });
  stripes.paint(); stripes.texture.wrapS = THREE.RepeatWrapping; stripes.texture.repeat.set(4, 1);
  return mat('#ffffff', { map: stripes.texture, roughness: .45 });
}

// The letter wheel: a disc with the 27 letters around the rim (Ñ included),
// a yellow pointer at +Z and a big red ¡PARA! hub. Lies flat, 1,05 m radius.
// userData: setAngle(a), angleFor(letter), setEnabled(letters), setHub(text, mode),
// press(amount 0–1).
export function createLetterWheel({ radius = 1.05 } = {}) {
  const group = new THREE.Group(); group.name = 'Rueda de letras';
  let enabled = new Set(WHEEL_LETTERS);
  const step = Math.PI * 2 / WHEEL_LETTERS.length;
  const face = paintedTexture(1024, 1024, (ctx, w) => {
    const c = w / 2, r = c - 6;
    WHEEL_LETTERS.forEach((letter, i) => {
      const a = i * step, on = enabled.has(letter);
      ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, r, a - step / 2, a + step / 2); ctx.closePath();
      ctx.fillStyle = on ? SECTOR_COLORS[i % SECTOR_COLORS.length] : '#8d8aa0'; ctx.fill();
      ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.save(); ctx.translate(c + Math.cos(a) * r * .8, c + Math.sin(a) * r * .8); ctx.rotate(a - Math.PI / 2);
      ctx.font = `86px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 10; ctx.strokeStyle = on ? '#2a1a00' : '#55526a'; ctx.strokeText(letter, 0, 4);
      ctx.fillStyle = on ? '#ffffff' : '#c9c6d8'; ctx.fillText(letter, 0, 4); ctx.restore();
    });
    ctx.lineWidth = 14; ctx.strokeStyle = '#2a1a00'; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.stroke();
  });
  face.paint(); afterFonts(() => face.paint());
  part(group, new THREE.CylinderGeometry(radius * .62, radius * .7, .12, 40), mat('#2a1a6e', { roughness: .4 }), 0, .06, 0);
  const disc = new THREE.Group(); disc.position.y = .14; group.add(disc);
  part(disc, new THREE.CylinderGeometry(radius, radius, .06, 72), mat('#2a1a00'), 0, 0, 0);
  const top = part(disc, new THREE.CircleGeometry(radius - .01, 72), new THREE.MeshStandardMaterial({ map: face.texture, roughness: .5 }), 0, .031, 0);
  top.rotation.x = -Math.PI / 2;
  // Pegs between letters, like a real carnival wheel.
  const pegs = new THREE.InstancedMesh(new THREE.CylinderGeometry(.018, .018, .09, 8), mat('#ffe7a1', { metalness: .6, roughness: .3 }), WHEEL_LETTERS.length);
  const m = new THREE.Matrix4();
  for (let i = 0; i < WHEEL_LETTERS.length; i++) { const a = i * step + step / 2; m.makeTranslation(Math.cos(a) * (radius - .03), .07, Math.sin(a) * (radius - .03)); pegs.setMatrixAt(i, m); }
  disc.add(pegs);
  // The pointer stands on the base and flicks over the pegs.
  const pointer = new THREE.Group(); pointer.position.set(0, .2, radius + .06); group.add(pointer);
  part(pointer, new THREE.CylinderGeometry(.05, .07, .32, 12), mat('#2a1a00'), 0, -.06, .06);
  const arrow = new THREE.Shape(); arrow.moveTo(0, -.2); arrow.lineTo(.13, .06); arrow.lineTo(-.13, .06); arrow.closePath();
  const flag = part(pointer, new THREE.ExtrudeGeometry(arrow, { depth: .05, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2 }), mat('#ffc629', { roughness: .35 }), 0, .1, .04);
  flag.rotation.x = -Math.PI / 2;
  // The hub: a mushroom button; its face says ¡PARA! or shows the letter.
  const hubFace = paintedTexture(512, 512, (ctx, w, h, text = '¡PARA!', mode = 'para') => {
    const c = w / 2;
    ctx.fillStyle = mode === 'letter' ? '#ffffff' : STOP_RED; ctx.beginPath(); ctx.arc(c, c, c, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 22; ctx.strokeStyle = mode === 'letter' ? STOP_RED : '#ffffff'; ctx.beginPath(); ctx.arc(c, c, c - 24, 0, Math.PI * 2); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${mode === 'letter' ? 330 : 128}px ${DISPLAY}`;
    ctx.fillStyle = mode === 'letter' ? STOP_RED : '#ffffff'; ctx.fillText(text, c, c + (mode === 'letter' ? 26 : 12));
  });
  let hubArgs = ['¡PARA!', 'para']; hubFace.paint(...hubArgs); afterFonts(() => hubFace.paint(...hubArgs));
  const hub = new THREE.Group(); hub.position.y = .2; group.add(hub);
  part(hub, new THREE.CylinderGeometry(.3, .34, .14, 32), mat('#ffffff', { roughness: .4 }), 0, .02, 0);
  const cap = part(hub, new THREE.CylinderGeometry(.28, .3, .1, 32), mat(STOP_RED, { roughness: .3 }), 0, .13, 0);
  const capFace = part(hub, new THREE.CircleGeometry(.275, 40), new THREE.MeshStandardMaterial({ map: hubFace.texture, roughness: .35 }), 0, .181, 0);
  capFace.rotation.x = -Math.PI / 2;
  let angle = 0, lastPeg = 0;
  Object.assign(group.userData, {
    radius, step,
    setAngle(a) {
      angle = a; disc.rotation.y = a;
      const peg = Math.floor((a / step) + .5);
      if (peg !== lastPeg) { lastPeg = peg; flag.rotation.z = .35; }
    },
    get angle() { return angle; },
    // The disc angle that puts a letter under the pointer.
    angleFor(letter) { return WHEEL_LETTERS.indexOf(letter) * step - Math.PI / 2; },
    setEnabled(letters) { const next = new Set(letters); if ([...next].join() !== [...enabled].join()) { enabled = next; face.paint(); } },
    setHub(text, mode) { if (hubArgs[0] === text && hubArgs[1] === mode) return; hubArgs = [text, mode]; hubFace.paint(text, mode); },
    press(amount) { cap.position.y = .13 - amount * .06; capFace.position.y = .181 - amount * .06; },
    tick(t, dt) { flag.rotation.z *= Math.exp(-dt * 14); },
    previewBounds: [[-1.2, 0, -1.2], [1.2, .5, 1.3]],
  });
  return owned(group);
}

// An open spiral school notebook lying flat, 0,9 × 0,62 m, spiral along
// the middle (local X), the pana sits on the +Z side. setProgress(filled,
// total) scribbles that many pencil lines on the right page, never the words.
export function createNotebook({ cover = '#3d7bf2' } = {}) {
  const group = new THREE.Group(); group.name = 'Libreta de rayas';
  const page = (side) => paintedTexture(512, 360, (ctx, w, h, filled = 0, total = 8, seed = 1) => {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#9cc3e6'; ctx.lineWidth = 3;
    for (let y = 70; y < h - 10; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = STOP_RED; ctx.lineWidth = 4; const mx = side ? 70 : w - 70;
    ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, h); ctx.stroke();
    if (!side) return;
    // Scribbles: one pencil line per filled box, never the words themselves.
    ctx.strokeStyle = '#4a4e5c'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const rows = Math.min(filled, 9);
    for (let i = 0; i < rows; i++) {
      const y = 62 + i * 32, len = 150 + ((seed * 37 + i * 53) % 210);
      ctx.beginPath(); ctx.moveTo(86, y);
      for (let x = 86; x < 86 + len; x += 14) ctx.lineTo(x + 7, y - 9 + ((x + i * 7) % 3) * 3), ctx.lineTo(x + 14, y);
      ctx.stroke();
    }
    if (total && filled >= total) { ctx.font = `64px ${DISPLAY}`; ctx.fillStyle = STOP_RED; ctx.save(); ctx.translate(w - 120, h - 60); ctx.rotate(-.25); ctx.fillText('¡LISTO!', -80, 0); ctx.restore(); }
  });
  const left = page(0), right = page(1); left.paint(); right.paint();
  part(group, new RoundedBoxGeometry(.96, .03, .66, 2, .012), mat(cover, { roughness: .6 }), 0, .015, 0);
  for (const [x, tex] of [[-.225, left], [.225, right]]) {
    part(group, new THREE.BoxGeometry(.43, .02, .6), mat('#f4ecd8'), x, .04, 0);
    const sheet = part(group, new THREE.PlaneGeometry(.43, .6), new THREE.MeshStandardMaterial({ map: tex.texture, roughness: .9 }), x, .051, 0);
    sheet.rotation.x = -Math.PI / 2;
  }
  const ring = new THREE.TorusGeometry(.03, .006, 6, 14), metal = mat('#c9ccd6', { metalness: .8, roughness: .3 });
  for (let i = 0; i < 9; i++) { const r = part(group, ring, metal, 0, .05, -.26 + i * .065); r.rotation.y = Math.PI / 2; }
  let shown = '';
  group.userData.setProgress = (filled, total, seed = 1) => { const key = `${filled}/${total}/${seed}`; if (key !== shown) { shown = key; right.paint(filled, total, seed); } };
  group.userData.previewBounds = [[-.55, 0, -.4], [.55, .2, .4]];
  return owned(group);
}

// A fat yellow school pencil, 0,5 m: the graphite tip is the origin and the
// eraser points up +Y, so it can be held tip-down or laid flat.
export function createPencil({ color = '#ffc629' } = {}) {
  const group = new THREE.Group(); group.name = 'Lápiz';
  part(group, new THREE.ConeGeometry(.012, .035, 6), mat('#3b3f4a', { roughness: .4 }), 0, .0175, 0).rotation.x = Math.PI;
  part(group, new THREE.CylinderGeometry(.034, .012, .08, 6), mat('#f1c58f', { roughness: .8 }), 0, .075, 0);
  part(group, new THREE.CylinderGeometry(.034, .034, .34, 6), mat(color, { roughness: .45 }), 0, .285, 0);
  part(group, new THREE.CylinderGeometry(.036, .036, .045, 12), mat('#c9ccd6', { metalness: .85, roughness: .25 }), 0, .475, 0);
  part(group, new THREE.CylinderGeometry(.034, .034, .05, 12), mat('#ff8fb0', { roughness: .7 }), 0, .52, 0);
  group.userData.length = .545;
  group.userData.previewBounds = [[-.1, 0, -.1], [.1, .56, .1]];
  return owned(group);
}

// The classic plastic plaza chair, bright and a bit toy-like. Seat top at
// 0,74 m, the back on −Z, sitter faces +Z.
export function createPlasticChair({ color = '#ff4b4b' } = {}) {
  const group = new THREE.Group(); group.name = 'Silla plástica';
  const plastic = mat(color, { roughness: .35 });
  part(group, new RoundedBoxGeometry(1.25, .1, 1.15, 3, .05), plastic, 0, .69, .02);
  for (const x of [-.52, .52]) for (const z of [-.45, .5]) {
    const leg = part(group, new THREE.CylinderGeometry(.05, .065, .7, 10), plastic, x * 1.04, .34, z * 1.04);
    leg.rotation.set(z > 0 ? .06 : -.06, 0, x > 0 ? -.06 : .06);
  }
  const back = new THREE.Group(); back.position.set(0, .74, -.55); back.rotation.x = -.18; group.add(back);
  for (const x of [-.56, .56]) part(back, new RoundedBoxGeometry(.1, 1.05, .1, 2, .04), plastic, x, .52, 0);
  for (const y of [.42, .72, 1.0]) part(back, new RoundedBoxGeometry(1.2, .16, .08, 2, .035), plastic, 0, y, 0);
  part(group, new RoundedBoxGeometry(1.1, .05, .08, 2, .02), plastic, 0, .25, .5);
  group.userData.seat = .74;
  return owned(group);
}

// The reel's purple wall covered in painted slang words, 14 × 4 m, painted
// face toward +Z.
export const SLANG_WALL_WORDS = ['CAMBUR', 'COTUFA', 'CHAMO', 'RASCAO', 'PANA', 'CHÉVERE', 'BURDA', 'LADILLA', 'GUAYOYO', 'ÑAPA', 'PEROL', 'JEVA', 'CHIMBO', 'PAVOSO', 'COROTO', 'GAFO', 'BOCHINCHE', 'PICHIRRE'];
export function createSlangWall({ width = 14, height = 4, words = SLANG_WALL_WORDS } = {}) {
  const group = new THREE.Group(); group.name = 'Muro de palabras';
  const colors = ['#ffc629', '#2ad1b2', '#ff6fae', '#ffffff', '#ff8a3d', '#6bdc5a', '#7fd4ff'];
  const face = paintedTexture(2048, Math.round(2048 * height / width), (ctx, w, h) => {
    ctx.fillStyle = '#5b2a9e'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; ctx.fillRect((i * 173) % w, (i * 97) % h, 160, 90); }
    const cols = 6, rows = 3;
    words.forEach((word, i) => {
      const col = i % cols, row = Math.floor(i / cols) % rows;
      const x = (col + .5 + (row % 2 ? .3 : -.1)) * w / cols, y = (row + .55) * h / rows;
      ctx.save(); ctx.translate(x, y); ctx.rotate(((i * 47) % 21 - 10) / 60);
      ctx.font = `${110 + (i * 13) % 50}px ${DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 14; ctx.strokeStyle = '#2a1050'; ctx.strokeText(word, 0, 0);
      ctx.fillStyle = colors[i % colors.length]; ctx.fillText(word, 0, 0); ctx.restore();
    });
  });
  face.paint(); afterFonts(() => face.paint());
  part(group, new THREE.BoxGeometry(width, height, .35), mat('#4a2185', { roughness: .9 }), 0, height / 2, -.18);
  const painted = part(group, new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: face.texture, roughness: .85 }), 0, height / 2, .001);
  painted.castShadow = false;
  part(group, new THREE.BoxGeometry(width + .3, .25, .5), mat('#f3e9d7', { roughness: .8 }), 0, height + .12, -.15);
  group.userData.previewBounds = [[-width / 2, 0, -.4], [width / 2, height + .3, .4]];
  return owned(group);
}

