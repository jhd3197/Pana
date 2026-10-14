// A stadium street circuit: grandstand straight, workshops and park bends.

import { marketStall, bench } from '/engine/plaza-props.js';
import * as THREE from 'three';
import { M, box } from '../car-kit.js';
import { house } from '/engine/plaza.js';

export default {
  id: 'estadio',
  name: 'El Estadio',
  blurb: "Tribunas, talleres y curvas del parque: el gran circuito del estadio.",
  points: [[-85,55],[-15,55],[65,55],[125,90],[190,65],[205,5],[170,-40],[95,-30],[45,-75],[75,-145],[30,-205],[-50,-205],[-120,-160],[-120,-85],[-175,-30],[-150,35]],
  rounded: true,
  sectors: [[0,"Recta de tribunas"],[0.25,"Patio de talleres"],[0.5,"Curvas del estadio"],[0.75,"Parque de los panas"]],
  hw: 9,
  lineU: 0.04,
  ramps: [
    { u: 0.2, len: 9, h: 1.7, hw: 4.2 },
    { u: 0.65, len: 9, h: 2.2, hw: 4.2 },
  ],
  items: {
    boxes: [0.12, 0.31, 0.51, 0.72, 0.91],
    boxLanes: [-6, -2, 2, 6],
    pads: [
      { u: 0.37178, off: -4 },
      { u: 0.56989, off: 0 },
      { u: 0.87111, off: 4 },
    ],
  },
  walls: true,
  fence: false,
  chevrons: true,
  palette: {
    horizon: 0xffd6a0,
    skyTop: 0x6fb7e8,
    hemiSky: 0xfff1d6,
    hemiGround: 0xc08a5a,
    hemiInt: 1.6,
    sun: 0xffd9a0,
    sunInt: 2.4,
    ground: 0xe8b57a,
    track: 0x9c5b33,
    dune: 1,
    fog: [100, 420],
  },
  scenery(group, kit, T) {
    kit.routeLandscape(group,T,{seed:137,color:0x91a66a,tree:'mango',height:18});
    for(const u of [0.015,0.05,0.085]) {
      const stand=new THREE.Group();
      for(let row=0;row<5;row++) {
        stand.add(box(28,0.8+row*0.9,2,M(0x8e9291),0,(0.8+row*0.9)/2,-row*2));
        stand.add(box(27,0.3,1.6,M(row%2?0xf6c84a:0xd24e45),0,1.1+row*0.9,-row*2));
      }
      stand.add(box(31,0.3,12,M(0xe8d6ae),0,8,-4));
      for(const x of [-14,14]) stand.add(box(0.4,8,0.4,M(0x454f50),x,4,-8));
      const p=kit.placeOnTrack(T,u*T.TOTAL,T.HW+8);
      kit.at(group,kit.bake(stand),p,p.h+Math.PI/2);
    }
    for(let i=0;i<7;i++) {
      const p=kit.placeOnTrack(T,T.TOTAL*(0.25+i*0.018),-(T.HW+12));
      const shop=house({w:8,h:5,color:i%2?0x78a9a3:0xe8b65d,seed:i,label:'TALLER PANA'});
      shop.scale.setScalar(1.5); kit.at(group,kit.bake(shop),p,p.h-Math.PI/2);
    }
    kit.at(group, marketStall({ seed: 4 }), { x: -15, z: 0 }, Math.PI / 2);
    kit.at(group, bench(), { x: -10, z: 3 });
    for (const [i, x] of [-34, -22, 22, 34].entries()) {
      kit.at(group, kit.mangoTree({ seed: i + 1, h: 3.8 }), { x, z: -5 });
    }
    for (const p of kit.scatter(T, { seed: 31, count: 28, min: T.HW + 8, max: T.HW + 22, sides: [1] })) {
      kit.at(group, kit.palm({ seed: Math.floor(p.s), h: 7 + p.k * 2 }), p, p.rot);
    }
  },
};
