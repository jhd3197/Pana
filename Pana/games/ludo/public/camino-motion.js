import * as THREE from 'three';
import { disposeModel } from '/engine/models/props/game-table.js';
import { createMotionProps } from './motion-props.js';
import { poseFace } from './studio-finish.js';
import { CAMINO } from './motion-choice.js';

const clamp = v => Math.max(0,Math.min(1,v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
const arc = v => Math.sin(clamp(v)*Math.PI);

// Adapt the authored Studio poses to the actual rule path (including corners,
// lane entry and crowded endpoints). No action here changes a logical cell.
export function createCaminoMotion(root, pawn, path, style, color, partner=null) {
  const props=createMotionProps(style,color);root.add(props);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const ctx=canvas.getContext('2d'),words=['¡Chócala!','¡Cambur!','¡A rodar!','¡Estilo!','¡BOING!','¡Matrix!','¡Arre!','¡Wiii!','¡Atajo!','¡Chicle!'];
  ctx.font='900 66px Nunito, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.lineWidth=12;ctx.strokeStyle='#2b2030';ctx.strokeText(words[CAMINO.indexOf(style)]||'¡Hop!',256,64);
  ctx.fillStyle=style==='gum'?'#ff8fc8':'#fff1ae';ctx.fillText(words[CAMINO.indexOf(style)]||'¡Hop!',256,64);
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
  const label=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false}));label.scale.set(1.3,.325,1);root.add(label);
  const end=path.length-1,base=path[0].y,at=new THREE.Vector3(),tangent=new THREE.Vector3();
  const partnerPose=partner?{position:partner.position.clone(),rotation:partner.rotation.clone(),scale:partner.scale.clone()}:null;
  let disposed=false;
  function point(t,out=at){const n=clamp(t)*end,i=Math.min(end-1,Math.floor(n));return out.lerpVectors(path[i],path[i+1],n-i);}
  function yaw(t){const i=Math.min(end-1,Math.floor(clamp(t)*end));tangent.subVectors(path[i+1],path[i]);return Math.atan2(tangent.x,tangent.z);}
  const pivot=path[Math.max(1,Math.floor(end*.4))].clone();
  function resetPartner(){if(partner){partner.position.copy(partnerPose.position);partner.rotation.copy(partnerPose.rotation);partner.scale.copy(partnerPose.scale);}}
  function sample(t,time=0,size=1){
    if(disposed)return;
    t=clamp(t);resetPartner();pawn.visible=true;pawn.scale.setScalar(size);pawn.rotation.set(0,yaw(t),0);
    point(t);pawn.position.copy(at);props.visible=false;
    label.visible=t>.18&&t<.82;
    let mood='happy';
    if(style==='moonwalk') {
      pawn.rotation.set(-.12,yaw(t)+Math.PI*smooth(t/.12),Math.sin(t*Math.PI*12)*.12*arc(t));
      pawn.position.y+=Math.abs(Math.sin(t*Math.PI*12))*.012;
    } else if(style==='rollbarrel') {
      // The tilt envelope returns upright at both ends.
      const envelope=Math.min(smooth(t/.15),smooth((1-t)/.15));
      pawn.rotation.set(t*Math.PI*end*2*envelope,yaw(t),-Math.PI/2*envelope);
      pawn.position.y+=.12*envelope; mood='surprised';
    } else if(style==='umbrella') {
      const travel=smooth((t-.22)/.68);point(travel);pawn.position.copy(at);
      pawn.position.y+=t<.22?1.45*smooth(t/.22):1.45*(1-smooth((t-.22)/.78));
      pawn.rotation.z=Math.sin(t*18)*.15*arc(t);props.visible=t>.2&&t<.98;
      props.position.copy(pawn.position);props.userData.canopy.scale.setScalar(Math.min(smooth((t-.2)/.1),smooth((1-t)/.1)));
    } else if(style==='spring') {
      props.position.copy(path[0]);props.visible=t<.55;
      const compression=t<.22?1-.7*smooth(t/.22):1+arc((t-.22)/.33)*1.2;
      props.scale.y=compression;
      if(t<.22){pawn.position.copy(path[0]);pawn.position.y+=.3*compression*smooth(t/.08);pawn.scale.y*=1-.3*smooth(t/.22);}
      else{const f=clamp((t-.22)/.78);point(smooth(f));pawn.position.copy(at);pawn.position.y+=.09*(1-f)+1.5*arc(f);pawn.rotation.x=Math.PI*4*smooth(f);}
      mood='surprised';
    } else if(style==='tunnel') {
      props.visible=t>.08&&t<.98;props.position.set(0,base-.015,0);
      for(let i=0;i<2;i++){const p=i?path[end]:path[0];props.children[i].position.set(p.x,0,p.z);}
      props.userData.mound.position.set(at.x,.02,at.z);props.userData.mound.visible=t>.2&&t<.78;
      if(t<.2){pawn.position.copy(path[0]);pawn.position.y-=.65*smooth(t/.2);pawn.rotation.y+=t*40;}
      else if(t<.78)pawn.visible=false;
      else{const f=(t-.78)/.22;pawn.position.copy(path[end]);pawn.position.y+=f<.35?-.65+.65*smooth(f/.35):.4*arc((f-.35)/.65);pawn.rotation.y+=Math.PI*2*smooth(f);}
    } else if(style==='gum') {
      props.visible=t>.15&&t<.95;props.position.copy(pivot);
      if(t<.25){point(t/.25*.4);pawn.position.copy(at);}
      else if(t<.65){
        const pull=(t-.25)/.4,stretch=Math.abs(Math.sin(pull*Math.PI*3))*(.08+.25*pull);
        tangent.subVectors(path[end],pivot).normalize();pawn.position.copy(pivot).addScaledVector(tangent,stretch);pawn.rotation.x=.45*stretch/.33;
      }else{const f=(t-.65)/.35;pawn.position.lerpVectors(pivot,path[end],smooth(f));pawn.position.y+=.8*arc(f);pawn.rotation.x=Math.PI*4*smooth(f);}
      const strand=props.userData.strand,delta=pawn.position.clone().sub(pivot);strand.visible=t>=.25&&t<.65;
      strand.position.copy(delta).multiplyScalar(.5);strand.scale.y=Math.max(.001,delta.length());
      if(delta.lengthSq()>0)strand.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
      mood='surprised';
    } else if(style==='slip') {
      props.visible=t<.75;props.position.copy(pivot);props.rotation.y=t>.3?(t-.3)*10:0;
      const f=clamp((t-.28)/.4),tilt=arc(f);
      pawn.rotation.set(-1.45*tilt,yaw(t)+Math.PI*2*smooth(f),0);pawn.position.y+=.18*arc(t*end);mood='surprised';
    } else {
      pawn.position.y+=.32*Math.abs(Math.sin(t*end*Math.PI));
      if(style==='highfive'&&partner){
        const f=arc((t-.2)/.5);partner.position.y+=.3*f;pawn.position.y+=.25*f;
        partner.rotation.z=-.2*f;pawn.rotation.z=.2*f;
      }else if(style==='dodge'&&partner){
        const f=arc((t-.25)/.5);pawn.rotation.x=-1.05*f;
        partner.position.lerp(pawn.position,.45*f);partner.position.y+=.45*f;partner.rotation.x=1.2*f;mood='surprised';
      }else if(style==='piggy'&&partner){
        const lift=Math.min(smooth(t/.2),smooth((1-t)/.2));
        partner.position.lerp(pawn.position,lift);pawn.position.y+=.42*lift;
        partner.scale.y*=1-.1*lift;partner.rotation.y=yaw(t);
      }
      if(partner)poseFace(partner,time,style==='piggy'?'surprised':'happy');
    }
    poseFace(pawn,time,mood);
    label.position.copy(pawn.position);label.position.y+=style==='umbrella'?1.3:.85;
    if(t===1){pawn.visible=true;pawn.position.copy(path[end]);pawn.rotation.set(0,yaw(1),0);pawn.scale.setScalar(size);props.visible=false;resetPartner();}
  }
  function dispose(){if(disposed)return;disposed=true;resetPartner();pawn.visible=true;pawn.rotation.set(0,0,0);disposeModel(props);disposeModel(label);}
  return {style,partner,sample,dispose};
}
