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
  // Use real committed defaults; changing fields without Apply is intentionally inert.
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
  const before=await page.locator('#geometry').innerHTML();
  await page.locator('#node-close').click();
  assert.match(await page.locator('#status').textContent(),/Локальная правка сохранена/);
  assert.equal(await page.locator('#geometry').innerHTML(),before,
    'original figure must remain untouched while the editor stays open');
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/,
    'old witness stays visible until editor exit and complete rescan');
  assert.equal(await page.locator('#busy').isHidden(),true);

  // Ctrl+Z/Ctrl+Y act on the local draft without reprocessing all objects.
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#geometry').innerHTML(),before);
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/);
  await page.keyboard.press('Control+y');
  assert.equal(await page.locator('#geometry').innerHTML(),before);
  await page.locator('#node-done').click();
  await page.waitForFunction(()=>!document.body.classList.contains('curve-editing'));
  assert.equal(await page.locator('#busy').isHidden(),true,
    'closing manual editor cannot schedule a global Worker');
  assert.match(await page.locator('#summary').textContent(),/Диагностика после ручного редактирования не выполнялась/);
  assert.equal(await page.locator('.problem-marker').count(),0,
    'stale markers must not claim the modified curve still has defects');
  assert.equal(await page.locator('#issue-count').textContent(),'—');
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#busy').isHidden(),true,
    'no delayed auto scan after 180 ms');
  assert.match(await page.locator('#summary').textContent(),/не выполнялась/);

  // Global Undo restores the geometry without another automatic scan.
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('#busy').isHidden(),true);
  assert.equal(await page.locator('.problem-marker').count(),0);
  assert.match(await page.locator('#summary').textContent(),/не выполнялась/);

  // Only the explicit operator command refreshes the defect witnesses.
  await page.locator('#recheck-defects').click();
  await page.waitForFunction(()=>document.querySelector('#busy').hidden&&
    document.querySelector('#issues').textContent.includes('Открытый контур'),
    {},{timeout:120000});
  assert.ok(await page.locator('.problem-marker').count()>0);
  assert.ok(Number(await page.locator('#issue-count').textContent())>0);
  // Exit without edits must also avoid a new clearance/diagnostic Worker.
  await page.locator('#curve-edit').click();
  await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
  await page.locator('#node-done').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#busy').isHidden(),true);
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/);
  assert.deepEqual(errors,[]);
  console.log('PASS manual nodes alpha67: commit/Undo without auto diagnostic, stale markers cleared, explicit manual scan restores defects');
}finally{await browser?.close();server.kill();}
