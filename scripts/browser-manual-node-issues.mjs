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
  await page.waitForTimeout(1200);
  const observed=await page.evaluate(()=>({
    status:document.querySelector('#status').textContent,
    summary:document.querySelector('#summary').textContent,
    issues:document.querySelector('#issues').textContent,
    nodeEditing:document.body.classList.contains('curve-editing'),
    busy:!document.querySelector('#busy').hidden,
    nodeSelected:document.querySelector('#node-hint').textContent,
    actions:[...document.querySelectorAll('#geometry .curve-node')].length
  }));
  console.log('ALPHA54 LOCAL WORKER OBSERVATION',JSON.stringify({observed,errors}));
  assert.ok(!errors.length,'browser module/worker error: '+errors.join(';'));
  await page.waitForFunction(()=>
    /Локальная проверка|Ошибка/.test(document.querySelector('#status').textContent),
    {},{timeout:6000});
  const localStatus=await page.locator('#status').textContent();
  assert.match(localStatus,/^Локальная проверка:/,
    'worker must complete a bounded local check: '+localStatus+
    ' · summary='+(await page.locator('#summary').textContent())+
    ' · browser-errors='+errors.join(';'));
  await page.waitForFunction(()=>
    !document.querySelector('#summary').textContent.includes('Идёт повторная проверка'),
    {},{timeout:20000});
  assert.equal(await page.locator('#busy').isVisible(),false,
    'manual close must not lock the entire document for a full scan');
  assert.doesNotMatch(await page.locator('#issues').textContent(),/Открытый контур/,
    'successful rescan must remove manually resolved open defect');

  // Undo is inside the collapsed Creation menu; use the real Ctrl+Z shortcut.
  await page.keyboard.press('Control+z');
  await page.waitForFunction(()=>
    document.querySelector('#status').textContent.startsWith('Локальная проверка:')&&
    !document.querySelector('#summary').textContent.includes('Идёт повторная проверка')&&
    document.querySelector('#issues').textContent.includes('Открытый контур')
  ,{},{timeout:120000});
  assert.ok(await page.locator('.problem-marker[aria-hidden="true"]').count()>0,
    'Undo restores a current, visible marker');
  await page.locator('#node-remove').click();
  const cursor=await page.locator('#canvas').evaluate(el=>el.style.cursor);
  assert.match(decodeURIComponent(cursor),/M6 6L10 10/);
  assert.doesNotMatch(decodeURIComponent(cursor),/<circle/,'remove cursor must not mask node center');
  await page.locator('#curve-edit').click();
  await page.locator('#smoothing-amount').fill('0.08');
  await page.locator('#smoothing-amount').dispatchEvent('input');
  assert.match(await page.locator('#settings-pending').textContent(),/не применены/);
  assert.equal(await page.locator('#apply-changes').isEnabled(),true);
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#busy').isVisible(),false,'typing settings must not start a global computation');
  const help=await page.locator('#tolerance').getAttribute('title');
  assert.ok(help.length>65,'each setting must explain its units and meaning');
  assert.deepEqual(errors,[]);
  console.log('PASS manual nodes: passive persistent markers, close -> rescan clears, Undo restores');
}finally{await browser?.close();server.kill();}
