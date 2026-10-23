import test from 'node:test';
import assert from 'node:assert/strict';
import { Bash, cleanInput, pack, unpack } from '../public/rules.js';
const members = new Map([[1, {}], [2, {}]]);
function match(options = {}) {
  const game = new Bash(71); game.configure({seats:2,...options});
  game.addPlayer(1,'Ana'); game.addPlayer(2,'Bruno'); game.start();
  game.combat.countdownFrames=0; game.update(1/60);
  return game;
}
const run = (g, n, inputs = new Map()) => { for (let i=0;i<n;i++) g.update(1/60, inputs); };
function face(g) {
  g.combat.fighters.forEach((f,i) => { f.position.x=i===0?-30:30; f.position.y=f.definition.size.height/2; f.facing=i===0?1:-1; f.state='idle'; f.grounded=true; f.invulnerableFrames=0; f.velocity={x:0,y:0}; });
}
test('input is bounded and fast taps survive the 20 Hz transport', () => {
  assert.equal(cleanInput({x:Infinity,y:-8}).x,0); assert.equal(cleanInput({y:-8}).y,-1);
  const g=match(), p=g.players[0];
  assert(g.frameInput(p,{held:[],taps:{jump:1}}).pressed.has('jump'));
  assert(!g.frameInput(p,{held:[],taps:{jump:1}}).pressed.has('jump'));
});
test('rules and styles validate, solo gets a CPU and join replaces it', () => {
  const g=new Bash(2); g.addPlayer(1,'Ana',{hat:'gorra'});
  assert.equal(g.configure({stocks:99}),false); assert.equal(g.choose(1,99),false);
  assert(g.choose(1,1)); g.start(); assert.equal(g.players[1].bot,true);
  g.addPlayer(2,'Bruno'); assert.equal(g.players.length,6); assert.equal(g.players[1].bot,false);
  assert.equal(g.players[0].avatar.hat,'gorra'); assert.equal(g.configure({stocks:1}),false);
});
test('jab hits and shield reduces damage', () => {
  const attack = new Map([[1,{held:['attack'],taps:{attack:1}}]]);
  const g=match({items:false});face(g);run(g,20,attack);
  assert(g.combat.fighters[1].percent>0);
  const h=match({items:false});face(h);run(h,3,new Map([[2,{held:['shield']}]]));
  attack.set(2,{held:['shield']}); run(h,20,attack);
  assert(h.combat.fighters[1].percent<g.combat.fighters[1].percent);
});
test('double jump, stock loss and final knockout', () => {
  const g=match({stocks:1,items:false});
  const y=g.combat.fighters[0].position.y;
  run(g,12,new Map([[1,{held:['jump'],taps:{jump:1}}]]));
  assert(g.combat.fighters[0].position.y>y+10);
  run(g,1);run(g,1,new Map([[1,{held:['jump'],taps:{jump:2}}]]));
  assert.equal(g.combat.fighters[0].jumpsRemaining,0);
  g.combat.fighters[1].position.x=2000;run(g,1);
  assert.equal(g.phase,'finished');assert.equal(g.winner,1);
  g.lobby();assert.equal(g.phase,'lobby');assert(g.configure({stocks:5}));
});
test('full checkpoint preserves active attacks and CPU randomness', () => {
  const g=match();face(g);run(g,7,new Map([[1,{held:['attack'],taps:{attack:1}}]]));
  g.removePlayer(2);
  const saved=JSON.parse(JSON.stringify(g.snapshot()));
  assert(Buffer.byteLength(JSON.stringify(saved))<256*1024);
  const restored=Bash.restore(saved,new Map([[1,{}]]));
  for(let i=0;i<240;i++) {g.update(1/60);restored.update(1/60);}
  assert.deepEqual(restored.combat.getSnapshot(),g.combat.getSnapshot());
  assert.equal(restored.combat.random.seed,g.combat.random.seed);
  const typed=unpack(pack({s:new Set([1]),m:new Map([[2,3]]),n:Infinity}));
  assert(typed.s.has(1));assert.equal(typed.m.get(2),3);assert.equal(typed.n,Infinity);
});
test('fixed stepping is invariant under timer slice size', () => {
  const a=match(),b=match(); const inputs=new Map([[1,{x:1,held:['right']}]]);
  for(let i=0;i<60;i++)a.update(.05,inputs);
  run(b,180,inputs);
  assert.deepEqual(a.combat.getSnapshot(),b.combat.getSnapshot());
});
test('a timeout with equal stocks and damage enters sudden death', () => {
  const g=match({seconds:60,items:false});g.combat.frame=180+3600;
  run(g,1);assert.equal(g.combat.suddenDeath,true);
});

