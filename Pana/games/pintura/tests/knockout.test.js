import test from 'node:test';
import assert from 'node:assert/strict';
import { KnockoutPhysics } from '../public/knockout-physics.js';
import { Arena } from '../public/rules.js';
const points = [{x:0,y:.8,z:0},{x:0,y:1.4,z:0},{x:0,y:1.9,z:0,radius:.3}];
const make = () => new KnockoutPhysics(points, [[0,1],[1,2]], {x:1,z:0});
test('knockouts use fixed steps at 30, 60 and 120 fps and settle above ground', () => {
  const runs = [30,60,120].map(fps => { const p=make(); for(let i=0;i<fps*2;i++) p.update(1/fps); return p; });
  for(const p of runs) for(let i=0;i<3;i++) {
    assert.ok(p.points[i].y >= (points[i].radius || .12)-1e-9);
    assert.ok(Math.abs(p.points[i].x-runs[0].points[i].x)<1e-8);
    assert.ok(Number.isFinite(p.points[i].y));
  }
  assert.ok(runs[0].points[2].x>.2);
});
test('cover collision keeps the body out of crates and long frames stay bounded', () => {
  const p=new KnockoutPhysics(points, [[0,1],[1,2]], {x:10,z:0}, 2, [{x:1,z:0,w:.5,d:4,h:3}]);
  for(let i=0;i<30;i++) p.update(10);
  assert.ok(p.points.every(q=>q.x<.76 && Number.isFinite(q.y)));
});
test('paint impact direction follows the projectile, including blast origins', () => {
  const g=new Arena();g.add(1,{name:'A'});g.add(2,{name:'B'});g.start();
  const [a,b]=g.players; g.hit(b,a,a.color,{x:0,z:-34});
  assert.deepEqual(b.impact,{x:0,z:-1,zone:'body',blast:false,n:1});
  assert.deepEqual(g.events.at(-1).impact,b.impact);
  assert.equal(b.respawn,0);g.hit(b,a,a.color,{x:-2,z:0,blast:true});g.hit(b,a,a.color,{x:-2,z:0,blast:true});
  assert.equal(b.respawn,2.5);assert.equal(b.impact.x,-1);assert.equal(b.impact.blast,true);
});
