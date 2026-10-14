// The familiar courtyard is one neighborhood in a much larger pueblo.
import * as THREE from 'three';
import { createPlazaEnvironment, house } from '/engine/plaza.js';
import { marketStall, streetLamp, bench } from '/engine/plaza-props.js';
import { M, box } from '../car-kit.js';

const SCALE = 2;
const COLORS = [0xe7b45e, 0x68a8a0, 0xe48b70, 0xb2bd7d, 0xeccf91, 0x6c94b2];
export default {
  id: 'plaza', name: 'Plaza Pana',
  blurb: 'Del casco histórico al mercado, el barrio de colores y el paseo de los mangos.',
  points: [[-110,38],[-50,22],[5,24],[55,22],[115,35],[155,85],[145,150],
    [210,190],[285,170],[315,105],[280,45],[225,20],[210,-40],[250,-100],
    [220,-170],[150,-195],[85,-160],[90,-90],[45,-80],[-35,-90],[-115,-75],[-150,-20]],
  rounded: true,
  hw: 9, lineU: 0.07,
  sectors: [[0, 'Casco histórico'], [0.19, 'Mercado de los panas'], [0.4, 'Paseo de los mangos'],
    [0.57, 'Barrio de colores'], [0.77, 'La alameda']],
  items: { boxes: [0.12,0.31,0.52,0.73,0.91], boxLanes: [-6,-2,2,6],
    pads: [{ u: 0.23, off: -4 }, { u: 0.46, off: 4 }, { u: 0.68, off: 0 }, { u: 0.87, off: -4 }] },
  walls: true,
  palette: { horizon: 0xc2dece, skyTop: 0x8bcde9, hemiSky: 0xe6f6ff,
    hemiGround: 0xc98d62, hemiInt: 2, sun: 0xffe1ab, sunInt: 3.2,
    ground: 0xc6b388, track: 0xb99468, dune: 0, fog: [110, 430] },
  environment(T) {
    const group = new THREE.Group();
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800,1800), M(0xc6b388));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.18; ground.receiveShadow = true; group.add(ground);
    const plaza = createPlazaEnvironment({ town: true,
      clearance: (x,z,r) => Math.abs(T.offsetOf(x*SCALE,z*SCALE)) > T.HW + r*SCALE + 2 });
    plaza.group.scale.setScalar(SCALE); group.add(plaza.group);
    return { group, groundAt: () => 0, update: plaza.update };
  },
  scenery(group, kit, T) {
    const town = new THREE.Group();
    // Shared colonial houses, batched after placement for the expanded town.
    const homes = COLORS.map((color,i) => house({ w: 7.4, h: 6 + i%3, color, seed: i,
      label: ['PANADERÍA','LOS PANAS','CAFÉ COCO','BODEGA','HECHO AQUÍ','HELADOS'][i] }));
    let n = 0;
    const occupied = [];
    for (let s = 110; s < T.TOTAL; s += 20) for (const side of [-1,1]) {
      const p = kit.placeOnTrack(T,s,side*(T.HW+11));
      if (Math.abs(p.x)<76 && p.z>-65 && p.z<60) continue;
      if (Math.abs(T.offsetOf(p.x,p.z))<T.HW+9) continue;
      if (occupied.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<15)) continue;
      occupied.push(p);
      const h = homes[n%homes.length].clone(true); h.scale.set(1.7,1.5+(n%3)*0.2,1.7);
      kit.at(town,h,p,p.h+side*Math.PI/2);
      const paving = box(15,0.22,9,M(0xe0c699),0,0,0);
      kit.at(town,paving,{...p,y:0},p.h);
      if (n%3===0) kit.at(town,streetLamp(),kit.placeOnTrack(T,s,side*(T.HW+3)));
      n++;
    }
    for (let i=0;i<12;i++) {
      const p=kit.placeOnTrack(T,T.TOTAL*(0.2+i*0.009),-(T.HW+5));
      kit.at(town,marketStall({seed:i+8}),p,p.h-Math.PI/2);
    }
    for (const p of kit.scatter(T,{seed:53,count:110,min:T.HW+22,max:T.HW+70,
      avoid:[{x:0,z:0,r:90}]})) {
      if (occupied.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<12)) continue;
      kit.at(town,p.k>0.45?kit.mangoTree({h:7+p.k*4,seed:Math.floor(p.s)}):kit.palm({h:10+p.k*4,seed:Math.floor(p.s)}),p,p.rot);
      if (p.k>0.8) kit.at(town,bench(),{x:p.x+4,y:0,z:p.z});
    }
    group.add(kit.bake(town, { cellSize: 100 }));
    kit.at(group,kit.distantMountains({r:650,count:16,color:0x709c85,seed:32,hMin:70,hMax:140}),{x:70,y:-5,z:0});
  },
};
