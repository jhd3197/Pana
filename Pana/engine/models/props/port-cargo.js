// Native port equipment. Metres, +Y up, doors/front +Z, ground origin.
import * as THREE from 'three';
import { M, box, mesh, tube, canvasMat } from '../core/primitives.js';
import { paintFinish } from '../core/architecture-kit.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function shippingContainer({color=0xc95339,length=12.2,markings=true}={}){
  const g=new THREE.Group(),paint=M(color,{roughness:.68,metalness:.25}),frame=M(new THREE.Color(color).multiplyScalar(.72).getHex(),{roughness:.6,metalness:.35}),metal=M(0xa6aca9,{metalness:.6,roughness:.45});
  // Pressed corrugated steel: beveled crests and recessed valleys, with no
  // hidden rib-box faces. End frames and locking gear stay three dimensional.
  const positions=[],quad=(a,b,c,d)=>positions.push(...a,...b,...c,...a,...c,...d);
  for(const side of [-1,1]){
    const points=[];for(let z=-length/2+.13;z<length/2-.13;z+=.28)for(const [dz,r]of[[0,0],[.06,.06],[.17,.06],[.23,0]])points.push([side*(1.2+r),Math.min(length/2-.13,z+dz)]);
    for(let i=1;i<points.length;i++){const [x,z]=points[i-1],[x2,z2]=points[i];const corners=[[x,.13,z],[x,2.51,z],[x2,2.51,z2],[x2,.13,z2]];if(side<0)corners.reverse();quad(...corners);}
    for(const y of [.1,2.55])g.add(box(.13,.15,length+.08,frame,side*1.2,y,0));
  }
  for(let x=-1.18;x<1.18;x+=.23){const a=Math.min(x+.07,1.18),b=Math.min(x+.15,1.18),c=Math.min(x+.23,1.18);
    for(const [x0,y0,x1,y1]of[[x,2.5,a,2.56],[a,2.56,b,2.56],[b,2.56,c,2.5]])quad([x0,y0,-length/2],[x0,y0,length/2],[x1,y1,length/2],[x1,y1,-length/2]);
  }
  const shell=new THREE.BufferGeometry();shell.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shell.computeVertexNormals();g.add(mesh(shell,paint));
  for(const z of [-length/2,length/2]){
    g.add(box(2.35,2.4,.09,paint,0,1.3,z));
    for(const x of [-1.18,1.18])g.add(box(.18,2.6,.18,frame,x,1.3,z));
    if(z<0){for(let x=-.9;x<=.9;x+=.3)g.add(box(.08,2.3,.045,frame,x,1.3,z-.07));}
    else for(const x of [-.58,.58]){
      g.add(box(1.08,2.25,.08,paint,x,1.3,z+Math.sign(z)*.065));
      for(const dx of [-.32,.32]){
        const front=z+Math.sign(z)*.17;g.add(box(.06,2.12,.06,metal,x+dx,1.3,front),box(.3,.065,.09,metal,x+dx+.1,1,front));
        for(const y of [.35,1.35,2.3])g.add(box(.15,.09,.08,frame,x+dx,y,front));
      }
    }
    for(const x of [-1.13,1.13])for(const y of [.11,2.51])g.add(box(.2,.18,.2,metal,x,y,z));
  }
  if(markings){
  const marking=canvasMat(512,128,ctx=>{
    ctx.clearRect(0,0,512,128);ctx.fillStyle='#eee7d6';ctx.font='800 48px sans-serif';ctx.fillText('GUAIRA',8,54);
    ctx.font='700 22px monospace';ctx.fillText('TRANSPORTE MARÍTIMO',10,86);ctx.font='17px monospace';ctx.fillText('PANA 220106  45G1',10,115);
  });marking.transparent=true;marking.depthWrite=false;
  const labels=[];
  for(const side of [-1,1]){const geo=new THREE.PlaneGeometry(Math.min(4.2,length*.65),1.05);geo.rotateY(side*Math.PI/2);geo.translate(side*1.275,1.55,0);labels.push(geo);}
  g.add(mesh(mergeGeometries(labels,false),marking));labels.forEach(geo=>geo.dispose());
  }
  const out=paintFinish(g,'shipping-container');out.userData.dimensions=[2.55,2.65,length+.3];return out;
}

export function transitWarehouse() {
  const g = new THREE.Group(), wall = M(0xe9dcc0), blue = M(0x548a98), trim = M(0xf7ebd1), roof = M(0xaa6954), dark = M(0x334e56);
  g.add(box(18, .7, 36, M(0x979d94), 0, .35, 0), box(17, 7, 34, wall, 0, 4.2, 0));
  for (const side of [-1, 1]) {
    const slope = box(9.6, .22, 36, roof, side * 4.5, 8.7, 0); slope.rotation.z = -side * .23; g.add(slope);
    for (let z = -16; z <= 16; z += 5.3) {
      g.add(box(.18, 4.9, 3.8, blue, side * 8.6, 3.1, z));
      for (let y = 1; y < 5.5; y += .35) g.add(box(.23, .055, 3.8, trim, side * 8.65, y, z));
      g.add(box(.5, 7.2, .5, trim, side * 8.6, 4.1, z - 2.4));
      g.add(box(.2, .9, 3, dark, side * 8.65, 6.7, z));
    }
  }
  for (const z of [-17.1, 17.1]) { g.add(box(6, 4.6, .18, blue, 0, 3.05, z)); g.add(box(10, .7, .2, trim, 0, 6.6, z)); }
  for (let z = -13; z <= 13; z += 6.5) g.add(box(1.5, .5, 2, trim, 0, 10, z));
  return paintFinish(g, 'transit-warehouse');
}

