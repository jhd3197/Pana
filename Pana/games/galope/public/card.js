import * as THREE from 'three';
import {loadAvatar} from '/engine/avatar.js';
import {createRider} from '/engine/models/fauna/farm/llanero-rider.js';
import { pixelRatio } from '/engine/settings.js';

// Hub tile uses the same horse, tack and saved pana as the actual race.
export function mount(canvas){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});renderer.setPixelRatio(pixelRatio(1.5));
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(33,1,.1,40);
  camera.position.set(4,2.8,5.3);camera.lookAt(0,1.25,0);
  scene.add(new THREE.HemisphereLight(0xfff1ce,0x69884f,2.4));const sun=new THREE.DirectionalLight(0xffd995,2);sun.position.set(-3,7,4);scene.add(sun);
  const rider=createRider(loadAvatar(),'palomino');scene.add(rider.group);
  const ground=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.2,.12,40),new THREE.MeshStandardMaterial({color:0x81995c}));ground.position.y=-.08;scene.add(ground);
  let previous=performance.now(),stopped=false;
  function frame(now){if(stopped)return;const dt=Math.min(.05,(now-previous)/1000);previous=now;const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();rider.group.rotation.y=-.5+Math.sin(now*.0003)*.35;rider.update(dt,{speed:7,jumpY:0});renderer.render(scene,camera);}requestAnimationFrame(frame);}requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{stopped=true;rider.dispose();ground.geometry.dispose();ground.material.dispose();renderer.dispose();},{once:true});
}
