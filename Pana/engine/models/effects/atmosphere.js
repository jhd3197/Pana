// Ambient light and air: ground fog, sun shafts and a night-sky moon. Metres,
// +Y up, origin on the ground (shafts at their floor hit, moon at its centre).
// Every texture is owned by the effect and released by userData.dispose().
import * as THREE from 'three';
import { rng } from '/engine/models/core/primitives.js';

function canvasTexture(width,height,draw){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  draw(canvas.getContext('2d'),width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function owned(group,textures,materials,geometries){
  let disposed=false;
  group.userData.dispose=()=>{
    if(disposed)return;disposed=true;
    textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
  };
  return group;
}
// Bright at the top (the opening), fading toward the floor.
const fadeDown=(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff');g.addColorStop(.6,'#666');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,w,h);};

// Stacked transparent sheets of tiling radial blobs; each layer drifts its own way.
export function groundFog({width=60,depth=60,layers=3,color=0x9d96c8,opacity=1,height=2.4,seed=9}={}){
  const group=new THREE.Group(),random=rng(seed),textures=[],materials=[];group.name='ground-fog';
  const blobs=Array.from({length:120},()=>[random()*256,random()*256,20+random()*50]);
  const geometry=new THREE.PlaneGeometry(width,depth);geometry.rotateX(-Math.PI/2);
  const tint=new THREE.Color(color);
  for(let i=0;i<layers;i++){
    const k=layers>1?i/(layers-1):0;
    const map=canvasTexture(256,256,(x)=>{
      for(const [px,py,r] of blobs){
        const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,0.22)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;
        // Draw every blob into the neighbouring tiles so the texture wraps seamlessly.
        for(const ox of [-256,0,256])for(const oy of [-256,0,256])x.fillRect(px-r+ox,py-r+oy,r*2,r*2);
      }
    });
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(width/87,depth/87);map.offset.set(i*.37,i*.21);
    const material=new THREE.MeshBasicMaterial({color:tint.clone().offsetHSL(0,-.03*k,-.04*k),map,transparent:true,opacity:opacity*(.32-.19*k),depthWrite:false});
    const sheet=new THREE.Mesh(geometry,material);
    sheet.position.y=.5+(height-.5)*k;sheet.renderOrder=2;sheet.raycast=()=>{};sheet.userData.layer=i;
    group.add(sheet);textures.push(map);materials.push(material);
  }
  // Studio clones materials; scroll the live material's map.
  group.userData.tick=t=>group.children.forEach(sheet=>{const i=sheet.userData.layer,offset=sheet.material.map?.offset;if(!offset)return;
    offset.x=i*.37+t*.004*(i+1);offset.y=i*.21+t*.0025*(i%2?-1:1);});
  group.userData.previewBounds=[[-width/2,0,-depth/2],[width/2,height+1,depth/2]];
  return owned(group,textures,materials,[geometry]);
}

function shaftDust(count,seed,color,size){
  const random=rng(seed),base=new Float32Array(count*4),positions=new Float32Array(count*3);
  for(let i=0;i<count;i++)base.set([random(),random()*Math.PI*2,Math.sqrt(random()),random()*10],i*4);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.PointsMaterial({color,size,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false});
  const points=new THREE.Points(geometry,material);points.frustumCulled=false;points.raycast=()=>{};
  // Positions live in the unit-cylinder space of the beam, which carries its scale.
  const update=t=>{
    for(let i=0;i<count;i++){
      const u=base[i*4],a=base[i*4+1]+t*.04,r=base[i*4+2]*.55,phase=base[i*4+3];
      positions[i*3]=Math.cos(a)*r;positions[i*3+1]=((u-t*.003)%1+1)%1-.5+Math.sin(t*.6+phase)*.006;positions[i*3+2]=Math.sin(a)*r;
    }
    geometry.attributes.position.needsUpdate=true;
  };
  update(0);
  return {points,geometry,material,update};
}

// Rain streaks falling through a beam, in the same unit-cylinder space as the
// dust; each drop wraps back to the opening when it reaches the floor.
function shaftRain(count,seed,color,height){
  const random=rng(seed+101),base=new Float32Array(count*3),positions=new Float32Array(count*6),streak=Math.min(.12,1.4/height);
  for(let i=0;i<count;i++)base.set([random()*Math.PI*2,Math.sqrt(random())*.9,random()],i*3);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.LineBasicMaterial({color,transparent:true,opacity:.5,depthWrite:false,fog:false});
  const lines=new THREE.LineSegments(geometry,material);lines.frustumCulled=false;lines.raycast=()=>{};
  const update=t=>{
    for(let i=0;i<count;i++){
      const a=base[i*3],r=base[i*3+1],y=.5-((base[i*3+2]+t*14/height)%1),x=Math.cos(a)*r,z=Math.sin(a)*r;
      positions.set([x,y+streak,z,x,y,z],i*6);
    }
    geometry.attributes.position.needsUpdate=true;
  };
  update(0);
  return {lines,geometry,material,update};
}

// Open cylinder lit by a fresnel term: faces seen head-on carry the light and
// the silhouette fades out, so the beam never shows a hard rim. Brightest at
// the opening (uv.y = 1) and breathing slowly.
function fresnelBeamMaterial(color,opacity,time){
  return new THREE.ShaderMaterial({
    uniforms:{color:{value:new THREE.Color(color)},opacity:{value:opacity},time},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
    vertexShader:`
      varying float beamHeight; varying vec3 beamNormal; varying vec3 beamView;
      void main(){
        beamHeight=uv.y;vec4 mv=modelViewMatrix*vec4(position,1.);
        beamNormal=normalize(normalMatrix*normal);beamView=normalize(-mv.xyz);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`
      uniform vec3 color; uniform float opacity; uniform float time;
      varying float beamHeight; varying vec3 beamNormal; varying vec3 beamView;
      void main(){
        float face=pow(abs(dot(normalize(beamNormal),normalize(beamView))),1.6);
        float a=opacity*2.4*smoothstep(0.,.75,beamHeight)*face*(.85+.15*sin(time*.7+beamHeight*6.));
        gl_FragColor=vec4(color*a,1.);
      }`,
  });
}

// Additive cylinder of light with thinner streaks and spiralling motes. Origin at
// the floor; `tilt` leans the beam toward +X like a low sun. Skylight options:
// `spread` widens the floor end (floor radius = radius·spread), `fresnel` swaps
// the gradient for the rimless fresnel fade, `sky` (a colour) caps the opening
// with a bright disc and `rain` (a drop count) keeps rain inside the beam.
export function lightShaft({radius=4,height=20,color=0xffe8b0,opacity=.085,tilt=.2,dust=true,dustCount=400,seed=7,spread=1.12,fresnel=false,sky=null,rain=0,rainColor=0xcfe4ff}={}){
  const group=new THREE.Group(),random=rng(seed);group.name='light-shaft';
  const time={value:0},textures=[],materials=[],ticks=[];
  let material;
  // Studio clones materials (and their uniforms); drive whichever is live.
  if(fresnel){material=fresnelBeamMaterial(color,opacity,time);ticks.push(t=>{time.value=t;beam.children.forEach(m=>{const u=m.material?.uniforms?.time;if(u)u.value=t;});});}
  else{
    const alphaMap=canvasTexture(4,128,fadeDown);textures.push(alphaMap);
    material=new THREE.MeshBasicMaterial({color,alphaMap,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
  }
  materials.push(material);
  const geometry=new THREE.CylinderGeometry(1,spread,1,48,1,true),thin=new THREE.CylinderGeometry(1,1+(spread-1)*.45,1,24,1,true);
  const beam=new THREE.Group();beam.rotation.z=-tilt;beam.position.set(Math.sin(tilt)*height/2,Math.cos(tilt)*height/2,0);group.add(beam);
  const main=new THREE.Mesh(geometry,material);main.scale.set(radius,height,radius);main.raycast=()=>{};beam.add(main);
  for(let i=0;i<5;i++){
    const ray=new THREE.Mesh(thin,material);ray.raycast=()=>{};
    ray.position.set((i-2)*radius*.28,0,(i%2?-1:1)*radius*.3*(.6+random()*.6));
    const r=radius*(.12+(i%3)*.07);ray.scale.set(r,height,r*(1.1+((i*7)%4)*.2));beam.add(ray);
  }
  const geometries=[geometry,thin];
  if(sky!=null){
    const disc=new THREE.CircleGeometry(radius*1.08,32),skyMaterial=new THREE.MeshBasicMaterial({color:sky,fog:false});
    const cap=new THREE.Mesh(disc,skyMaterial);cap.rotation.x=Math.PI/2;cap.position.y=height/2;cap.raycast=()=>{};beam.add(cap);
    geometries.push(disc);materials.push(skyMaterial);
  }
  if(dust){
    const motes=shaftDust(dustCount,seed,0xffe9b8,.16);motes.points.scale.set(radius,height,radius);beam.add(motes.points);
    materials.push(motes.material);geometries.push(motes.geometry);ticks.push(motes.update);
  }
  if(rain>0){
    const drops=shaftRain(rain,seed,rainColor,height);drops.lines.scale.set(radius,height,radius);beam.add(drops.lines);
    materials.push(drops.material);geometries.push(drops.geometry);ticks.push(drops.update);
  }
  if(ticks.length)group.userData.tick=t=>ticks.forEach(tick=>tick(t));
  const reach=Math.sin(tilt)*height,wide=radius*Math.max(1.2,spread*1.05);
  group.userData.previewBounds=[[Math.min(0,reach)-wide,0,-wide],[Math.max(0,reach)+wide,height,wide]];
  return owned(group,textures,materials,geometries);
}

// A vertical skylight for caves: a narrow opening of sky widening to a pool of
// light on the floor, fresnel-faded, with dust and optional rain.
export function skylightBeam({radius=3.2,height=24,spread=2.8,color=0xfff0c8,opacity=.085,sky=0xfff6dc,dustCount=260,rain=0,seed=7}={}){
  const group=lightShaft({radius,height,spread,color,opacity,sky,dustCount,rain,seed,tilt:0,fresnel:true});
  group.name='skylight-beam';
  return group;
}

// Slanted shafts through a canopy gap, scattered over `spread` metres. One shared
// gradient and material keeps the cluster at a single texture.
export function godRays({count=9,spread=30,length=34,color=0xfff3c4,opacity=.12,sun=[.35,1,.28],seed=12}={}){
  const group=new THREE.Group(),random=rng(seed);group.name='god-rays';
  const direction=new THREE.Vector3(...sun).normalize(),up=new THREE.Vector3(0,1,0);
  const alphaMap=canvasTexture(4,128,(x,w,h)=>{const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff');g.addColorStop(.7,'#555');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,w,h);});
  const material=new THREE.MeshBasicMaterial({color,alphaMap,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
  const geometries=[];
  for(let i=0;i<count;i++){
    const r=2+random()*1,x=(random()-.5)*spread,z=(random()-.5)*spread;
    const geometry=new THREE.CylinderGeometry(r,r*1.25,length,20,1,true);geometries.push(geometry);
    const ray=new THREE.Mesh(geometry,material);ray.raycast=()=>{};
    ray.position.set(x+direction.x*length/2,direction.y*length/2,z+direction.z*length/2);ray.quaternion.setFromUnitVectors(up,direction);
    group.add(ray);
  }
  // A slow breathing keeps the shafts from reading as solid geometry.
  group.userData.tick=t=>{const k=opacity*(.8+.2*Math.sin(t*.35));group.children.forEach(ray=>{ray.material.opacity=k;});};
  const half=spread/2+length*.5;
  group.userData.previewBounds=[[-half,0,-half],[half,length,half]];
  return owned(group,[alphaMap],[material],geometries);
}

// Night-sky dressing: pale disc, additive halo and a few darker maria. Faces +Z;
// callers place it far away and orient it toward the view.
export function moonDisc({radius=16,color=0xf3efd9,halo=0xdcd7ff,craters=6}={}){
  const group=new THREE.Group();group.name='moon-disc';
  const discGeometry=new THREE.CircleGeometry(radius,40),disc=new THREE.MeshBasicMaterial({color,fog:false});
  group.add(new THREE.Mesh(discGeometry,disc));
  const tint=new THREE.Color(halo),rgb=`${tint.r*255|0},${tint.g*255|0},${tint.b*255|0}`;
  const glow=canvasTexture(128,128,(x)=>{const g=x.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,`rgba(${rgb},0.55)`);g.addColorStop(1,`rgba(${rgb},0)`);x.fillStyle=g;x.fillRect(0,0,128,128);});
  const haloMaterial=new THREE.SpriteMaterial({map:glow,fog:false,depthWrite:false,blending:THREE.AdditiveBlending,transparent:true});
  const sprite=new THREE.Sprite(haloMaterial);sprite.scale.set(radius*7.5,radius*7.5,1);sprite.position.z=-.2;sprite.raycast=()=>{};group.add(sprite);
  const crater=new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(.89),fog:false}),geometries=[discGeometry],s=radius/16;
  for(let i=0;i<craters;i++){
    const geometry=new THREE.CircleGeometry((1.2+i%3*1.1)*s,10);geometries.push(geometry);
    const m=new THREE.Mesh(geometry,crater);m.position.set(((i*7%11)-5)*s,((i*5%9)-4)*s,.05);group.add(m);
  }
  group.userData.previewBounds=[[-radius*1.4,-radius*1.4,-1],[radius*1.4,radius*1.4,1]];
  return owned(group,[glow],[disc,haloMaterial,crater],geometries);
}

