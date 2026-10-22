import * as THREE from 'three';
import { studioEnvironment } from './garage-stage.js';

// Borrow the actual car hierarchy and its saved pana. No extra WebGL context,
// animation loop or model geometry survives this synchronous snapshot.
export function racerPortrait(renderer, car) {
  const scene=new THREE.Scene(),root=car.root.clone(true);
  root.position.set(0,0,0);root.rotation.set(0,0,0);scene.add(root);
  scene.environment=studioEnvironment(renderer);   // the garage's studio reflections
  scene.add(new THREE.HemisphereLight(0xffffff,0x8799ae,2.5));
  const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(4,9,8);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(37,4/3,.1,80);
  camera.position.set(8,4.5,10);camera.lookAt(0,1.5,0);
  const target=new THREE.WebGLRenderTarget(256,192),previous=renderer.getRenderTarget();
  const color=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  try{
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.clear();renderer.render(scene,camera);
    const pixels=new Uint8Array(256*192*4);renderer.readRenderTargetPixels(target,0,0,256,192,pixels);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=192;
    const context=canvas.getContext('2d'),data=context.createImageData(256,192);
    for(let y=0;y<192;y++)data.data.set(pixels.subarray(y*1024,(y+1)*1024),(191-y)*1024);
    context.putImageData(data,0,0);return canvas.toDataURL('image/png');
  }finally{
    renderer.setRenderTarget(previous);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(color,alpha);target.dispose();scene.clear();
  }
}
