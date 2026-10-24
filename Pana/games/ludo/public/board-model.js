import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { disposeModel } from '/engine/models/props/game-table.js';
import { COLORS, RING, SAFE, rotateCell, cellFor } from './rules.js';
import { finishBoard, finishPawn } from './studio-finish.js';

export const STEP = .36;
export const boardPoint = (seat, progress, piece) => cellFor(seat, progress, piece).map(v => (v - 7) * STEP);
const material = color => new THREE.MeshStandardMaterial({ color, roughness: .55 });
function add(group, geometry, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, mat); m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true; group.add(m); return m;
}
function finish(group) { group.userData.dispose = () => disposeModel(group); return group; }
// Origin at the underside; the playing surface is +0.12 m, forward is +Z.
export function createLudoBoard() {
  const group = new THREE.Group(); group.name = 'Tablero de Ludo';
  const cream = material('#f3e9d7'), ink = material('#65544a');
  add(group, new RoundedBoxGeometry(5.65, .12, 5.65, 3, .07), material('#86522f'), 0, .02);
  add(group, new THREE.BoxGeometry(5.42, .035, 5.42), cream, 0, .095);
  for (let seat = 0; seat < 4; seat++) {
    const color = material(COLORS[seat]), [x,z] = rotateCell([2.5,11.5], seat).map(v => (v-7)*STEP);
    add(group, new RoundedBoxGeometry(2.06,.045,2.06,2,.1), color,x,.12,z);
    add(group, new RoundedBoxGeometry(1.63,.025,1.63,2,.12), cream,x,.15,z);
    for (let piece = 0; piece < 4; piece++) {
      const [px,pz] = boardPoint(seat,-1,piece);
      add(group,new THREE.CylinderGeometry(.23,.23,.02,32),color,px,.175,pz);
      add(group,new THREE.CylinderGeometry(.175,.175,.025,32),cream,px,.19,pz);
    }
    for (let progress = 51; progress <= 55; progress++) {
      const [px,pz] = boardPoint(seat,progress);
      add(group,new THREE.BoxGeometry(.33,.035,.33),color,px,.14,pz);
    }
    const shape = new THREE.Shape(); shape.moveTo(-.52,.52); shape.lineTo(.52,.52); shape.lineTo(0,0); shape.closePath();
    const triangle = add(group,new THREE.ShapeGeometry(shape),color,0,.16,0);
    triangle.rotation.set(-Math.PI/2,0,Math.PI-seat*Math.PI/2);
  }
  RING.forEach(([x,z],index) => {
    const start = index % 13 === 0, mat = start ? material(COLORS[Math.floor(index/13)]) : cream;
    const px = (x-7)*STEP, pz = (z-7)*STEP;
    add(group,new THREE.BoxGeometry(.34,.035,.34),ink,px,.12,pz);
    add(group,new THREE.BoxGeometry(.315,.038,.315),mat,px,.128,pz);
    if (SAFE.includes(index)) {
      // A double contrasting frame stays visible around occupied safe cells.
      const frame = new THREE.Group(); frame.name = `safe-cell-${index}`;
      frame.position.set(px, .154, pz); group.add(frame);
      for (const [extent, thickness, mat] of [[.16, .02, ink], [.14, .014, cream]]) {
        for (const side of [-1, 1]) {
          add(frame,new THREE.BoxGeometry(extent*2,.008,thickness),mat,0,0,side*extent);
          add(frame,new THREE.BoxGeometry(thickness,.008,extent*2),mat,side*extent,0,0);
        }
      }
      const ring = add(group,new THREE.TorusGeometry(.09,.018,6,24),start ? cream : ink,px,.16,pz); ring.rotation.x = -Math.PI/2;
    }
  });
  finishBoard(group);
  return finish(group);
}
export function createLudoPawn({ seat = 0, number = 1 } = {}) {
  const group = new THREE.Group(); group.name = `Ficha ${number}`;
  const color = material(COLORS[seat]), cream = material('#fff6e2');
  add(group,new THREE.CylinderGeometry(.13,.155,.07,24),cream,0,.035);
  add(group,new THREE.CylinderGeometry(.085,.125,.19,24),color,0,.15);
  add(group,new THREE.SphereGeometry(.115,20,12),color,0,.3);
  const c = document.createElement('canvas'); c.width=c.height=64; const ctx=c.getContext('2d');
  ctx.fillStyle='#fff6e2'; ctx.beginPath();ctx.arc(32,32,29,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#302435';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 42px Nunito';ctx.fillText(String(number),32,34);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
  const badge=add(group,new THREE.CircleGeometry(.085,24),new THREE.MeshBasicMaterial({map:texture,transparent:true}),0,.421);badge.rotation.x=-Math.PI/2;
  const halo=add(group,new THREE.TorusGeometry(.19,.025,8,32),material('#ffc629'),0,.018);halo.rotation.x=-Math.PI/2;halo.visible=false;
  group.userData.halo=halo; finishPawn(group,seat*4+number); return finish(group);
}
function dieTexture(value) {
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#fff6e2';ctx.fillRect(0,0,128,128);ctx.fillStyle='#302435';
  const points = {1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
  for(const [x,y] of points[value]){ctx.beginPath();ctx.arc(64+x*31,64+y*31,10,0,Math.PI*2);ctx.fill();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
export function createLudoDie() {
  const group=new THREE.Group();group.name='Dado de Ludo';
  add(group,new RoundedBoxGeometry(.43,.43,.43,3,.045),[3,4,1,6,2,5].map(v=>new THREE.MeshPhysicalMaterial({map:dieTexture(v),roughness:.35,clearcoat:1,clearcoatRoughness:.2})),0,.215);
  return finish(group);
}
