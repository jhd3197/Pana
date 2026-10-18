// These helpers compose game-local route/bed data. They do not own whole worlds.
import { THREE, M, mesh, placeOnTrack } from './world-kit.js';
import { waterSurface } from '/engine/models/effects/water-surface.js';

export function waterGrid(T,world,{bounds,step=5,sample,color=0x459c97,name='river-water'}) {
  const [x0,z0,x1,z1]=bounds,nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step);
  const positions=[],depths=[],flow=[],indices=[];
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=x0+(x1-x0)*i/nx,z=z0+(z1-z0)*j/nz,q=sample(x,z);
    const deck=Math.abs(T.offsetOf(x,z))<T.HW+1 ? T.surfaceAt(x,z)+.13 : -Infinity;
    positions.push(x,q.height,z);
    depths.push(q.visible===false?-1:q.height-Math.max(world.groundAt(x,z),deck));
    flow.push(q.cross??x,q.along??z);
    if(i<nx&&j<nz){const a=j*(nx+1)+i;indices.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geometry.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const water=waterSurface(geometry,{kind:'river',color,amplitude:.015});water.name=name;
  // Shader discards dry bed/deck fragments; ray proofs must inspect their depths.
  water.raycast=()=>{};return water;
}

// Gaussian "halls" on a constant size: hallProfile(28,[{u:.3,add:14,spread:.02}])
// returns u => 28 + 14·exp(-((u-.3)/.02)²/2) + …, for hollowGallery's
// widthAt/heightAt and for anything placed against the same walls.
export function hallProfile(base,halls=[]) {
  return u=>halls.reduce((sum,{u:at,add,spread=.02})=>{const d=(u-at)/spread;return sum+add*Math.exp(-d*d/2);},base);
}

// A shell around the road from u=from to u=to. widthAt(u)/heightAt(u) open it
// into halls; without them it keeps the constant width and height.
export function hollowGallery(T,{from,to,skylights=[],openSide=0,width=28,height=29,widthAt=null,heightAt=null,color=0x777e70,name='river-cave'}) {
  const group=new THREE.Group();group.name=name;
  const W=widthAt||(()=>width),H=heightAt||(()=>height);
  const profile=(w,h)=>[[-w,-5],[-w,12],[-w*.78,h*.8],[0,h],[w*.78,h*.8],[w,12],[w,-5]],walls=profile(width,height);
  const positions=[],colors=[],indices=[],n=Math.ceil((to-from)*T.TOTAL/3),c=new THREE.Color(color);
  for(let i=0;i<=n;i++){
    const u=from+(to-from)*i/n,p=placeOnTrack(T,u*T.TOTAL);
    profile(W(u),H(u)).forEach(([off,y],j)=>{
      const noise=j===0||j===6?0:Math.sin(i*.71+j*2.1)*1.3;
      const x=p.x+Math.cos(p.h)*off,z=p.z-Math.sin(p.h)*off;
      positions.push(x,p.y+y+noise,z);
      const tint=c.clone().offsetHSL(.015*Math.sin(i*.2),0,.055*Math.sin(i*.45+j));colors.push(tint.r,tint.g,tint.b);
      const open=skylights.some(([a,b])=>u>=a&&u<=b);
      if(i<n&&j<walls.length-1&&!(open&&j>=1&&j<=4)&&!(openSide===-1&&j<=1)&&!(openSide===1&&j>=4)){
        const a=i*walls.length+j,b=a+walls.length;indices.push(a,b,a+1,a+1,b,b+1);
      }
    });
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  group.add(mesh(geometry,M(0xffffff,{vertexColors:true,roughness:.94,side:THREE.DoubleSide})));
  group.userData.corridor={from,to,width,height,widthAt:W,heightAt:H,skylights};return group;
}
