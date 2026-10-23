import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser=await launch();
try {
  const page=await openGame(browser,'carreritas',{query:'debug&manual'});
  await waitFor(page,()=>window.garage?.car);
  const proof=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {forestZone,prepareForestModel,simplifyCanopy,denseForest}=await import('/engine/worlds/coastal/forest-detail.js');
    const {ceiba}=await import('/engine/models/vegetation/ceiba.js');
    const {mangoTree}=await import('/engine/models/vegetation/mango-tree.js');
    const {cacao}=await import('/engine/models/vegetation/selva-trees.js');
    const {palm}=await import('/engine/models/vegetation/palm.js');
    function measure(model) {
      let triangles=0,bark=0,foliage=0,finite=true;
      model.traverse(o=>{
        if(!o.isMesh)return;
        const g=o.geometry,p=g.attributes.position,s=g.attributes.natureSurface;
        triangles+=(g.index?.count??p.count)/3;
        for(let i=0;i<p.count;i++){
          finite&&=Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i));
          if(s?.getX(i)>.99)bark++;else if(s?.getX(i)>.6)foliage++;
        }
      });
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3());
      return {triangles,bark,foliage,finite,width:size.x,depth:size.z,top:bounds.max.y};
    }
    const species=[];
    for(const [name,factory] of Object.entries({ceiba,mangoTree,cacao})){
      const near=factory({seed:37,detail:'game'}),geometries=[];
      near.traverse(o=>{if(o.isMesh)geometries.push(o.geometry);});
      prepareForestModel(near,'near');
      const retained=[];near.traverse(o=>{if(o.isMesh)retained.push(o.geometry);});
      const far=factory({seed:37,detail:'far',fruit:false}),original=measure(far);
      const old=simplifyCanopy(factory({seed:37,detail:'far',fruit:false}));
      const middle=prepareForestModel(factory({seed:37,detail:'far',fruit:false}),'middle');
      prepareForestModel(far,'far');
      species.push({name,unchanged:retained.every((g,i)=>g===geometries[i]),near:measure(near),middle:measure(middle),far:measure(far),old:measure(old),original});
    }
    const palmFar=prepareForestModel(palm({seed:37,detail:'far',fruit:false}),'far',{fronds:true});
    const isolated=prepareForestModel(ceiba({seed:37,detail:'far',fruit:false}),'far',{dense:false});
    const placements=[{x:0,z:0},{x:3,z:0},{x:0,z:3},{x:3,z:3},{x:200,z:200}];
    return {zones:[0,22,22.01,70,70.01,500].map(d=>forestZone(d)),scaledZones:[22,22.01,44,44.01].map(d=>forestZone(d*1.6,8*1.6)),species,palm:measure(palmFar),isolated:measure(isolated),denseCount:denseForest(placements).size};
  });
  assert.deepEqual(proof.zones,['near','near','middle','middle','far','far']);
  assert.deepEqual(proof.scaledZones,['near','middle','middle','far']);
  for(const p of proof.species){
    assert.ok(p.unchanged,`${p.name}: roadside geometry stays native`);
    assert.ok(p.far.finite&&p.far.triangles>0&&p.far.foliage>0);
    assert.equal(p.far.bark,0,`${p.name}: no hidden distant trunks`);
    assert.ok(p.far.triangles<p.old.triangles*.3,`${p.name}: at least 70% less distant geometry`);
    assert.ok(p.middle.bark>0&&p.middle.triangles<p.near.triangles);
    for(const axis of ['width','depth'])assert.ok(p.far[axis]>=p.original[axis]*.85,`${p.name}: crown ${axis} retained`);
    assert.ok(Math.abs(p.far.top-p.original.top)<.01,`${p.name}: crown height retained`);
  }
  assert.ok(proof.palm.bark>0&&proof.palm.foliage>0,'exposed palm trunks and fronds remain visible');
  assert.ok(proof.isolated.bark>0&&proof.isolated.foliage>0,'isolated distant trees retain a trunk');
  assert.equal(proof.denseCount,4,'only the crowded stand can hide trunks');
  assert.deepEqual(page.errors,[]);
  console.log(JSON.stringify(proof));
  console.log('PASS: route-based forest zones preserve near trees and reduce distant crown geometry.');
} finally {await browser.close();}
