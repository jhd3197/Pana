import * as THREE from 'three';
import { disposeModel } from '/engine/models/props/game-table.js';
import { poseFace } from './studio-finish.js';
import { MOMENTS, MOMENT_NAMES } from './moment-events.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};

// Authored Studio reactions adapted to existing positions, never logical cells.
// Callers restore the underlying pose before every sample.
export function createMomentVisual(kind,color='#ffc629') {
  const root=new THREE.Group();root.name=`ludo-moment-${kind}`;
  function textSprite(text,color='#fff1ae') {
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');ctx.font='900 54px Nunito, sans-serif';
    canvas.width=Math.ceil(ctx.measureText(text).width)+30;canvas.height=100;
    ctx.font='900 54px Nunito, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=9;ctx.strokeStyle='#231a47';
    ctx.strokeText(text,canvas.width/2,50);ctx.fillStyle=color;ctx.fillText(text,canvas.width/2,50);
    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,depthWrite:false})),width=Math.min(2.4,Math.max(.65,canvas.width/200));sprite.scale.set(width,width*100/canvas.width,1);return sprite;
  }
  const text=kind==='block'?'¡Juntos!':kind==='sleep'?'Z z z':kind==='suspense'?'…':kind==='podium'?'¡Campeón!':MOMENT_NAMES[MOMENTS.indexOf(kind)];
  const label=textSprite(text);label.name='moment-caption';if(kind==='nomoves')label.scale.multiplyScalar(.65);root.add(label);
  const props=new THREE.Group();root.add(props);
  const mat=new THREE.MeshStandardMaterial({color,roughness:.5});
  function mesh(geometry,material=mat){const m=new THREE.Mesh(geometry,material);props.add(m);return m;}
  if(kind==='safe')mesh(new THREE.SphereGeometry(.36,20,12),new THREE.MeshStandardMaterial({color:'#7fd7ff',transparent:true,opacity:.25,roughness:.15,depthWrite:false}));
  if(kind==='block')for(let i=0;i<6;i++){const m=mesh(new THREE.BoxGeometry(.15,.10,.08));m.position.set((i%3-1)*.16,.05+Math.floor(i/3)*.11,-.22);}
  if(kind==='nomoves'){
    const cloudMaterial=new THREE.MeshStandardMaterial({color:'#c4ccdc',roughness:1});
    const lobes=[[-.29,.73,.01,.16],[-.11,.82,0,.21],[.14,.8,.015,.19],[.31,.72,0,.15],[0,.68,.03,.21]];
    for(const [x,y,z,radius] of lobes){
      const puff=mesh(new THREE.SphereGeometry(radius,16,12),cloudMaterial);
      puff.name='rain-cloud';puff.position.set(x,y,z);
      puff.scale.set(y<.7?1.8:1.05,y<.7?.6:1,.9);
    }
  }
  const droplets=[];
  if(kind==='nomoves'||kind==='nearmiss')for(let i=0;i<10;i++){
    const drop=mesh(new THREE.SphereGeometry(.018,6,4),new THREE.MeshStandardMaterial({color:'#6ec3ff'}));drop.scale.y=2;droplets.push(drop);
  }
  if(kind==='podium')for(let i=0;i<3;i++){const height=[.48,.32,.22][i],m=mesh(new THREE.BoxGeometry(.46,height,.46),new THREE.MeshStandardMaterial({color:['#ffc629','#b8c2cf','#d89155'][i]}));m.position.set([0,-.6,.6][i],height/2,0);const badge=textSprite(String(i+1));badge.scale.set(.22,.22,1);badge.position.set([0,-.6,.6][i],height/2,.25);props.add(badge);}
  if(['intro','turn','sprint'].includes(kind)){const m=mesh(new THREE.TorusGeometry(.35,.015,6,32));m.rotation.x=-Math.PI/2;}
  function sample(t,actors,time=0) {
    t=clamp(t);const envelope=Math.sin(t*Math.PI),center=new THREE.Vector3();
    actors.forEach(p=>center.add(p.position));if(actors.length)center.divideScalar(actors.length);
    root.visible=t<1;props.position.copy(center);label.position.copy(center).add(new THREE.Vector3(0,kind==='nomoves'?.95:1.05,kind==='nomoves'?-.55:0));
    label.material.opacity=Math.min(1,t*8,(1-t)*8);
    if(kind==='podium'){props.position.set(0,center.y,0);label.position.set(0,center.y+1.3,0);}
    if(kind==='safe')props.position.y+=.2;
    droplets.forEach((drop,i)=>{const fall=(time*1.5+i*.17)%1;drop.position.set(Math.sin(i*3.7)*.3,(kind==='nomoves'?.68:.5)-fall*.65,Math.cos(i*2.3)*.2);});
    props.scale.setScalar(Math.max(.001,Math.min(1,t*8,(1-t)*8)));
    for(let i=0;i<actors.length;i++){
      const p=actors[i],wave=clamp((t-i*.035)/.7),hop=Math.sin(wave*Math.PI);
      if(kind==='intro'){p.position.y+=2.2*(1-smooth(t/.65));p.rotation.y+=(1-smooth(t/.65))*Math.PI*3;p.scale.y*=1+.18*hop;}
      else if(kind==='turn'){p.position.y+=.24*hop;p.rotation.z+=Math.sin(t*15+i)*.12*envelope;}
      else if(kind==='suspense'){p.position.y+=.15*Math.sin(clamp(t/.18)*Math.PI);p.rotation.x+=.18*envelope;p.rotation.z+=Math.sin(time*9)*.04*envelope;}
      else if(kind==='safe'){p.rotation.x-=.14*envelope;}
      else if(kind==='block'){p.rotation.z+=(i%2?1:-1)*.12*envelope;}
      else if(kind==='nearmiss'){p.scale.y*=1-.12*envelope;p.rotation.z+=.14*envelope;}
      else if(kind==='nomoves'){p.rotation.z+=Math.sin(t*12+i)*.18*envelope;p.scale.y*=1-.1*envelope;}
      else if(kind==='sleep'){p.rotation.x+=(.22+.05*Math.sin(time*2+i))*envelope;p.scale.y*=1-.08*envelope;}
      else if(kind==='podium'&&i<3){const target=new THREE.Vector3([0,-.6,.6][i],center.y+[.48,.32,.22][i],0),travel=smooth((t-i*.08)/.45);p.position.lerp(target,travel);p.position.y+=Math.sin(travel*Math.PI)*.9;p.rotation.y+=travel*Math.PI*2;}
      poseFace(p,time,['suspense','intro'].includes(kind)?'surprised':kind==='nomoves'?'sad':kind==='sleep'?'sleep':'happy');
    }
  }
  return {root,sample,dispose:()=>disposeModel(root)};
}
