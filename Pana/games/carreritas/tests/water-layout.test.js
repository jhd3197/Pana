import test from 'node:test';
import assert from 'node:assert/strict';
import {channelAt} from '../public/tracks/water-world-math.js';
import {OUTLET} from '../public/tracks/salto-layout.js';
import {RIVER} from '../public/tracks/cuevas-layout.js';
import {wetness,WATER_Y} from '../public/tracks/salinas-layout.js';
test('river flow coordinates follow the descending authored channel',()=>{
  for(const route of [OUTLET,RIVER]){let along=-1,height=Infinity;
    for(let i=0;i<route.length-1;i++)for(let j=0;j<20;j++){
      const a=route[i],b=route[i+1],t=j/20,q=channelAt(route,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
      assert.ok(q.distance<1e-8&&q.along>=along-1e-8&&q.height<=height+1e-8);along=q.along;height=q.height;
    }
  }
});
test('salt crossing wetness uses the visible runtime deck, with dry bridge priority',()=>{
  assert.equal(wetness(180,130,0,{surfaceAt:()=>WATER_Y}),0);
  assert.ok(wetness(180,130,0,{surfaceAt:()=>.55})>.5);
  assert.equal(wetness(-260,-180,0,{surfaceAt:()=>2.8}),0);
});
