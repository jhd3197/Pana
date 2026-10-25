import assert from 'node:assert/strict';
import { launch, openGame } from '../../../tests/browser-kit.js';
const browser=await launch();
try {
  const page=await openGame(browser,'ludo',{name:'Audio QA'});
  const levels=await page.evaluate(async()=>{
    const {sound}=await import('/engine/fx.js');
    const {createLudoSounds}=await import('/g/ludo/sounds.js');
    const levels=[], synth=Object.create(sound);
    for(const volume of [1,.25,0]) {
      synth.ctx=new OfflineAudioContext(1,48000,48000);synth.master=null;synth.voices=[];synth.muted=false;synth.volume=volume;
      const audio=createLudoSounds(synth);await audio.prepare();audio.result(6);audio.land({capture:true});
      const buffer=await synth.ctx.startRendering(),samples=buffer.getChannelData(0);
      if(!samples.every(Number.isFinite))throw Error('non-finite audio');
      levels.push(Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length));audio.dispose();
    }
    synth.ctx=null;synth.master=null;synth.voices=[];synth.muted=true;
    return levels;
  });
  assert.ok(levels[0]>.005&&levels[0]<.2,`audible, bounded mix: ${levels}`);
  assert.ok(Math.abs(levels[1]/levels[0]-.25)<.01,'shared volume scales the rendered signal');
  assert.equal(levels[2],0);assert.deepEqual(page.errors,[]);
  console.log('ok: real Web Audio produces finite audible cues and follows shared volume');
} finally {await browser.close();}
