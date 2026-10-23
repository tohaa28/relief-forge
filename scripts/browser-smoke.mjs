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
  // Responsive icon ownership, not just a static CSS assertion. Check actual rectangles.
  const sourceName=(process.env.SMOKE_EPS||'tests/fixtures/eps/corel-unpainted.eps').split(/[\\/]/).at(-1);
  assert.equal(await page.locator('#workspace-filename').textContent(),sourceName);
  assert.equal(await page.locator('#workspace-file').getAttribute('title'),'Исходный файл: '+sourceName);
  await page.locator('#toggle-info').click();
  assert.equal(await page.locator('#toggle-info > .tool-icon').count(),1,'toggle must not erase its SVG');
  await page.locator('#toggle-info').click();
  assert.equal(await page.locator('#toggle-info > .tool-icon').count(),1);
  for(const width of [1440,1024,820,390]){
    await page.setViewportSize({width,height:1000});
    const bad=await page.evaluate(()=>{
      const errors=[];
      const keys=['#open','#export-eps','#toggle-info','#fit','#zoom-in','#zoom-out',
        '#curve-edit','#compare-before','#compare-after','#toggle-points','#toggle-markers','#apply-changes'];
      for(const sel of keys){
        const button=document.querySelector(sel),icon=button?.querySelector(':scope > .tool-icon');
        if(!button||!icon||!button.getClientRects().length)continue;
        const b=button.getBoundingClientRect(),i=icon.getBoundingClientRect();
        if(i.left<b.left-1||i.right>b.right+1||i.top<b.top-1||i.bottom>b.bottom+1)
          errors.push(sel+' icon outside button');
        const kbd=button.querySelector(':scope > kbd');
        if(kbd){const k=kbd.getBoundingClientRect();
          if(i.left<k.right-1&&i.right>k.left+1&&i.top<k.bottom-1&&i.bottom>k.top+1)
            errors.push(sel+' icon overlaps shortcut');}
        if(button.scrollWidth>button.clientWidth+2)errors.push(sel+' horizontal overflow');
      }
      const badge=document.querySelector('#workspace-file'),r=badge.getBoundingClientRect(),
        w=document.querySelector('#drop-target').getBoundingClientRect();
      if(badge.hidden||r.left<w.left-1||r.right>w.right+1||r.bottom>w.bottom+1)
        errors.push('filename outside workspace');
      return errors;
    });
    assert.deepEqual(bad,[],'toolbar geometry at width '+width);
  }
  await page.setViewportSize({width:1440,height:1000});
  // Source-owned large closed contour forces batch splitting, without private artwork.
  const points=Array.from({length:2444},(_,i)=>[110+100*Math.cos(i*2*Math.PI/2444),110+100*Math.sin(i*2*Math.PI/2444)]);
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="220mm" height="220mm" viewBox="0 0 220 220"><path fill="none" stroke="black" d="M '+points.map(p=>p.join(' ')).join(' L ')+' Z"/></svg>';
  await page.locator('#file').setInputFiles({name:'closed-batch-regression.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'),{},{timeout:120000});
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  assert.equal(await page.locator('#workspace-filename').textContent(),'closed-batch-regression.svg');
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
