import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:8080');
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  // Actual EPS worker -> Ghostscript/MuPDF or recognised recovery -> UI/WASM.
  await page.locator('#file').setInputFiles(process.env.SMOKE_EPS||'tests/fixtures/eps/corel-unpainted.eps');
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'),{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  assert.ok(await page.locator('#geometry [data-path]').count());
  assert.equal(await page.locator('#mascot-welcome').isVisible(),false);
  console.log('EPS import status:',await page.locator('#status').textContent());
  if(process.env.SMOKE_EPS){
    assert.ok(!(await page.locator('#issues').textContent()).includes('Открытый контур'));
    await page.screenshot({path:'evidence/private/browser-after.png'});
  }
  // Source-owned large closed contour forces batch splitting, without private artwork.
  const points=Array.from({length:2444},(_,i)=>[110+100*Math.cos(i*2*Math.PI/2444),110+100*Math.sin(i*2*Math.PI/2444)]);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="220mm" height="220mm" viewBox="0 0 220 220"><path fill="none" stroke="black" d="M '+points.map(p=>p.join(' ')).join(' L ')+' Z"/></svg>';
  await page.locator('#file').setInputFiles({name:'closed-batch-regression.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'),{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  const after=await page.locator('#geometry .comparison-path').first().getAttribute('d');
  assert.ok(after);
  assert.ok(!(await page.locator('#issues').textContent()).includes('Открытый контур'));
  await page.locator('#compare-before').click();
  const before=await page.locator('#geometry .comparison-path').first().getAttribute('d');
  assert.notEqual(before,after,'optimization must change stored/rendered geometry');
  await page.locator('#compare-after').click();
  await page.locator('#apply-changes').click();
  assert.equal(await page.locator('#geometry .comparison-path').first().getAttribute('d'),after);
  const download=page.waitForEvent('download');
  await page.locator('#export-eps').click();
  await page.locator('#eps-color-confirm').click();
  if(await page.locator('#eps-save-warning').isVisible())await page.locator('#eps-save-anyway').click();
  const file=await download;
  const bytes=readFileSync(await file.path());
  assert.match(bytes.toString(),/^%!PS/);
  assert.match(file.suggestedFilename(),/_result\.eps$/);
  await page.keyboard.press('Control+z');
  assert.ok(await page.locator('#geometry [data-path]').count());
  assert.deepEqual(errors,[]);
  console.log('PASS browser: real Worker/WASM EPS import, large closed diagnostic batches, actual BEFORE/AFTER reduction, Apply, EPS export, Undo');
}finally{await browser?.close();server.kill();}
