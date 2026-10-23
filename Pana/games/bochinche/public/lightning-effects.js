import * as THREE from 'three';
import { rng } from '/engine/random.js';

// Soft ribbons replace solid polygonal rods. All geometry and textures are reused.
export function createLightningEffects(scene) {
  const root=new THREE.Group();scene.add(root);
  const capacity=240, positions=new Float32Array(capacity*18), uvs=new Float32Array(capacity*12);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uvs,2).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{opacity:{value:1}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv;uniform float opacity;
      void main(){
        float x=abs(vUv.x);
        float core=exp(-x*x*230.0);
        float corona=exp(-x*x*32.0);
        float halo=exp(-x*x*5.0)*(1.0-smoothstep(.5,1.0,x));
        float alpha=(core*.98+corona*.45+halo*.16)*opacity;
        vec3 blue=vec3(.10,.35,1.0);
        vec3 color=mix(blue,vec3(.78,.94,1.0),corona);
        color=mix(color,vec3(1.0),core);
        gl_FragColor=vec4(color,min(alpha,1.0));
      }`,
  });
  const bolt=new THREE.Mesh(geometry,material);bolt.frustumCulled=false;bolt.renderOrder=5;root.add(bolt);
  // Painted light texture, not an opaque sphere: no hard bubble at contact.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'), gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,255,255,1)');
  gradient.addColorStop(.08,'rgba(245,254,255,1)');
  gradient.addColorStop(.22,'rgba(143,222,255,.7)');
  gradient.addColorStop(.5,'rgba(55,122,255,.18)');
  gradient.addColorStop(1,'rgba(25,65,255,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=()=>{
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false}));
    s.renderOrder=6;s.visible=false;root.add(s);return s;
  };
  const flash=sprite(),chargeLight=sprite();
  let segments=0;
  const point=(p,hand=false)=>new THREE.Vector3(p.x*.014+(hand?.48:0),p.y*.014+(hand?.26:0),.72);
  function segment(a,b,wa,wb) {
    if(segments>=capacity)return;
    const tangent=b.clone().sub(a),normal=new THREE.Vector3(-tangent.y,tangent.x,0).normalize();
    const a0=a.clone().addScaledVector(normal,-wa),a1=a.clone().addScaledVector(normal,wa);
    const b0=b.clone().addScaledVector(normal,-wb),b1=b.clone().addScaledVector(normal,wb);
    const i=segments++;
    positions.set([...a0.toArray(),...a1.toArray(),...b0.toArray(),...b0.toArray(),...a1.toArray(),...b1.toArray()],i*18);
    uvs.set([-1,0,1,0,-1,1,-1,1,1,0,1,1],i*12);
  }
  // Midpoint subdivision produces connected, correlated bends at several scales.
  // Independent offsets per vertex were the source of the scribbled zigzag.
  function path(a,b,random,displacement,levels=5) {
    let points=[a,b];
    for(let level=0;level<levels;level++) {
      const next=[points[0]];
      for(let i=1;i<points.length;i++) {
        const prev=points[i-1],end=points[i],d=end.clone().sub(prev);
        const normal=new THREE.Vector3(-d.y,d.x,0).normalize();
        const mid=prev.clone().lerp(end,.5).addScaledVector(normal,(random()-.5)*displacement);
        next.push(mid,end);
      }
      points=next;displacement*=.48;
    }
    return points;
  }
  function ribbon(points,width,endWidth) {
    for(let i=1;i<points.length;i++) {
      const start=(i-1)/(points.length-1),end=i/(points.length-1);
      segment(points[i-1],points[i],THREE.MathUtils.lerp(width,endWidth,start),THREE.MathUtils.lerp(width,endWidth,end));
    }
  }
  function frame(trial,camera,reduced) {
    segments=0;flash.visible=chargeLight.visible=false;
    const opts=trial.active??trial.settings,charge=trial.phase==='charge',age=trial.age;
    const impact=trial.phase==='impact'&&trial.impact;
    // Hold a shape briefly, then restrike: electricity, rather than random scribbling.
    const random=rng(139+(trial.casts??0)*71+Math.floor(age*(reduced?8:18)));
    if(charge&&opts.lightning) {
      const hand=point(trial.combat.fighters[0].position,true);
      chargeLight.visible=true;chargeLight.position.copy(hand);
      chargeLight.scale.setScalar(.25+age*1.1);chargeLight.material.opacity=reduced?.4:.8;
      for(let i=0;i<3;i++) {
        const angle=i*2.1+age*6,tip=hand.clone().add(new THREE.Vector3(Math.cos(angle)*.28,Math.sin(angle)*.28,0));
        ribbon(path(hand,tip,random,.14,3),.055,.008);
      }
    }
    if(impact) {
      const a=point(impact.from,true),b=point(impact.to);
      if(age<.22&&opts.lightning) {
        const points=path(a,b,random,.38);
        ribbon(points,.115,.075);
        for(const [index,side] of [[8,1],[17,-1],[24,1]]) {
          const start=points[index],tip=start.clone().add(new THREE.Vector3(.3+random()*.28,side*(.18+random()*.25),0));
          ribbon(path(start,tip,random,.18,4),.057,.002);
        }
        chargeLight.visible=true;chargeLight.position.copy(a);chargeLight.scale.setScalar(.45);
        chargeLight.material.opacity=.65*Math.max(0,1-age/.22);
        material.uniforms.opacity.value=Math.max(0,1-age/.22);
        // Fine outward sparks; their tapered tails replace the solid purple ring.
        if(age<.18)for(let i=0;i<7;i++) {
          const angle=i*Math.PI*2/7+.2,d=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0);
          const start=b.clone().addScaledVector(d,.10+age*1.6),end=start.clone().addScaledVector(d,.12+random()*.12);
          ribbon(path(start,end,random,.04,2),.035,.001);
        }
      }
      if(opts.flash&&age<.18) {
        flash.visible=true;flash.position.copy(b);flash.scale.setScalar((reduced?.45:1.25)+age*2);
        flash.material.opacity=(reduced?.3:1)*Math.pow(Math.max(0,1-age/.18),1.5);
      }
      if(opts.shake&&!reduced&&age<.22) {
        const strength=opts.shakeStrength*Math.pow(1-age/.22,2);
        camera.position.x+=Math.sin(age*150+1)*strength;
        camera.position.y+=Math.cos(age*117)*strength*.65;camera.updateMatrixWorld();
      }
    }
    if(charge)material.uniforms.opacity.value=.9;
    bolt.visible=segments>0;geometry.setDrawRange(0,segments*6);
    geometry.attributes.position.needsUpdate=true;geometry.attributes.uv.needsUpdate=true;
  }
  return {frame,root,get segments(){return segments;},get flashing(){return flash.visible;},dispose(){
    geometry.dispose();material.dispose();texture.dispose();flash.material.dispose();chargeLight.material.dispose();root.removeFromParent();
  }};
}
