import * as THREE from 'three';
import { M, mesh, rng } from '/engine/models/core/primitives.js';
import { TAU, finish, leaf } from '/engine/models/vegetation/plant-kit.js';

function cactusColumn(points,radius,material) {
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
  const geo=new THREE.TubeGeometry(curve,20,1,20,false),p=geo.attributes.position,colors=[];
  const dark=new THREE.Color(0x3c7b61),light=new THREE.Color(0x82ab74);
  for(let i=0;i<=20;i++) {
    const t=i/20,center=curve.getPointAt(t),cap=t<0.85?1:Math.sqrt(Math.max(0.002,1-((t-0.85)/0.15)**2));
    for(let j=0;j<=20;j++) {
      const k=i*21+j,a=j*TAU/20,rib=0.88+0.12*Math.cos(a*10),rr=radius*rib*cap;
      p.setXYZ(k,center.x+(p.getX(k)-center.x)*rr,center.y+(p.getY(k)-center.y)*rr,center.z+(p.getZ(k)-center.z)*rr);
      const c=dark.clone().lerp(light,0.4+0.38*Math.cos(a*10));colors.push(c.r,c.g,c.b);
    }
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();return mesh(geo,material);
}

export function cactus({seed=1}={}) {
  const r=rng(seed),g=new THREE.Group(),h=3.5+r()*0.7,mat=M(0xffffff,{vertexColors:true,roughness:1,flatShading:false});
  g.add(cactusColumn([[0,0,0],[0.03,h*0.6,0],[0.08,h,0]],0.34,mat));
  for(const side of [-1,1]) {
    const y=1.3+(side===1?0.35:0),x=side*(0.85+r()*0.2),top=y+0.95+r()*0.5;
    g.add(cactusColumn([[0,y,0],[x*0.75,y+0.1,0],[x,y+0.45,0],[x,top,0]],0.23,mat));
  }
  const cream=M(0xd6cda4,{roughness:1});
  for(let row=0;row<12;row++)for(let j=0;j<5;j++) {
    const a=j*TAU/5+row%2*0.3,x=Math.cos(a)*0.335,z=Math.sin(a)*0.335,y=0.25+row*0.24;
    const dot=mesh(new THREE.SphereGeometry(0.028,5,3),cream,x,y,z);g.add(dot);
  }
  const flower=new THREE.Group();flower.position.set(0.08,h,0);flower.rotation.x=0.3;
  for(let j=0;j<6;j++)leaf(flower,0.25,0.11,[0,0,0],[0,j*TAU/6,0.6],0xef947c,0.06,5);
  flower.add(mesh(new THREE.SphereGeometry(0.07,7,5),M(0xf3cc61,{roughness:1}),0,0.08,0));g.add(flower);
  return finish(g,'cactus');
}
