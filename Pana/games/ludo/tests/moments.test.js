import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionMoments, landingMoments, MOMENTS } from '../public/moment-events.js';
import { LudoGame } from '../public/rules.js';
test('extra moments follow real transitions and skip first snapshots',()=>{
 const g=new LudoGame(1),before=g.snapshot();assert.deepEqual(transitionMoments(null,before),[]);
 g.phase='starter';g.round++;assert.deepEqual(transitionMoments(before,g),[{kind:'intro',seat:0}]);
 let prev=g.snapshot();g.phase='playing';assert.equal(transitionMoments(prev,g)[0].kind,'turn');
 prev=g.snapshot();g.rng++;g.lastDie=3;g.toss={seat:0,power:.5};g.turn=1;
 assert.deepEqual(transitionMoments(prev,g).map(e=>e.kind).sort(),['nomoves','suspense','turn']);
 assert.deepEqual(transitionMoments(g,g),[]);prev=g.snapshot();g.phase='finished';g.winner=1;
 assert.deepEqual(transitionMoments(prev,g),[{kind:'podium',seat:1}]);assert.equal(MOMENTS.length,11);
});
test('safe squares, same-color stacks and near misses do not alter the board',()=>{
 const g=new LudoGame(1);g.phase='playing';g.players[0].pieces=[0,0,-1,-1];
 const before=JSON.stringify(g);assert.deepEqual(landingMoments(g,0,0).map(e=>e.kind),['safe','block']);assert.equal(JSON.stringify(g),before);
 g.players[0].pieces=[17,-1,-1,-1];g.players[1].pieces=[5,-1,-1,-1];
 assert.deepEqual(landingMoments(g,0,0),[{kind:'nearmiss',seat:1,piece:0}]);
 g.players[0].pieces[0]=56;assert.deepEqual(landingMoments(g,0,0),[]);
});
