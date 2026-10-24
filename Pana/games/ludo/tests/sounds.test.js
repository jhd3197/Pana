import test from 'node:test';
import assert from 'node:assert/strict';
import { createLudoSounds } from '../public/sounds.js';

function fixture() {
  const calls=[], sound={muted:false,volume:1,tone:(...args)=>calls.push(['tone',...args]),sweep:(...args)=>calls.push(['sweep',...args])};
  return {sound,calls};
}
function all(audio) {
  audio.shake(.8);audio.throw(.8);audio.bounce(1);audio.result(6);audio.step(3);
  for(const option of [{},{entry:true},{capture:true},{home:true},{win:true}])audio.land(option);
  audio.returnHome();
  for(const kind of ['intro','turn','suspense','safe','block','leap','sprint','nearmiss','nomoves','sleep','podium'])audio.moment(kind);
  for(const style of ['highfive','slip','rollbarrel','moonwalk','spring','dodge','piggy','umbrella','tunnel','gum'])audio.trick(style);
}
test('every Ludo cue respects mute, zero volume and hidden pages',()=>{
  for(const mode of ['muted','silent','hidden']) {
    const {sound,calls}=fixture();sound.muted=mode==='muted';sound.volume=mode==='silent'?0:1;
    all(createLudoSounds(sound,{audible:()=>mode!=='hidden'}));assert.equal(calls.length,0,mode);
  }
});
test('Ludo cues use finite short voices and a modest peak level',()=>{
  const {sound,calls}=fixture();all(createLudoSounds(sound));assert.ok(calls.length>20);
  for(const [kind,a,b,duration,type,volume] of calls) {
    assert.ok([a,b,duration,volume].every(Number.isFinite));assert.ok(duration>=.04&&duration<=.4);
    assert.ok(volume>0&&volume<=.07);assert.ok(['triangle','sine'].includes(type));
    if(kind==='tone')assert.ok(b>=0&&b+duration<1);
  }
});
test('six and victory have distinct celebrations without stacking home cues',()=>{
  const {sound,calls}=fixture(),audio=createLudoSounds(sound);
  audio.result(2);const ordinary=calls.length;calls.length=0;audio.result(6);assert.ok(calls.length>ordinary);
  calls.length=0;audio.land({win:true,home:true});const win=[...calls];calls.length=0;audio.land({win:true});assert.deepEqual(calls,win);
});
