// Native map/asset regression, with screenshots for the placement audit.
// npm start; PANA_PLAYWRIGHT_PATH may point to an existing Playwright package.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
const output='art/studio/map-rollout';await mkdir(output,{recursive:true});
const records=[];
try {
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0}canvas{display:block}</style><canvas></canvas>');
  await page.evaluate(async()=>{
    const THREE=await import('three'),preview=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js');
    const stage=preview.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1440,960,false);stage.camera.aspect=1.5;
    window.proof={THREE,preview,ASSETS,stage};
  });
  for(const id of process.env.PANA_ASSET_TEST_MAPS?.split(',')||['reef-fish','reef-fish-school','plaza','cocina','isla','track-estadio','track-desierto','track-llanos','track-chichi','track-selva','track-paramo','track-plaza','track-bululu']) {
    const record=await page.evaluate(async id=>{
      const {THREE,preview,ASSETS,stage}=proof,asset=ASSETS.find(a=>a.id===id),model=await asset.build();
      const check=(ok,message)=>{if(!ok)throw Error(`${id}: ${message}`);};
      proof.model=model;preview.ownMaterials(model);model.update?.(0,0);model.group.updateMatrixWorld(true);
      const details=[],counts={},schools=[];
      model.group.traverse(o=>{
        if(o.userData.assetCounts)for(const [key,value]of Object.entries(o.userData.assetCounts))counts[key]=(counts[key]||0)+value;
        if(o.userData.assetId) {
          const p=o.getWorldPosition(new THREE.Vector3()),s=o.getWorldScale(new THREE.Vector3());
          details.push({id:o.userData.assetId,position:p.toArray(),radius:o.userData.footprintRadius*Math.max(s.x,s.z)});
        }
        if(o.userData.assetId==='reef-fish-school')schools.push(o);
        if(o.geometry)for(const v of o.geometry.attributes.position.array)check(Number.isFinite(v),'non-finite geometry');
      });
      const expected={plaza:['plaza-clock-tower','park-bench','capybara-topiary'],cocina:['plaza-clock-tower','park-bench'],
        'track-estadio':['trophy-monument','basketball-hoop','rooftop-water-tank'],
        'track-plaza':['bus-stop-shelter','plaza-clock-tower'],
        'track-selva':['stone-totem','vine-arch','hollow-log'],
        'track-paramo':['cable-car-station','rocky-cliff'],
        'track-bululu':['reef-fish-school','beachShade','beachHut','souvenir-kiosk'],isla:['reef-fish-school']}[id]||[];
      for(const kind of expected)check(details.some(d=>d.id===kind),`missing placement ${kind}`);
      if(id==='track-llanos')check(counts['hato-cow']===8&&counts['llanero-horse']===3&&counts['yard-chicken']===8,'farm counts');
      if(id==='track-desierto'||id==='track-llanos')check(Object.keys(counts).length>=10,'incomplete regional pack');
      if(id.startsWith('track-')) {
        const {TRACKS,makeTrack}=await import('/g/derrape/tracks.js'),T=makeTrack(TRACKS.find(t=>`track-${t.id}`===id));
        for(const d of details)check(Math.abs(T.offsetOf(d.position[0],d.position[2]))>T.HW+d.radius+1.5,`${d.id} intrudes into the driving corridor`);
      }
      if(id==='plaza'||id==='cocina')for(const d of details)check(Math.abs(d.position[0])-d.radius>=22||Math.abs(d.position[2])-d.radius>=19,`${d.id} enters player movement bounds`);
      if(id==='track-selva') {
        const plants=model.group.getObjectByName('track-environment').userData.jungle.plants;
        for(const kind of ['jungleGiant','tropicalBush']){counts[kind]=plants.filter(p=>p.kind===kind).length;check(counts[kind]>0,`missing ${kind}`);}
      }
      // School motion must scrub exactly and remain inside its declared envelope.
      const pose=()=>schools.flatMap(s=>s.children.flatMap(f=>[...f.position.toArray(),f.rotation.y,f.children[1].rotation.y]));
      const start=pose();
      for(let t=0;t<=90;t+=3){model.update?.(t,0);schools.forEach(s=>s.children.forEach(f=>{
        check(Math.hypot(f.position.x,f.position.z)+.65<=s.userData.footprintRadius&&Math.abs(f.position.y)<.3,'fish escapes school bounds');
        if(model.groundAt&&s.userData.waterY!==undefined) {
          const p=f.getWorldPosition(new THREE.Vector3());
          check(p.y-.4>model.groundAt(p.x,p.z),'fish enters the seabed');
          check(p.y+.4<s.userData.waterY-.44,'fish breaks through the lowest wave');
        }
      }));}
      model.update?.(0,0);check(JSON.stringify(pose())===JSON.stringify(start),'fish animation accumulates state');
      stage.scene.add(model.group);const info=preview.inspect(model);preview.fitCamera(stage.camera,info.frameBounds);stage.camera.far=5000;stage.camera.updateProjectionMatrix();
      stage.renderer.render(stage.scene,stage.camera);
      return {id,counts,details,...info.stats};
    },id);
    records.push(record);console.log(JSON.stringify(record));
    await page.screenshot({path:`${output}/${id}.png`});
    // A close view establishes that fish are visible through the real ocean.
    if(['isla','track-bululu'].includes(id)) {
      await page.evaluate(()=>{
        const {THREE,stage,model}=proof;let school;model.group.traverse(o=>{if(o.userData.assetId==='reef-fish-school')school=o;});
        const p=school.getWorldPosition(new THREE.Vector3());stage.camera.position.copy(p).add(new THREE.Vector3(5,8,7));stage.camera.lookAt(p);stage.renderer.render(stage.scene,stage.camera);
      });
      await page.screenshot({path:`${output}/${id}-fish.png`});
    }
    await page.evaluate(()=>{proof.preview.release(proof.model);proof.model=null;});
  }
  assert.deepEqual(errors,[]);await writeFile(`${output}/coverage.json`,JSON.stringify(records,null,2));
} finally {await browser.close();}
