// One quiet, looping noise source routed through the shared sound controls.
// Filter changes distinguish open wind/water from the enclosed river chamber.
export function createWaterAmbience(sound) {
  let source,filter,gain;
  return {
    update(track,x,z){
      if(!['salto','delta','cuevas','salinas'].includes(track.id)||!sound.ctx){this.stop();return;}
      const context=sound.ctx;
      if(!source){
        const buffer=context.createBuffer(1,context.sampleRate*2,context.sampleRate),data=buffer.getChannelData(0);
        let n=56,last=0;for(let i=0;i<data.length;i++){n=(Math.imul(n,1664525)+1013904223)>>>0;last=(last+.035*(n/2147483648-1))/1.035;data[i]=last*5;}
        source=context.createBufferSource();source.buffer=buffer;source.loop=true;
        filter=context.createBiquadFilter();filter.type='lowpass';gain=context.createGain();gain.gain.value=0;
        source.connect(filter).connect(gain).connect(sound.out());source.start();
      }
      const u=track.paramOf(x,z)/track.TOTAL,cave=track.id==='cuevas'&&u>.1&&u<.61;
      const nearFall=track.id==='salto'?Math.max(0,1-Math.hypot(x,z)/220):0;
      filter.frequency.setTargetAtTime(cave?340:track.id==='salinas'?1400:850,context.currentTime,.3);
      gain.gain.setTargetAtTime(sound.muted?0:(cave?.075:.035)+nearFall*.11,context.currentTime,.3);
    },
    stop(){if(!source)return;source.stop();source.disconnect();filter.disconnect();gain.disconnect();source=filter=gain=null;},
    get active(){return !!source;},
  };
}
