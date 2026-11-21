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
  await page.goto(process.env.MARKERS_URL||'http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  // Use real committed defaults; changing fields without Apply is intentionally inert.
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="30mm" viewBox="0 0 30 30"><path fill="none" stroke="black" d="M 2 2 L 12 2 L 12 12"/><path fill="none" stroke="blue" d="M 16 21 L 25 21 L 25 27"/><path fill="#b42318" d="M19 3H26V9H19Z"/></svg>';
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
  await page.evaluate(()=>document.querySelector('#toggle-points').click());
  assert.ok(await page.locator('#manual-glyphs .curve-node').first().isVisible(),
    'healthy-point visibility must not hide the editable points');
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
  const openCount=()=>page.locator('#issues').getByText(/Открытый контур/).count();
  assert.equal(await openCount(),2,'fixture has two independent open contours');
  await page.locator('#node-done').click();
  await page.waitForFunction(()=>!document.body.classList.contains('curve-editing')&&
    document.querySelector('#busy').hidden&&
    document.querySelector('#status').textContent.startsWith('Маркеры изменённых контуров обновлены'));
  assert.equal(await openCount(),1,'the fixed open contour disappears and the other stays marked');
  assert.equal(await page.locator('.problem-marker').count(),1);
  const display=await page.locator('#geometry').evaluate(layer=>({
    outlines:[...layer.querySelectorAll('.wireframe-override')].map(path=>getComputedStyle(path).fill),
    artwork:layer.querySelectorAll('.svg-artwork').length
  }));
  assert.equal(display.outlines.length,3,'edited and unedited vectors use one display mode');
  assert.ok(display.outlines.every(fill=>fill==='none'));
  assert.equal(display.artwork,0);
  assert.ok(await page.locator('#compare-after').isDisabled(),'diagnostics must not launch automatic repair');
  // Exit without edits must also avoid a new clearance/diagnostic Worker.
  await page.locator('#curve-edit').click();
  await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
  await page.locator('#node-done').click();
  await page.waitForTimeout(400);
  assert.equal(await page.locator('#busy').isHidden(),true);
  assert.match(await page.locator('#issues').textContent(),/Открытый контур/);
  assert.deepEqual(errors,[]);
  console.log('PASS manual editor: fixed marker removed, unrelated defect retained, no auto repair, unchanged exit preserves markers');
}finally{await browser?.close();server.kill();}
