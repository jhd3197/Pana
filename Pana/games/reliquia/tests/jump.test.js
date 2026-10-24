import test from 'node:test';
import assert from 'node:assert/strict';
import { Expedition, stepExplorer } from '../public/rules.js';

test('jump is a single press, lands, and cannot double-jump or move through walls',()=>{
 const g=new Expedition(1);g.addPlayer(1,'Juan');g.start(1);const p=g.players[0];
 const x=p.x,z=p.z;stepExplorer(p,{jump:1},.05,g);assert.ok(p.jumpHeight>0);
 const first=p.jumpVelocity;stepExplorer(p,{jump:2},.05,g);assert.ok(p.jumpVelocity<first);
 for(let i=0;i<30;i++)stepExplorer(p,{jump:2},.05,g);
 assert.equal(p.jumpHeight,0);assert.equal(p.x,x);assert.equal(p.z,z);
 stepExplorer(p,{jump:3},.05,g);assert.ok(p.jumpHeight>0);
});


test('a fresh jump occurs at the end of a background-host catch-up',()=>{
 const g=new Expedition(1);g.addPlayer(1,'Juan');g.start(1);const p=g.players[0];
 for(let i=0;i<20;i++)stepExplorer(p,{jump:1,jumpDelay:.95},.05,g);
 assert.ok(p.jumpHeight>.1);assert.ok(p.jumpVelocity>0,'still ascending when the host publishes');
});
