// Capture comparable driver views, runtime inventory and a real automated lap.
// node Pana/scripts/map-audit.js --tracks plaza,selva --out art/map-audit/baseline
// Add --motion 12 --start .5 for a scrub-able 20 fps simulation sequence.
// Output is local evidence, never committed. Render timings are synchronous
// submissions with GPU completion, not a claim about interactive browser FPS.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { startServer } from './pana-server.js';
import { TRACK_DEFINITIONS } from '../games/carreritas/public/track-definitions.js';

const args=process.argv.slice(2);
const opt=(key,fallback)=>{const i=args.indexOf(`--${key}`);return i<0?fallback:args[i+1];};
const out=path.resolve(opt('out','art/map-audit/baseline'));
const quality=opt('quality','alta');
const motionSeconds=Number(opt('motion','0')),startFraction=Number(opt('start','0.5'));
if(!Number.isFinite(motionSeconds)||motionSeconds<0||motionSeconds>120||!Number.isFinite(startFraction)||startFraction<0||startFraction>=1)throw new Error('Use --motion 0..120 seconds and --start 0..<1 lap fraction');
const poses=opt('poses','.05,.15,.25,.35,.45,.55,.65,.75,.85,.95').split(',').map(Number);
if(!poses.length||poses.some(n=>!Number.isFinite(n)||n<0||n>=1))throw new Error('Pose fractions must be in 0..<1');
const camera=opt('camera','current');
if(!['current','legacy','anticipation'].includes(camera))throw new Error('Unknown camera comparison mode');
if(!['alta','media','baja'].includes(quality))throw new Error('Unknown quality');
const root=path.resolve(import.meta.dirname,'../..');
fs.mkdirSync(out,{recursive:true});
const revision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const diff=execFileSync('git',['diff','HEAD','--binary'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(out,'source.diff'),diff);
const manifest={revision,started:new Date().toISOString(),platform:process.platform,cpu:os.cpus()[0]?.model,
  viewport:{width:1280,height:720},quality,seed:107,motionSeconds,startFraction,poses,camera,method:'fixed driver poses plus automated 1-lap simulation; no realtime FPS claim',maps:[]};
const server=await startServer();
const browser=await chromium.launch({headless:true,...(process.env.PANA_BROWSER_PATH?{executablePath:process.env.PANA_BROWSER_PATH}:{})});
try {
  // Each map has an isolated context, so random state, weather and storage
  // never inherit from the preceding circuit or an earlier audit run.
  const ids=opt('tracks',null)?.split(',')||TRACK_DEFINITIONS.map(t=>t.id);
  for(const id of ids){
    const dir=path.join(out,id);fs.mkdirSync(dir,{recursive:true});
    const context=await browser.newContext({viewport:manifest.viewport,deviceScaleFactor:1});
    await context.addInitScript(({quality})=>{
      let seed=107;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      localStorage.setItem('pana:name','Map audit');
      localStorage.setItem('pana:settings',JSON.stringify({sound:false,music:0,quality}));
    },{quality});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const begun=Date.now();
    console.log(`Loading ${id}`);
    try {
      await page.goto(`${server.base}/g/carreritas/?debug&manual&auto&track=${encodeURIComponent(id)}&camera=${camera}`);
      await page.waitForFunction(()=>window.getActiveTrack&&window.garage?.car,null,{timeout:180000});
      const info=await page.evaluate(async id=>{
        const THREE=await import('three');
        if(!TRACKS.some(t=>t.id===id))throw new Error(`Unknown track ${id}`);
        toGarage();buildTrack(id);setup.mode='race';setup.laps=1;await startRace(0);
        const T=getActiveTrack();
        renderer.toneMapping=THREE.NoToneMapping;
        let minHeight=Infinity,maxHeight=-Infinity,maxGrade=0,minRadius=Infinity;
        for(let s=0;s<T.TOTAL;s+=2){
          const h=T.heightAtS(s);minHeight=Math.min(minHeight,h);maxHeight=Math.max(maxHeight,h);
          maxGrade=Math.max(maxGrade,Math.abs(T.heightAtS(s+.5)-T.heightAtS(s-.5)));
          const a=T.pointAt(s-1),b=T.pointAt(s),c=T.pointAt(s+1);
          const t=Math.atan2(c.y-b.y,c.x-b.x)-Math.atan2(b.y-a.y,b.x-a.x);
          minRadius=Math.min(minRadius,1/Math.max(1e-9,Math.abs(Math.atan2(Math.sin(t),Math.cos(t)))));
        }
        const gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
        return {id,length:T.TOTAL,width:T.HW*2,minHeight,maxHeight,maxGrade,minRadius,
          sectors:T.def.sectors||[],rain:T.def.rain||0,palette:T.def.palette,
          layered:!!T.def.layered,crossfall:!!T.def.crossfall,transformGates:T.def.transformGates||[],
          authored:T.group.getObjectByName('authored-sightlines')?.userData.sites||[],
          gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};
      },id);
      info.readyMs=Date.now()-begun;info.poses=[];
      for(const u of poses){
        const result=await page.evaluate(u=>{
          const T=getActiveTrack(),p=race.player,s=u*T.TOTAL;
          placeRacer(p,0,(T.LINE-9-s)/8);race.state='audit';race.clock=30;race.camPos=null;race.shake=0;p.boost=0;
          // The audit state suppresses driving; settle presentation/camera only.
          for(let i=0;i<60;i++)updateRace(1/60,true);
          renderer.setPixelRatio(1);renderer.setSize(1280,720);
          const gl=renderer.getContext(),samples=[];
          for(let i=0;i<7;i++){const start=performance.now();renderer.render(race.scene,race.camera);gl.finish();if(i>=2)samples.push(performance.now()-start);}
          samples.sort((a,b)=>a-b);
          return {image:renderer.domElement.toDataURL('image/jpeg',.85),u,
            pose:{x:p.x,y:p.y,z:p.z,h:p.h},camera:{position:race.camera.position.toArray(),quaternion:race.camera.quaternion.toArray(),fov:race.camera.fov},
            clock:race.clock,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
            memory:{...renderer.info.memory},synchronousRenderMs:{median:samples[2],max:samples[4],samples:5}};
        },u);
        fs.writeFileSync(path.join(dir,`pose-${u}.jpg`),Buffer.from(result.image.split(',')[1],'base64'));
        delete result.image;info.poses.push(result);
        fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify(info,null,2));
      }
      // Restart after posed captures. These are actual AI/physics updates,
      // separate from the fixed poses; never infer race completion from a tour.
      if(motionSeconds>0){
        console.log(`${id}: recording ${motionSeconds}s driver sequence from ${startFraction}`);
        await page.evaluate(async u=>{
          await startRace(0);race.state='go';race.count=0;
          const T=getActiveTrack();placeRacer(race.player,0,(T.LINE-9-u*T.TOTAL)/8);race.camPos=null;
        },startFraction);
        const frames=[];
        for(let frame=0;frame<Math.ceil(motionSeconds*20);frame++){
          const sample=await page.evaluate(()=>{
            for(let i=0;i<3;i++)updateRace(1/60,true);
            renderer.render(race.scene,race.camera);
            const p=race.player;
            return {image:renderer.domElement.toDataURL('image/jpeg',.82),clock:race.clock,
              pose:{x:p.x,y:p.y,z:p.z,h:p.h,speed:p.vf},
              camera:{position:race.camera.position.toArray(),quaternion:race.camera.quaternion.toArray(),fov:race.camera.fov}};
          });
          const file=`motion-${String(frame).padStart(4,'0')}.jpg`;
          fs.writeFileSync(path.join(dir,file),Buffer.from(sample.image.split(',')[1],'base64'));
          delete sample.image;frames.push({file,...sample});
        }
        info.motion={fps:20,startFraction,seconds:motionSeconds,method:'60 Hz physics; render every third step; playback is simulation time, not measured FPS',frames};
        fs.writeFileSync(path.join(dir,'motion.html'),`<!doctype html><meta charset="utf-8"><title>Driver sequence</title><style>body{background:#171c20;color:white;font:16px system-ui;margin:24px}img{display:block;width:min(100%,1280px)}input{width:min(100%,1280px)}button{padding:10px;margin:12px 12px 12px 0}</style><h1>Driver sequence</h1><p>20 frames per simulated second. This is a deterministic review sequence, not a performance recording.</p><img id="view"><button id="play">Play / pause</button><output id="time"></output><br><input id="seek" type="range" min="0" max="${frames.length-1}" value="0"><script>const files=${JSON.stringify(frames.map(f=>f.file))};let n=0,playing=false;const view=document.querySelector('#view'),seek=document.querySelector('#seek'),time=document.querySelector('#time');function show(){view.src=files[n];seek.value=n;time.textContent=(n/20).toFixed(2)+' s'}document.querySelector('#play').onclick=()=>playing=!playing;seek.oninput=()=>{n=Number(seek.value);show()};setInterval(()=>{if(playing){n=(n+1)%files.length;show()}},50);show();</script>`);
      }
      console.log(`${id}: ${poses.length} driver poses captured; running automated lap`);
      await page.evaluate(async()=>{await startRace(0);race.state='go';race.count=0;});
      let drive={finished:false},step=0;info.drive=[];
      const limit=Math.max(36000,Math.ceil(info.length/8*60));
      while(!drive.finished&&step<limit){
        drive=await page.evaluate(()=>{
          for(let i=0;i<600&&race.state!=='end';i++)updateRace(1/60,true);
          const p=race.player,T=getActiveTrack();
          return {clock:race.clock,finished:race.state==='end',lap:p.lap,u:T.paramOf(p.x,p.z,p.y)/T.TOTAL,
            x:p.x,y:p.y,z:p.z,speed:p.vf,boat:!!p.boat,air:!p.onGround,rescue:p.rescueT,
            camera:race.camera.position.toArray(),finite:[p.x,p.y,p.z,...race.camera.position.toArray()].every(Number.isFinite)};
        });
        info.drive.push(drive);step+=600;
      }
      info.finished=drive.finished;info.errors=errors;info.elapsedMs=Date.now()-begun;
      fs.writeFileSync(path.join(dir,'audit.json'),JSON.stringify(info,null,2));
      manifest.maps.push({id,finished:info.finished,errors,elapsedMs:info.elapsedMs});
      console.log(JSON.stringify({id,finished:info.finished,seconds:drive.clock,length:Math.round(info.length),errors}));
    }catch(e){manifest.maps.push({id,error:String(e),errors});console.error(id,String(e));}
    finally{await context.close();fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));}
  }
}finally{await browser.close();server.stop();}
if(manifest.maps.some(m=>m.error||m.errors.length||!m.finished))process.exitCode=1;
