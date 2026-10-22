// Real map factories: world continuity and views from the racing route.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true});
const baseline=process.env.PANA_SURROUNDINGS_BASELINE==='1';
const out=`art/surroundings/${baseline?'before':'after'}`;await mkdir(out,{recursive:true});
const errors=[],results=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas></canvas><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  await page.evaluate(async()=>{
    const THREE=await import('three'),{TRACKS,makeTrack,loadTracks}=await import('/g/carreritas/tracks.js'),{createSky}=await import('/engine/worlds/sky.js');await loadTracks();
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1280,800);renderer.toneMapping=THREE.ACESFilmicToneMapping;
    Object.assign(window,{THREE,TRACKS,makeTrack,createSky,renderer});
  });
  for(const id of (process.env.PANA_MAP_TEST_TRACKS||'plaza,llanos,estadio,desierto,paramo,chichi,selva,bululu').split(',')) {
    const result=await page.evaluate(id=>{
      const def=TRACKS.find(d=>d.id===id),T=makeTrack(def),scene=new THREE.Scene(),p=def.palette;
      const sky=createSky(p);scene.add(T.build(),sky.mesh,new THREE.HemisphereLight(p.hemiSky,p.hemiGround,p.hemiInt));
      const sun=new THREE.DirectionalLight(p.sun,p.sunInt);sun.position.set(-180,300,120);scene.add(sun);sky.update(32);
      T.animated.forEach(o=>o.userData.tick?.(32,0));
      const camera=new THREE.PerspectiveCamera(58,1280/800,.2,10000);
      scene.updateMatrixWorld(true);
      const continuations=[];scene.traverse(o=>{if(o.userData.worldContinuation)continuations.push(o);});
      let seamError=0,missingGround=0,outerHeightError=0;
      for(const o of continuations) {
        const {edgeIndices,bands}=o.userData.worldContinuation,src=o.parent.geometry.attributes.position,p=o.geometry.attributes.position;
        edgeIndices.forEach((index,i)=>{seamError=Math.max(seamError,new THREE.Vector3().fromBufferAttribute(src,index).distanceTo(new THREE.Vector3().fromBufferAttribute(p,i)));});
        const n=edgeIndices.length,ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
        for(let band=1;band<bands;band++)for(let i=0;i<n;i+=23){
          const a=new THREE.Vector3().fromBufferAttribute(p,band*n+i),b=new THREE.Vector3().fromBufferAttribute(p,(band-1)*n+(i+1)%n);
          const midpoint=a.add(b).multiplyScalar(.5);ray.ray.origin.set(midpoint.x,2000,midpoint.z);
          const hit=ray.intersectObject(o,false)[0];
          if(!hit)missingGround++;else outerHeightError=Math.max(outerHeightError,Math.abs(hit.point.y-T.terrainAt(midpoint.x,midpoint.z)));
        }
      }
      let waterBoundaryDepth=null;
      const river=T.group.getObjectByName('llanos-cano');
      if(river){
        river.geometry.computeBoundingBox();const bounds=river.geometry.boundingBox,p=river.geometry.attributes.position,d=river.geometry.attributes.waterDepth;
        waterBoundaryDepth=-Infinity;
        for(let i=0;i<p.count;i++)if(p.getX(i)===bounds.min.x||p.getX(i)===bounds.max.x||p.getZ(i)===bounds.min.z||p.getZ(i)===bounds.max.z)waterBoundaryDepth=Math.max(waterBoundaryDepth,d.getX(i));
      }
      Object.assign(window,{T,scene,sky,camera});
      return {id,continuations:continuations.length,seamError,missingGround,outerHeightError,waterBoundaryDepth,grounds:T.group.getObjectByName('track-environment').userData.surroundings||null};
    },id);
    if(!baseline){assert.equal(result.continuations,1,id+' continuous outer terrain');assert.ok(result.seamError<.0001,id+' matched terrain seam');assert.equal(result.missingGround,0,id+' outward ground coverage');}
    if(!baseline)assert.ok(result.outerHeightError<.001,id+' placement height follows the outer triangles');
    if(!baseline&&id==='llanos')assert.ok(result.waterBoundaryDepth<=0,'river closes against its actual banks before the water grid ends');
    if(!baseline&&['plaza','llanos','estadio'].includes(id))assert.ok(result.grounds.trees>100,id+' has planted surroundings');
    await page.evaluate(()=>{
      const bounds=T.def.previewBounds||[[-400,0,-400],[400,60,400]],cx=(bounds[0][0]+bounds[1][0])/2,cz=(bounds[0][2]+bounds[1][2])/2;
      const size=Math.max(bounds[1][0]-bounds[0][0],bounds[1][2]-bounds[0][2]);
      scene.fog=null;camera.near=1;camera.updateProjectionMatrix();camera.position.set(cx+size*.55,size*.70,cz+size*.63);camera.lookAt(cx,0,cz);renderer.render(scene,camera);
    });
    await page.screenshot({path:`${out}/${id}-overview.png`});
    for(const [name,u,side] of [['start',.03,0],['middle',.42,0],['outward',.72,1]]) {
      const stats=await page.evaluate(({u,side})=>{
        const s=T.TOTAL*u,p=T.pointAt(s),q=T.pointAt(s+35),d=q.clone().sub(p).normalize(),y=T.heightAtS(s);
        camera.position.set(p.x-d.x*7,y+5,p.y-d.y*7);
        camera.near=.2;camera.updateProjectionMatrix();
        camera.lookAt(side?p.x+d.y*65:q.x,y+4,side?p.y-d.x*65:q.y);
        scene.fog=new THREE.Fog(T.def.palette.horizon,...T.def.palette.fog);renderer.render(scene,camera);
        return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
      },{u,side});
      await page.screenshot({path:`${out}/${id}-${name}.png`});result[name]=stats;
      // Plaza's start view was 3.49 M before the festive roadside (+45 k).
      // Selva doubled in length on purpose (jaguar cave, plateau): its middle and outward
      // views measure 3.86-3.90 M, so it gets its own cap with similar headroom.
      const triangleCap=id==='selva'?4000000:3600000;
      if(!baseline){assert.ok(stats.calls<900,id+' bounded draw submissions');assert.ok(stats.triangles<triangleCap,id+' bounded driving-view geometry');}
    }
    results.push(result);console.log(JSON.stringify(result));
    await page.evaluate(()=>{
      const disposers=[];scene.traverse(o=>{if(o.userData.dispose)disposers.push(o.userData.dispose);});disposers.forEach(f=>f());
      const geos=new Set(),mats=new Set();scene.traverse(o=>{if(o.geometry)geos.add(o.geometry);if(o.material)for(const m of [].concat(o.material))mats.add(m);});
      geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());scene.clear();renderer.renderLists.dispose();
    });
  }
  assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify(results,null,2));
  console.log(`PASS ${baseline?'baseline capture':'world continuity'}: ${results.length} circuits`);
}finally{await browser.close();}
