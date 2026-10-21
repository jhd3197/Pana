import * as THREE from 'three';
import { TRACK_DEFINITIONS } from '../track-definitions.js';

// Mountain and lake circuits adapted from the same reference scenes pass
// their own scale, light and grip; the Aragua coast keeps these defaults.
export function coastalTrack(id, layout, createWorld, options = {}) {
  const { RP, roadY, bank, NR } = layout;
  const scale = options.scale ?? (id === 'cata' ? 1.6 : id === 'choroni' ? 1.3 : 1);
  const distances = [0];
  for(let i=1;i<=NR;i++) distances.push(distances[i-1]+Math.hypot(RP[i%NR].x-RP[i-1].x,RP[i%NR].z-RP[i-1].z));
  function banking(s,T) {
    const d=((s/T.TOTAL)%1+1)%1*distances[NR];
    let lo=0,hi=NR;
    while(hi-lo>1){const mid=(lo+hi)>>1;if(distances[mid]>d)hi=mid;else lo=mid;}
    const t=(d-distances[lo])/(distances[hi]-distances[lo]||1);
    return bank[lo]*(1-t)+bank[hi%NR]*t;
  }
  const points = RP.filter((_, i) => i % 4 === 0).map((p, j) => [p.x * scale, p.z * scale, roadY[j * 4]]);
  return {
    ...TRACK_DEFINITIONS.find(t => t.id === id),
    points, hw: 8 * scale, lineU: .015,
    authoredRoad: true, walls: false, chevrons: false,
    previewBounds: [[-350*scale, 0, -350*scale], [350*scale, 190, 300*scale]],
    crossfall(s, off, T) { return banking(s,T) * off / scale + .12; },
    gripAt: options.gripAt ?? (id === 'chuao' ? (x,z) => {
      const near=layout.sampleR(layout.RR,x,z);
      return near.i>=0 && layout.wet(near.i) ? .82 : 1;
    } : undefined),
    palette: options.palette ?? { skySeed: 31, cloudCover: .35, horizon: 0xd7e8df, skyTop: 0x249ee8,
      hemiSky: 0xd2e6ff, hemiGround: 0x639450, hemiInt: 1.6, sun: 0xffddb0,
      sunInt: 2.4, ground: 0x549631, track: 0x827d72, dune: 0, fog: [460, 2600] },
    ...(options.previewBounds && { previewBounds: options.previewBounds }),
    items: options.items ?? { boxes: [.1,.27,.43,.6,.77,.91], boxLanes: [-3,0,3], pads: [{u:.2,off:0},{u:.5,off:0},{u:.85,off:0}] },
    environment(T) {
      const world = createWorld(new THREE.Group(), layout, (x,z)=>T.roadDistance(x*scale,z*scale));
      world.group.scale.set(scale,1,scale);
      // Sea depth is sampled in world coordinates, unlike the road textures.
      world.group.traverse(o=>{if(o.material?.uniforms?.uBox)o.material.uniforms.uBox.value.multiplyScalar(scale);});
      return {...world, groundAt: (x,z) => world.groundAt(x/scale,z/scale)};
    },
  };
}
