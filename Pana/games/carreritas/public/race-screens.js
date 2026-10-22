// Presentation only: room countdowns and the receipt-backed wallet stay authoritative.
import { badge, nivelOf, kitNivel, trackPieces, vesselById } from './parts.js';
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
    prepare(cars,player,track,auto=false){
      this.grid(cars,player,track);
      if(auto)return Promise.resolve();
      grid.classList.add('preparing');
      const footer=grid.querySelector('footer'),button=document.createElement('button');button.type='button';button.className='grid-ready pk-btn--primary';button.textContent='¡Listo!';button.autofocus=true;footer.querySelector('.grid-status').innerHTML='Revisa tu kit · <b id="grid-count">10</b> s';footer.append(button);
      return new Promise(resolve=>{
        const end=performance.now()+10000;
        readyDone=()=>{cancelAnimationFrame(readyFrame);readyDone=null;footer.querySelector('.grid-status').textContent='Esperando a los panas…';button.disabled=true;button.textContent='Listo';resolve();};
        button.onclick=()=>readyDone?.();button.focus();
        const tick=now=>{if(!readyDone)return;grid.querySelector('#grid-count').textContent=Math.max(0,Math.ceil((end-now)/1000));if(now>=end)readyDone();else readyFrame=requestAnimationFrame(tick);};readyFrame=requestAnimationFrame(tick);
      });
    },
    rows(cars,player) {
      for(const [i,row] of [...table.children].entries()){
        const c=cars[i];if(!c)continue;const m=stat(c),leader=cars[0];
        const level=document.createElement('span');level.className='finish-level';level.innerHTML=badge(pi(c,trackPieces(currentTrack)));row.insertBefore(level,row.querySelector('.pk-row-end'));
        for(const [className,value] of [['finish-gap',c.done&&leader.done?(i?'+'+(c.time-leader.time).toFixed(1):'—'):'—'],['finish-lap',m.best==null?'—':m.best.toFixed(1)+' s'],['finish-speed',Math.round(m.peak)+' km/h'],['finish-coins',c.coinsCollected||0]]){const cell=document.createElement('span');cell.className=className;cell.textContent=value;row.append(cell);}
      }
    },
    grid(cars, player, track) {
      grid.classList.remove('preparing');
      cash.hidden = true; banner.hidden = true; stats=new WeakMap(); currentTrack=track; const use = trackPieces(track);for(const c of cars)c.kitLevel=pi(c,use);
      grid.innerHTML = `<header><h1>La parrilla</h1><p>${esc(track.name)} · ${use.map(k => ({car:'carro',boat:'lancha',air:'avioneta'})[k]).join(' + ')}</p></header><ol>${cars.map((c,i) => `<li class="${c === player ? 'is-me' : ''}"><b>${i+1}</b><details><summary>${esc(c.name)} ${c === player ? '· Tú' : ''}</summary><p>${esc(c.def.name)} · ${esc(vesselById('boat',c.cosmetics?.boat).name)} · ${esc(vesselById('air',c.cosmetics?.air).name)}</p></details><span class="grid-pieces">${use.map(k=>esc(k==='car'?c.def.name:vesselById(k,c.cosmetics?.[k]).name)).join(' · ')}</span>${badge(pi(c,use))}</li>`).join('')}</ol><footer>Tu kit ${badge(pi(player,use))}<span class="grid-status">Salimos en <b id="grid-count">3</b></span></footer>`;
      const ranking=[...cars].sort((a,b)=>pi(a,use)-pi(b,use));for(const [i,row] of [...grid.querySelectorAll('li')].entries()){row.style.setProperty('--reveal',`${ranking.indexOf(cars[i])*.16}s`);if(pi(cars[i],use)===pi(ranking.at(-1),use)){row.classList.add('strongest');row.querySelector('summary').insertAdjacentHTML('beforeend',' <em>¡OJO!</em>');}}
      const inspect=document.createElement('aside');inspect.className='grid-inspect fin-me';grid.append(inspect);
      const show=c=>{
        const own=pi(player,use),other=pi(c,use),average=Math.round(cars.reduce((n,v)=>n+pi(v,use),0)/cars.length);
        const pieces=[['Carro',c.def.name,c.tunes?.car??c.tune??c.def.tune,ICONS.kitWheel],['Lancha',vesselById('boat',c.cosmetics?.boat).name,c.tunes?.boat??vesselById('boat',c.cosmetics?.boat).tune,ICONS.kitHull],['Avioneta',vesselById('air',c.cosmetics?.air).name,c.tunes?.plane??vesselById('air',c.cosmetics?.air).tune,ICONS.kitWing]];
        inspect.innerHTML=`<div class="grid-inspect-head"><b>${esc(c.name)}</b>${badge(other)}</div><div class="grid-kit">${pieces.map(([kind,name,tune,icon])=>`<div><small>${kind}</small>${icon}<b>${esc(name)}</b>${badge(nivelOf(tune))}</div>`).join('')}</div><dl><div><dt>Tu kit</dt><dd>${badge(own)}</dd></div><div><dt>Media de la parrilla</dt><dd>${badge(average)}</dd></div><div><dt>Diferencia</dt><dd>${own-average>0?'+':''}${own-average}</dd></div></dl><div class="grid-distribution"><div><i>D</i><i>C</i><i>B</i><i>A</i><i>S</i></div>${cars.map(v=>`<b class="${v===player?'me':''}" title="${esc(v.name)} · ${pi(v,use)}" style="left:${Math.min(98,Math.max(2,(pi(v,use)-300)/500*100))}%;--c:${v.def.color}"></b>`).join('')}</div><p>¡Matagigantes! +5 mangos por cada rival de mayor nivel que dejes atrás.</p><div class="grid-copy"><button type="button" data-copy="kit">Copiar kit ${badge(other)}<small>${taller?.quoteKit(c)??0} mangos</small></button><button type="button" data-copy="colors">Copiar colores</button></div><p class="grid-copy-note" role="status"></p>`;
        inspect.querySelector('[data-copy=kit]').onclick=()=>{taller?.recommend(c);inspect.querySelector('.grid-copy-note').textContent='Piezas marcadas en tu taller para la próxima carrera.';};
        inspect.querySelector('[data-copy=colors]').onclick=()=>{const ok=taller?.copyColors(c);inspect.querySelector('.grid-copy-note').textContent=ok?'Colores guardados para tu próximo kit.':'Te faltan mangos para esta pintura.';if(ok)grid.querySelector('li.is-me').style.setProperty('--copied',c.def.color);};
      };
      for(const [i,detail] of [...grid.querySelectorAll('details')].entries()) detail.addEventListener('toggle',()=>{if(detail.open)show(cars[i]);});show(player);
      grid.hidden = false;
    },
    tick(state, count, cars=[], dt=0, order=[], clock=0) { if(state==='off')readyDone?.(); if(state==='go') for(const c of cars){const v=stat(c),rank=order.indexOf(c);if(!c.done&&v.rank!=null&&rank<v.rank)v.passes+=v.rank-rank;v.rank=rank;v.peak=Math.max(v.peak,Math.abs(c.vf||0)*3.6);if(c.drift)v.drift+=Math.abs(c.vf||0)*dt;if(c.lap>v.lap){const lap=clock-v.lapAt;if(lap>0)v.best=Math.min(v.best??Infinity,lap);v.lap=c.lap;v.lapAt=clock;}} grid.hidden = state !== 'count'; const el = grid.querySelector('#grid-count'); if (el) el.textContent = Math.max(1, Math.ceil(count)-1); if (state !== 'end') { if(!cash.hidden){++cashGeneration;cashScene?.dispose();cashScene=null;}cash.hidden = true; banner.hidden = true; lastPlayer = null; } },
    finish(data) {
      grid.hidden=true;
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
