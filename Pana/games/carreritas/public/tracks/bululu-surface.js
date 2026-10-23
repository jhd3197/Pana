import * as THREE from 'three';
import { groundPaint } from './ground-paint.js';
import { terrainMaterial } from '/engine/worlds/terrain-material.js';

// Warm limestone on exposed slopes; irregular grassy caps remain on flatter
// ground. Paint before natureSurface classifies grass, so rock grows no grass.
export function coastalPaint(){
  const paint=groundPaint({tone:.12,moss:.15,verge:.35,vergeColor:0xc5ad83,keep:(x,z,y)=>y<1});
  return {...paint,apply(geo,T){
    paint.apply(geo,T);
    const p=geo.attributes.position,n=geo.attributes.normal,c=geo.attributes.color;
    const color=new THREE.Color(),rock=new THREE.Color(0xcba079);
    let rocks=0,caps=0;
    for(let i=0;i<p.count;i++){
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),slope=1-Math.abs(n.getY(i));
      if(y<5)continue;
      const edge=.055+.025*Math.sin(x*.17+Math.sin(z*.11)*2);
      const amount=THREE.MathUtils.smoothstep(slope,edge,edge+.11)*THREE.MathUtils.smoothstep(y,5,8);
      color.fromBufferAttribute(c,i).lerp(rock,amount);
      c.setXYZ(i,color.r,color.g,color.b);
      if(amount>.8)rocks++;if(amount<.1&&y>12)caps++;
    }
    geo.userData.coastalSurface={rocks,caps};c.needsUpdate=true;
  }};
}

export function coastalRockMaterial(){
  const material=terrainMaterial(),baseCompile=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
    baseCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      // Broad vertical erosion grooves and shallow strata, in world metres.
      float exposure=smoothstep(.035,.16,1.0-abs(normalize(vTerrainNormal).y))*smoothstep(5.0,8.0,vTerrainPosition.y);
      float groove=.5+.5*sin((vTerrainPosition.x+vTerrainPosition.z*.73)*.48+terrainNoise(vTerrainPosition*.075)*3.0);
      float strata=.5+.5*sin(vTerrainPosition.y*.85+terrainNoise(vTerrainPosition*.08)*2.0);
      diffuseColor.rgb*=mix(1.0,.58+.52*groove+.12*strata,exposure);
      #include <roughnessmap_fragment>`);
  };
  material.customProgramCacheKey=()=> 'bululu-limestone-caps-v1';
  return material;
}
