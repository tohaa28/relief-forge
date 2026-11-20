import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8102';
const server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']
});
await new Promise((resolve,reject)=>{
  server.stdout.once('data',resolve);server.once('error',reject);
});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));

  assert.equal(await page.locator('#merge-nearby').isChecked(),true);
  assert.equal(await page.locator('#merge-nearby-distance').inputValue(),'0.05');
  assert.equal(await page.locator('#merge-nearby-strict').isChecked(),true);

  // A 0.042-mm off-angle corner: the existing exact-straight optimizer cannot
  // remove it; only the new proximity controlled weld should do so.
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="12mm" height="12mm" viewBox="0 0 12 12">'+
    '<path fill="black" stroke="none" d="M 1 1 L 9 1 L 9.03 1.03 L 9 9 L 1 9 Z"/></svg>';
  await page.locator('#file').setInputFiles({
    name:'alpha69-weld-tiny-corner.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
  });
  await page.waitForFunction(()=>{
    const e=document.querySelector('#optimization-result').textContent;
    return document.querySelector('#busy').hidden&&
      e.includes('Сближение контуров: объединено узлов')&&
      document.querySelector('#status').textContent.startsWith('ПОСЛЕ:');
  },{},{timeout:120000});
  const report=await page.locator('#optimization-result').textContent();
  assert.match(report,/Сближение контуров: объединено узлов [1-9]\d*/,
    'real preview must accept at least one conservative proximity weld: '+report);

  await page.locator('#compare-before').click();
  const original=await page.locator('#geometry').innerHTML();
  await page.locator('#compare-after').click();
  assert.notEqual(await page.locator('#geometry').innerHTML(),original,
    'AFTER must contain changed SVG geometry, not only a status counter');

  // Staged value changes cannot schedule an immediate diagnostic or mutate
  // the preview. The single Apply action is the only write-to-document point.
  const geometry=await page.locator('#geometry').innerHTML();
  await page.locator('#merge-nearby-distance').fill('0.005');
  assert.match(await page.locator('#settings-pending').textContent(),/не применены/);
  assert.equal(await page.locator('#busy').isHidden(),true);
  assert.equal(await page.locator('#geometry').innerHTML(),geometry);
  await page.locator('#merge-nearby-distance').fill('0.05');
  assert.equal(await page.locator('#busy').isHidden(),true);
  await page.locator('#apply-changes').click();
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  assert.equal(errors.length,0,JSON.stringify(errors));

  // Preserve alpha67 rule: exit manual editor without another automatic scan.
  await page.locator('#curve-edit').click();
  await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
  await page.locator('#node-done').click();
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#busy').isHidden(),true);

  console.log('PASS alpha69 real browser: 0.05-mm native weld, AFTER geometry, staged tolerance, Apply/Undo and no manual-close rescan');
}finally{await browser?.close();server.kill();}
