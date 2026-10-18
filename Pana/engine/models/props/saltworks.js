// Coastal saltworks props, metres, ground origin, +Z front.
import * as THREE from 'three';
import { M, mesh, box, tube, rng } from '../core/primitives.js';
import { waterPool } from '../effects/water-surface.js';
export function saltPile({seed=56,radius=5,height=3}={}) {
  const r=rng(seed),g=new THREE.Group(),geo=new THREE.ConeGeometry(radius,height,13,5),p=geo.attributes.position;
  for(let i=0;i<p.count;i++){const k=1+(r()-.5)*.12;p.setXYZ(i,p.getX(i)*k,p.getY(i)+height/2,p.getZ(i)*k);}
  geo.computeVertexNormals();g.add(mesh(geo,M(0xe3dfd2,{roughness:1})));g.name='salt-pile';return g;
}
export function sluiceGate({width=4,height=3}={}) {
  const g=new THREE.Group(),wood=M(0x806b4e),iron=M(0x53676a,{metalness:.35});
  for(const x of [-width/2,width/2])g.add(box(.35,height+1,.4,wood,x,height/2,0));
  for(let y=.3;y<height*.6;y+=.32)g.add(box(width,.29,.14,wood,0,y,.05));
  g.add(box(width+.5,.3,.45,wood,0,height,0),tube([0,.5,0],[0,height+1,0],.065,iron));
  const wheel=mesh(new THREE.TorusGeometry(.5,.05,6,20),iron,0,height+.6,.06);g.add(wheel);
  for(const d of [-1,1])g.add(tube([-.35*d,height+.25,.06],[.35*d,height+.95,.06],.035,iron));
  g.name='sluice-gate';return g;
}

// A glowing brine pool inside a raised salt crust, as in salt caves and
// evaporation flats. Water origin at y = .1; userData.tick animates it.
export function saltPool({ rx = 11, rz = 7, color = 0x3fd8d0, glow = .45 } = {}) {
  const g = new THREE.Group(), water = waterPool(rx, rz, { color, depth: 2 }); water.position.y = .1; g.add(water);
  const outer = new THREE.Shape(), inner = new THREE.Path();
  outer.absellipse(0, 0, rx + 1.8, rz + 1.8, 0, Math.PI * 2, false); inner.absellipse(0, 0, rx - .3, rz - .3, 0, Math.PI * 2, true);
  outer.holes.push(inner);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: .35, bevelEnabled: true, bevelThickness: .15, bevelSize: .3, bevelSegments: 2, curveSegments: 36 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -.05, 0);
  const crust = mesh(geo, M(0xffe6ef, { emissive: 0xffc4dc, emissiveIntensity: glow, roughness: .6 })); crust.castShadow = false; g.add(crust);
  g.name = 'salt-pool'; g.userData.tick = t => water.userData.tick(t);
  g.userData.previewBounds = [[-rx - 2.5, -.5, -rz - 2.5], [rx + 2.5, 1, rz + 2.5]];
  return g;
}
