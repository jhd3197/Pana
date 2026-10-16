// Real models, real course, isolated Studio previews and riding-height captures.
// node Pana/games/galope/tests/landscape.browser.mjs [playwright-package]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.argv[2]||'playwright');
const browser=await chromium.launch({headless:true}),out='art/galope/landscape';
await mkdir(out,{recursive:true});
try{
  const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://localhost:8461/studio/settings.html');
  await p.setContent(`<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script><style>body{margin:0;background:#eef0ee;font:14px system-ui;color:#35423b}canvas{display:block}label{position:absolute;text-align:center;width:288px;pointer-events:none}</style><canvas></canvas><div id="labels"></div>`);
  const models=await p.evaluate(async()=>{
    const THREE=await import('three'),{ASSETS}=await import('/studio/catalog.js');
    const {createPreview,inspect,fitCamera,ownMaterials,release}=await import('/studio/preview.js');
    const assets=ASSETS.filter(a=>a.pack==='llano-life'||['moriche','savanna-grass'].includes(a.id));
    const stage=createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1440,1000,false);stage.renderer.setScissorTest(true);
    const check=(ok,text)=>{if(!ok)throw Error(text);};
    const hash=root=>{
      root.updateMatrixWorld(true);let h=2166136261;
      root.traverse(o=>{for(const a of Object.values(o.geometry?.attributes||{}))for(const v of a.array){check(Number.isFinite(v),'Nonfinite geometry');h=Math.imul(h^Math.round(v*10000),16777619);}for(const v of o.matrixWorld.elements)h=Math.imul(h^Math.round(v*10000),16777619);});return h;
    };
    const models=[],metrics=[];
    for(const [i,asset]of assets.entries()){
      const model=await asset.build(),twin=await asset.build(),geos=new Set();model.group.traverse(o=>o.geometry&&geos.add(o.geometry));
      twin.group.traverse(o=>check(!geos.has(o.geometry),`${asset.id} shares owned geometry`));check(hash(model.group)===hash(twin.group),`${asset.id} seed is not stable`);
      // Dispose only owned twin geometry, leaving cached materials intact.
      twin.group.traverse(o=>{o.geometry?.dispose();o.userData.dispose?.();});
      if(model.update){model.update(0);const before=hash(model.group);model.update(2);check(hash(model.group)!==before,`${asset.id} animation frozen`);model.update(0);check(hash(model.group)===before,`${asset.id} time accumulates`);}
      ownMaterials(model);const {bounds,stats}=inspect(model);check(bounds.min.y>-.06,`${asset.id} is underground`);check(stats.meshes<35&&stats.triangles<30000,`${asset.id} excessive geometry`);
      const x=i%5*288,y=1000-(Math.floor(i/5)+1)*333;stage.scene.add(model.group);stage.camera.aspect=288/300;fitCamera(stage.camera,bounds);stage.renderer.setViewport(x,y+30,288,300);stage.renderer.setScissor(x,y+30,288,300);stage.renderer.render(stage.scene,stage.camera);stage.scene.remove(model.group);
      const label=document.createElement('label');label.textContent=asset.name;label.style.left=`${x}px`;label.style.top=`${1000-y-25}px`;document.querySelector('#labels').append(label);
      metrics.push({id:asset.id,...stats});models.push(model);
    }
    // Usable openings: the caney remains open at rider height; the curiara has
    // an actual hollow interior rather than a solid boat-shaped block.
    const ray=(id,origin,dir,far)=>{const g=models[assets.findIndex(a=>a.id===id)].group;g.updateMatrixWorld(true);return new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...dir),0,far).intersectObject(g,true);};
    check(!ray('ranch-caney',[0,1.8,4],[0,0,-1],8).length,'Caney passage blocked');
    const canoe=ray('river-canoe',[0,2,0],[0,-1,0],3);check(canoe.length&&canoe[0].point.y<.2,'Canoe interior capped');
    window.proof={THREE,stage,models,assets,release,inspect,fitCamera};return metrics;
  });
  await p.screenshot({path:`${out}/asset-pack.png`});
  for(const id of ['moriche','ranch-caney','chinchorro','river-canoe','saddle-stand']){
    await p.evaluate(id=>{
      const {stage,models,assets,fitCamera,inspect}=proof;document.querySelector('#labels').hidden=true;
      stage.renderer.setScissorTest(false);stage.renderer.setSize(1440,1000,false);stage.renderer.setViewport(0,0,1440,1000);
      models.forEach(m=>stage.scene.remove(m.group));const model=models[assets.findIndex(a=>a.id===id)];stage.scene.add(model.group);stage.camera.aspect=1.44;fitCamera(stage.camera,inspect(model).bounds);stage.renderer.render(stage.scene,stage.camera);
    },id);await p.screenshot({path:`${out}/${id}.png`});
  }
  const world=await p.evaluate(async()=>{
    const {stage,models,release,THREE}=proof;models.forEach(release);stage.dispose();document.querySelector('canvas').replaceWith(document.createElement('canvas'));
    const {createRaceScene}=await import('/g/galope/scene.js'),course=await import('/g/galope/course.js');
    const w=createRaceScene(document.querySelector('canvas'));w.renderer.setSize(1440,1000,false);w.camera.aspect=1.44;w.camera.updateProjectionMatrix();w.course.update(4);
    const check=(v,t)=>{if(!v)throw Error(t);};
    for(const placement of w.course.group.userData.placements)check(course.nearest(placement.x,placement.z).distance>=9+placement.radius,`Blocked recovery corridor: ${placement.id}`);
    for(const a of proof.assets)check(w.course.group.userData.assetCounts[a.id]>0,`Studio-only asset: ${a.id}`);
    const land=w.course.group.getObjectByName('Wadeable savanna'),water=w.course.group.getObjectByName('Laguna and winding caño');
    const lp=land.geometry.attributes.position,wp=water.geometry.attributes.position,depth=water.geometry.attributes.waterDepth;
    for(let i=0;i<lp.count;i++){
      check(Math.abs(lp.getY(i)-course.groundAt(lp.getX(i),lp.getZ(i)))<1e-5,'Terrain does not match simulation');
      check(Math.abs(wp.getY(i)-course.WATER_Y)<1e-5&&Math.abs(depth.getX(i)-(course.WATER_Y-lp.getY(i)))<1e-5,'Water bed mismatch');
    }
    const trail=w.course.group.getObjectByName('Horse trail').geometry.attributes.position;
    for(let i=0;i<trail.count;i+=Math.ceil(trail.count/80)){
      const ray=new THREE.Raycaster(new THREE.Vector3(trail.getX(i),10,trail.getZ(i)),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(land)[0];check(hit&&Math.abs(trail.getY(i)-hit.point.y-.018)<.0001,'Trail cuts into the rendered bank');
    }
    check(course.waterDepth(94,74)===0,'Lagoon island submerged');
    check(course.waterDepth(-99,-64)>.3&&course.waterDepth(-89,-78)>.3,'Creek is disconnected');
    const deck=w.course.group.children.find(o=>o.userData.assetId==='wetland-landing'),canoe=w.course.group.children.find(o=>o.userData.assetId==='river-canoe');
    check(canoe.position.y===course.WATER_Y-.18&&course.waterDepth(canoe.position.x,canoe.position.z)>.2,'Canoe is stranded');
    // Grounded landward end, water under the outward end, deck above both.
    deck.updateMatrixWorld(true);const start=deck.localToWorld(new THREE.Vector3(0,.95,-4.5)),end=deck.localToWorld(new THREE.Vector3(0,.95,4.5));
    check(Math.abs(start.y-course.groundAt(start.x,start.z))<.2&&course.waterDepth(end.x,end.z)>.05&&end.y>course.WATER_Y,'Landing does not connect bank to water');
    window.worldProof={w,course,THREE};return {counts:w.course.group.userData.assetCounts,placements:w.course.group.userData.placements.length};
  });
  const views=[
    ['overview',[165,215,240],[0,0,-5],false],
    ['wetlands-top',[0,300,0],[0,0,0],true],
    ['lagoon',[111,38,122],[83,0,56],false],
    ['morichal',[-148,25,-22],[-87,0,-48],false],
    ['hato',[-55,13,63],[-24,1,30],false],
    ['landing',[74,6,29],[88,1,47],false],
  ];
  for(const [name,position,target,top]of views){
    const stats=await p.evaluate(({position,target,top})=>{
      const {w,THREE}=worldProof;let cam=w.camera;
      if(top){cam=new THREE.OrthographicCamera(-155,155,108,-108,.1,700);cam.up.set(0,0,-1);}cam.position.set(...position);cam.lookAt(...target);
      w.scene.fog=top||position[1]>100?null:new THREE.Fog(worldProof.course.DAYLIGHT.horizon,...worldProof.course.DAYLIGHT.fog);w.sky.mesh.visible=!top;w.sky.update(4);w.sun.position.set(position[0]-50,70,position[2]+35);w.sun.target.position.set(...target);w.renderer.render(w.scene,cam);return w.renderer.info.render;
    },{position,target,top});world[name]={calls:stats.calls,triangles:stats.triangles};await p.screenshot({path:`${out}/${name}.png`});
  }
  for(const u of [.06,.19,.5,.73]){
    await p.evaluate(u=>{const {w,course}=worldProof,q=course.at(u*course.LENGTH);w.camera.position.set(q.x-Math.sin(q.h)*7.7,course.groundAt(q.x,q.z)+3.6,q.z-Math.cos(q.h)*7.7);w.camera.lookAt(q.x+Math.sin(q.h)*5,course.groundAt(q.x,q.z)+1.2,q.z+Math.cos(q.h)*5);w.sky.mesh.visible=true;w.sky.update(4);w.scene.fog=new worldProof.THREE.Fog(course.DAYLIGHT.horizon,...course.DAYLIGHT.fog);w.renderer.render(w.scene,w.camera);},u);
    await p.screenshot({path:`${out}/ride-${Math.round(u*100)}.png`});
  }
  await p.evaluate(()=>{worldProof.w.course.dispose();worldProof.w.course.dispose();worldProof.w.sky.dispose();worldProof.w.renderer.dispose();});
  assert.deepEqual(errors,[]);await writeFile(`${out}/proof.json`,JSON.stringify({models,world},null,2));console.log('PASS asset geometry/ownership, deterministic motion, hollow openings, placements, shared water bed, landing and renders',world);
}finally{await browser.close();}
