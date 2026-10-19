import test from 'node:test';
import assert from 'node:assert/strict';
import { Race } from '../public/rules.js';
import { LENGTH, nearest } from '../public/course.js';
import { routeAt, raceJumps, origin } from '../public/options.js';

const step = (r, seconds, input = {throttle:1}) => {for(let t=0;t<seconds;t+=.05)r.update(.05,new Map([[1,input]]));};
function race(options={}) {const r=new Race();r.configure(options);r.addPlayer(1,'Pana');r.start(false,123);step(r,3.1,{});return r;}
function place(r,s,offset=0) {const p=r.players[0],q=routeAt(s,offset,r.options);Object.assign(p,{...q,progress:s,checkpoint:Math.max(0,Math.floor(s/(LENGTH/8))+1),speed:12,water:0});return p;}

test('Galope validates choices atomically and keeps them through migration',()=>{
 const r=new Race();assert.equal(r.configure({laps:3,weather:'snow'}),false);assert.equal(r.options.laps,2);
 r.configure({laps:3,weather:'rain',course:'morichal'});r.addPlayer(1,'Pana');r.start(false);
 assert.equal(r.configure({laps:2}),false);const copy=Race.restore(r.snapshot(),new Map([[1,{}]]));assert.deepEqual(copy.options,r.options);
 assert.ok(Math.abs(copy.players[0].s-origin(r.options))<10);
});
test('Morichal runs the existing palm creek circuit backwards with ordered gates',()=>{
 const r=race({course:'morichal',laps:3});const p=place(r,10);const before=p.s;step(r,.5);assert.ok(p.s<before);assert.ok(p.progress>10);
 place(r,LENGTH*2-1);step(r,.3);assert.equal(p.finish,null,'two laps do not finish a three-lap race');
 place(r,LENGTH*3-1);step(r,.3);assert.ok(p.finish>0);
});
test('obstacle density, crazy jumps and automatic help change the jump challenge',()=>{
 assert.equal(raceJumps({obstacles:'few'}).length,1);assert.equal(raceJumps({obstacles:'many'}).length,6);
 const r=race({jumps:'crazy',jumpHelp:true});const log=raceJumps(r.options)[0];const p=place(r,log.s-4);step(r,.5);
 assert.ok(p.jumpY>1.5);assert.equal(p.hits,0);
});
test('rain slows horses; enabled shortcuts retain off-trail speed within the safe corridor',()=>{
 const dry=race(),rain=race({weather:'rain'}),cut=race({shortcuts:true});
 for(const r of [dry,rain,cut])place(r,80,6);
 step(dry,1);step(rain,1);step(cut,1);
 assert.ok(rain.players[0].speed<dry.players[0].speed);assert.ok(cut.players[0].speed>dry.players[0].speed);
 assert.ok(nearest(cut.players[0].x,cut.players[0].z).distance<=9.01);
});
test('drafting gives a following horse extra speed; random coats are seeded',()=>{
 const r=race({drafting:true});const p=place(r,15);const q=routeAt(21);r.players.push({...p,...q,id:2,progress:21});step(r,.2);
 assert.equal(p.drafting,true);assert.ok(p.speed>12);
 const a=new Race(),b=new Race();for(const r of [a,b]){r.configure({horse:'random'});for(let i=0;i<8;i++)r.addPlayer(i,`P${i}`);r.start(false,27);}
 assert.deepEqual(a.players.map(p=>p.coat),b.players.map(p=>p.coat));assert.equal(a.players.length,8);assert.ok(new Set(a.players.map(p=>p.coat)).size>1);
});

test('late-join hello refreshes cannot overwrite a randomly assigned racing horse',()=>{
 const r=new Race();r.configure({horse:'random'});r.addPlayer(1,'Pana',{},'bay');r.start(false,27);
 const coat=r.players[0].coat,other=coat==='grey'?'bay':'grey';
 r.addPlayer(1,'Pana',{hat:'cap'},other);assert.equal(r.players[0].coat,coat);assert.equal(r.players[0].avatar.hat,'cap');
 step(r,3.1);r.addPlayer(1,'Pana',{},other);assert.equal(r.players[0].coat,coat);
 r.phase='finished';r.addPlayer(1,'Pana',{},other);assert.equal(r.players[0].coat,other);
});