test('expired inputs release the stick without replaying old taps', () => {
  const g=match(),p=g.players[0],input={held:['attack'],taps:{attack:1},x:1};
  g.frameInput(p,input);
  const expired=g.frameInput(p,undefined);
  assert.equal(expired.pressed.size,0);assert.equal(expired.direction.x,0);
  assert.equal(g.frameInput(p,{...input,held:[]}).pressed.size,0);
});

test('healing items apply their original combat effect', () => {
  const g=match({items:false});const f=g.combat.fighters[0];f.percent=70;
  g.combat.spawnItem('vitality-fruit',{...f.position});run(g,2);
  assert.equal(f.percent,40);
});

test('combat styles match their speed and weight labels', async () => {
  const { STYLES } = await import('../public/rules.js');
  const { getFighterDefinition } = await import('../public/combat/roster.js');
  const [balanced,fast,heavy]=STYLES.map(getFighterDefinition);
  assert(fast.runSpeed>balanced.runSpeed);
  assert(heavy.runSpeed<balanced.runSpeed);
  assert(heavy.weight>balanced.weight&&balanced.weight>fast.weight);
  assert(heavy.attacks['forward-smash'].damage>balanced.attacks['forward-smash'].damage);
});

test('catch-up ticks retain hit events until the next network publish', () => {
  const g=match({items:false});face(g);
  const attack=new Map([[1,{held:['attack'],taps:{attack:1}}]]);
  // A backgrounded host can process many room slices before sending once.
  for(let i=0;i<12;i++)g.update(.05,attack);
  const snap=g.snapshot();
  assert(snap.fight.fighters[1].percent>0);
  assert(snap.fight.events.some(e=>e.type==='hit'));
  assert(snap.fight.events.length<=96);
  const restored=Bash.restore(JSON.parse(JSON.stringify(snap)),members);
  assert.deepEqual(restored.snapshot().fight.events,snap.fight.events);
  run(g,125);
  assert(g.snapshot().fight.events.every(e=>e.frame>g.combat.frame-120));
});

