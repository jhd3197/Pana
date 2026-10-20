import * as THREE from 'three';
import { gameDetail } from '/engine/models/characters/pana/detail.js';

// Catmull–Clark subdivision preserves the openings and blends positions and
// bone weights together. Original vertices retain their IDs after refinement.
function subdivide(vertices, faces) {
  const edges = new Map(), facePoints = [], adjacentFaces = vertices.map(() => []), adjacentEdges = vertices.map(() => []);
  const average = ids => Array.from({ length: 5 }, (_, k) => ids.reduce((sum, i) => sum + vertices[i][k], 0) / ids.length);
  faces.forEach((face, f) => {
    facePoints.push(average(face));
    face.forEach((a, i) => {
      adjacentFaces[a].push(f);
      const b = face[(i + 1) % face.length], key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (!edges.has(key)) { const edge = { a, b, faces: [] }; edges.set(key, edge); adjacentEdges[a].push(edge); adjacentEdges[b].push(edge); }
      edges.get(key).faces.push(f);
    });
  });
  const result = vertices.map((v, i) => {
    const boundary = adjacentEdges[i].filter(e => e.faces.length === 1);
    if (boundary.length) {
      const neighbors = boundary.map(e => e.a === i ? e.b : e.a);
      return v.map((x, k) => x * 0.75 + neighbors.reduce((sum, n) => sum + vertices[n][k], 0) / neighbors.length * 0.25);
    }
    const n = adjacentFaces[i].length;
    return v.map((x, k) => {
      const f = adjacentFaces[i].reduce((sum, j) => sum + facePoints[j][k], 0) / n;
      const e = adjacentEdges[i].reduce((sum, edge) => sum + (vertices[edge.a][k] + vertices[edge.b][k]) / 2, 0) / n;
      return (f + 2 * e + (n - 3) * x) / n;
    });
  });
  for (const edge of edges.values()) {
    edge.id = result.length;
    result.push(Array.from({ length: 5 }, (_, k) => edge.faces.length === 1
      ? (vertices[edge.a][k] + vertices[edge.b][k]) / 2
      : (vertices[edge.a][k] + vertices[edge.b][k] + facePoints[edge.faces[0]][k] + facePoints[edge.faces[1]][k]) / 4));
  }
  const centers = facePoints.map(p => { const id = result.length; result.push(p); return id; });
  const quads = [];
  const edgeId = (a, b) => edges.get(a < b ? `${a}:${b}` : `${b}:${a}`).id;
  faces.forEach((face, f) => face.forEach((v, i) => {
    quads.push([v, edgeId(v, face[(i + 1) % face.length]), centers[f], edgeId(face[(i + face.length - 1) % face.length], v)]);
  }));
  return { vertices: result, faces: quads };
}

// Merges coincident vertices so neighbouring quads subdivide as one surface.
function weld({ vertices, faces }) {
  const ids = new Map(), out = [];
  const remap = vertices.map(v => {
    const key = v.slice(0, 3).map(n => n.toFixed(5)).join();
    if (!ids.has(key)) { ids.set(key, out.length); out.push(v); }
    return ids.get(key);
  });
  return { vertices: out, faces: faces.map(f => f.map(id => remap[id])) };
}

