import test from 'node:test';
import assert from 'node:assert/strict';
import { Race } from '../public/rules.js';
import { RIVER, GREYBOX, configuredRiver, angle } from '../public/river.js';

const step=(r,t,input={})=>{for(let x=0;x<t;x+=.05)r.update(.05,new Map([[1,input]]));};
function race(options={}){const r=new Race(GREYBOX);r.configure(options);r.addPlayer(1,'Pana');r.start(false,1);step(r,3.1);return r;}
test('Curiara options reject invalid patches and survive host restoration',()=>{
 const r=new Race();assert.equal(r.configure({river:'orinoco',current:'invalid'}),false);assert.equal(r.options.river,'amazonas');
 r.configure({river:'orinoco',falls:false,crew:'triples',paddling:'tap'});r.addPlayer(1,'Pana');r.start(true,1);
 assert.equal(r.configure({current:'slow'}),false);const copy=Race.restore(r.snapshot(),new Map([[1,{}]]));assert.deepEqual(copy.snapshot(),r.snapshot());assert.equal(copy.river.drops.length,0);assert.equal(copy.river.LENGTH,r.river.LENGTH);
});
test('river variants change bends and banks without mutating another river',()=>{
 const before=RIVER.at(200),width=RIVER.halfWidth(200),flow=RIVER.currentAt(before.x,before.z);
 const caroni=configuredRiver({river:'caroni'}),orinoco=configuredRiver({river:'orinoco'});
 assert.notDeepEqual(caroni.at(200),orinoco.at(200));assert.ok(orinoco.halfWidth(200)>caroni.halfWidth(200));
 assert.deepEqual(RIVER.at(200),before);assert.equal(RIVER.halfWidth(200),width);assert.deepEqual(RIVER.currentAt(before.x,before.z),flow);
 const empty=configuredRiver({river:'orinoco',items:false,falls:false});assert.equal(empty.rocks.length+empty.logs.length+empty.snags.length+empty.drops.length,0);
});
test('three and four pairs seat everyone; a smaller format cannot silently drop players',()=>{
 for(const [crew,count]of [['duos',2],['triples',3],['parejas',4]]){
  const paired=new Race();paired.configure({crew});for(let i=0;i<count*2;i++)paired.addPlayer(i,`P${i}`);
  paired.start(false);assert.equal(paired.phase,'countdown');assert.equal(paired.boats.length,count);assert.ok(paired.boats.every(b=>b.crew.length===2));
 }
 const r=new Race();for(let i=0;i<8;i++)r.addPlayer(i,`P${i}`);
 r.configure({crew:'triples'});assert.equal(r.start(),false);assert.equal(r.phase,'lobby');
 r.configure({crew:'duos'});assert.equal(r.canStart(),false);
 r.configure({crew:'parejas'});r.start(false);assert.equal(r.boats.length,4);assert.equal(r.boats.flatMap(b=>b.crew).filter(c=>!c.bot).length,8);
 assert.equal(r.chooseSeat(0,{boat:0,pos:0}),false,'seats cannot change during a race');
});
test('current strength, soft rapid landings and collision protection affect physics',()=>{
 const slow=race({current:'slow'}),hard=race({current:'hard'});step(slow,2);step(hard,2);assert.ok(hard.boats[0].progress>slow.boats[0].progress+2);
 const easy=race({rapids:'easy',collisions:'soft'}),normal=race();easy.tip(easy.boats[0],40,'raudal');normal.tip(normal.boats[0],40,'raudal');assert.ok(easy.boats[0].tip<normal.boats[0].tip);
 easy.boats[0].tip=0;easy.tip(easy.boats[0],40,'choque');assert.equal(easy.boats[0].tip,12);
});
test('tap mode gives equal stroke power while rhythm rewards accurate timing',()=>{
 const tap=race({paddling:'tap'}),rhythm=race();
 for(const r of [tap,rhythm]){r.steer(r.boats[0],.05,new Map([[1,{strokes:[[1,-1,r.time]]}]]));r.time+=.4;r.steer(r.boats[0],.05,new Map([[1,{strokes:[[2,1,r.time]]}]]));}
 assert.equal(tap.boats[0].paddle.power,1);assert.equal(tap.boats[0].remazos,0);assert.equal(rhythm.boats[0].paddle.power,1.25);
});
test('steering help gently aligns the canoe with the channel',()=>{
 const a=race({steeringHelp:true}),b=race();for(const r of [a,b])r.boats[0].h+=.8;
 step(a,1);step(b,1);const error=r=>Math.abs(angle(r.boats[0].h-r.river.at(r.boats[0].s).h));assert.ok(error(a)<error(b)-.3);
});

test('crew cards swap occupied roles, authorize self or host, and preserve assignments across hello and migration', () => {
 const r = new Race(); r.setFormat('triples'); for(let id=1;id<=6;id++)r.addPlayer(id,`P${id}`);
 assert.equal(r.moveSeat(2,0,2,1),false); assert.equal(r.moveSeat(99,0,1,99),false);
 assert.equal(r.moveSeat(2,1,4,1),true); assert.deepEqual(r.crews().flat().map(p=>p.id),[1,5,3,4,2,6]);
 r.addPlayer(2,'P2',{},null); assert.equal(r.crews()[2][0].id,2,'repeated hello cannot undo an authoritative swap');
 assert.equal(r.moveSeat(1,2,5,1),true); const order=r.crews().flat().map(p=>p.id);
 const restored=Race.restore(r.snapshot(),new Map(r.players.map(p=>[p.id,p])));assert.deepEqual(restored.crews().flat().map(p=>p.id),order);
 restored.removePlayer(5); assert.equal(restored.moveSeat(2,4,1,1),true);assert.equal(restored.crews()[0][1].id,2);
 restored.start(false,1); assert.equal(restored.moveSeat(2,1,0,1),false);
 assert.equal(new Set(restored.boats.flatMap(b=>b.crew.filter(p=>!p.bot).map(p=>p.id))).size,5);
});
