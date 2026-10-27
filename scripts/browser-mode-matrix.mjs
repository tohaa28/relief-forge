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
  assert.equal(await page.locator('#compare-after').getAttribute('aria-pressed'),'true',
    'computed AFTER must be selected automatically after preview');
  await page.locator('#compare-before').click();
  const importedGeometry=await page.locator('#geometry').innerHTML();
  await page.locator('#compare-after').click();
  const rendered=await page.locator('#geometry').innerHTML();
  assert.notEqual(rendered,importedGeometry,'DO and AFTER are distinct snapshots');
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
  assert.match(await page.locator('#curve-edit').textContent(),/Редактирование кривой/);
  const manual=page.locator('#manual-repairs');
  assert.equal(await manual.locator('summary').isVisible(),true);
  assert.equal(await page.locator('aside.right #manual-repairs').count(),0);
  await manual.locator('summary').click();
  assert.equal(await manual.locator('[data-action="1"]').isVisible(),true);
  assert.equal(await manual.locator('[data-action]').count(),8);
  await manual.locator('summary').click();
  await page.locator('#node-add').click();
  const plus=await page.locator('#canvas').evaluate(el=>decodeURIComponent(el.style.cursor));
  assert.match(plus,/M16 11V21 M11 16H21/);
  assert.match(plus,/\) 16 16, crosshair/);
  await page.locator('#node-remove').click();
  const targetX=await page.locator('#canvas').evaluate(el=>decodeURIComponent(el.style.cursor));
  assert.match(targetX,/M12 12L20 20 M20 12L12 20/);
  assert.notEqual(plus,targetX);
  await page.locator('#node-done').click();
  await page.waitForTimeout(250); // Wait for the documented editor-close debounce.
  await page.waitForFunction(()=>document.querySelector('#busy').hidden);
  const projectDownload=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');
  const project=await projectDownload,bytes=readFileSync(await project.path()),doc=JSON.parse(bytes);
  assert.ok(doc.paths.length>0);assert.ok(doc.history.past.length>0);
  const firstExport=doc.journal.findIndex(x=>x.action==='export-eps-after');
  const preview=doc.journal.slice(0,firstExport).filter(x=>x.action==='autoheal-curve-preview').at(-1);
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
 // CNC end-to-end: tiny internal compound detail (<.1×.1 mm), strict
 // thresholds, original DO, independent AFTER, and exported outline EPS.
 const cncPage=await browser.newPage({viewport:{width:1280,height:1000}});
 cncPage.on('pageerror',e=>errors.push(e.message));
 await cncPage.goto('http://localhost:'+port);
 await cncPage.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 await cncPage.locator('#merge-overlaps').uncheck();
 const cncSvg='<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="40mm" viewBox="0 0 40 40">'+
  '<path fill="none" stroke="#222" d="M1 1 L20 1 L20 20 L1 20 Z M5 5 L5.04 5 L5.04 5.05 L5 5.05 Z"/></svg>';
 await cncPage.locator('#file').setInputFiles({name:'cnc-inner-micro.svg',
   mimeType:'image/svg+xml',buffer:Buffer.from(cncSvg)});
 const cncReady=async()=>{
   await cncPage.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'),{},{timeout:120000});
   await cncPage.waitForFunction(()=>document.querySelector('#busy').hidden);
 };
 const countMoves=async()=>((await cncPage.locator('#geometry .comparison-path').first().getAttribute('d')).match(/M/g)||[]).length;
 await cncReady();
 assert.equal(await cncPage.locator('#compare-after').getAttribute('aria-pressed'),'true');
 await cncPage.locator('#compare-before').click();
 assert.equal(await countMoves(),2,'original CNC ДО must retain both native contours');
 await cncPage.locator('#compare-after').click();
 assert.equal(await countMoves(),1,'CNC AFTER must remove only .04×.05mm inner contour');
 assert.match(await cncPage.locator('#optimization-result').textContent(),/CNC: удалено малых замкнутых подконтуров 1/);
 await cncPage.locator('#remove-micro').uncheck();
 await cncPage.waitForFunction(()=>document.querySelector('#optimization-result').textContent.includes('фильтр отключён'));
 await cncReady();await cncPage.locator('#compare-after').click();
 assert.equal(await countMoves(),2,'disabled microfilter must preserve tiny detail');
 await cncPage.locator('#remove-micro').check();
 await cncPage.locator('#micro-width').fill('0.02');
 await cncPage.locator('#micro-width').press('Tab');
 await cncPage.waitForFunction(()=>document.querySelector('#optimization-result').textContent.includes('размер строго меньше 0.02 × 0.1 мм')&&!document.querySelector('#optimization-result').textContent.includes('фильтр отключён'));
 await cncReady();await cncPage.locator('#compare-after').click();
 assert.equal(await countMoves(),2,'width threshold .02mm must retain .04mm detail');
 await cncPage.locator('#micro-width').fill('0.1');
 await cncPage.locator('#micro-width').press('Tab');
 await cncPage.waitForFunction(()=>document.querySelector('#optimization-result').textContent.includes('размер строго меньше 0.1 × 0.1 мм')&&!document.querySelector('#optimization-result').textContent.includes('фильтр отключён'));
 await cncReady();await cncPage.locator('#compare-after').click();
 assert.equal(await countMoves(),1,'restoring .1mm threshold removes tiny detail');
 await cncPage.locator('#compare-before').click();
 assert.equal(await countMoves(),2,'filter must never alter raw imported ДО');
 await cncPage.locator('#compare-after').click();
 const downloadCnc=cncPage.waitForEvent('download');
 await cncPage.locator('#export-eps').click();
 await cncPage.locator('input[name="eps-color-mode"][value="outline"]').check();
 await cncPage.locator('#eps-color-confirm').click();
 if(await cncPage.locator('#eps-save-warning').isVisible())await cncPage.locator('#eps-save-anyway').click();
 const cncFile=await downloadCnc;
 const cncEPS=readFileSync(await cncFile.path(),'utf8');
 assert.equal(cncEPS.split(/\r?\n/).filter(x=>/^[-\d. ]+ m$/.test(x)).length,1,
   'downloaded EPS contains exactly the filtered AFTER native contour');
 await cncPage.close();
 console.log('PASS CNC micro-filter: inner compound contour, toggling, threshold, DO and exported EPS');
 const tracePage=await browser.newPage();tracePage.on('pageerror',e=>errors.push(e.message));
 await tracePage.goto('http://localhost:'+port);await tracePage.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 const traceSvg='<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20"><path fill="red" stroke="none" d="M0 0 L10 0 L10 10 L0 10 Z M2 0 L8 0 L2 0 Z"/></svg>';
 await tracePage.locator('#file').setInputFiles({name:'covered-retrace.svg',mimeType:'image/svg+xml',buffer:Buffer.from(traceSvg)});
 await tracePage.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));await tracePage.waitForFunction(()=>document.querySelector('#busy').hidden);
 assert.match(await tracePage.locator('#optimization-result').textContent(),/покрытых повторных проходов 1/);
 assert.match(await tracePage.locator('#status').textContent(),/0 неисправленных/);
 await tracePage.locator('#compare-before').click();const traceBefore=await tracePage.locator('#geometry .comparison-path').first().getAttribute('d');
 await tracePage.locator('#compare-after').click();const traceAfter=await tracePage.locator('#geometry .comparison-path').first().getAttribute('d');assert.notEqual(traceBefore,traceAfter);
 await tracePage.locator('#apply-changes').click();await tracePage.keyboard.press('Control+z');
 await tracePage.waitForTimeout(250);await tracePage.waitForFunction(()=>document.querySelector('#busy').hidden);
 const traceProjectEvent=tracePage.waitForEvent('download');await tracePage.keyboard.press('Control+Shift+s');const traceProjectFile=await traceProjectEvent;
 const traceProject=JSON.parse(readFileSync(await traceProjectFile.path(),'utf8'));
 const nodeCount=d=>d.paths.reduce((n,p)=>n+p.commands.filter(c=>['M','L','C','Q'].includes(c[0])).length,0);
 assert.equal(nodeCount(traceProject),7,'Undo restores the original duplicate subpath');assert.ok(traceProject.history.future.some(d=>nodeCount(d)===4));
 const traceEpsEvent=tracePage.waitForEvent('download');await tracePage.locator('#export-eps').click();await tracePage.locator('input[name="eps-color-mode"][value="outline"]').check();await tracePage.locator('#eps-color-confirm').click();assert.equal(await tracePage.locator('#eps-save-warning').isVisible(),false);
 const traceEps=await traceEpsEvent;assert.equal(readFileSync(await traceEps.path(),'utf8').split(/\r?\n/).filter(s=>/^[-\d. ]+ (?:m|L|C)$/.test(s)).length,4);
 await tracePage.close();console.log('PASS covered retrace UI: real repair, cached AFTER, Apply, Undo restores seven anchors, EPS saves four');
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
