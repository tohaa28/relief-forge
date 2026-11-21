import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8097',server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{
  server.stdout.once('data',resolve);server.once('error',reject);
});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.SETTINGS_URL||'http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  assert.equal(await page.locator('#smoothing-amount').inputValue(),'0','first launch smoothing is off');
  const defaults=await page.locator('#settings-card').evaluate(card=>Object.fromEntries([...card.querySelectorAll('input,select')].map(f=>[f.id,f.type==='checkbox'?f.checked:f.value])));
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="30mm" viewBox="0 0 30 30"><path fill="none" stroke="black" d="M 2 2 L 20 2 L 20 20"/></svg>';
  await page.locator('#file').setInputFiles({
    name:'settings-staged.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
  });
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
  await page.waitForFunction(()=>document.querySelector('#busy').hidden&&
    document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),
    {},{timeout:120000});
  const previous=await page.locator('#optimization-result').textContent();
  const tolerance=page.locator('#tolerance');
  await tolerance.fill('0.02');
  await page.waitForTimeout(350);
  assert.equal(await page.locator('#optimization-result').textContent(),previous,
    'typing a draft number must not run a new preview');
  assert.equal(await page.locator('#busy').isHidden(),true,
    'entering a parameter must never lock the workbench');
  assert.match(await page.locator('#settings-pending').textContent(),/не применены/);
  assert.equal(await page.locator('#apply-changes').isEnabled(),true);
  for(const id of ['tolerance','clearance-threshold','smoothing-amount',
    'optimization-tolerance','micro-width','micro-height']){
    const input=page.locator('#'+id);
    assert.ok((await input.getAttribute('title')).length>=40,id+' hover explanation');
  }
  const compact=await page.locator('#settings-card').evaluate(node=>{
    const card=node.getBoundingClientRect(),side=node.closest('aside').getBoundingClientRect();
    return {cardHeight:card.height,sideHeight:side.height,top:card.top,bottom:card.bottom};
  });
  assert.ok(compact.cardHeight<compact.sideHeight,'all settings fit the right viewport');
  assert.ok(compact.bottom<960,'Apply button remains visible without scrolling');

  await page.locator('#apply-changes').click();
  await page.waitForFunction(()=>
    document.querySelector('#busy').hidden&&
    !document.querySelector('#settings-pending').textContent.includes('не применены')&&
    !document.querySelector('#settings-pending').textContent.includes('Выполняется'),
    {},{timeout:120000});
  assert.equal(await tolerance.inputValue(),'0.02');
  assert.equal(await page.locator('#settings-pending').evaluate(n=>n.classList.contains('unsaved')),false);
  await page.locator('#settings-card').evaluate(card=>{
    for(const f of card.querySelectorAll('input,select')){
      if(f.type==='checkbox')f.checked=!f.checked;
      else if(f.tagName==='SELECT')f.selectedIndex=(f.selectedIndex+1)%f.options.length;
      else f.value=String(Number(f.value)+.01);
      f.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  const beforeReset=await page.locator('#geometry').innerHTML(),beforeReport=await page.locator('#optimization-result').textContent();
  await page.locator('#settings-defaults').click();
  await page.waitForTimeout(200);
  const reset=await page.locator('#settings-card').evaluate(card=>Object.fromEntries([...card.querySelectorAll('input,select')].map(f=>[f.id,f.type==='checkbox'?f.checked:f.value])));
  assert.deepEqual(reset,defaults,'all numbers, checks, selects and slider reset together');
  assert.equal(await page.locator('#geometry').innerHTML(),beforeReset,'reset stages settings without touching vectors');
  assert.equal(await page.locator('#optimization-result').textContent(),beforeReport,'reset never launches computation');
  assert.equal(await page.locator('#busy').isHidden(),true);
  assert.match(await page.locator('#settings-pending').textContent(),/по умолчанию восстановлены/);
  await page.locator('#apply-changes').click();
  await page.waitForFunction(()=>document.querySelector('#busy').hidden&&!document.querySelector('#settings-pending').textContent.includes('Выполняется'),null,{timeout:120000});
  assert.equal(await page.locator('#smoothing-amount').inputValue(),'0');
  assert.equal(await page.locator('#settings-pending').evaluate(n=>n.classList.contains('unsaved')),false);
  await page.locator('#settings-defaults').click();
  assert.match(await page.locator('#settings-pending').textContent(),/Уже действуют/);
  assert.deepEqual(errors,[]);
  console.log('PASS settings inspector: compact, detailed tooltips, draft number no recompute, explicit Apply, all defaults/reset staged/idempotent, real browser');
}finally{await browser?.close();server.kill();}
