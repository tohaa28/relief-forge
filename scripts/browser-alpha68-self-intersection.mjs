import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8101';
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
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  assert.equal(await page.locator('#repair-self-intersections').isChecked(),true);
  assert.equal(await page.locator('#self-intersection-mode').inputValue(),'hybrid');
  assert.equal(await page.locator('#self-intersection-size').inputValue(),'all');
  assert.equal(await page.locator('#self-intersection-preserve').isChecked(),true);

  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="12mm" height="8mm" viewBox="-1 -1 6 3">'+
    '<path fill="none" stroke="#123456" d="M 0 0 L 2.2 0 L 1.8 .02 L 2.2 -.02 L 3 0"/></svg>';
  await page.locator('#file').setInputFiles({
    name:'alpha68-small-loop.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
  });
  await page.waitForFunction(()=>{
    const s=document.querySelector('#optimization-result').textContent;
    return document.querySelector('#busy').hidden&&
      s.includes('Самопересечения: обнаружено')&&
      document.querySelector('#status').textContent.startsWith('ПОСЛЕ:');
  },{},{timeout:120000});
  const report=await page.locator('#optimization-result').textContent();
  assert.match(report,/Самопересечения: обнаружено [1-9]\d*/);
  assert.match(report,/удалено петель [1-9]\d*/);
  assert.equal(await page.locator('#apply-changes').isDisabled(),false,
    'a corrected AFTER candidate must be available for explicit Apply');
  await page.locator('#compare-before').click();
  const original=await page.locator('#geometry').innerHTML();
  await page.locator('#compare-after').click();
  const after=await page.locator('#geometry').innerHTML();
  assert.notEqual(after,original,'BEFORE and AFTER must show different real vector geometry');

  // Changing a selection in the settings is a staged operation, not a
  // request to run another full diagnosis. The controls are not decorative.
  await page.locator('#self-intersection-size').selectOption('micro');
  assert.match(await page.locator('#settings-pending').textContent(),/не применены/);
  assert.equal(await page.locator('#busy').isHidden(),true);
  await page.locator('#self-intersection-size').selectOption('all');
  assert.equal(await page.locator('#busy').isHidden(),true);
  await page.locator('#apply-changes').click();
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  assert.ok(!errors.length,JSON.stringify(errors));
  console.log('PASS alpha68 real browser: hybrid/all/strict settings, native loop removed in AFTER, explicit Apply and no auto-scan on input');
}finally{
  await browser?.close();server.kill();
}
