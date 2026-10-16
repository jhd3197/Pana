// Soft camera-facing steam. One instanced draw, no textures, absolute-time motion.
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

export function steamField(origins,{seed=1,count=12,radius=3,rise=14,opacity=.28,drift=4}={}){
  const random=rng(seed),geometry=new THREE.PlaneGeometry(2,2),phases=[],sizes=[],speeds=[];
  const material=new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{time:{value:0},rise:{value:rise},opacity:{value:opacity},drift:{value:drift},tint:{value:new THREE.Color(0xe0eeea)}},
    vertexShader:`attribute float phase; attribute float size; attribute float speed;
      uniform float time; uniform float rise; uniform float drift;
      varying vec2 cloudUV; varying float fade;
      void main(){
        float age=fract(phase+time*speed);
        vec3 center=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
        center+=vec3(sin(phase*19.+age*3.)*drift*age,age*rise,cos(phase*23.+age*2.)*drift*age);
        vec4 mv=modelViewMatrix*vec4(center,1.);
        mv.xy+=position.xy*size*(.65+age*1.5)*length(modelMatrix[0].xyz);
        gl_Position=projectionMatrix*mv;cloudUV=uv*2.-1.;
        fade=smoothstep(0.,.17,age)*(1.-smoothstep(.5,1.,age))*(1.-smoothstep(900.,1700.,-mv.z));
      }`,
    fragmentShader:`uniform vec3 tint; uniform float opacity; varying vec2 cloudUV; varying float fade;
      void main(){
        float r=dot(cloudUV,cloudUV);float cloud=exp(-3.8*r)*(1.-smoothstep(.38,1.,r));
        float alpha=cloud*fade*opacity;if(alpha<.003)discard;
        gl_FragColor=vec4(tint,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const steam=new THREE.InstancedMesh(geometry,material,origins.length*count),pose=new THREE.Object3D();
  origins.forEach(([x,y,z],j)=>{for(let i=0;i<count;i++){
    pose.position.set(x+(random()-.5)*radius,y,z+(random()-.5)*radius);pose.updateMatrix();steam.setMatrixAt(j*count+i,pose.matrix);
    phases.push((i/count+random()*.15)%1);sizes.push(radius*(.8+random()*.5));speeds.push(.055+random()*.035);
  }});
  geometry.setAttribute('phase',new THREE.InstancedBufferAttribute(new Float32Array(phases),1));
  geometry.setAttribute('size',new THREE.InstancedBufferAttribute(new Float32Array(sizes),1));
  geometry.setAttribute('speed',new THREE.InstancedBufferAttribute(new Float32Array(speeds),1));
  // Shader displacement extends beyond the source quad; retain a conservative bound.
  const bounds=new THREE.Box3();origins.forEach(p=>bounds.expandByPoint(new THREE.Vector3(...p)));bounds.expandByScalar(radius*4+drift+rise);
  steam.boundingBox=bounds;steam.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());
  steam.name='thermal-steam';steam.raycast=()=>{};
  // Studio clones materials for its inspection controls; tick the live material.
  steam.userData.tick=t=>{steam.material.uniforms.time.value=t;};steam.userData.dispose=()=>material.dispose();
  return steam;
}