function four(options={}) {
  const g=new Bash(25); g.configure({seats:4,items:false,stocks:1,...options});
  for(let i=1;i<=4;i++)g.addPlayer(i,'Pana '+i);
  g.start();g.combat.countdownFrames=0;run(g,1);return g;
}
const neutral=()=>({held:new Set(),pressed:new Set(),released:new Set(),direction:{x:0,y:0}});
test('four fighters have distinct spawns and only the last survivor wins',()=>{
  const g=four();assert.equal(g.players.length,4);assert.equal(g.addPlayer(5,'Extra'),null);
  assert.equal(new Set(g.combat.fighters.map(f=>f.position.x)).size,4);
  for(const slot of [0,1]){g.combat.fighters[slot].position.x=2000;run(g,1);assert.equal(g.phase,'playing');}
  g.combat.fighters[2].position.x=2000;run(g,1);
  assert.equal(g.phase,'finished');assert.equal(g.winner,4);
});
test('four-player melee can strike both nearby opponents and grab slot three',()=>{
  const g=four({stocks:3});const fs=g.combat.fighters;
  fs.forEach((f,i)=>{f.position={x:[-300,-30,30,35][i],y:f.definition.size.height/2};f.grounded=true;f.state='idle';f.invulnerableFrames=0;f.facing=1;});
  g.combat.startMove(fs[1],'jab',neutral());
  fs[1].action.frame=fs[1].definition.attacks.jab.startup;
  g.combat.resolveMeleeHits(fs.map(neutral));
  assert(fs[2].percent>0);assert(fs[3].percent>0);assert.equal(fs[0].percent,0);
  fs[2].position.x=-250;fs[3].state='idle';fs[3].invulnerableFrames=0;
  g.combat.startGrab(fs[1]);assert.equal(fs[1].grabTarget,3);
});
test('projectile and activated item collisions reach the fourth slot',()=>{
  const g=four({stocks:3}),c=g.combat,fs=c.fighters;
  fs.forEach((f,i)=>{f.position={x:[-300,-200,0,70][i],y:200};f.invulnerableFrames=0;f.facing=1;});
  // Use a roster projectile to exercise actual collision/ownership bookkeeping.
  const move=Object.values(fs[0].definition.attacks).find(m=>m.projectile);
  assert(move);c.spawnProjectile(fs[0],'neutral-special',move);
  const p=c.projectiles[0];p.position={...fs[3].position};p.velocity={x:0,y:0};p.definition={...p.definition,gravity:0,manualDetonation:false};
  c.updateProjectiles(fs.map(neutral));assert(fs[3].percent>0);assert.equal(fs[1].percent,0);
  fs[3].invulnerableFrames=0;fs[3].state='idle';const before=fs[3].percent;
  c.spawnItem('ricochet-disc',{...fs[3].position});const item=c.items.at(-1);item.mode='thrown';item.owner=2;item.velocity={x:0,y:0};
  c.updateItems(fs.map(neutral));assert(fs[3].percent>before);
});
test('only leaders enter sudden death and earlier eliminations cannot win a mutual KO',()=>{
  const g=four({stocks:3}),c=g.combat;
  c.fighters[0].stocks=1;c.fighters[1].stocks=2;c.frame=180+180*60;
  c.resolveTimeLimit();assert.equal(c.suddenDeath,true);
  assert.deepEqual(c.fighters.map(f=>f.stocks),[0,0,1,1]);
  c.fighters[0].percent=0;c.fighters[2].position.x=2000;c.fighters[3].position.x=2000;
  c.resolveKnockouts();assert([2,3].includes(c.winner));
});
test('four-player checkpoint and CPU takeover remain deterministic',()=>{
  const g=four({stocks:3});g.removePlayer(3);g.removePlayer(4);
  const saved=JSON.parse(JSON.stringify(g.snapshot()));assert(Buffer.byteLength(JSON.stringify(saved))<256*1024);
  const restored=Bash.restore(saved,members);
  run(g,240);run(restored,240);assert.deepEqual(restored.combat.getSnapshot(),g.combat.getSnapshot());
  const slot=g.players.findIndex(p=>p.bot);const stocks=g.combat.fighters[slot].stocks;
  g.addPlayer(9,'Nuevo');assert.equal(g.players[slot].id,9);assert.equal(g.combat.fighters[slot].stocks,stocks);
});

test('six fighters survive checkpoint migration and slots five/six can win',()=>{
  const g=new Bash(61);g.configure({stocks:1,items:false});
  for(let id=1;id<=6;id++)g.addPlayer(id,'Pana '+id);
  assert.equal(g.addPlayer(7,'Extra'),null);g.start();g.combat.countdownFrames=0;run(g,1);
  assert.equal(g.combat.fighters.length,6);
  assert.equal(new Set(g.combat.fighters.map(f=>f.position.x)).size,6);
  const saved=JSON.parse(JSON.stringify(g.snapshot()));assert(Buffer.byteLength(JSON.stringify(saved))<256*1024);
  const restored=Bash.restore(saved,new Map(g.players.map(p=>[p.id,{}])));
  run(g,120);assert.deepEqual(g.combat.fighters.map(f=>f.stocks),[1,1,1,1,1,1]);run(restored,120);assert.deepEqual(restored.combat.getSnapshot(),g.combat.getSnapshot());
  for(const i of [0,1,2,3])g.combat.fighters[i].position.x=2000;
  run(g,1);assert.equal(g.phase,'playing');
  g.combat.fighters[4].position.x=2000;run(g,1);assert.equal(g.winner,6);
});
