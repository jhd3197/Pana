import test from 'node:test';
import assert from 'node:assert/strict';
import { Arena, cleanInput, grenadeStart, grenadeFlight, TICK, THROW } from '../public/rules.js';
import { cleanKit, kitStats, MARKERS, GRENADES, grenadeDef } from '../public/armory-data.js';
import { traceLob } from '../../../engine/play/lob.js';
const arena=kit=>{const a=new Arena('plaza');a.add(1,{name:'Ana'});a.add(2,{name:'Bea'});a.selectKit(1,kit);a.start();a.go();Object.assign(a.players[0],{x:-22,z:-22,shield:0});Object.assign(a.players[1],{x:-22,z:-15,shield:0});return a;};
test('kits sanitize identifiers and cap three distinct attachments',()=>{
 assert.deepEqual(cleanKit({weapon:'hacked',attachments:['barrel','barrel','bad','hopper','stock','optic']}).attachments,['barrel','hopper','stock']);
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
 for(let i=0;i<50;i++)a.step(.05,new Map([[1,{az:1,grenade:true}]]));assert.equal(a.puddles.length,1);assert.equal(a.grenades.length,0);
 Object.assign(a.players[1],{x:a.puddles[0].x,z:a.puddles[0].z});a.step(.05);assert.ok(a.players[1].slow>0);
 for(let i=0;i<110;i++)a.step(.05);assert.equal(a.puddles.length,0);a.respawn(p);assert.equal(p.grenadeReady,true);
 // The same throw down the open south lane: Chispita bounces on far past La Piñita; La Pegajosa stays where it lands.
 const lane=kind=>{const g=arena({grenade:kind});Object.assign(g.players[0],{x:-20,z:-24.5});g.step(.05,new Map([[1,{ax:1,az:0,grenade:true,pitch:-.3}]]));let most=0,first=null;
  for(let i=0;i<80 && g.grenades.length;i++){const n=g.grenades[0];most=Math.max(most,n.bounces);if(first===null && (n.bounces||n.rolling||n.resting))first=n.x;g.step(.05);}return {most,first,end:g.booms[0].x};};
 const chispita=lane('chispita'),pinita=lane('pinita'),pegajosa=lane('pegajosa');
 assert.ok(chispita.most>=3 && chispita.most>pinita.most,`${chispita.most} vs ${pinita.most} bounces`);assert.ok(chispita.end>pinita.end+3,`${chispita.end} vs ${pinita.end}`);
 assert.ok(Math.abs(pegajosa.end-pegajosa.first)<1e-9,'La Pegajosa sticks');
});
test('grenades leave the hand along the look: about 12 m at no charge, 28 m at full, higher with pitch',()=>{
 const carry=(charge,pitch=0,kind='pinita')=>{const out=[],r=traceLob(grenadeStart({x:0,z:0},{ax:1,az:0,pitch,charge},kind),grenadeFlight(kind),{dt:TICK,time:4,out,land:true});return {carry:out[r.land].x,peak:r.peak};};
 for(const g of GRENADES){const low=carry(0,0,g.id).carry,high=carry(1,0,g.id).carry;assert.ok(low>11 && low<13.5,`${g.id} ${low}`);assert.ok(high>27 && high<30,`${g.id} ${high}`);}
 const peaks=[-.4,0,.3,.55].map(pitch=>carry(.5,pitch).peak);for(let i=1;i<peaks.length;i++)assert.ok(peaks[i]>peaks[i-1],peaks.join(' < '));
 const a=arena({}),p=a.players[0];a.step(.05,new Map([[1,{az:1,grenade:true,pitch:.3}]]));const g=a.grenades[0];
 assert.ok(g.y>THROW.hand && g.vy>0,'leaves the hand rising');assert.ok(g.z>p.z+.4,'in front of the pana');
});
test('the aim the client previews is the throw the server plays',()=>{
 const a=arena({grenade:'pinita'}),p=a.players[0],aim=a.aimGrenade(p,-22,-8);
 a.step(.05,new Map([[1,{ax:aim.ax,az:aim.az,grenade:true,pitch:aim.pitch,charge:aim.charge}]]));
 for(let i=0;i<120 && !a.booms.length;i++)a.step(.05);
 assert.ok(Math.abs(a.booms[0].x-aim.x)<1e-9 && Math.abs(a.booms[0].z-aim.z)<1e-9);
});
test('the fuse starts on release and a lob still in the air blows on touchdown',()=>{
 const a=arena({grenade:'pinita'});Object.assign(a.players[0],{x:-20,z:-24.5});a.step(.05,new Map([[1,{ax:1,az:0,grenade:true,pitch:-.3}]]));
 let steps=1;while(!a.booms.length && steps<200){a.step(.05);steps++;}
 assert.ok(Math.abs(steps*TICK-grenadeDef('pinita').fuse)<TICK+1e-9,`${steps*TICK}`);
 const b=arena({grenade:'pinita'});Object.assign(b.players[0],{x:-20,z:-24.5});b.step(.05,new Map([[1,{ax:1,az:0,grenade:true,pitch:.55,charge:1}]]));
 steps=1;while(!b.booms.length && steps<200){b.step(.05);steps++;}
 assert.ok(steps*TICK>grenadeDef('pinita').fuse+.2,'waited for touchdown');assert.ok(b.booms[0].y<.6,'blew on the ground');
});
test('a blast paints fully near the centre, less near the edge, nothing outside or behind cover',()=>{
 const a=arena({}),q=a.players[1],burst=d=>{Object.assign(q,{x:-22,z:-22+d,paint:0,stains:[],respawn:0,shield:0});a.blast({owner:1,x:-22,z:-22,y:0,color:'#fff'},4.5,2);return q.paint;};
 assert.equal(burst(1),2);assert.equal(burst(4.2),1);assert.equal(burst(5),0);
 Object.assign(q,{x:0,z:3,paint:0});a.blast({owner:1,x:0,z:-3,y:0,color:'#fff'},4.5,2);assert.equal(q.paint,0,'cover blocks');
 Object.assign(q,{x:0,z:2.2,paint:0});a.blast({owner:1,x:0,z:0,y:2.5,color:'#fff'},4.5,2);assert.ok(q.paint>0,'a blast on top of a crate reaches over it');
 assert.equal(a.booms.at(-1).radius,4.5);assert.equal(a.splats.at(-1).blast,true);
});
test('grenade input is validated and ignored while out of play',()=>{
 const input=cleanInput({grenade:true,pitch:9,charge:-3});assert.equal(input.pitch,THROW.up);assert.equal(input.charge,0);
 assert.deepEqual([cleanInput({pitch:NaN,charge:'1'}).pitch,cleanInput({pitch:-Infinity,charge:Infinity}).charge,cleanInput({pitch:-9}).pitch],[0,0,THROW.down]);
 const a=arena({}),p=a.players[0];p.respawn=1;a.step(.05,new Map([[1,{grenade:true}]]));assert.equal(p.grenadeReady,true);assert.equal(a.grenades.length,0);
 const lobby=new Arena('plaza');lobby.add(1,{name:'Ana'});lobby.step(.05,new Map([[1,{grenade:true}]]));assert.equal(lobby.grenades.length,0);
});
test('bots lob only at a rival in range, with a cooldown, using the solved throw',()=>{
 const a=arena({}),bot=a.players[0],q=a.players[1];bot.bot=true;Object.assign(bot,{x:-15,z:-24.5});
 const ask=at=>{Object.assign(q,{x:at,z:-24.5});bot.lobAt=-Infinity;return a.botGrenade(bot,q,true);};
 assert.equal(ask(-12),null,'too close');assert.equal(ask(20),null,'too far');
 const lob=ask(0);assert.equal(lob.grenade,true);assert.ok(lob.charge>=0 && lob.charge<=1);assert.ok(lob.ax>.99);
 assert.equal(a.botGrenade(bot,q,true),null,'cooldown');
 bot.lobAt=null;assert.equal(a.botGrenade(bot,q,true),null,'not in the first seconds of a life');
});
test('the armory range lobs at its target with the new input',()=>{
 const a=arena({}),[p,dummy]=a.players,aim=a.aimGrenade(p,dummy.x,dummy.z);
 a.step(.05,new Map([[1,{ax:0,az:1,grenade:true,pitch:aim.pitch,charge:aim.charge}]]));for(let i=0;i<120 && !a.booms.length;i++)a.step(.05);
 assert.ok(dummy.paint>0);
});
test('explosions respect cover, shields and team friendly-fire settings',()=>{
 const a=arena({});const q=a.players[1];Object.assign(q,{x:0,z:3});a.blast({owner:1,x:0,z:-3,color:'#fff'},10);assert.equal(q.paint,0);
 Object.assign(q,{x:-22,z:-15,shield:1});a.blast({owner:1,x:-22,z:-15,color:'#fff'},4);assert.equal(q.paint,0);
 q.shield=0;q.team=a.players[0].team;a.options.mode='teams';a.blast({owner:1,x:-22,z:-15,color:'#fff'},4);assert.equal(q.paint,0);
});
