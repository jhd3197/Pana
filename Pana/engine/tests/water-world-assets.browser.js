import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {MODEL_DEFINITIONS} from '../models/catalog.js';
// The pack's members come from the shared catalog: a new water-world model needs no edit here.
const expected=MODEL_DEFINITIONS.filter(m=>m.pack==='water-worlds').map(m=>m.id);
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:720,height:560}}),errors=[];
page.on('pageerror',e=>errors.push(String(e)));
try{
  await mkdir('art/water-worlds/models',{recursive:true});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<style>body{margin:0;background:#22333c}</style><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  const ids=await page.evaluate(async()=>{
    const THREE=await import('three');window.__T=THREE;window.__renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});__renderer.setSize(720,560);document.body.appendChild(__renderer.domElement);
    window.__assets=(await import('/studio/catalog.js')).ASSETS.filter(a=>a.pack==='water-worlds');return __assets.map(a=>a.id);
  });
  assert.ok(expected.length>0,'water-worlds pack is empty');assert.deepEqual([...ids].sort(),[...expected].sort(),'Studio water-worlds pack matches the shared catalog');const proof=[];
  for(const id of ids){
    const result=await page.evaluate(async id=>{
      const THREE=__T,asset=__assets.find(a=>a.id===id),model=await asset.build().catch(e=>{throw Error(`${id} failed to build: ${e.message}`);}),scene=new THREE.Scene();scene.background=new THREE.Color(0x22333c);scene.add(model.group);
      scene.add(new THREE.HemisphereLight(0xf5f7ef,0x92947f,2));const sun=new THREE.DirectionalLight(0xffeed3,3);sun.position.set(10,30,20);scene.add(sun);
      const bounds=model.bounds||new THREE.Box3().setFromObject(model.group),center=bounds.getCenter(new THREE.Vector3()),radius=bounds.getSize(new THREE.Vector3()).length()*.65;
      const camera=new THREE.PerspectiveCamera(40,720/560,.1,2000);camera.position.copy(center).add(new THREE.Vector3(radius*.65,radius*.35,radius*1.6));camera.lookAt(center);
      model.update?.(0,0);__renderer.render(scene,camera);const first=__renderer.domElement.toDataURL();
      model.update?.(17,0);__renderer.render(scene,camera);const moved=__renderer.domElement.toDataURL();
      model.update?.(0,0);__renderer.render(scene,camera);const replay=__renderer.domElement.toDataURL();
      const result={id,finite:bounds.min.toArray().concat(bounds.max.toArray()).every(Number.isFinite),reversible:first===replay,animated:first!==moved,draws:__renderer.info.render.calls};
      if(id==='waterfall-curtain'){
        const mist=model.group.getObjectByName('waterfall-impact-mist'),curtain=model.group.getObjectByName('falling-curtain');
        result.particles=mist.count;model.group.userData.setReduced(true);result.reduced=mist.count;
        // Studio inspection replaces live materials; absolute updates must follow them.
        const original=curtain.material;curtain.material=original.clone();model.update(6,0);result.liveMaterialTime=curtain.material.uniforms.time.value;curtain.material.dispose();curtain.material=original;
        const owned=new Set();model.group.traverse(o=>{if(o.geometry)owned.add(o.geometry);for(const m of [].concat(o.material||[]))owned.add(m);});
        let disposals=0;for(const resource of owned)resource.addEventListener('dispose',()=>disposals++);
        model.group.userData.dispose();const once=disposals;model.group.userData.dispose();result.disposal={expected:owned.size,once,twice:disposals};
      }
      window.__preview={scene,camera,model};return result;
    },id);
    assert.ok(result.finite&&result.reversible);
    if(id==='waterfall-curtain'){assert.ok(result.animated);assert.equal(result.particles,36);assert.equal(result.reduced,12);assert.equal(result.draws,3);assert.equal(result.liveMaterialTime,6);assert.equal(result.disposal.once,result.disposal.expected);assert.equal(result.disposal.twice,result.disposal.once);}
    await page.screenshot({path:`art/water-worlds/models/${id}.png`});proof.push(result);
    await page.evaluate(()=>{const callbacks=[],geometries=new Set();__preview.model.group.traverse(o=>{if(o.userData.dispose)callbacks.push(o.userData.dispose);if(o.geometry)geometries.add(o.geometry);});callbacks.forEach(f=>f());geometries.forEach(g=>g.dispose());__preview.scene.clear();__preview=null;});
  }
  assert.deepEqual(errors,[]);await writeFile('art/water-worlds/models/proof.json',JSON.stringify(proof,null,2));console.log(`${proof.length} water-world Studio models: rendering, absolute time, reduced effects and disposal passed`);
}finally{await browser.close();}
