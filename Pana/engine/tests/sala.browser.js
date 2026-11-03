import assert from 'node:assert/strict';
import { launch, openGame, base } from '../../tests/browser-kit.js';
const browser=await launch();
const prepared=p=>p.waitForFunction(()=>document.querySelector('.prototype-sala') && !document.querySelector('.pk-cover') && !document.getElementById('pana-lobby-ready').disabled,null,{timeout:120000});
try {
  for(const game of ['carreritas','pintura']) {
    const code=`sala-${game}-${Date.now()}`;
    const host=await openGame(browser,game,{name:'Ana',room:code,query:'debug&manual'});await prepared(host);
    const guest=await openGame(browser,game,{name:'Luis',room:code,query:'debug&manual'});await prepared(guest);
    await host.waitForFunction(()=>document.querySelectorAll('.pk-game-lobby-player').length===2);
    assert.equal(await host.locator('#pana-lobby-roster>*').count(),game==='carreritas'?12:8);
    assert.equal(await host.locator('.sala-player-kit').count(),2);
    for(const [width,height] of [[1024,768],[1280,800],[1440,900],[1920,1080]]) {
      await host.setViewportSize({width,height});
      const fit=await host.evaluate(()=>{
        const lobby=document.querySelector('.pk-game-lobby'),edge=sel=>document.querySelector(sel).getBoundingClientRect().right-innerWidth;
        const sideways=[lobby,...lobby.querySelectorAll('*')].filter(el=>el.scrollWidth>el.clientWidth+1&&(/auto|scroll/.test(getComputedStyle(el).overflowX)||el.matches('.pk-game-lobby-layout,.pk-game-lobby-roster,.pk-game-lobby-settings'))).map(el=>String(el.className));
        return {sideways,page:document.documentElement.scrollWidth-innerWidth,settings:edge('.pk-game-lobby-settings'),code:edge('.pk-game-lobby-code')};
      });
      assert.deepEqual(fit.sideways,[],`${game} lobby has no sideways scrollbar at ${width}px`);
      assert.ok(fit.page<=0&&fit.settings<=0.5&&fit.code<=0,`${game} lobby fits ${width}px: ${JSON.stringify(fit)}`);
    }
    await host.setViewportSize({width:1280,height:800});
    await guest.locator('.pk-game-lobby-player.is-own').click();
    await host.waitForFunction(()=>[...document.querySelectorAll('.pk-game-lobby-state')].some(n=>n.textContent==='Esperando'));
    await host.locator('#start').click();assert.ok(await host.locator('#pana-lobby-shell').isVisible(),'unready pana blocks start');
    await guest.locator('.pk-game-lobby-player.is-own').click();
    await host.waitForFunction(()=>[...document.querySelectorAll('.pk-game-lobby-state')].every(n=>n.textContent==='Listo'));
    if(game==='pintura') {
      // The main lobby asks only Partida and Modo; the rest waits in Más ajustes.
      assert.deepEqual(await host.locator('.pk-room-primary .pk-room-field:not([hidden])').evaluateAll(n=>n.map(f=>f.querySelector('button').dataset.roomOption)),['sides','ffaMode']);
      assert.equal(await host.locator('.pk-room-primary [data-room-option=duration]').count(),0,'round time lives in Más ajustes');
      // Teams vs everyone is a main setting; the team panels stand in the main lobby.
      await host.locator('[data-room-option=sides][data-value=teams]').click();
      await guest.locator('.pk-game-lobby-roster #team-roster .pk-roster-group').first().waitFor();
      assert.equal(await guest.locator('#team-roster .pk-roster-group').count(),2,'both teams show in the main lobby');
      assert.equal(await host.locator('#pana-room-dialog #team-roster').count(),0,'teams are not hidden in Más ajustes');
      assert.ok(await host.locator('[data-room-option=teamMode][data-value=ctf]').isVisible(),'team games are picked next to Equipos');
      // Four seats a side stand as a 2×2 grid.
      const cols=await guest.locator('#team-roster .pk-roster-cards').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);
      assert.equal(cols,2,'four seats a side are two columns');
      await host.locator('[data-room-option=teamMode][data-value=hardcore]').click();
      await guest.waitForFunction(()=>document.querySelector('.sala-summary').textContent.includes('Hardcore'));
      await host.locator('#pana-room-more').click();
      await host.locator('[data-room-option=duration][data-value="300"]').click();
      await guest.waitForFunction(()=>document.querySelector('.sala-summary').textContent.includes('5 min'));
      await guest.locator('#pana-room-more').click();
      assert.ok(await guest.locator('[data-room-option=duration][data-value="180"]').isDisabled());
      await guest.locator('#pana-room-done').click();await host.locator('#pana-room-done').click();
      await host.locator('[data-room-option=sides][data-value=ffa]').click();
      await guest.locator('#team-roster').waitFor({state:'hidden'});
      await host.locator('[data-room-option=teamMode][data-value=ctf]').waitFor({state:'hidden'});
      assert.ok(await host.locator('[data-room-option=ffaMode][data-value=hardcore][aria-pressed=true]').isVisible(),'Hardcore carries over to todos contra todos');
      const before=await guest.locator('.is-own .pk-kit-level').getAttribute('aria-label');
      await guest.locator('#open-armory').click();assert.ok(await guest.locator('#armory').isVisible());
      assert.equal(await guest.locator('#armory-rating .pk-kit-level').getAttribute('aria-label'),before);
      await guest.locator('#armory-slots [data-slot=armor]').click();await guest.locator('.armory-choice[data-id=padded]').click();await guest.locator('#armory-parts-back').click();
      const after=await guest.locator('#armory-rating .pk-kit-level').getAttribute('aria-label');assert.notEqual(after,before);
      await guest.locator('#armory-close').click();
      await host.waitForFunction(label=>[...document.querySelectorAll('.sala-player-kit .pk-kit-level')].some(n=>n.getAttribute('aria-label')===label),after);
      assert.equal(await guest.locator('.is-own .pk-kit-level').getAttribute('aria-label'),after);
    } else {
      await host.locator('[data-difficulty=dificil]').click();await guest.waitForFunction(()=>document.querySelector('.sala-summary').textContent.includes('Difícil'));
      assert.ok(await guest.locator('[data-difficulty=normal]').isDisabled());
      await guest.locator('#sala-kit').click();await host.locator('[data-difficulty=normal]').click();await guest.waitForFunction(()=>getNet().state.difficulty==='normal');assert.ok(await guest.locator('#shop').isVisible());assert.ok(await guest.locator('#pana-lobby-shell').isHidden(),'room updates do not dismiss the personal workshop');await guest.locator('#taller-pistas').click();
    }
    assert.deepEqual([...host.errors,...guest.errors],[]);await host.context().close();await guest.context().close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>localStorage.setItem('pana:settings',JSON.stringify({quality:'baja',sound:false})));
  await context.route('**/colyseus/**',route=>route.abort());const offline=await context.newPage();
  await offline.goto(`${base}/g/pintura/?debug&room=offline-${Date.now()}`);await prepared(offline);
  await offline.locator('.sala-connection[data-state=offline]').waitFor();assert.ok(await offline.locator('#start').isEnabled());assert.match(await offline.locator('#start').textContent(),/en local/);
  assert.equal(await offline.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await offline.locator('#start').click();
  await offline.waitForFunction(()=>window.pinturaDebug.room.local && window.pinturaDebug.room.state.phase==='playing');
  assert.ok(await offline.locator('#pana-lobby-shell').isHidden(),'the offline primary action starts real local play');
  await offline.reload();await prepared(offline);await offline.locator('.sala-connection[data-state=offline]').waitFor();
  await context.unroute('**/colyseus/**');await offline.locator('.sala-connection button').click();await prepared(offline);await offline.locator('.sala-connection[data-state=online]').waitFor({timeout:60000});
  assert.deepEqual(await offline.locator('.sala-connection button').isHidden(),true);await context.close();
  console.log('ok: reference sala, real two-client readiness/settings, kits, teams and offline retry');
} finally {await browser.close();}
