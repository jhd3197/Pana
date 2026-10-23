// Real WebGL renders, deterministic wind/clouds, house clearance and tour lifecycle.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true});
const output='art/living-world';await mkdir(output,{recursive:true});
const errors=[];
try {
  const page=await browser.newPage({viewport:{width:1280,height:760},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas id="world"></canvas><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"}}</script>');
  const result=await page.evaluate(async()=>{
    const THREE=await import('three'),{createPlaza}=await import('/engine/worlds/plaza.js'),{house}=await import('/engine/models/props/plaza-buildings.js');
    const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1280,760);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    const camera=new THREE.PerspectiveCamera(60,1280/760,.1,1500),plaza=createPlaza();
    camera.position.set(0,3.3,32);camera.lookAt(0,7,-18);
    const check=(b,m)=>{if(!b)throw Error(m);};
    const flags=plaza.scene.getObjectByName('Wind in the plaza bunting');
    plaza.update(12);const a=Array.from(flags.geometry.attributes.position.array);
    plaza.update(20);const b=Array.from(flags.geometry.attributes.position.array);
    plaza.update(12);check(JSON.stringify(a)===JSON.stringify(Array.from(flags.geometry.attributes.position.array)),'wind must rewind');
    check(a.some((n,i)=>n!==b[i]),'cloth must move');
    for(let i=0;i<a.length/3;i+=5)for(const j of [i,i+1])check(a[j*3+2]===b[j*3+2],'cable attachment must stay fixed');
    const houses=[];
    for(const style of ['tejas','balcon','tienda','terraza']) {
      const model=house({style,w:7,h:7.8,seed:9}),bounds=new THREE.Box3().setFromObject(model);
      // Street houses come from the colonial house maker (Oct 2026): its eaves, porch steps and
      // lanterns pass the 7 x 5.4 shell, so clearance is the maker's documented placement envelope.
      const spec=model.userData.houseSpec,env=spec&&new THREE.Box3(new THREE.Vector3(...spec.envelope.min),new THREE.Vector3(...spec.envelope.max));
      check(Math.abs(bounds.min.y)<.02,'house origin');check(spec?.footprint.width===7&&spec.footprint.depth===5.4,'house footprint');
      check(bounds.max.z<=env.max.z&&bounds.min.z>=env.min.z,'house depth clearance');
      check(bounds.max.x<=env.max.x&&bounds.min.x>=env.min.x,'house width clearance');
      houses.push({style,size:bounds.getSize(new THREE.Vector3()).toArray()});
      const geometry=new Set();model.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});geometry.forEach(g=>g.dispose());
    }
    plaza.update(12);renderer.render(plaza.scene,camera);
    Object.assign(window,{THREE,renderer,camera,plaza,house});
    return {houses,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
  });
  await page.screenshot({path:`${output}/plaza-street.png`});
  await page.evaluate(()=>{camera.position.set(-1,5,-7);camera.lookAt(0,5.5,-23);renderer.render(plaza.scene,camera);});
  await page.screenshot({path:`${output}/plaza-facades.png`});
  await page.evaluate(async()=>{
    const {createSky}=await import('/engine/worlds/sky.js');
    window.skyScene=new THREE.Scene();window.sky=createSky();skyScene.add(sky.mesh);
    camera.position.set(0,0,0);camera.lookAt(0,.35,-1);sky.update(12);renderer.render(skyScene,camera);
    window.skyFirst=renderer.domElement.toDataURL();
  });
  await page.screenshot({path:`${output}/sky.png`});
  const skyChecks=await page.evaluate(()=>{
    sky.update(72);renderer.render(skyScene,camera);const moved=renderer.domElement.toDataURL()!==skyFirst;
    sky.update(12);camera.position.set(9000,3000,-8000);camera.lookAt(9000,3000.35,-8001);renderer.render(skyScene,camera);
    const translated=renderer.domElement.toDataURL()===skyFirst;
    camera.position.set(0,0,0);camera.lookAt(0,.35,-1);sky.update(12);renderer.render(skyScene,camera);
    return {moved,rewound:renderer.domElement.toDataURL()===skyFirst,translated};
  });
  assert.ok(skyChecks.moved);assert.ok(skyChecks.rewound);assert.ok(skyChecks.translated);
  const cloneCheck=await page.evaluate(async()=>{
    const {ownMaterials}=await import('/studio/preview.js');ownMaterials({group:skyScene});
    sky.update(27,.2);return sky.mesh.material.uniforms.time.value===27&&sky.mesh.material.uniforms.daylight.value===.2;
  });
  assert.ok(cloneCheck,'Studio material ownership must preserve animation');
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/galope/?debug&manual`);
  await page.waitForFunction(()=>window.galope?.world.sky,{},{timeout:90000});
  await page.screenshot({path:`${output}/galope.png`});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${output}/galope-mobile.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.setViewportSize({width:1280,height:760});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/bululu/?debug&sky=night`);
  await page.waitForFunction(()=>window.board?.atmosphere,{},{timeout:90000});
  const islandSky=async name=>{
    const data=await page.evaluate(async()=>{
      const THREE=await import('three'),view=new THREE.PerspectiveCamera(62,1280/760,.1,1800);
      view.position.set(0,28,175);view.lookAt(0,50,-180);renderer.render(boardScene,view);
      return renderer.domElement.toDataURL().split(',')[1];
    });
    await writeFile(`${output}/${name}.png`,Buffer.from(data,'base64'));
  };
  await islandSky('island-night');
  assert.ok(await page.evaluate(()=>board.atmosphere.daylight<.01));
  await page.evaluate(()=>{board.atmosphere.setMode('day');board.atmosphere.update(20,20);renderer.render(boardScene,boardCam);});
  await islandSky('island-day');
  assert.ok(await page.evaluate(()=>board.atmosphere.daylight>.99));
  assert.deepEqual(errors,[]);
  console.log('PASS living world:',JSON.stringify({...result,skyChecks}));
}finally{await browser.close();}
