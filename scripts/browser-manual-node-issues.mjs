import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8096';
const server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']
});
await new Promise((resolve,reject)=>{
  server.stdout.once('data',resolve);
  server.once('error',reject);
});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  await page.evaluate(()=>{
    document.querySelector('#merge-overlaps').checked=false;
    document.querySelector('#smoothing-amount').value='0';
    document.querySelector('#optimization-tolerance').value='.00001';
  });
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="30mm" viewBox="0 0 30 30"><path fill="none" stroke="black" d="M 2 2 L 20 2 L 20 20"/></svg>';
  await page.locator('#file').setInputFiles({
    name:'manual-open-curve.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
  });
  await page.waitForFunction(()=>
    document.querySelector('#auto-status').textContent.includes('Предварительный')&&
    document.querySelector('#busy').hidden&&
    !document.querySelector('#compare-after').disabled
  ,{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),{},{timeout:120000});
  await page.locator('#compare-after').click();
  await page.locator('#curve-edit').click();
  await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/,
    'open endpoint remains highlighted on entry to manual editing');
  assert.ok(await page.locator('.problem-marker[aria-hidden="true"]').count()>0,
    'passive diagnostic rings remain visible');
  const events=await page.locator('#markers').evaluate(node=>({
    pointer:getComputedStyle(node).pointerEvents,
    count:node.querySelectorAll('[data-issue]').length
  }));
  assert.equal(events.pointer,'none','overlay must never take pointer events from Bézier nodes');
  assert.equal(events.count,0,'passive rings have no interactive focus targets');

  // The right-hand issue list is collapsed by default: use the actual node
  // on the canvas rather than clicking a hidden off-screen button.
  assert.ok(await page.locator('#geometry .curve-node').count()>0);
  await page.locator('#geometry .curve-node').first().click();
  await page.locator('#node-close').click();
  await page.waitForFunction(()=>
    document.querySelector('#summary').textContent.includes('Идёт повторная проверка'),
    {},{timeout:30000});
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/,
    'old witness must not disappear before the new calculation finishes');
  await page.waitForFunction(()=>
    document.querySelector('#busy').hidden&&
    !document.querySelector('#summary').textContent.includes('Идёт повторная проверка')
  ,{},{timeout:120000});
  assert.doesNotMatch(await page.locator('#issues').textContent(),/Открытый контур/,
    'successful rescan must remove manually resolved open defect');

  await page.locator('#undo').click();
  await page.waitForFunction(()=>
    document.querySelector('#busy').hidden&&
    !document.querySelector('#summary').textContent.includes('Идёт повторная проверка')&&
    document.querySelector('#issues').textContent.includes('Открытый контур')
  ,{},{timeout:120000});
  assert.ok(await page.locator('.problem-marker[aria-hidden="true"]').count()>0,
    'Undo restores a current, visible marker');
  assert.deepEqual(errors,[]);
  console.log('PASS manual nodes: passive persistent markers, close -> rescan clears, Undo restores');
}finally{await browser?.close();server.kill();}
