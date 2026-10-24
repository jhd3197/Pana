// Rigid batching must preserve all eight cars, their animated pana and pivots.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),errors=[];
try {
  const page=await browser.newPage();page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&manual`);
  await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
  const results=await page.evaluate(async()=>{
    const THREE=await import('three'),{CARS}=await import('./cars.js'),{batchRacer}=await import('./racer-render.js');
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,.1,100);
    scene.background=new THREE.Color(0x303038);scene.add(new THREE.HemisphereLight(0xffffff,0x667788,2));
    const sun=new THREE.DirectionalLight(0xffffff,3);sun.position.set(8,12,10);scene.add(sun);
    camera.position.set(8,5,10);camera.lookAt(0,1.8,0);
    const target=new THREE.WebGLRenderTarget(320,320),results=[];
    const pixels=()=>{const data=new Uint8Array(320*320*4);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,320,320,data);renderer.setRenderTarget(null);return data;};
    const stats=root=>{let triangles=0,meshes=0;const bounds=new THREE.Box3().setFromObject(root,true);root.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});return {triangles,meshes,bounds:[...bounds.min,...bounds.max]};};
    for(const [i,def] of CARS.entries()){
      const car=def.build({name:'Pana',color:'#e63946'});
      scene.add(car.root);car.chassis.rotation.set(.08,0,-.06);car.wheels[0].steer.rotation.y=.3;
      car.wheels.forEach(w=>w.spin.rotation.x=.7);car.driver.head.rotation.y=.25;
      const refs=[car.root,car.chassis,car.tumble,car.driver.group,car.driver.head,car.driver.armL,...car.detachables,...car.danglers,...car.wheels.flatMap(w=>[w.steer,w.spin]),car.flag].filter(Boolean);
      const matrices=refs.map(o=>{o.updateMatrix();return o.matrix.toArray();});
      // Render first: the pana's skinned arms only take their pose (and bounds) once drawn.
      const a=pixels(),before=stats(car.root);batchRacer(car,def.color);const b=pixels(),after=stats(car.root);
      let difference=0,changed=0;for(let j=0;j<a.length;j+=4){let delta=0;for(let k=0;k<3;k++){delta+=Math.abs(a[j+k]-b[j+k]);difference+=Math.abs(a[j+k]-b[j+k]);}if(delta>12)changed++;}
      const attached=refs.every((o,j)=>{let p=o;while(p&&p!==car.root)p=p.parent;return p===car.root&&o.matrix.toArray().every((v,k)=>v===matrices[j][k]);});
      const detached=car.detachables[0];if(detached){scene.attach(detached);detached.rotation.x+=.4;renderer.render(scene,camera);detached.removeFromParent();}
      results.push({id:def.id,before,after,attached,meanChannelDifference:difference/(320*320*3),changedPixelFraction:changed/(320*320)});
      const geometries=new Set();car.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});detached?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
      car.driver.dispose();car.batchedMaterials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());car.root.removeFromParent();
    }
    target.dispose();return results;
  });
  await mkdir('art/grand-prix',{recursive:true});await writeFile('art/grand-prix/racer-batching.json',JSON.stringify(results,null,2));
  for(const r of results){
    assert.equal(r.before.triangles,r.after.triangles,`${r.id}: every triangle retained`);
    // Cars arrive with each chassis merged per material (car-kit batchStatic);
    // batching still gathers sibling parts under pivots (about 10 %), never adds.
    assert.ok(r.after.meshes<r.before.meshes,`${r.id}: batching removes draws`);
    assert.ok(r.before.bounds.every((v,i)=>Math.abs(v-r.after.bounds[i])<.00002),`${r.id}: identical bounds`);
    assert.ok(r.attached,`${r.id}: all animated references/pivots survive`);
    assert.ok(r.meanChannelDifference<.5&&r.changedPixelFraction<.01,`${r.id}: appearance unchanged: ${JSON.stringify(r)}`);
    console.log(`${r.id}: ${r.before.meshes} -> ${r.after.meshes} meshes; pixel delta ${r.meanChannelDifference.toFixed(4)}`);
  }
  assert.deepEqual(errors,[]);
} finally {await browser.close();}
