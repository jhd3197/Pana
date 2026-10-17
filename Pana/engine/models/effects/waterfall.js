// Vertical curtain, impact foam and bounded mist. Metres, origin at impact,
// +Y up, curtain in XY facing +Z. Caller owns placement, bed and wet-road rules.
import * as THREE from 'three';
import { steamField } from './thermal-steam.js';

export function waterfall({width=10,height=30,run=0,seed=56,reduced=false}={}) {
  if(!(width>0&&width<=240&&height>0&&height<=300))throw new RangeError('Invalid waterfall dimensions');
  const group=new THREE.Group();group.name='waterfall';
  const geometry=new THREE.PlaneGeometry(width,height,24,32);geometry.translate(0,height/2,0);
  // A falling ribbon can follow a cliff's slope without a second effect factory.
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){const descent=1-positions.getY(i)/height;positions.setZ(i,run*(descent*descent-1));}
  geometry.computeVertexNormals();
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:{value:0},tint:{value:new THREE.Color(0xc5e5df)},motion:{value:reduced?.35:1}},
    vertexShader:`uniform float time;uniform float motion;varying vec2 flow;
      #include <fog_pars_vertex>
      void main(){flow=uv;vec3 transformed=position;
        transformed.z+=sin(uv.x*35.+uv.y*19.-time*1.8)*.32*motion*sin(uv.y*3.14159);
        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform float time;uniform vec3 tint;uniform float motion;varying vec2 flow;
      #include <fog_pars_fragment>
      void main(){
        float t=time*motion;float fall=flow.y*34.+t*5.8;
        float ribs=.5+.5*sin(flow.x*127.+sin(flow.x*33.)*3.+sin(fall)*.32);
        float threads=.5+.5*sin(flow.x*267.+fall*.16);
        float edge=smoothstep(0.,.045,flow.x)*smoothstep(0.,.045,1.-flow.x);
        float breaks=smoothstep(.08,.38,ribs+threads*.25);
        float alpha=edge*(.24+.48*breaks);
        vec3 col=mix(tint*.75,vec3(.94,.98,.94),ribs*.65+threads*.18);
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const curtain=new THREE.Mesh(geometry,material);curtain.name='falling-curtain';curtain.raycast=()=>{};group.add(curtain);
  const origins=[[-width*.3,.5,1],[0,.5,2],[width*.3,.5,1]];
  const mist=steamField(origins,{seed,count:12,radius:Math.min(width*.18,9),rise:Math.min(height*.16,16),opacity:.2,drift:3});
  mist.name='waterfall-impact-mist';group.add(mist);
  const foamGeometry=new THREE.CircleGeometry(1,40);foamGeometry.rotateX(-Math.PI/2);
  const foamMaterial=new THREE.MeshBasicMaterial({color:0xe5f0e8,transparent:true,opacity:.5,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true});
  const foam=new THREE.Mesh(foamGeometry,foamMaterial);foam.position.set(0,.04,1.5);foam.scale.set(width*.55,1,Math.min(9,width*.22));foam.raycast=()=>{};group.add(foam);
  group.userData.setReduced=value=>{mist.count=value?12:36;curtain.material.uniforms.motion.value=value?.35:1;};
  group.userData.setReduced(reduced);
  group.userData.tick=t=>{curtain.material.uniforms.time.value=t;mist.userData.tick(t);foam.material.opacity=.46+.06*Math.sin(t*1.3);};
  group.userData.previewBounds=[[-width*.7,0,-Math.abs(run)-3],[width*.7,height+1,12]];
  group.userData.effectBudget={draws:3,particles:36,renderTargets:0};
  let disposed=false;
  group.userData.dispose=()=>{if(disposed)return;disposed=true;geometry.dispose();foamGeometry.dispose();mist.geometry.dispose();material.dispose();foamMaterial.dispose();mist.userData.dispose();};
  return group;
}
