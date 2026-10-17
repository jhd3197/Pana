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

export function portBollard() {
  const g = new THREE.Group(), steel = M(0x344b50), yellow = M(0xe4b64b);
  g.add(box(1.3, .16, 1.3, steel, 0, .08, 0), mesh(new THREE.CylinderGeometry(.35, .48, .85, 10), yellow, 0, .58, 0), box(1.2, .25, .65, steel, 0, 1.1, 0));
  return paintFinish(g, 'port-bollard');
}
