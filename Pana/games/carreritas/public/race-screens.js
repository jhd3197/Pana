// Presentation only: room countdowns and the receipt-backed wallet stay authoritative.
import { badge, nivelOf, kitNivel, trackPieces, vesselById } from './parts.js';
import { paintOf } from './shop.js';
import { ICONS } from '/engine/icons.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const pi = (c, use) => kitNivel({ car: nivelOf(c.tunes?.car ?? c.tune ?? c.def.tune), boat: nivelOf(c.tunes?.boat ?? c.def.tune), air: nivelOf(c.tunes?.plane ?? c.def.tune) }, use);
export function createRaceScreens({sound,taller}={}) {
  const grid = document.createElement('section'); grid.id = 'parrilla'; grid.className = 'race-grid'; grid.hidden = true;
  grid.setAttribute('aria-label', 'La parrilla'); grid.setAttribute('data-pad-menu',''); document.body.append(grid);
  const banner = document.createElement('div'); banner.className = 'finish-banner'; banner.hidden = true; document.body.append(banner);
  const result = document.getElementById('result'); result.classList.add('finish-screen', 'pk-results');
  const personal = document.createElement('section'); personal.className = 'race-personal fin-me'; result.querySelector('.res-side').prepend(personal);
  const collect = document.createElement('button'); collect.id = 'collect-rewards'; collect.className = 'pk-btn pk-btn--primary'; collect.textContent = '¡A cobrar!'; result.querySelector('.res-coins').append(collect);
  const cash = document.createElement('section'); cash.id = 'cash-in'; cash.className = 'cash-in'; cash.hidden = true; cash.setAttribute('aria-label', '¡A cobrar!'); result.append(cash);
  let vehiclePopup = null, inspectPanel = null, inspectGeneration = 0, previewGeneration = 0;
  const closeInspection = () => { inspectGeneration++; vehiclePopup?.close(); vehiclePopup = null; inspectPanel?.close(); };
  let receipt = null, lastPlayer = null, animation = null, stats = new WeakMap(), cashScene=null, cashGeneration=0,currentTrack=null,readyDone=null,readyFrame=0,cashedPlayer=null,pendingAction=null;
  const stat = c => { if(!stats.has(c)) stats.set(c,{peak:0,drift:0,lap:1,lapAt:0,best:null,rank:null,passes:0}); return stats.get(c); };
  const title = document.createElement('header'); title.className='fin-title'; title.append(document.getElementById('result-title'),document.getElementById('result-time')); result.prepend(title);
  collect.onclick = async () => {
    if (!receipt) return;
    const generation=++cashGeneration;cashScene?.dispose();cashScene=null;
    const {earned,balance,player,detail}=receipt;
    const rows=[['Monedas recogidas',detail?.collected??player.coinsCollected??0],['Premio de carrera',detail?.podium??detail?.prizes??0],...(detail?.cup?[['Premio de copa',detail.cup]]:[]),...(detail?.giant?[['¡Matagigantes!',detail.giant]]:[]),...(detail?.record?[['Récord de vuelta',detail.record]]:[]),['Total',earned]];
    cash.innerHTML=`<header class="fin-title"><h2 class="fin-t">¡A cobrar!</h2><p class="fin-sub">Lo que ganaste, pa’l taller.</p></header><div class="cash-wallet">${ICONS.mango}<b>${balance-earned}</b></div><div class="cb-led">${rows.map(([label,n],i)=>`<div class="cb-row ${i===rows.length-1?'tot':''}" data-line="${i}"><span>${label}</span><b class="v">+${n}</b></div>`).join('')}</div><canvas id="cash-world" aria-label="Las monedas de la carrera se convierten en mangos y caen en la caja en 3D"></canvas><div class="cash-pile-count"><b>0</b><small>MONEDAS</small></div><div class="cb-rate">1 moneda = 1 mango</div><strong class="cb-plus">+${earned}</strong><p class="cash-saved">Tus mangos ya están guardados.</p><button type="button" class="pk-btn pk-btn--primary" id="cash-done">Saltar <kbd>Enter</kbd></button>`;
    cash.hidden=false;delete cash.dataset.complete;delete cash.dataset.sceneReady;
    const done=()=>{cash.dataset.complete='true';cash.querySelector('.cash-wallet b').textContent=balance;cash.querySelector('#cash-done').textContent='Listo';cash.querySelectorAll('.cb-row').forEach(r=>r.classList.add('in'));};
    const skip=()=>{if(!cash.dataset.complete){cashScene?.finish();done();}else{++cashGeneration;cashScene?.dispose();cashScene=null;cash.hidden=true;cashedPlayer=receipt.player;collect.focus();const next=pendingAction;pendingAction=null;next?.click();}};
    cash.querySelector('button').onclick=skip;cash.querySelector('button').focus();
    cash.onclick=e=>{if(e.target.closest('button'))return;if(!cash.dataset.complete){cashScene?.finish();done();}};
    const {createCashScene}=await import('./cash-scene.js');
    if(generation!==cashGeneration||cash.hidden)return;
    cashScene=createCashScene(cash.querySelector('canvas'),{earned,awards:rows.slice(0,-1).map(r=>r[1]),sound,complete:done,progress:({time,pile,banked})=>{
      cash.querySelectorAll('.cb-row').forEach((r,i)=>r.classList.toggle('in',time>i*.3));
      cash.querySelector('.cash-pile-count b').textContent=Math.max(0,pile);cash.querySelector('.cash-wallet b').textContent=balance-earned+banked;
      cash.classList.toggle('banking',time>=5.5);
    }});
    cash.dataset.sceneReady='true';if(cash.dataset.complete)cashScene.finish();
  };
  result.addEventListener('click',e=>{const button=e.target.closest('#again,#back');if(button&&receipt?.earned>0&&cashedPlayer!==receipt.player){e.preventDefault();e.stopImmediatePropagation();pendingAction=button;collect.click();}},true);
  const table=document.getElementById('result-board');const headings=document.createElement('div');headings.className='finish-columns';headings.innerHTML='<span></span><span></span><span>Corredor</span><span>Nivel</span><span>Tiempo</span><span>Dif.</span><span>Mejor vuelta</span><span>Vel. máx</span><span>Monedas</span>';table.before(headings);
  return {
    async prepare(cars,player,track,auto=false){
      await this.grid(cars,player,track,!auto);
      if(grid.hidden)return;
      if(auto)return Promise.resolve();
      grid.classList.add('preparing');
      const footer=grid.querySelector('footer'),button=document.createElement('button');button.type='button';button.className='grid-ready pk-btn--primary';button.textContent='¡Listo!';button.autofocus=true;footer.querySelector('.grid-status').innerHTML='Salida automática en <b id="grid-count">10</b> s · se pausa al inspeccionar';footer.append(button);
      return new Promise(resolve=>{
        let previous=performance.now(),remaining=10000;
        readyDone=()=>{cancelAnimationFrame(readyFrame);readyDone=null;footer.querySelector('.grid-status').textContent='Esperando a los panas…';button.disabled=true;button.textContent='Listo';resolve();};
        button.onclick=()=>readyDone?.();button.focus();
        const tick=now=>{if(!readyDone)return;if(!inspectPanel?.matches(':modal'))remaining-=now-previous;previous=now;grid.querySelector('#grid-count').textContent=Math.max(0,Math.ceil(remaining/1000));if(remaining<=0)readyDone();else readyFrame=requestAnimationFrame(tick);};readyFrame=requestAnimationFrame(tick);
      });
    },
    rows(cars,player) {
      for(const [i,row] of [...table.children].entries()){
        const c=cars[i];if(!c)continue;const m=stat(c),leader=cars[0];
        const level=document.createElement('span');level.className='finish-level';level.innerHTML=badge(pi(c,trackPieces(currentTrack)));row.insertBefore(level,row.querySelector('.pk-row-end'));
        for(const [className,value] of [['finish-gap',c.done&&leader.done?(i?'+'+(c.time-leader.time).toFixed(1):'—'):'—'],['finish-lap',m.best==null?'—':m.best.toFixed(1)+' s'],['finish-speed',Math.round(m.peak)+' km/h'],['finish-coins',c.coinsCollected||0]]){const cell=document.createElement('span');cell.className=className;cell.textContent=value;row.append(cell);}
      }
    },
    async grid(cars, player, track, previews=true) {
      const previewRun = ++previewGeneration, images = new Map(); delete grid.dataset.previewsReady;
      closeInspection(); grid.classList.remove('preparing');
      cash.hidden = true; banner.hidden = true; stats=new WeakMap(); currentTrack=track; const use = trackPieces(track);for(const c of cars)c.kitLevel=pi(c,use);
      grid.innerHTML = `<header><div><h1>La parrilla</h1><p>${esc(track.name)} · ${use.map(k => ({car:'carro',boat:'lancha',air:'avioneta'})[k]).join(' + ')}</p></div><p class="grid-guide">Mira los carros de tus panas.<br><strong>Elige uno para ver sus piezas y guardar su kit.</strong></p></header><ol>${cars.map((c,i) => `<li class="${c === player ? 'is-me' : ''}"><details><summary aria-label="Ver kit de ${esc(c.name)}"><span class="grid-driver"><b>${esc(c.name)}${c === player ? ' · Tú' : ''}</b>${badge(pi(c,use))}</span><span class="grid-car-preview"><span class="grid-preview-status">Preparando carro…</span></span><span class="grid-car-name">${esc(c.def.name)}</span><span class="grid-inspect-action">Ver carro y kit</span></summary></details></li>`).join('')}</ol><footer><span>Tu kit ${badge(pi(player,use))}</span><span class="grid-status">Preparando los carros… <b id="grid-count">10</b></span></footer>`;
      const inspect=document.createElement('dialog');inspect.className='grid-inspect fin-me';inspect.setAttribute('aria-label','Kit del corredor');grid.append(inspect);inspectPanel=inspect;
      inspect.addEventListener('close',()=>{inspectGeneration++;vehiclePopup?.close();vehiclePopup=null;});
      inspect.addEventListener('click',e=>{const r=inspect.getBoundingClientRect();if(e.target===inspect&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))inspect.close();});
      const show=(c,modal=false)=>{
        if(modal){inspect.close();inspect.showModal();}
        const own=pi(player,use),other=pi(c,use);
        const pieces=[['Carro',c.def.name,c.tunes?.car??c.tune??c.def.tune,ICONS.kitWheel],['Lancha',vesselById('boat',c.cosmetics?.boat).name,c.tunes?.boat??vesselById('boat',c.cosmetics?.boat).tune,ICONS.kitHull],['Avioneta',vesselById('air',c.cosmetics?.air).name,c.tunes?.plane??vesselById('air',c.cosmetics?.air).tune,ICONS.kitWing]];
        inspect.innerHTML=`<div class="grid-inspect-head"><div><small>Kit de ${esc(c.name)}</small><b>${esc(c.def.name)}</b></div>${badge(other)}<button type="button" data-close aria-label="Cerrar kit">Volver a los carros</button></div><button type="button" class="grid-selected-preview" data-preview-car aria-label="Ver carro en 3D">${images.has(c)?`<img src="${images.get(c)}" alt="Carro de ${esc(c.name)} con sus piezas y pintura">`:''}<span>Ver carro en 3D · girar y acercar</span></button><div class="grid-kit">${pieces.map(([kind,name,tune,icon],i)=>`<button type="button" data-vehicle="${['car','boat','air'][i]}"><small>${kind}${use.includes(['car','boat','air'][i])?' · en esta pista':''}</small><b>${esc(name)}</b>${badge(nivelOf(tune))}</button>`).join('')}</div><p class="grid-inspect-hint">Elige un vehículo para ver sus piezas. Tu kit actual: ${badge(own)}</p><div class="grid-copy">${c===player?'':`<button type="button" data-copy="kit">Guardar kit para el taller<small>Piezas que te faltan: ${taller?.quoteKit(c)??0} mangos</small></button>`}</div><p class="grid-save-help">${c===player?'Este es el kit con el que vas a correr.':'Guarda una referencia para equiparla o comprar las piezas en el taller. No cambia tu carro en esta carrera.'}</p><p class="grid-copy-note" role="status"></p>`;
        inspect.querySelector('[data-preview-car]').onclick=()=>inspect.querySelector('[data-vehicle=car]').click();
        inspect.querySelector('[data-close]').onclick=()=>inspect.close();
        const copy=inspect.querySelector('[data-copy=kit]');if(copy)copy.onclick=()=>{const price=taller?.recommend(c)??0,short=Math.max(0,price-(taller?.balance??0));inspect.querySelector('.grid-copy-note').textContent=`Kit de ${c.name} marcado en tu taller.${short?` Te faltan ${short} mangos para las piezas.`:' Listo para equipar o comprar.'}`;};
        for(const tile of inspect.querySelectorAll('[data-vehicle]'))tile.onclick=async()=>{
          const generation=++inspectGeneration;vehiclePopup?.close();
          const {openVehicleDialog}=await import('./vehicle-inspect.js');if(generation!==inspectGeneration||grid.hidden||!inspect.open)return;
          vehiclePopup=openVehicleDialog({racer:c,kind:tile.dataset.vehicle,own:c===player,used:use.includes(tile.dataset.vehicle),taller,onColors:()=>{const row=grid.querySelector('li.is-me');row.style.setProperty('--copied',paintOf(c.cosmetics,c.def.color));row.dataset.color=paintOf(c.cosmetics,c.def.color);}});
        }
      };
      for(const [i,detail] of [...grid.querySelectorAll('details')].entries()) detail.querySelector('summary').addEventListener('click',event=>{event.preventDefault();show(cars[i],true);});show(player);
      grid.hidden = false;
      if(previews) {
        try {
          const {gridPreviews}=await import('./grid-previews.js');
          if(previewRun!==previewGeneration||grid.hidden)return;
          await gridPreviews(cars,async(c,src)=>{
            images.set(c,src);
            const target=grid.querySelectorAll('.grid-car-preview')[cars.indexOf(c)];
            const img=new Image();img.src=src;img.alt=`${c.def.name} de ${c.name}: pintura y piezas reales`;await img.decode();if(previewRun===previewGeneration&&!grid.hidden)target.replaceChildren(img);
          },()=>previewRun===previewGeneration&&!grid.hidden);
          if(previewRun===previewGeneration)grid.dataset.previewsReady='true';
        } catch(error) {
          console.error('Grid previews failed',error);
          for(const label of grid.querySelectorAll('.grid-preview-status'))label.textContent='Ver carro en 3D';
        }
      }
    },
    tick(state, count, cars=[], dt=0, order=[], clock=0) { if(state==='off'){previewGeneration++;readyDone?.();} if(state==='go') for(const c of cars){const v=stat(c),rank=order.indexOf(c);if(!c.done&&v.rank!=null&&rank<v.rank)v.passes+=v.rank-rank;v.rank=rank;v.peak=Math.max(v.peak,Math.abs(c.vf||0)*3.6);if(c.drift)v.drift+=Math.abs(c.vf||0)*dt;if(c.lap>v.lap){const lap=clock-v.lapAt;if(lap>0)v.best=Math.min(v.best??Infinity,lap);v.lap=c.lap;v.lapAt=clock;}} closeInspection(); grid.hidden = true; const el = grid.querySelector('#grid-count'); if (el) el.textContent = Math.max(1, Math.ceil(count)-1); if (state !== 'end') { if(!cash.hidden){++cashGeneration;cashScene?.dispose();cashScene=null;}cash.hidden = true; banner.hidden = true; lastPlayer = null; } },
    finish(data) {
      closeInspection();grid.hidden=true;
      receipt = data;
      const { player, place, best } = data;
      const measured=stat(player);
      personal.innerHTML = `<div class="top"><div class="pl">${place}<sup>º</sup></div><div class="who"><b>Tu carrera</b><small>${esc(player.name)}</small></div></div><dl><div><dt>Mejor vuelta</dt><dd>${best == null?'—':best.toFixed(2)+' s'}${data.detail?.record?'<small class="record">RÉCORD</small>':''}</dd></div><div><dt>Vel. máx</dt><dd>${Math.round(measured.peak)}<small>km/h</small></dd></div><div><dt>Derrape</dt><dd>${Math.round(measured.drift)}<small>m</small></dd></div><div><dt>Monedas</dt><dd>${player.coinsCollected||0}</dd></div><div><dt>Adelantamientos</dt><dd>${measured.passes}</dd></div><div><dt>Choques</dt><dd>${player.hits||0}</dd></div>${data.detail?.giant?`<div class="mg"><dt>¡Matagigantes!</dt><dd>+${data.detail.giant}<small>${(data.detail.giants??[]).map(g=>esc(g.name)+' '+badge(g.pi)).join(', ')}</small></dd></div>`:''}</dl>`;
      if (lastPlayer !== player) {
        lastPlayer = player; banner.textContent = player.done ? '¡META!' : 'Fin de carrera'; banner.hidden = false;
        animation?.cancel();
        animation = banner.animate([{opacity:0,transform:'scale(1.4) rotate(-5deg)'},{opacity:1,transform:'scale(1) rotate(-5deg)',offset:.2},{opacity:1,offset:.7},{opacity:0}], {duration:matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 1500,fill:'forwards'});
        animation.onfinish = () => { banner.hidden = true; };
      }
    },
  };
}
