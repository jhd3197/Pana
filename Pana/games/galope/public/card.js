import * as THREE from 'three';
import {loadAvatar} from '/engine/avatar.js';
import {createRider} from '/engine/models/fauna/farm/llanero-rider.js';
import { mountCard } from '/engine/card.js';

// Hub tile uses the same horse, tack and saved pana as the actual race.
export function mount(canvas){
  const camera=new THREE.PerspectiveCamera(33,1,.1,40);
  camera.position.set(4,2.8,5.3);camera.lookAt(0,1.25,0);
  return mountCard(canvas,{camera,build(scene){
    scene.add(new THREE.HemisphereLight(0xfff1ce,0x69884f,2.4));const sun=new THREE.DirectionalLight(0xffd995,2);sun.position.set(-3,7,4);scene.add(sun);
    const rider=createRider(loadAvatar(),'palomino');scene.add(rider.group);
    const ground=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.2,.12,40),new THREE.MeshStandardMaterial({color:0x81995c}));ground.position.y=-.08;scene.add(ground);
    return{
      update(dt,t,now){rider.group.rotation.y=-.5+Math.sin(now*.0003)*.35;rider.update(dt,{speed:7,jumpY:0});},
      dispose(){rider.dispose();ground.geometry.dispose();ground.material.dispose();},
    };
  }});
}
