import { cachedPortrait } from '/engine/portrait-cache.js';
import { ATTACK_THEMES } from './artifact-attacks.js';
import { STYLE_NAMES } from './rules.js';
import { loc, locn } from '/engine/i18n.js';
export function createFightHud() {
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const rows=[0,1,2,3,4,5].map(i=>{
    const root=document.getElementById('fighter-'+i);
    root.innerHTML='<img class="fighter-portrait" alt=""><div class="fighter-label"><span class="fighter-name" translate="no"></span><span class="fighter-style"></span></div><div class="fighter-vitals"><b class="damage">0<small>%</small></b><div class="fighter-reserves"><span class="stocks"></span><span class="shield-label">Escudo</span><span class="shield-track"><span></span></span></div></div>';
    return {root,portrait:root.querySelector('.fighter-portrait'),portraitKey:null,name:root.querySelector('.fighter-name'),style:root.querySelector('.fighter-style'),damage:root.querySelector('.damage'),stocks:root.querySelector('.stocks'),shield:root.querySelector('.shield-track span'),percent:0};
  });
  const call=document.getElementById('countdown');let round=-1,frame=-1,until=0,message='';
  return state=>{
    if(state.round!==round){round=state.round;frame=-1;until=0;}
    rows.forEach((row, i) => { row.root.hidden = !state.players[i]; });
    state.players.forEach((p,i)=>{
      const row=rows[i], f=state.fight?.fighters[i],percent=Math.round(f?.percent??0),stocks=f?.stocks??state.options.stocks;
      const avatar=p.bot?{outfitColor:['#ffc629','#2ad1b2','#fa7467','#a798e8','#77b8ff','#f5a552'][i],face:'feliz'}:p.avatar;
      const key=JSON.stringify(avatar);
      if(key!==row.portraitKey){
        row.portraitKey=key;row.portrait.removeAttribute('src');
        const cached=cachedPortrait(avatar);
        if(cached)row.portrait.src=cached;
        else import('/engine/portrait.js').then(({portrait})=>portrait(avatar)).then(src=>{if(row.portraitKey===key)row.portrait.src=src;}).catch(()=>{});
      }
      row.name.textContent=p.name;row.style.textContent=p.bot?loc('Bot · {style}',{style:loc(STYLE_NAMES[p.style])}):loc(STYLE_NAMES[p.style]);
      if(row.percent!==percent){row.damage.innerHTML=percent+'<small>%</small>';if(percent>row.percent&&!reduced.matches)row.damage.animate([{transform:'scale(1.18)'},{transform:'scale(1)'}],{duration:190});row.percent=percent;}
      row.root.dataset.danger=percent>=100?'high':percent>=60?'medium':'low';
      const stockKey=stocks+':'+state.options.stocks;
      if(row.stocks.dataset.value!==stockKey){
        row.stocks.dataset.value=stockKey;row.stocks.replaceChildren();
        row.stocks.setAttribute('aria-label',locn(stocks,'{n} vidas','{n} vidas'));
        for(let life=0;life<state.options.stocks;life++){const pip=document.createElement('i');pip.className=life>=stocks?'is-lost':'';pip.setAttribute('aria-hidden','true');row.stocks.append(pip);}
      }
      row.root.dataset.out=stocks===0;
      row.shield.style.transform=`scaleX(${f?Math.max(0,f.shield/f.maxShield):1})`;
      row.root.setAttribute('aria-label',locn(stocks,'{name}: {percent}% de daño, {n} vidas','{name}: {percent}% de daño, {n} vidas',{name:p.name,percent}));
    });
    const fight=state.fight,now=performance.now();
    if(fight&&fight.frame>frame){
      for(const e of fight.events){
        if(e.frame<=frame)continue;
        if(e.type==='hit'&&ATTACK_THEMES[e.move]){message=loc('¡{move}!',{move:loc(ATTACK_THEMES[e.move].name)});until=now+500;}
        if(e.type==='ko'){message=loc('¡Fuera!');until=now+1000;}
        if(e.type==='match-start'){message=loc('¡Dale!');until=now+650;}
        if(e.type==='sudden-death'){message=loc('Muerte súbita');until=now+1500;}
      }
      frame=fight.frame;
    }
    const text=fight?.phase==='countdown'?String(Math.ceil(fight.countdownFrames/60)):now<until&&state.phase==='playing'?message:'';
    if(call.textContent!==text){call.textContent=text;if(text&&!reduced.matches)call.animate([{transform:'translateX(-50%) scale(1.2)',opacity:0},{transform:'translateX(-50%) scale(1)',opacity:1}],{duration:180});}
  };
}
