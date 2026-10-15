// Animated water for the race worlds and Studio. No reflection passes or downloads.
import * as THREE from 'three';

// Sample the actual terrain once. RG stores signed depth to centimetre precision;
// linear filtering gives continuous shorelines without a dense ocean mesh.
export function waterDepthMap(groundAt,{size=2200,y=0,resolution=256}={}){
  const data=new Uint8Array(resolution*resolution*4);
  for(let j=0;j<resolution;j++)for(let i=0;i<resolution;i++){
    const depth=y-groundAt((i/(resolution-1)-.5)*size,(j/(resolution-1)-.5)*size);
    const packed=Math.round(THREE.MathUtils.clamp((depth+32)/96,0,1)*65535),k=(j*resolution+i)*4;
    data[k]=packed>>8;data[k+1]=packed&255;data[k+3]=255;
  }
  const texture=new THREE.DataTexture(data,resolution,resolution,THREE.RGBAFormat);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.needsUpdate=true;
  return texture;
}

export function waterSurface(geometry,{kind='sea',color,depth=5,depthMap=null,size=2200,amplitude=.07,opacity=1}={}){
  const p=geometry.attributes.position;
  if(!geometry.attributes.waterDepth)geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(depth),1));
  if(!geometry.attributes.waterMask)geometry.setAttribute('waterMask',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(1),1));
  if(!geometry.attributes.waterFlow){
    const flow=[];for(let i=0;i<p.count;i++)flow.push(p.getX(i),p.getZ(i));
    geometry.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  }
  const sea=kind==='sea',shallow=new THREE.Color(color??(sea?0x4dc9c1:0x609b8d));
  const deep=sea?new THREE.Color(0x125878):shallow.clone().multiplyScalar(.38);
  const material=new THREE.ShaderMaterial({
    transparent:opacity<1,depthWrite:opacity>=1,side:THREE.DoubleSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:{value:0},shallow:{value:shallow},deep:{value:deep},
      sky:{value:new THREE.Color(0xb9dce1)},foam:{value:new THREE.Color(0xe4f3e9)},opacity:{value:opacity},
      amplitude:{value:amplitude},flowing:{value:kind==='river'?1:0},depthMap:{value:depthMap},hasDepthMap:{value:depthMap?1:0},domain:{value:size}},
    vertexShader:`
      attribute float waterDepth; attribute float waterMask; attribute vec2 waterFlow;
      uniform float time; uniform float amplitude;
      varying vec3 worldPosition; varying vec2 flowUV; varying float bedDepth; varying float edgeMask;
      #include <fog_pars_vertex>
      void main(){
        vec3 transformed=position;vec4 world=modelMatrix*vec4(position,1.);
        float wave=sin(world.x*.19+world.z*.11-time*1.1)*.6+sin(world.x*-.13+world.z*.23-time*.85)*.4;
        // Keep shores, ponds and river edges attached to their banks.
        transformed.y+=amplitude*wave*smoothstep(0.,2.,waterDepth);
        worldPosition=(modelMatrix*vec4(transformed,1.)).xyz;flowUV=waterFlow;bedDepth=waterDepth;edgeMask=waterMask;
        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform float time; uniform float flowing; uniform float opacity; uniform float foamStrength;
      uniform vec3 shallow; uniform vec3 deep; uniform vec3 sky; uniform vec3 foam;
      uniform sampler2D depthMap; uniform float hasDepthMap; uniform float domain;
      varying vec3 worldPosition; varying vec2 flowUV; varying float bedDepth; varying float edgeMask;
      #include <fog_pars_fragment>
      float noise(vec2 p){return sin(p.x+sin(p.y*1.31))*sin(p.y*.87+cos(p.x*.73));}
      void main(){
        float depth=bedDepth;
        if(hasDepthMap>.5){vec2 encoded=texture2D(depthMap,worldPosition.xz/domain+.5).rg;depth=(encoded.r*65280.+encoded.g*255.)/65535.*96.-32.;}
        if(depth<.015)discard;
        vec2 p=mix(worldPosition.xz,flowUV,flowing);
        vec2 drift=mix(vec2(.72,.38),vec2(0.,1.8),flowing)*time;
        float detail=1.-smoothstep(90.,600.,distance(cameraPosition,worldPosition));
        vec2 q=p-drift;
        q+=vec2(noise(q*.09),noise(q.yx*.07+3.7))*2.5;
        float a=q.x*.55+q.y*.32,b=q.x*-.31+q.y*.71;
        float fine=noise(q*1.7)*.22+noise(q*.34)*.42;
        vec3 normal=normalize(vec3((-.035*cos(a)+.025*cos(b))*detail,1.,(-.025*cos(a)-.045*cos(b))*detail));
        vec3 view=normalize(cameraPosition-worldPosition);
        float fresnel=.06+.32*pow(1.-max(0.,dot(view,normal)),4.);
        float body=1.-exp(-depth*.13);
        vec3 col=mix(shallow,deep,body)*(1.+fine*.08*detail+noise(p*.045-time*.08)*.025);
        // Soft caustics only in the clear shallows; no painted grid on deep water.
        float caustic=pow(max(0.,sin(a*2.6+fine)*sin(b*2.3-fine)),12.);
        col+=shallow*caustic*.16*exp(-depth*.35)*detail;
        col=mix(col,sky,fresnel);
        vec3 halfVector=normalize(view+normalize(vec3(-.45,.85,.25)));
        float glint=pow(max(0.,dot(normal,halfVector)),180.);
        col+=vec3(.82,.88,.77)*glint*.32*detail;
        // Broken, travelling shore breakers and longitudinal river streaks.
        float breaker=sin(depth*4.-time*1.7+noise(p*.24)*1.4)*.5+.5;
        float coastFoam=pow(breaker,9.)*(1.-smoothstep(.3,2.8,depth))*foamStrength*(.45+.55*smoothstep(-.4,.7,noise(p*.6-time*.13)));
        float current=pow(max(0.,sin(q.x*2.8+noise(q*.4)*2.)),16.)*pow(max(0.,sin(q.y*.7)),4.)*.2*flowing;
        col=mix(col,foam,clamp(coastFoam+current,0.,.78));
        gl_FragColor=vec4(col,opacity*smoothstep(.015,.16,depth)*edgeMask);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  material.uniforms.foamStrength={value:sea?.65:kind==='river'?.25:.09};
  const water=new THREE.Mesh(geometry,material);water.name=`${kind}-water`;
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=Math.abs(amplitude);
  water.userData.waterSurface=true;
  // Material cloning in Studio must not disconnect animation or resource disposal.
  water.userData.tick=t=>{water.material.uniforms.time.value=t;};
  water.userData.dispose=()=>{
    const live=water.material.uniforms.depthMap.value;if(live!==depthMap)live?.dispose();
    material.dispose();depthMap?.dispose();
  };
  return water;
}

export function waterPool(rx,rz,{color=0x609b8d,depth=4}={}){
  const geo=new THREE.RingGeometry(0,1,64,8);geo.rotateX(-Math.PI/2);
  const p=geo.attributes.position,depths=[];
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i),a=Math.atan2(z,x),shore=.97+.02*Math.sin(a*5+.4)+.01*Math.sin(a*9);
    depths.push(.08+depth*(1-Math.min(1,x*x+z*z)));p.setXYZ(i,x*shore,0,z*shore);
  }
  geo.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geo.scale(rx,1,rz);
  return waterSurface(geo,{kind:'lake',color,amplitude:.018});
}

export function riverSurface(points,width,height,{color=0x438e93,closed=false}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),closed,'centripetal');
  const length=curve.getLength(),segments=Math.max(40,Math.ceil(length/4)),ps=curve.getSpacedPoints(segments);
  const verts=[],indices=[],depths=[],flow=[],columns=8;
  for(let i=0;i<ps.length;i++){
    const p=ps[i],a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;
    for(let j=0;j<=columns;j++){
      const side=j/columns*2-1,x=p.x-side*dz/l*width/2,z=p.z+side*dx/l*width/2;
      verts.push(x,height(x,z),z);depths.push(.08+2.7*(1-side*side));flow.push(side*width/2,i/segments*length);
      if(i<ps.length-1&&j<columns){const n=i*(columns+1)+j;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  geo.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geo.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  return waterSurface(geo,{kind:'river',color,amplitude:.025});
}

// Environment owners call this once at construction, then compose with their
// own updates. Scenery ticks are already collected by the track runtime.
export function waterAnimator(root){
  const water=[];root.traverse(o=>{if(o.userData.waterSurface)water.push(o);});
  return t=>water.forEach(o=>o.userData.tick(t));
}
