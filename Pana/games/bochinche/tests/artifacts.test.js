import test from 'node:test';
import assert from 'node:assert/strict';
import { Bash } from '../public/rules.js';
import { advanceStage, canoeAt, stormAt } from '../public/stage-rules.js';
import { createEmptyInput } from '../public/combat/engine.js';
function game(stage) {const g=new Bash(41);g.configure({stage,seats:2,items:false});g.addPlayer('a','Ana');g.addPlayer('b','Bruno');g.start();g.combat.phase='playing';return g;}
test('canoe carries its grounded rider and checkpoint resumes identical motion',()=>{
 const g=game('salto-angel'),c=g.combat,p=c.stage.platforms.find(p=>p.id==='top'),f=c.fighters[0];
 f.grounded=true;f.supportPlatform='top';f.position={x:0,y:p.y+12+f.definition.size.height/2};
 c.frame=120;advanceStage(c);assert.equal(p.x,canoeAt(120).x);assert.equal(f.position.x,p.x);
 const restored=Bash.restore(g.snapshot(),new Map([['a',{}],['b',{}]]));
 for(let i=0;i<30;i++){g.update(.05);restored.update(.05);}
 assert.deepEqual(g.snapshot().fight,restored.snapshot().fight);
});
test('storm warns, strikes once, respects invulnerability and migrates through impact',()=>{
 assert.equal(stormAt(563).warning,false);assert.equal(stormAt(564).warning,true);
 const g=game('catatumbo'),c=g.combat;c.frame=659;
 c.fighters.forEach(f=>{f.position={x:270,y:f.definition.size.height/2};f.invulnerableFrames=0;});
 c.fighters[1].invulnerableFrames=60;
 const restored=Bash.restore(g.snapshot(),new Map([['a',{}],['b',{}]]));
 g.update(1/60);restored.update(1/60);
 assert.equal(c.fighters[0].percent,18);assert.equal(c.fighters[1].percent,0);
 assert.deepEqual(g.snapshot().fight,restored.snapshot().fight);
 g.update(1/60);assert.equal(c.fighters[0].percent,18);
});
test('artifact attacks retain damage, shielding, ice escape and recovery',()=>{
 for(const [name,damage] of [['neutral-special',14],['side-special',12],['down-special',10],['forward-smash',30]]){
  const c=game('verdant-grove').combat,[a,b]=c.fighters,move=a.definition.attacks[name];
  b.invulnerableFrames=0;b.state='idle';c.resolveAttackHit(a,b,move,name,createEmptyInput());
  assert.equal(b.percent,damage,name);
  const shielded=game('verdant-grove').combat,[sa,sb]=shielded.fighters;sb.invulnerableFrames=0;sb.state='shield';
  const guard=createEmptyInput();guard.held.add('shield');shielded.resolveAttackHit(sa,sb,move,name,guard);
  assert(sb.percent<damage,'shield reduces '+name);
assert.ok(a.definition.attacks['up-special'].specialMovement);
  if(name==='down-special'){
   assert.equal(b.statusEffect,'freeze');
   for(let i=0;i<55;i++)c.step([createEmptyInput(),createEmptyInput()]);
   assert.equal(b.statusEffect,null);
  }
 }
});

test('Los Roques spawns six players on solids and migrates the raft, boat and ledges',()=>{
 const g=new Bash(101);g.configure({stage:'los-roques',seats:6,items:false});g.addPlayer('a','Ana');g.start();
 const c=g.combat;c.phase='playing';
 for(const f of c.fighters)assert(c.stage.platforms.some(p=>p.kind==='ground'&&Math.abs(f.position.x-p.x)<=p.width/2),'safe spawn');
 const p=c.stage.platforms.find(p=>p.id==='penero'),f=c.fighters[0],old=p.y;
 f.position={x:p.x,y:p.y+12+f.definition.size.height/2};f.grounded=true;f.supportPlatform=p.id;
 c.frame=80;advanceStage(c);
 assert.notEqual(p.y,old);assert.equal(f.position.y,p.y+12+f.definition.size.height/2);
 assert.equal(c.stage.ledges.find(l=>l.platformId==='penero').position.y,p.y+12);
 const restored=Bash.restore(g.snapshot(),new Map([['a',{}]]));
 for(let i=0;i<20;i++){g.update(.05);restored.update(.05);}
 assert.deepEqual(g.snapshot().fight,restored.snapshot().fight);
});
