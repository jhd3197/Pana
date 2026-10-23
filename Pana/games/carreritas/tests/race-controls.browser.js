// Control reference remains available without covering the racing view.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {menuStep} from './menu-helpers.js';
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 await page.goto(`${process.env.PANA_TEST_URL||'http://localhost:8461'}/g/carreritas/?debug&manual&track=plaza`);
 await page.waitForFunction(()=>window.garage?.car,null,{timeout:90000});
 await menuStep(page,'track');
 await page.evaluate(async()=>{await startRace(0);for(let i=0;i<270;i++)updateRace(1/60);race.state='go';race.count=0;
  window.__pad={connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  navigator.getGamepads=()=>[window.__pad];dispatchEvent(new Event('gamepadconnected'));
  window.__pad.buttons[7]={pressed:true,value:1};
 });
 await page.waitForFunction(()=>document.documentElement.dataset.panaInput==='gamepad');
 await page.waitForFunction(()=>document.querySelector('.pana-pad-prompts'));
 assert.equal(await page.locator('.pana-pad-prompts').isVisible(),false,'no controller strip over the road');
 await page.evaluate(()=>{window.__pad.buttons[7]={pressed:false,value:0};});
 await page.keyboard.press('w');
 assert.equal(await page.locator('#race .keys').isVisible(),false,'no keyboard legend over the road');
 await page.locator('#pause').click();
 await page.locator('dialog.pana-menu[open]').waitFor();

 await page.locator('dialog.pana-menu [data-tab="settings"]').click();
 await page.getByRole('button',{name:'Ratón y teclado',exact:true}).click();
 await page.locator('[data-settings-category="mouse"]').waitFor();
 assert.match(await page.locator('[data-settings-category="mouse"]').innerText(),/Acelerar/,'keyboard reference remains in settings');
 await page.getByRole('button',{name:'Cerrar menú',exact:true}).click();
 assert.equal(await page.locator('dialog.pana-menu').isVisible(),false);
 assert.equal(await page.locator('.pana-pad-prompts').isVisible(),false);
 console.log('Race stays clear; full controls remain in the shared menu.');
}finally{await browser.close();}