// Open steel shed: red columns, a corrugated gable roof and a grated mezzanine
// over the north half (-Z). Columns stand at x = ±w/2, ±w/6 on z = ±d/2, and the
// mezzanine's two posts at x = ±w/6 just inside its south edge, so a map can
// fit its collision to them. Ground origin.
export function steelShed({ w = 18, d = 14, roof = 9.5, deck = 5.18, mezzanine = [-7, -.6] } = {}) {
  const g = new THREE.Group(), red = M(0xe8402a, { metalness: .3, roughness: .5 }), yellow = M(0xf2c12e, { metalness: .3, roughness: .5 });
  const sheet = M(0xe8e4dc, { metalness: .25, roughness: .55, side: THREE.DoubleSide }), grate = M(0x5a6068, { metalness: .4, roughness: .7 }), dark = M(0x2a2e34);
  const xs = [-w / 2, -w / 6, w / 6, w / 2];
  for (const x of xs) {
    for (const z of [-d / 2, d / 2]) g.add(box(.45, roof, .45, red, x, roof / 2, z));
    // A truss across the bay at every column line.
    g.add(box(.3, .4, d + .4, red, x, roof, 0));
    for (const s of [-1, 1]) g.add(tube([x, roof, s * d / 2], [x, roof + 1.6, 0], .1, red));
  }
  for (const z of [-d / 2, d / 2]) g.add(box(w + .4, .4, .3, red, 0, roof, z));
  g.add(box(w + .6, .3, .3, red, 0, roof + 1.6, 0));
  // Corrugated roof: ribs pressed into both slopes.
  const slope = Math.atan2(1.6, d / 2), run = Math.hypot(d / 2, 1.6) + 1.1;
  for (const s of [-1, 1]) {
    const pitch = new THREE.Group(); pitch.position.set(0, roof + .85, s * (run / 2 - .3)); pitch.rotation.x = s * slope; g.add(pitch);
    pitch.add(box(w + 2, .08, run, sheet, 0, 0, 0));
    for (let x = -w / 2 - .8; x <= w / 2 + .8; x += .5) pitch.add(box(.12, .06, run, sheet, x, .06, 0));
  }
  // Mezzanine deck, its edge beam, railing and the two posts under it.
  const [z0, z1] = mezzanine, depth = z1 - z0, mid = (z0 + z1) / 2;
  g.add(box(w, .12, depth, grate, 0, deck - .06, mid), box(w, .3, .2, red, 0, deck - .27, z1 - .1));
  for (let x = -w / 2 + .4; x < w / 2; x += .45) g.add(box(.05, .05, depth - .1, dark, x, deck + .01, mid));
  for (const x of [-w / 6, w / 6]) g.add(box(.3, deck - .3, .3, red, x, (deck - .3) / 2, z1 - .2));
  g.add(box(w, .08, .08, yellow, 0, deck + 1.05, z1), box(w, .06, .06, yellow, 0, deck + .55, z1));
  for (let x = -w / 2; x <= w / 2 + .01; x += w / 9) g.add(box(.07, 1.05, .07, yellow, x, deck + .52, z1));
  for (const x of [-w / 2, w / 2]) g.add(box(.08, .08, depth, yellow, x, deck + 1.05, mid));
  return paintFinish(g, 'steel-shed');
}

// Steel oil drum with two rolled hoops and a bung on the lid. Ground origin.
export function oilDrum({ color = 0x2f7cf0 } = {}) {
  const g = new THREE.Group(), paint = M(color, { metalness: .35, roughness: .45 }), rim = M(new THREE.Color(color).multiplyScalar(.7).getHex(), { metalness: .4, roughness: .4 });
  g.add(mesh(new THREE.CylinderGeometry(.29, .29, .88, 16), paint, 0, .44, 0));
  for (const y of [.03, .3, .58, .87]) g.add(mesh(new THREE.TorusGeometry(.29, .022, 6, 16), rim, 0, y, 0).rotateX(Math.PI / 2));
  g.add(mesh(new THREE.CylinderGeometry(.04, .04, .03, 8), rim, .15, .89, .05));
  return paintFinish(g, 'oil-drum');
}

export function portBollard() {
  const g = new THREE.Group(), steel = M(0x344b50), yellow = M(0xe4b64b);
  g.add(box(1.3, .16, 1.3, steel, 0, .08, 0), mesh(new THREE.CylinderGeometry(.35, .48, .85, 10), yellow, 0, .58, 0), box(1.2, .25, .65, steel, 0, 1.1, 0));
  return paintFinish(g, 'port-bollard');
}
