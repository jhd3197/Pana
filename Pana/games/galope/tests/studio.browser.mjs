// Focused real Studio preview/tour and mounted-skin regression for Galope.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true});await mkdir('art/galope',{recursive:true});
try{
  const p=await browser.newPage({viewport:{width:1100,height:780}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:8461/studio/settings.html');
  await p.setContent(`<html><head><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:16px sans-serif}#preview{display:block}header{padding:16px}</style></head><body><header>Pana Studio · Galope · La vuelta del estero</header><div id="studio-app"><div><canvas id="preview" tabindex="0"></canvas></div><div id="track-tour"><button id="tour-play"></button><input id="tour-progress" type="range" min="0" max="1000"><span id="tour-time"></span><span id="tour-position"></span><span id="tour-state"></span><button id="tour-overview"></button><button id="tour-copy"></button><button id="tour-expand"></button><select id="tour-speed"><option value="1">1</option></select></div><button id="rotate"></button></div></body></html>`);
  const proof=await p.evaluate(async()=>{
    const THREE=await import('three'),{OrbitControls}=await import('three/addons/controls/OrbitControls.js');
    const {ASSETS}=await import('/studio/catalog.js'),{createPreview,ownMaterials,fitCamera,release}=await import('/studio/preview.js');
    const {createTrackTour,tourPose}=await import('/studio/track-tour.js');
    const asset=ASSETS.find(a=>a.id==='galope'),model=await asset.build(),stage=createPreview(document.querySelector('canvas'),true);
    const check=(value,text)=>{if(!value)throw Error(text);};
    ownMaterials(model);model.update(0);stage.scene.add(model.group);stage.renderer.setSize(1100,690,false);stage.camera.aspect=1100/690;
    const overview=()=>fitCamera(stage.camera,model.bounds,true),controls=new OrbitControls(stage.camera,stage.renderer.domElement);
    overview();let copied='';
    const tour=createTrackTour({...stage,canvas:stage.renderer.domElement,controls,overview,copy:async text=>{copied=text;return true;},animate:t=>model.update(t),invalidate:()=>stage.renderer.render(stage.scene,stage.camera)});
    tour.setTrack(model.route,asset);check(!tour.playing&&!tour.active,'tour autostarted');
    let previous=null;
    for(let s=0;s<model.route.TOTAL;s+=1){const v=tourPose(model.route,s);check([...v.position,...v.target].every(Number.isFinite),'invalid tour pose');check(v.position.y-model.groundAt(v.position.x,v.position.z)>2.9,'camera below trail');if(previous)check(v.position.distanceTo(previous)<1.1,'camera route discontinuity');previous=v.position;}
    check(tourPose(model.route,0).position.distanceTo(tourPose(model.route,model.route.TOTAL).position)<1e-6,'lap seam');
    document.querySelector('#tour-play').click();tour.step(.1);check(tour.distance>0,'tour did not advance');document.querySelector('#tour-play').click();const stopped=tour.distance;tour.step(.1);check(tour.distance===stopped,'pause moved');
    const range=document.querySelector('#tour-progress');range.value=250;range.dispatchEvent(new Event('input'));check(Math.abs(tour.distance-model.route.TOTAL*.25)<.01,'scrub');
    await document.querySelector('#tour-copy').onclick();check(copied.includes('#galope')&&copied.includes('25.0 %'),'copy point');
    document.querySelector('#tour-overview').click();check(!tour.active&&stage.camera.fov===34,'overview did not restore');
    const {llaneroHorse}=await import('/engine/models/fauna/farm/llanero-horse.js');
    const horse=llaneroHorse({locomotion:true}),skin=horse.getObjectByName('AnimalSkin'),idle=llaneroHorse();
    check(skin.skeleton.bones.length===11,'mounted leg bones missing');check(idle.getObjectByName('AnimalSkin').skeleton.bones.length===3,'default grazing rig changed');
    const feet=[];for(let i=0;i<skin.geometry.attributes.position.count;i++)if(skin.geometry.attributes.position.getY(i)<.05)feet.push(i);
    horse.userData.gallop(0,12);const first=feet.map(i=>skin.getVertexPosition(i,new THREE.Vector3()).toArray());
    horse.userData.gallop(1.7,12);check(feet.some((i,k)=>skin.getVertexPosition(i,new THREE.Vector3()).distanceTo(new THREE.Vector3(...first[k]))>.25),'gallop does not move skinned feet');
    horse.userData.gallop(0,12);check(feet.every((i,k)=>skin.getVertexPosition(i,new THREE.Vector3()).distanceTo(new THREE.Vector3(...first[k]))<1e-7),'gallop is not deterministic');
    release({group:horse});release({group:idle});
    stage.renderer.render(stage.scene,stage.camera);window.qa={stage,model,release,tour};
    return {length:model.route.TOTAL,assets:model.group.userData.assetCounts};
  });
  await p.screenshot({path:'art/galope/studio-course.png'});
  await p.evaluate(()=>{qa.release(qa.model);qa.release(qa.model);qa.stage.dispose();});assert.deepEqual(errors,[]);
  console.log('PASS Studio map, tour/play/pause/scrub/copy/overview, skinned gallop, unchanged grazing rig, disposal',proof);
}finally{await browser.close();}
