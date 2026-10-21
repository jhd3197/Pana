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

// Exact 4-wave displacement + analytical slope so boats, canoes and buoys can
// ride the same wave math as the vertex shader (or rock in place cheaply).
export function sampleWaterWave(x,z,t=0,amplitude=.07){
  const p1=x*.19+z*.11-t*1.1,p2=x*-.13+z*.23-t*.85,p3=x*.29-z*.17-t*1.45,p4=x*-.21-z*.31-t*1.65;
  const wave=Math.sin(p1)*.42+Math.sin(p2)*.28+Math.sin(p3)*.18+Math.sin(p4)*.12;
  const dx=Math.cos(p1)*.19*.42+Math.cos(p2)*-.13*.28+Math.cos(p3)*.29*.18+Math.cos(p4)*-.21*.12;
  const dz=Math.cos(p1)*.11*.42+Math.cos(p2)*.23*.28+Math.cos(p3)*-.17*.18+Math.cos(p4)*-.31*.12;
  return {
    wave,
    y:wave*amplitude,
    pitch:-dz*Math.max(amplitude*4.5,.18),
    roll:dx*Math.max(amplitude*4.5,.22),
  };
}

// Opt-in extras compile only where used, so existing water keeps its shader:
// a `waterFoam` attribute (0 calm … 1 white water) whitens and speeds up the
// flow, and `rain` (0…1) scatters raindrop rings over the surface.
export function waterSurface(geometry,{kind='sea',color,depth=5,depthMap=null,size=2200,amplitude=.07,opacity=1,rain=0}={}){
  const p=geometry.attributes.position;
  if(!geometry.attributes.waterDepth)geometry.setAttribute('waterDepth',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(depth),1));
  if(!geometry.attributes.waterMask)geometry.setAttribute('waterMask',new THREE.Float32BufferAttribute(new Float32Array(p.count).fill(1),1));
  if(!geometry.attributes.waterFlow){
    const flow=[];for(let i=0;i<p.count;i++)flow.push(p.getX(i),p.getZ(i));
    geometry.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  }
  const sea=kind==='sea',shallow=new THREE.Color(color??(sea?0x4dc9c1:0x609b8d));
  const deep=sea?new THREE.Color(0x125878):shallow.clone().multiplyScalar(.38);
  const defines={};
  if(geometry.attributes.waterFoam)defines.WATER_FOAM='';
  if(rain>0)defines.WATER_RAIN='';
  const material=new THREE.ShaderMaterial({
    defines,transparent:opacity<1,depthWrite:opacity>=1,side:THREE.DoubleSide,fog:true,
    uniforms:{...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),time:{value:0},shallow:{value:shallow},deep:{value:deep},
      sky:{value:new THREE.Color(0xb9dce1)},foam:{value:new THREE.Color(0xe4f3e9)},opacity:{value:opacity},
      amplitude:{value:amplitude},rain:{value:rain},flowing:{value:kind==='river'?1:0},depthMap:{value:depthMap},hasDepthMap:{value:depthMap?1:0},domain:{value:size}},
    vertexShader:`
      attribute float waterDepth; attribute float waterMask; attribute vec2 waterFlow;
      uniform float time; uniform float amplitude;
      varying vec3 worldPosition; varying vec2 flowUV; varying float bedDepth; varying float edgeMask; varying float waveHeight;
      #ifdef WATER_FOAM
        attribute float waterFoam; varying float foamAmount;
      #endif
      #include <fog_pars_vertex>
      void main(){
        #ifdef WATER_FOAM
          foamAmount=waterFoam;
        #endif
        vec3 transformed=position;vec4 world=modelMatrix*vec4(position,1.);
        // Layer 01: 4 sine waves at distinct angles push vertices up and down.
        float wave=sin(world.x*.19+world.z*.11-time*1.1)*.42
          +sin(world.x*-.13+world.z*.23-time*.85)*.28
          +sin(world.x*.29-world.z*.17-time*1.45)*.18
          +sin(world.x*-.21-world.z*.31-time*1.65)*.12;
        float atten=smoothstep(0.,2.,waterDepth);
        transformed.y+=amplitude*wave*atten;
        waveHeight=wave*atten;
        worldPosition=(modelMatrix*vec4(transformed,1.)).xyz;flowUV=waterFlow;bedDepth=waterDepth;edgeMask=waterMask;
        vec4 mvPosition=modelViewMatrix*vec4(transformed,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform float time; uniform float flowing; uniform float opacity; uniform float foamStrength;
      uniform vec3 shallow; uniform vec3 deep; uniform vec3 sky; uniform vec3 foam;
      uniform sampler2D depthMap; uniform float hasDepthMap; uniform float domain;
      varying vec3 worldPosition; varying vec2 flowUV; varying float bedDepth; varying float edgeMask; varying float waveHeight;
      #ifdef WATER_FOAM
        varying float foamAmount;
      #endif
      #ifdef WATER_RAIN
        uniform float rain;
      #endif
      #include <fog_pars_fragment>
      float noise(vec2 p){return sin(p.x+sin(p.y*1.31))*sin(p.y*.87+cos(p.x*.73));}
      void main(){
        float depth=bedDepth;
        if(hasDepthMap>.5){vec2 encoded=texture2D(depthMap,worldPosition.xz/domain+.5).rg;depth=(encoded.r*65280.+encoded.g*255.)/65535.*96.-32.;}
        if(depth<.015)discard;
        vec2 p=mix(worldPosition.xz,flowUV,flowing);
        vec2 drift=mix(vec2(.72,.38),vec2(0.,1.8),flowing)*time;
        #ifdef WATER_FOAM
          // Cascades run faster than the pool they fall into.
          drift*=1.+foamAmount*2.5;
        #endif
        float detail=1.-smoothstep(90.,600.,distance(cameraPosition,worldPosition));
        // Layer 05: dual counter-scrolling ripple normals bend light with no extra polygons.
        vec2 q=p-drift;
        vec2 q2=p*1.28+drift*.62+vec2(4.1,-2.7);
        q+=vec2(noise(q*.09),noise(q.yx*.07+3.7))*2.5;
        q2+=vec2(noise(q2*.11+1.9),noise(q2.yx*.08-2.3))*1.8;
        float a=q.x*.55+q.y*.32,b=q.x*-.31+q.y*.71;
        float a2=q2.x*.48-q2.y*.39,b2=q2.x*.27+q2.y*.64;
        float fine=noise(q*1.7)*.18+noise(q*.32)*.32+noise(q2*1.4)*.14;
        vec3 normal=normalize(vec3(
          (-.03*cos(a)+.022*cos(b)-.018*cos(a2))*detail,
          1.,
          (-.022*cos(a)-.038*cos(b)+.02*cos(b2))*detail
        ));
        vec3 view=normalize(cameraPosition-worldPosition);
        // Layer 06: Fresnel sky reflection at grazing angles + sun glint.
        float fresnel=.06+.36*pow(1.-max(0.,dot(view,normal)),5.);
        // Layer 02: depth color (turquoise shallows -> deep water).
        float body=1.-exp(-depth*.13);
        vec3 col=mix(shallow,deep,body)*(1.+fine*.08*detail+noise(p*.045-time*.08)*.025);
        // Layer 03: clear shallows with dual-layer dancing caustics.
        float caustic=pow(max(0.,sin(a*2.6+fine)*sin(b*2.3-fine)+sin(a2*2.1)*sin(b2*2.4)*.35),10.);
        col+=shallow*caustic*.18*exp(-depth*.35)*detail;
        col=mix(col,sky,fresnel);
        vec3 halfVector=normalize(view+normalize(vec3(-.45,.85,.25)));
        float glint=pow(max(0.,dot(normal,halfVector)),180.);
        col+=vec3(.85,.9,.8)*glint*.36*detail;
        // Layer 04: shore foam + wave-crest foam + longitudinal river streaks.
        float breaker=sin(depth*4.-time*1.7+noise(p*.24)*1.4)*.5+.5;
        float coastFoam=pow(breaker,9.)*(1.-smoothstep(.3,2.8,depth))*foamStrength*(.45+.55*smoothstep(-.4,.7,noise(p*.6-time*.13)));
        float crestFoam=smoothstep(.48,.86,waveHeight+.18*fine)*foamStrength*.42*smoothstep(1.1,3.5,depth);
        float current=pow(max(0.,sin(q.x*2.8+noise(q*.4)*2.)),16.)*pow(max(0.,sin(q.y*.7)),4.)*.22*flowing;
        col=mix(col,foam,clamp(coastFoam+crestFoam+current,0.,.82));
        #ifdef WATER_FOAM
          float churn=.65+.35*sin(q.x*1.9-q.y*1.3+noise(q*.5)*2.);
          col=mix(col,foam*1.06,clamp(foamAmount*churn,0.,.95));
        #endif
        #ifdef WATER_RAIN
          // Raindrop rings: one drop per hashed 2 m cell, each on its own beat.
          vec2 cell=floor(worldPosition.xz*.5),local=fract(worldPosition.xz*.5)-.5;
          float seed=fract(sin(dot(cell,vec2(12.9898,78.233)))*43758.5453);
          local-=(vec2(seed,fract(seed*7.13))-.5)*.3;
          float beat=fract(time*.6+seed);
          float ring=smoothstep(.05,0.,abs(length(local)-beat*.45))*(1.-beat);
          col+=vec3(.85,.92,.95)*ring*.28*rain*detail;
        #endif
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

// `foam` true derives white water from the bed's slope (a cascade between two
// levels foams, a flat reach stays clear); a function foam(u, slope) sets it.
export function riverSurface(points,width,height,{color=0x438e93,closed=false,foam=false,rain=0}={}){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)),closed,'centripetal');
  const length=curve.getLength(),segments=Math.max(40,Math.ceil(length/4)),ps=curve.getSpacedPoints(segments);
  const verts=[],indices=[],depths=[],flow=[],foams=[],columns=8;
  for(let i=0;i<ps.length;i++){
    const p=ps[i],a=ps[Math.max(0,i-1)],b=ps[Math.min(ps.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;
    if(foam){
      const slope=Math.abs(height(b.x,b.z)-height(a.x,a.z))/l;
      const white=typeof foam==='function'?foam(i/segments,slope):THREE.MathUtils.smoothstep(slope,.02,.09);
      for(let j=0;j<=columns;j++)foams.push(white);
    }
    for(let j=0;j<=columns;j++){
      const side=j/columns*2-1,x=p.x-side*dz/l*width/2,z=p.z+side*dx/l*width/2;
      verts.push(x,height(x,z),z);depths.push(.08+2.7*(1-side*side));flow.push(side*width/2,i/segments*length);
      if(i<ps.length-1&&j<columns){const n=i*(columns+1)+j;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  geo.setAttribute('waterDepth',new THREE.Float32BufferAttribute(depths,1));geo.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flow,2));
  if(foam)geo.setAttribute('waterFoam',new THREE.Float32BufferAttribute(foams,1));
  return waterSurface(geo,{kind:'river',color,amplitude:.025,rain});
}

// A short stream stepping down `drops` ledges, for previews and cave falls:
// the steps foam and race, the reaches between them stay glassy.
export function cascadeStream({length=36,width=5,drop=6,drops=2,rain=0,color=0x3f9a96}={}){
  const points=Array.from({length:7},(_,i)=>[Math.sin(i*.9)*2,(i/6-.5)*length]);
  const step=z=>{const k=(z/length+.5)*(drops+1),f=k-Math.floor(k);return -(Math.floor(k)+THREE.MathUtils.smoothstep(f,.78,.98))*drop/(drops+1);};
  const water=riverSurface(points,width,(x,z)=>drop/2+step(z),{color,foam:true,rain}),group=new THREE.Group();
  // Library factories return a Group (engine/models/README.md); the water mesh keeps its own tick.
  water.name='cascade-stream-water';group.name='cascade-stream';group.add(water);
  group.userData.previewBounds=[[-width-2,-drop/2-1,-length/2],[width+2,drop/2+1,length/2]];
  group.userData.tick=water.userData.tick;
  return group;
}

// Environment owners call this once at construction, then compose with their
// own updates. Scenery ticks are already collected by the track runtime.
export function waterAnimator(root){
  const water=[];root.traverse(o=>{if(o.userData.waterSurface)water.push(o);});
  return t=>water.forEach(o=>o.userData.tick(t));
}
