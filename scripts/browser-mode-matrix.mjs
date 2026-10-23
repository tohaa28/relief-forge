import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const port='8083',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const errors=[],svg='<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="40mm" viewBox="0 0 50 40"><path fill="red" d="M 1 1 L 10 1 L 10 10 L 1 10 Z"/><path fill="red" d="M 5 5 L 15 5 L 15 15 L 5 15 Z"/><path fill="none" stroke="black" d="M 20 20 L 21 20 L 22 20 L 25 20"/></svg>';
 let modes=0;
 for(const union of [false,true])for(const smoothing of [0,.05])for(const selection of [false,true]){
  const page=await browser.newPage({viewport:{width:1280,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  await page.evaluate(({union,smoothing,selection})=>{
   document.querySelector('#merge-overlaps').checked=union;
   document.querySelector('#smoothing-amount').value=smoothing;
   document.querySelector('#selection-only').checked=selection;
  },{union,smoothing,selection});
  await page.locator('#file').setInputFiles({name:'mode-matrix.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  await page.locator('#toggle-info').click();
  await page.locator('[data-filter="open"]').click();
  await page.waitForTimeout(300); // Explicit application debounce is 180 ms.
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
  assert.equal(await page.locator('#apply-changes').isEnabled(),true,'scene must have a real optimized candidate');
  const rendered=await page.locator('#geometry').innerHTML();
  const outputs={};
  for(const mode of ['outline','original']){
   const pending=page.waitForEvent('download');await page.locator('#export-eps').click();
   await page.locator('input[name="eps-color-mode"][value="'+mode+'"]').check();await page.locator('#eps-color-confirm').click();
   if(await page.locator('#eps-save-warning').isVisible())await page.locator('#eps-save-anyway').click();
   const file=await pending;outputs[mode]=readFileSync(await file.path(),'utf8');
   assert.match(outputs[mode],/^%!PS/);assert.equal(await page.locator('#geometry').innerHTML(),rendered,'Save must not mutate preview');
  }
  assert.equal(await page.locator('#apply-changes').isEnabled(),false,'EPS save already applied the exact preview with Undo');
  await page.locator('#curve-edit').click();
  assert.equal(await page.locator('#curve-node-tools').isVisible(),true);
  await page.locator('#node-done').click();
  await page.waitForTimeout(250); // Wait for the documented editor-close debounce.
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  const projectDownload=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');
  const project=await projectDownload,bytes=readFileSync(await project.path()),doc=JSON.parse(bytes);
  assert.ok(doc.paths.length>0);assert.ok(doc.history.past.length>0);
  const preview=doc.journal.filter(x=>x.action==='autoheal-curve-preview').at(-1);
  assert.deepEqual(preview.detail.scope,selection?[2]:[0,1,2],'actual selected objects must determine the recalculated preview');
  await page.locator('#file').setInputFiles({name:'reopened.rf.json',mimeType:'application/json',buffer:bytes});
  await page.waitForTimeout(250); // Await the async file stream and any scheduled UI update.
  await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  const againDownload=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');const again=await againDownload;
  assert.deepEqual(JSON.parse(readFileSync(await again.path())).paths,doc.paths,'project reopen preserves applied geometry');
  await page.keyboard.press('Control+z');assert.ok(await page.locator('#geometry [data-path]').count());
  await page.close();modes++;
 }
 const pdfPage=await browser.newPage();pdfPage.on('pageerror',e=>errors.push(e.message));
 await pdfPage.goto('http://localhost:'+port);await pdfPage.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 await pdfPage.locator('#file').setInputFiles({name:'vector-regression.pdf',mimeType:'application/pdf',buffer:Buffer.from(simpleVectorPdf())});
 await pdfPage.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
 await pdfPage.waitForFunction(()=>document.querySelector('#busy').hidden);
 assert.ok(await pdfPage.locator('#geometry [data-path]').count());assert.equal(await pdfPage.locator('#mascot-welcome').isVisible(),false);
 const svgDownload=pdfPage.waitForEvent('download');await pdfPage.keyboard.press('Control+Shift+e');const svgFile=await svgDownload;
 assert.match(readFileSync(await svgFile.path(),'utf8'),/<path/);await pdfPage.close();
 assert.deepEqual(errors,[]);console.log('PASS mode matrix: '+modes+' Union/smoothing/selection settings, both EPS modes, unchanged rendered AFTER on Save, exact-snapshot commit, node editor, project save/reopen/Undo, PDF import/SVG export');
}finally{await browser?.close();server.kill();}

function simpleVectorPdf(){
  let source='%PDF-1.4\n';
  const positions=[0];
  const put=(n,body)=>{
    positions[n]=Buffer.byteLength(source,'latin1');
    source+=n+' 0 obj\n'+body+'\nendobj\n';
  };
  put(1,'<< /Type /Catalog /Pages 2 0 R >>');
  put(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  put(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>');
  const operators='0 0 0 RG 1 w 10 10 m 120 150 l S\n';
  put(4,'<< /Length '+Buffer.byteLength(operators,'latin1')+' >>\nstream\n'+operators+'endstream');
  const xref=Buffer.byteLength(source,'latin1');
  source+='xref\n0 5\n0000000000 65535 f \n';
  for(let n=1;n<=4;n++)source+=String(positions[n]).padStart(10,'0')+' 00000 n \n';
  source+='trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new Uint8Array(Buffer.from(source,'latin1'));
}
