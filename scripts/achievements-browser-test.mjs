import {chromium} from '@playwright/test';
import {mockBackend} from './mock-backend.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const [label,width,height] of [['desktop',1280,720],['mobile',540,720]]) {
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const calls=await mockBackend(page,{savedName:true});
  await page.goto('http://127.0.0.1:5173/?qa');
  await page.waitForFunction(()=>window.vaccoinQA?.snapshot().achievements.rows.length===6);
  await page.getByRole('button',{name:'ACHIEVEMENTS',exact:true}).click();
  await page.waitForFunction(()=>window.vaccoinQA.snapshot().achievements.open);
  await page.screenshot({path:`test-results/achievements-${label}.png`});
  await page.getByRole('button',{name:'BACK',exact:true}).click();
  await page.waitForTimeout(500);
  calls.achievementScore=12000;
  await page.waitForFunction(()=>window.vaccoinQA.snapshot().achievements.notice?.id==='run-coins-500');
  await page.screenshot({path:`test-results/achievement-toast-${label}.png`});
  await page.waitForFunction(()=>window.vaccoinQA.snapshot().achievements.notice?.id==='run-coins-1000',{},{timeout:7000});
  await page.getByRole('button',{name:'ACHIEVEMENTS',exact:true}).click();
  await page.waitForFunction(()=>window.vaccoinQA.snapshot().achievements.rows.filter(a=>a.unlocked).length===4);
  await page.keyboard.press('Escape');
  assert.equal((await page.evaluate(()=>window.vaccoinQA.snapshot())).achievements.open,false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS achievement menu, 4 unlocks, FIFO toast, Escape and desktop/mobile Canvas screenshots');
} finally {await browser.close();}