const templates = new Map();
const copyTemplate = value => ({ geometry: value.geometry.clone(), collar: value.collar.map(p => p.clone()), cuffs: value.cuffs.map(ring => ring.map(p => p.clone())) });
export function shirtGeometry(arms, { style = 'shirt' } = {}) {
  const key = JSON.stringify([gameDetail(), style, arms.map(a => [...a.position, ...a.quaternion])]);
  if (!templates.has(key)) {
    if (templates.size >= 16) { const oldest = templates.keys().next().value; templates.get(oldest).geometry.dispose(); templates.delete(oldest); }
    templates.set(key, buildShirtGeometry(arms, style));
  }
  return copyTemplate(templates.get(key));
}
function buildShirtGeometry(arms, style) {
  const count = 24, vertices = [], faces = [], ring = (r, i) => r * count + (i + count) % count;
  const profile = [[1.015, 0.803, 0.588], [1.08, 0.805, 0.588], [1.37, 0.76, 0.565], [1.88, 0.69, 0.465], [1.89, 0.45, 0.395]];
  for (let r = 0; r < profile.length; r++) for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2, [height, width, depth] = profile[r];
    const front = Math.max(0, Math.cos(a)), back = Math.max(0, -Math.cos(a));
    const neckDip = style === 'tropical' ? 0.32 : 0.20;
    const dip = r === 4 ? neckDip * front + 0.035 * back : r === 3 ? 0.29 * front + 0.16 * back : 0;
    vertices.push([Math.sin(a) * width, height - dip, Math.cos(a) * depth - 0.01, 0, 0]);
  }
  for (let r = 0; r < profile.length - 1; r++) for (let i = 0; i < count; i++) {
    const armhole = r === 2 && ((i >= 3 && i < 9) || (i >= 15 && i < 21));
    if (!armhole) faces.push([ring(r, i), ring(r, i + 1), ring(r + 1, i + 1), ring(r + 1, i)]);
  }
  const cuffs = [];
  arms.forEach((arm, side) => {
    const sign = side ? -1 : 1, start = side ? 15 : 3;
    const opening = [];
    for (let i = 0; i <= 6; i++) opening.push(ring(2, start + i));
    for (let i = 6; i >= 0; i--) opening.push(ring(3, start + i));
    if (style === 'sport') { cuffs.push(opening); return; }
    opening.forEach((id, i) => {
      const across = i <= 6 ? i / 6 : (13 - i) / 6;
      // Keep the top shoulder anchored to the collar. Moving that edge with
      // the arm folds it back through the neck opening during a high wave.
      vertices[id][3 + side] = i <= 6 ? 0.18 + 0.30 * Math.sin(across * Math.PI) : 0;
    });
    const cuff = opening.map((_, j) => {
      const angle = (j + 0.5) / opening.length * Math.PI * 2 + Math.PI / 2;
      const long = style === 'hoodie';
      return new THREE.Vector3(sign * Math.cos(angle) * (long ? 0.21 : 0.253), long ? -0.76 : -0.34, sign * Math.sin(angle) * (long ? 0.235 : 0.273) + 0.015)
        .applyQuaternion(arm.quaternion).add(arm.position);
    });
    let previous = opening;
    for (const t of style === 'hoodie' ? [0.28, 0.55, 0.78, 0.92, 1] : [0.55, 0.92, 1]) {
      const next = opening.map((id, j) => {
        const p = new THREE.Vector3(...vertices[id].slice(0, 3)).lerp(cuff[j], t);
        const w = t >= 0.92 ? 1 : style === 'hoodie' ? THREE.MathUtils.lerp(vertices[id][3 + side], 1, t) : 0.85;
        const index = vertices.length;
        vertices.push([p.x, p.y, p.z, side === 0 ? w : 0, side === 1 ? w : 0]);
        return index;
      });
      for (let j = 0; j < opening.length; j++) {
        const k = (j + 1) % opening.length;
        faces.push([previous[j], previous[k], next[k], next[j]]);
      }
      previous = next;
    }
    cuffs.push(previous);
  });
  // A torso-only panel under each sleeve closes the armhole: with the arms
  // down it sits inside the sleeve, raised forward it keeps the belly from
  // showing through. A tank has no sleeve to hide it in.
  const panels = { vertices: [], faces: [] };
  if (style !== 'sport') for (const start of [3, 15]) for (let i = start; i < start + 6; i++) {
    const corner = panels.vertices.length;
    for (const [r, j] of [[2, i], [2, i + 1], [3, i + 1], [3, i]]) {
      const [x, y, z] = vertices[ring(r, j)];
      panels.vertices.push([x, y, z, 0, 0]);
    }
    panels.faces.push([corner, corner + 1, corner + 2, corner + 3]);
  }
  let cage = { vertices, faces };
  for (let i = 0; i < (gameDetail() ? 2 : 3); i++) cage = subdivide(cage.vertices, cage.faces);
  // Subdivision bleeds the sleeves' arm weight into the flanks under them;
  // the side of the shirt then follows a raised arm and the belly shows
  // through. Below the armhole the shirt belongs to the torso only.
  for (const v of cage.vertices) {
    const keep = Math.max(THREE.MathUtils.smoothstep(v[1], 1.3, 1.5), THREE.MathUtils.smoothstep(Math.abs(v[0]), 0.8, 0.9));
    v[3] *= keep; v[4] *= keep;
  }
  if (panels.faces.length) {
    let panel = weld(panels);
    for (let i = 0; i < (gameDetail() ? 2 : 3); i++) panel = subdivide(panel.vertices, panel.faces);
    const offset = cage.vertices.length;
    cage = { vertices: [...cage.vertices, ...panel.vertices], faces: [...cage.faces, ...panel.faces.map(f => f.map(id => id + offset))] };
  }
  const g = new THREE.BufferGeometry(), positions = [], uvs = [], weights = [], boneIndices = [], indices = [];
  for (const [x, y, z, left, right] of cage.vertices) {
    positions.push(x, y, z); uvs.push(x * 0.5 + 0.5, y);
    weights.push(Math.max(0, 1 - left - right), left, right, 0); boneIndices.push(0, 1, 2, 0);
  }
  for (const [a, b, c, d] of cage.faces) indices.push(a, b, c, a, c, d);
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(boneIndices, 4));
  g.setIndex(indices); g.computeVertexNormals();
  const points = ids => ids.map(id => new THREE.Vector3(...cage.vertices[id].slice(0, 3)));
  return { geometry: g, collar: points(Array.from({ length: count }, (_, i) => ring(4, i))), cuffs: cuffs.map(points) };
}
