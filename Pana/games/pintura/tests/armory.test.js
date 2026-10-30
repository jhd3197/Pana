import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, cleanInput } from '../public/rules.js';
import { cleanKit, kitStats, MARKERS } from '../public/armory-data.js';
const arena=kit=>{const a=new Arena();a.add(1,{name:'Ana'});a.add(2,{name:'Bea'});a.selectKit(1,kit);a.start();a.go();Object.assign(a.players[0],{x:-22,z:-22,shield:0});Object.assign(a.players[1],{x:-22,z:-15,shield:0});return a;};
test('kits sanitize identifiers and cap two distinct attachments',()=>{
 assert.deepEqual(cleanKit({weapon:'hacked',attachments:['barrel','barrel','bad','hopper','stock']}).attachments,['barrel','hopper']);
 assert.equal(cleanKit(null).weapon,'pistol');assert.equal(cleanInput({grenade:'true',weapon:'bad'}).grenade,false);
 for(const w of MARKERS){const base=kitStats({weapon:w.id}),barrel=kitStats({weapon:w.id,attachments:['barrel']}),hopper=kitStats({weapon:w.id,attachments:['hopper']});assert.ok(barrel.mobility<base.mobility);assert.ok(hopper.reload>base.reload);}
 assert.equal(kitStats({weapon:'rocket',armor:'wind',attachments:['stock']}).sprint,false);
});
test('only lobby or results can change personal gear; armor changes actual aguante',()=>{
 const a=arena({armor:'padded'}),p=a.players[0];assert.equal(a.selectKit(1,{armor:'wind'}),false);
 for(let i=0;i<3;i++)a.hit(p,a.players[1],'#fff');assert.equal(p.respawn,0);a.hit(p,a.players[1],'#fff');assert.ok(p.respawn>0);
 const b=arena({armor:'wind'});b.hit(b.players[0],b.players[1],'#fff');b.hit(b.players[0],b.players[1],'#fff');assert.ok(b.players[0].respawn>0);
});
test('Cohetón is slow, cannot sprint and its blast applies one pepazo per rival',()=>{
 const a=arena({weapon:'rocket'}),p=a.players[0];a.step(.05,new Map([[1,{x:1,sprint:true}]]));assert.equal(p.sprint,false);assert.ok(p.x+22<7*.05*.65);
 Object.assign(p,{x:-22,z:-22});a.step(.05,new Map([[1,{az:1,fire:true}]]));assert.equal(a.balls[0].rocket,true);assert.equal(p.ammo,0);
 for(let i=0;i<10;i++)a.step(.05);assert.equal(a.players[1].paint,1);assert.equal(a.players[1].respawn,0);
 const blast={id:123,owner:1,x:-22,z:-15,color:'#fff'};a.blast(blast,4);a.blast(blast,4);assert.equal(a.players[1].paint,2);
});
test('rocket reserves exhaust; changing weapon never refills rockets',()=>{
 const a=arena({weapon:'rocket',attachments:['hopper']}),p=a.players[0];assert.equal(p.reserve,4);
 p.reserve=0;p.ammo=0;a.step(.05,new Map([[1,{reload:true}]]));assert.equal(p.reload,0);
 p.shots=1;a.step(.05,new Map([[1,{weapon:'pistol'}]]));a.step(.05,new Map([[1,{weapon:'rocket'}]]));assert.equal(p.ammo,0);assert.equal(p.reserve,0);
});
test('one grenade per respawn, sticky pools expire and Chispita bounces',()=>{
 const a=arena({grenade:'pegajosa'}),p=a.players[0];a.step(.05,new Map([[1,{az:1,grenade:true}]]));assert.equal(p.grenadeReady,false);assert.equal(a.grenades.length,1);
 for(let i=0;i<24;i++)a.step(.05,new Map([[1,{az:1,grenade:true}]]));assert.equal(a.puddles.length,1);assert.equal(a.grenades.length,0);
 Object.assign(a.players[1],{x:a.puddles[0].x,z:a.puddles[0].z});a.step(.05);assert.ok(a.players[1].slow>0);
 for(let i=0;i<110;i++)a.step(.05);assert.equal(a.puddles.length,0);a.respawn(p);assert.equal(p.grenadeReady,true);
 const b=arena({grenade:'chispita'});b.step(.05,new Map([[1,{az:1,grenade:true}]]));for(let i=0;i<18;i++)b.step(.05);assert.equal(b.grenades[0].bounced,true);
});
test('explosions respect cover, shields and team friendly-fire settings',()=>{
 const a=arena({});const q=a.players[1];Object.assign(q,{x:0,z:3});a.blast({owner:1,x:0,z:-3,color:'#fff'},10);assert.equal(q.paint,0);
 Object.assign(q,{x:-22,z:-15,shield:1});a.blast({owner:1,x:-22,z:-15,color:'#fff'},4);assert.equal(q.paint,0);
 q.shield=0;q.team=a.players[0].team;a.options.mode='teams';a.blast({owner:1,x:-22,z:-15,color:'#fff'},4);assert.equal(q.paint,0);
});
