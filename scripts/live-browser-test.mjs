import { chromium } from '@playwright/test';
import { mockBackend } from './mock-backend.mjs';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
  for (const [label,width,height] of [['desktop',1280,720],['mobile',844,390]]) {
    const page=await browser.newPage({viewport:{width,height}});
    const calls=await mockBackend(page,{savedName:true});
    calls.mineRank = 12;
    await page.goto(`${process.env.VACCOIN_TEST_URL ?? 'http://127.0.0.1:5173'}/?qa`);
    await page.waitForFunction(()=>window.vaccoinQA?.snapshot().live.entries.length===10);
    await page.waitForFunction(()=>window.vaccoinQA.snapshot().live.status==='CONNECTED');
    await page.screenshot({path:`test-results/live-${label}.png`});
    calls.liveScore=20000; calls.mineRank=5; calls.broadcast();
    await page.waitForFunction(()=>window.vaccoinQA.snapshot().live.entries[0].score===20000);
    assert(calls.top>=2);
    await page.waitForFunction(()=>window.vaccoinQA.snapshot().live.notice.includes('TOP 10'));
    const reads = calls.top;
    calls.disconnect();
    await page.waitForFunction(()=>window.vaccoinQA.snapshot().live.status==='CONNECTED');
    await page.waitForTimeout(1500);
    assert(calls.top > reads, 'reconnect refreshes snapshot');
    await page.waitForTimeout(3200);
    await page.screenshot({path:`test-results/live-${label}-rolled.png`});
    await page.close();
  }
  console.log('PASS live title snapshots, Broadcast refresh and desktop/mobile screenshots');
} finally {await browser.close();}
