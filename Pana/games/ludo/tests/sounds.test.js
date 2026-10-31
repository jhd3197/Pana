import test from 'node:test';
import assert from 'node:assert/strict';
import { createLudoSounds, SAMPLES } from '../public/sounds.js';
function fixture() {
  const calls=[], requests=[], gain=()=>({gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){return this;},disconnect(){}});
  const sound={muted:false,volume:1,admit:()=>({gs:[]}),out:()=>({}),ctx:{currentTime:0,
    decodeAudioData:async()=>({duration:.15}),createGain:gain,
    createBufferSource(){const s={playbackRate:{value:1},connect(){return gain();},disconnect(){},start(t){calls.push({rate:s.playbackRate.value,t});},stop(){}};return s;}}};
  const audio=createLudoSounds(sound,{events:null,fetchAudio:async url=>{requests.push(url);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};}});
  return {sound,audio,calls,requests};
}
function all(audio) {
  audio.shake(.8);audio.throw(.8);audio.bounce(1);audio.result(6);audio.step(3);
  for(const option of [{},{entry:true},{capture:true},{home:true},{win:true}])audio.land(option);
  audio.returnHome();
  for(const kind of ['intro','turn','suspense','safe','block','leap','sprint','nearmiss','nomoves','sleep','podium'])audio.moment(kind);
  for(const style of ['highfive','slip','rollbarrel','moonwalk','spring','dodge','piggy','umbrella','tunnel','gum'])audio.trick(style);
}
test('recordings load once and use the shared voice budget and master output',async()=>{
  const {sound,audio,calls,requests}=fixture();await audio.prepare();await audio.prepare();
  assert.equal(requests.length,SAMPLES.length);all(audio);assert.ok(calls.length>20);
  assert.ok(calls.every(c=>Number.isFinite(c.rate)&&c.rate>=.6&&c.rate<=2&&c.t>=0&&c.t<1));
  calls.length=0;sound.admit=()=>null;all(audio);assert.equal(calls.length,0);audio.dispose();
});
test('mute, zero volume and disposal suppress recorded cues',async()=>{
  for(const mode of ['muted','silent','disposed']){
    const {sound,audio,calls}=fixture();await audio.prepare();
    if(mode==='disposed')audio.dispose();else if(mode==='muted')sound.muted=true;else sound.volume=0;
    all(audio);assert.equal(calls.length,0,mode);audio.dispose();
  }
});
test('late downloads do not replay old steps and victory does not stack home cues',async()=>{
  const {audio,calls}=fixture();audio.step();await audio.prepare();assert.equal(calls.length,0);
  audio.land({win:true,home:true});const win=[...calls];calls.length=0;audio.land({win:true});assert.deepEqual(calls,win);
  audio.dispose();
});
