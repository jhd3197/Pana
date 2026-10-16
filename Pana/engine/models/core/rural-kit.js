// Construction details shared by the ranch and desert collections.
import * as THREE from 'three';
import { M, mesh, box, tube } from '/engine/models/core/primitives.js';

export const rural = {
  wood: M(0x90704b,{roughness:1}), darkWood:M(0x594634,{roughness:1}),
  steel:M(0x879996,{metalness:.55,roughness:.65}), rust:M(0x925137,{roughness:1}),
  rubber:M(0x323735,{roughness:1}), straw:M(0xc9aa55,{roughness:1}),
};
export function dimension(value,min,max,label) {
  if(!Number.isFinite(value)||value<min||value>max)throw new RangeError(`${label} must be ${min}–${max}`);
  return value;
}
export function ring(radius,thickness,material,x=0,y=0,z=0) {
  return mesh(new THREE.TorusGeometry(radius,thickness,6,28),material,x,y,z);
}
export function cylinder(rt,rb,h,mat,x=0,y=0,z=0,n=16) {
  return mesh(new THREE.CylinderGeometry(rt,rb,h,n),mat,x,y,z);
}
// Wheels face ±X; the outer tread radius is exactly radius.
export function wheel(radius,width,{hub=0x879996,tread=true}={}) {
  const g=new THREE.Group(),tire=ring(radius*.75,radius*.25,rural.rubber);tire.rotation.y=Math.PI/2;tire.scale.z=width/(radius*.5);g.add(tire);
  const axle=cylinder(radius*.49,radius*.49,width*.85,M(hub,{metalness:.35,roughness:.75}));axle.rotation.z=Math.PI/2;g.add(axle);
  for(const side of [-1,1]) {
    const cap=cylinder(radius*.18,radius*.18,.08,rural.steel,side*width*.48);cap.rotation.z=Math.PI/2;g.add(cap);
    for(let j=0;j<6;j++){const a=j*Math.PI/3;const nut=cylinder(.035,.035,.06,rural.darkWood,side*width*.46,Math.cos(a)*radius*.32,Math.sin(a)*radius*.32,6);nut.rotation.z=Math.PI/2;g.add(nut);}
  }
  if(tread)for(let j=0;j<20;j++) {
    const a=j*Math.PI/10,t=box(width*.95,radius*.055,radius*.15,rural.rubber,0,Math.cos(a)*radius*.96,Math.sin(a)*radius*.96);t.rotation.x=a;g.add(t);
  }
  return g;
}
// Ridge runs along Z; open gables, suitable for barns and pump shelters.
export function corrugatedRoof(g,{w,d,y,rise=.8,color=0x7c9692}) {
  const mat=M(color,{metalness:.4,roughness:.8}),slope=Math.atan2(rise,w/2),run=Math.hypot(w/2,rise);
  for(const side of [-1,1]) {
    const panel=box(run,.065,d,mat,side*w/4,y+rise/2,0);panel.rotation.z=-side*slope;g.add(panel);
    for(let z=-d/2+.1;z<d/2;z+=.23)g.add(tube([0,y+rise+.035,z],[side*w/2,y+.035,z],.025,mat));
    for(let i=0;i<5;i++){const patch=box(run*(.12+i%2*.1),.015,.13,rural.rust,side*w*(.12+i*.065),y+rise*(.76-i*.13)+.05,-d*.35+i*d*.17);patch.rotation.z=-side*slope;g.add(patch);}
  }
  const cap=box(.16,.1,d+.04,rural.steel,0,y+rise+.06,0);g.add(cap);
}
export function ladder(g,x,y,z,height,{width=.55}={}) {
  for(const side of [-1,1])g.add(tube([x+side*width/2,y,z],[x+side*width/2,y+height,z],.038,rural.steel));
  for(let h=.2;h<height;h+=.3)g.add(tube([x-width/2,y+h,z],[x+width/2,y+h,z],.032,rural.steel));
}
export function plank(g,w,h,d,x,y,z,{mat=rural.wood,grain=true}={}) {
  g.add(box(w,h,d,mat,x,y,z));
  if(grain)for(let j=0;j<2;j++)g.add(box(w*.58,.012,.006,rural.darkWood,x+(j-.5)*w*.13,y+(j-.5)*h*.3,z+d/2+.004));
}
