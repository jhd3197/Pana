import assert from 'node:assert/strict';
import { launch, openGame, waitFor } from '../../../tests/browser-kit.js';

const browser=await launch();
try{
  const page=await openGame(browser,'carreritas',{query:'debug&manual&track=cata'});
  await waitFor(page,()=>window.getActiveTrack&&garage.car);
  for(const id of ['plaza','cata','salinas','sarisarinama']){
    const result=await page.evaluate(async id=>{
      toGarage();buildTrack(id);await startRace(0);race.state='audit';
      const T=getActiveTrack(),p=race.player;
      if(id==='plaza'){
        const THREE=await import('three'),road=race.scene.getObjectByName('track-road');
        race.scene.updateMatrixWorld(true);
        const ray=new THREE.Raycaster(new THREE.Vector3(),new THREE.Vector3(0,-1,0));
        let agreement=0,grade=0;
        for(let s=T.TOTAL*.525;s<T.TOTAL*.575;s+=1.7){
          const a=T.pointAt(s),b=T.pointAt(s+.3),h=Math.atan2(b.x-a.x,b.y-a.y);
          for(const off of [-8.5,0,8.5]){
            const x=a.x-Math.cos(h)*off,z=a.y+Math.sin(h)*off;
            ray.ray.origin.set(x,100,z);
            const hit=ray.intersectObject(road)[0];
            if(!hit)throw Error('Banked road has a hole');
            agreement=Math.max(agreement,Math.abs(hit.point.y-.12-T.groundAt(x,z)));
            const height=s=>T.heightAtS(s)+T.def.crossfall(s,off,T);
            grade=Math.max(grade,Math.abs(height(s+.25)-height(s-.25))/.5);
          }
        }
        const bank=T.def.crossfall;
        if(agreement>.04||grade>.28)throw Error(`Bank support/transition mismatch: ${agreement}, ${grade}`);
        if(bank(T.TOTAL*.552,-T.HW,T)<5||Math.abs(bank(T.TOTAL*.552,T.HW,T))>1e-8)throw Error('Raise the outside of the right turn, preserving its inside edge');
        for(const u of [.1,.52,.58,.9])if(bank(T.TOTAL*u,-T.HW,T)!==0)throw Error('Bank leaks beyond the return bend');
        console.log(JSON.stringify({bankAgreement:agreement,maxEdgeGrade:grade}));
      }
      let best={s:T.TOTAL*.2,tilt:0};
      for(let s=0;s<T.TOTAL;s+=4){
        const a=T.pointAt(s),b=T.pointAt(s+.5),h=Math.atan2(b.x-a.x,b.y-a.y),y=T.heightAtS(s);
        const right=T.groundAt(a.x+Math.cos(h),a.y-Math.sin(h),y);
        const left=T.groundAt(a.x-Math.cos(h),a.y+Math.sin(h),y);
        const tilt=Math.atan2(right-left,2);
        if(Math.abs(tilt)>Math.abs(best.tilt)&&y>0)best={s,tilt};
      }
      const cases=[];
      for(const backwards of [false,true]){
        placeRacer(p,0,(T.LINE-9-best.s)/8);
        Object.assign(p,{onGround:true,roll:0,pitch:0,rollV:0,pitchV:0,boat:false,flyLift:0,boost:0,vr:0});
        if(backwards)p.h+=Math.PI;
        const right=T.groundAt(p.x+Math.cos(p.h),p.z-Math.sin(p.h),p.y);
        const left=T.groundAt(p.x-Math.cos(p.h),p.z+Math.sin(p.h),p.y);
        const expected=T.def.crossfall?Math.max(-.35,Math.min(.35,Math.atan2(right-left,2))):0;
        for(let i=0;i<90;i++)stepCar(p,{throttle:0,steer:0},1/60);
        cases.push({backwards,expected,roll:p.roll,grounded:p.onGround});
      }
      p.onGround=false;p.y+=20;p.vy=0;p.roll=.2;p.rollV=0;
      stepCar(p,{throttle:0,steer:0},1/60);
      return {id,crossfall:!!T.def.crossfall,best:best.tilt,cases,airRoll:p.roll};
    },id);
    console.log(JSON.stringify(result));
    if(result.crossfall)assert.ok(Math.abs(result.best)>.015,`${id}: exercise a genuinely banked section`);
    for(const c of result.cases){assert.ok(c.grounded);assert.ok(Math.abs(c.roll-c.expected)<.005,`${id}: car follows its supporting cross-slope in either direction`);}
    assert.ok(Math.abs(result.airRoll-.2)<1e-8,`${id}: airborne roll is not grounded`);
  }
  assert.deepEqual(page.errors,[]);
}finally{await browser.close();}
