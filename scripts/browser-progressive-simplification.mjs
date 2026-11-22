import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=process.env.SIMPLIFICATION_PORT||'8134';
const server=spawn(process.execPath,['scripts/serve.mjs'],
  {env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
let browser;
try{
  await new Promise((resolve,reject)=>{
    server.stdout.once('data',resolve);
    server.once('exit',code=>reject(Error('Server exited: '+code)));
  });
  browser=await chromium.launch();
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.SIMPLIFICATION_HOST_URL||'http://localhost:'+port,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const path=Array.from({length:24},(_,i)=>[1+2*i,10+Math.sin(i*1.8)*3]);
  const d=path.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ');
  await page.locator('#file').setInputFiles({name:'progressive.svg',mimeType:'image/svg+xml',
    buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="20mm" viewBox="0 0 50 20"><path fill="none" stroke="black" d="'+d+'"/></svg>')});
  const settled=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&
    document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'));
  const compareBefore=page.locator('#compare-before'),compareAfter=page.locator('#compare-after');
  const geometry=()=>page.locator('#geometry path.comparison-path').evaluateAll(
    paths=>paths.map(path=>path.getAttribute('d')).join(' '));
  const nodes=data=>[...data.matchAll(/[MLCQ]/g)].length;
  const field=page.locator('#simplification-percent');
  const apply=page.locator('#apply-changes');
  await settled();
  assert.ok(await page.locator('#doctortracer-send').isHidden());
  assert.ok(await page.locator('#doctortracer-dpi').isHidden());
  assert.equal(await field.inputValue(),'0');
  const ordinary=await geometry();
  await compareBefore.click();
  const before=await geometry();
  await compareAfter.click();
  async function preview(percent){
    const previous=await geometry();
    await field.fill(String(percent));
    assert.equal(await geometry(),previous,'draft input must not mutate AFTER');
    await apply.click();
    await settled();
    if(percent)assert.match(await page.locator('#optimization-result').textContent(),
      new RegExp('Упрощение ПОСЛЕ '+percent+'%'));
    return geometry();
  }
  const medium=await preview(50);
  assert.ok(nodes(medium)<nodes(ordinary));
  const maximum=await preview(100);
  assert.equal(nodes(maximum),2);
  await compareBefore.click();
  assert.equal(await geometry(),before);
  await compareAfter.click();
  assert.equal(await preview(0),ordinary);
  assert.equal(await preview(100),maximum);
  await apply.click();
  assert.match(await page.locator('#status').textContent(),/Изменения применены/);
  assert.equal(await geometry(),maximum);
  await compareAfter.click();
  await page.keyboard.press('Control+z');
  await settled();
  await compareBefore.click();
  assert.equal(await geometry(),before);
  assert.deepEqual(errors,[]);
  console.log('PASS progressive AFTER: staged 0/50/100, repeatable preview, endpoints, BEFORE, Apply, Undo, hidden DoctorTracer');
}finally{
  await browser?.close();
  server.kill();
}
