import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port='8094',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(process.env.NODE_PROXIMITY_URL||'http://localhost:'+port);
 await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 await page.evaluate(()=>{
  document.querySelector('#merge-overlaps').checked=false;
  document.querySelector('#smoothing-amount').value='0';
  document.querySelector('#optimization-tolerance').value='.00001';
 });
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20"><g fill="none" stroke="black"><path d="M1 2L12 2"/><path d="M1 2.006L11 2.006"/><path d="M1 8.2L3 8L9 8L10 9L9 10L3 8.006L1 9"/></g></svg>';
 await page.locator('#file').setInputFiles({name:'native-node-gaps.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
 await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
 await page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'));
 for(const stage of ['before','after']){
  await page.locator('#compare-'+stage).click();
  const near=page.locator('.problem-marker[aria-label*="Сближенные узлы"]');
  assert.equal(await near.count(),1,stage+' must report the real branch pair once');
  assert.match(await near.getAttribute('aria-label'),/0,006 мм/);
  const dots=await near.locator('.issue-core').evaluateAll(nodes=>nodes.map(n=>[+n.getAttribute('cx'),+n.getAttribute('cy')]));
  assert.equal(dots.length,2);
  assert.ok(dots.every(([x])=>Math.abs(x-3)<1e-10));
  assert.ok(Math.abs(Math.abs(dots[0][1]-dots[1][1])-.006)<1e-10);
  assert.doesNotMatch(await page.locator('#summary').getAttribute('title'),/Совпадающие узлы/);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS native node proximity: parallel contours excluded, exact 0.006 mm branch pair on both original anchors in BEFORE and AFTER');
}finally{await browser?.close();server.kill();}
