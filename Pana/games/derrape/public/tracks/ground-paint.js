// The painted ground of the reference-ported circuits, as a pass over any
// vertex-coloured terrain: broad lighter and darker growth, straw patches,
// moss on banks and a worn verge beside the road. The map's own colour stays
// the base, so beaches, salt and cave floors keep their identity.
import * as THREE from 'three';

const sstep = THREE.MathUtils.smoothstep;
const tmp = new THREE.Color(), dryC = new THREE.Color(), mossC = new THREE.Color(), vergeC = new THREE.Color();

// slope: 0 flat .. 1 vertical. edge: metres beyond the road edge (Infinity when unknown).
// coarse: the horizon's long triangles alias fine noise into rays, so it only
// takes the broad growth pattern.
export function paintColor(color, x, z, y, slope, edge, recipe, coarse = false) {
  const { tone = .1, dry = 0, dryColor = 0xc9b95c, moss = 0, mossColor = 0x3f6e2e, verge = 0, vergeColor = 0xd3c49a } = recipe;
  const out = color.isColor ? color : tmp.set(color);
  const broad = .5 + .5 * Math.sin(x * .023 - z * .031 + Math.sin(z * .011) * 2);
  const fine = coarse ? .5 : .5 + .5 * Math.sin(x * .09 + Math.sin(z * .05) * 3) * Math.cos(z * .08 - x * .03);
  out.multiplyScalar(1 + tone * ((broad - .5) * 1.3 + (fine - .5) * .7));
  out.offsetHSL((fine - .5) * tone * .12, 0, 0);
  if (dry) out.lerp(dryC.set(dryColor), sstep(broad * .6 + fine * .4, .55, .82) * dry);
  if (moss) out.lerp(mossC.set(mossColor), sstep(slope, .12, .35) * (1 - sstep(slope, .55, .75)) * moss);
  if (verge && edge > -.5) out.lerp(vergeC.set(vergeColor), (1 - sstep(edge, .5, 4.5)) * verge * (.75 + .25 * fine));
  return out;
}

// Repaints a mesh's existing vertex colours in place. `keep(x,z,y)` leaves a
// vertex untouched (sand, salt, plazas, the stadium infield).
export function paintTerrain(geometry, T, recipe = {}) {
  const p = geometry.attributes.position, n = geometry.attributes.normal, c = geometry.attributes.color;
  if (!c || !n) return geometry;
  const keep = recipe.keep ?? (() => false), color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (keep(x, z, y)) continue;
    const edge = recipe.verge ? T.roadDistance(x, z) - T.HW : Infinity;
    color.fromBufferAttribute(c, i);
    paintColor(color, x, z, y, 1 - Math.abs(n.getY(i)), edge, recipe);
    c.setXYZ(i, color.r, color.g, color.b);
  }
  c.needsUpdate = true;
  return geometry;
}

// The horizon continuation has no road and no slope shading of its own.
export function paintedColor(colorAt, recipe) {
  const keep = recipe.keep ?? (() => false);
  return (x, z, y) => {
    const base = new THREE.Color(colorAt(x, z, y));
    return keep(x, z, y) ? base : paintColor(base, x, z, y, 0, Infinity, recipe, true);
  };
}

// The bundle terrain() accepts: the mesh pass and the horizon colour.
export function groundPaint(recipe) {
  return { apply: (geometry, T) => paintTerrain(geometry, T, recipe), color: colorAt => paintedColor(colorAt, recipe) };
}
