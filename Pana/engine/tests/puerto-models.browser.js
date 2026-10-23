import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PANA_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({headless:true}),out='art/studio/puerto/models';await mkdir(out,{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1000,height:760}});
  await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/studio/settings.html`);
  await page.setContent('<style>body{margin:0}canvas{display:block}</style><canvas></canvas><script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"}}</script>');
  await page.evaluate(async()=>{const preview=await import('/studio/preview.js'),{ASSETS}=await import('/studio/catalog.js'),stage=preview.createPreview(document.querySelector('canvas'),true);stage.renderer.setSize(1000,760);stage.camera.aspect=1000/760;window.proof={preview,stage,assets:ASSETS.filter(a=>a.pack==='puerto')};});
  const ids=await page.evaluate(()=>proof.assets.map(a=>a.id));assert.equal(ids.length,9);const metrics=[];
  for(const id of ids) {
    const result=await page.evaluate(async id=>{
      const {preview,stage,assets}=proof,asset=assets.find(a=>a.id===id),a=await asset.build(),b=await asset.build(),geometries=new Set();
      let shared=false,finite=true;a.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);});
      b.group.traverse(o=>{if(o.geometry){if(geometries.has(o.geometry))shared=true;for(const v of o.geometry.attributes.position.array)if(!Number.isFinite(v))finite=false;}});
      preview.ownMaterials(a);preview.ownMaterials(b);const info=preview.inspect(a),other=preview.inspect(b);preview.release(b);
      stage.scene.add(a.group);preview.fitCamera(stage.camera,info.bounds);stage.renderer.render(stage.scene,stage.camera);proof.model=a;
      return {id,shared,finite,stats:info.stats,other:other.stats,minY:info.bounds.min.y,foundationDepth:a.group.userData.foundationDepth||0};
    },id);
    assert.equal(result.shared,false,`${id}: owned geometry`);assert.equal(result.finite,true);assert.deepEqual(result.stats,result.other);
    assert.ok(result.minY>=-result.foundationDepth-.02&&result.foundationDepth<=.55,`${id}: ground/keel origin`);assert.ok(result.stats.triangles<180000&&result.stats.meshes<(['casa-guipuzcoana','port-silos','san-carlos-fortress'].includes(id)?32:10),`${id}: model budget`);
    metrics.push(result);await page.screenshot({path:`${out}/${id}.png`});
    await page.evaluate(()=>{proof.preview.release(proof.model);proof.stage.renderer.renderLists.dispose();});
  }
  const vault=await page.evaluate(async()=>{
    const THREE=await import('three'),{sanCarlosFortress}=await import('/engine/models/props/san-carlos-fortress.js');
    const model=sanCarlosFortress();model.updateMatrixWorld(true);let min=Infinity,max=-Infinity,count=0;
    const colour=new THREE.Color(0xcfc2a6);
    model.traverse(o=>{if(!o.isMesh||o.material.side!==THREE.BackSide)return;
      const p=o.geometry.attributes.position,c=o.geometry.attributes.color,v=new THREE.Vector3();
      for(let i=0;i<p.count;i++){if(!c||Math.abs(c.getX(i)-colour.r)+Math.abs(c.getY(i)-colour.g)+Math.abs(c.getZ(i)-colour.b)>.001)continue;v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);min=Math.min(min,v.y);max=Math.max(max,v.y);count++;}});
    model.traverse(o=>o.geometry?.dispose());model.userData.dispose?.();return {min,max,count};
  });
  assert.ok(vault.count>0&&vault.min>=6.49&&vault.max>13.4,'gate vault stays above its spring, never bowls down into the entrance');
  await writeFile(`${out}/metrics.json`,JSON.stringify(metrics,null,2));console.log('Nine Puerto models: catalog previews, finite geometry, independent ownership, deterministic construction and budgets passed.');
}finally{await browser.close();}
