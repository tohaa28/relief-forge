import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as mupdf from '../web/vendor/mupdf/mupdf.js';
import {pdfPageToSvg} from '../web/pdf-pipeline.js';
import {layeredPdf} from '../tests/fixtures/pdf/layered-fixture.mjs';
const port='8086',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PDF_IMPORT_URL||'http://localhost:'+port);await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 const input=process.env.SMOKE_PDF?readFileSync(process.env.SMOKE_PDF):layeredPdf(),name=process.env.SMOKE_PDF?'private-example.pdf':'layered-fixture.pdf';
 const converted=pdfPageToSvg(input,mupdf,0),raw=converted.svg.replace(/(<g) xmlns:inkscape="[^"]*"/g,'$1');
 const baseline=await page.evaluate(async svg=>{const m=await import('./rich-svg.js');try{const doc=m.importRichSvg(svg,{unitsPerInch:72});doc.paths.forEach(p=>m.safeFragment(p.artwork));return 'unexpected-success';}catch(e){return e.message;}},raw);
 assert.equal(baseline,'Некорректный SVG','must reproduce browser rejection of old standalone PDF layer fragments');
 const waitImport=async()=>{await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'),{},{timeout:120000});await page.waitForFunction(()=>document.querySelector('#busy').hidden);};
 const getDownload=async action=>{const pending=page.waitForEvent('download');await action();const f=await pending;return readFileSync(await f.path(),'utf8');};
 const project=async()=>JSON.parse(await getDownload(()=>page.keyboard.press('Control+Shift+s')));
 const start=performance.now();await page.locator('#file').setInputFiles({name,mimeType:'application/pdf',buffer:input});await waitImport();
 assert.equal(await page.locator('#workspace-filename').textContent(),name);assert.equal(await page.locator('#workspace-health-state').isVisible(),false);
 await page.locator('#compare-before').click();const before=await project();assert.equal(before.pdfImport.pageNumber,1);assert.equal(before.pdfImport.pageCount,1);
 assert.ok(before.paths.some(p=>p.commands.some(c=>c[0]==='C')));assert.ok(before.paths.every(p=>!p.paint?.unsupported));
 const sourceNodes=before.paths.reduce((n,p)=>n+p.points.length,0),svg=await getDownload(()=>page.keyboard.press('Control+Shift+e'));
 const visual=await page.evaluate(async({raw,svg,ratio})=>{
  const draw=async text=>{const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(text);await img.decode();const c=document.createElement('canvas');c.width=800;c.height=Math.round(800*ratio);c.getContext('2d').drawImage(img,0,0,c.width,c.height);return c.getContext('2d').getImageData(0,0,c.width,c.height).data;};
  const a=await draw(raw),b=await draw(svg);let mismatch=0,ink=0;for(let i=3;i<Math.min(a.length,b.length);i+=4){if(a[i]>128)ink++;if(Math.abs(a[i]-b[i])>32)mismatch++;}return {mismatch,ink,pixels:a.length/4};
 },{raw,svg,ratio:converted.heightPt/converted.widthPt});
 assert.ok(visual.ink>100);assert.ok(visual.mismatch/visual.pixels<.002,'independent raw-page SVG and exported editable SVG silhouettes must agree');
 if(process.env.PDF_IMPORT_SCREENSHOT)await page.screenshot({path:process.env.PDF_IMPORT_SCREENSHOT});
 await page.locator('#compare-after').click();let finalProject;
 for(const mode of ['outline','original']){
  const eps=await getDownload(async()=>{await page.locator('#export-eps').click();await page.locator('input[name="eps-color-mode"][value="'+mode+'"]').check();await page.locator('#eps-color-confirm').click();if(await page.locator('#eps-save-warning').isVisible())await page.locator('#eps-save-anyway').click();});
  assert.match(eps,/^%!PS/);assert.ok(/(?:curveto| C\s*$)/m.test(eps));finalProject=await project();
 }
 if(JSON.stringify(finalProject.paths)===JSON.stringify(before.paths)){
   console.error('PDF-UNION-FALLBACK-DIAGNOSTIC',JSON.stringify({
     sourceNodes:before.paths.reduce((n,p)=>n+p.points.length,0),
     finalNodes:finalProject.paths.reduce((n,p)=>n+p.points.length,0),
     status:await page.locator('#status').textContent(),
     preview:(await page.locator('#optimization-result').textContent()).slice(0,2600),
     auto:await page.locator('#auto-status').textContent(),
     applyDisabled:await page.locator('#apply-changes').isDisabled()
   }));
 }
 await page.keyboard.press('Control+z');await page.waitForTimeout(250);await page.waitForFunction(()=>document.querySelector('#busy').hidden);assert.deepEqual((await project()).paths,before.paths,'Undo must restore imported PDF native curves and paint exactly');
 await page.keyboard.press('Control+y');await page.waitForTimeout(250);await page.waitForFunction(()=>document.querySelector('#busy').hidden);assert.deepEqual((await project()).paths,finalProject.paths,'Redo must restore the applied result exactly');
 await page.locator('#file').setInputFiles({name:'reopened.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(finalProject))});await waitImport();assert.equal((await project()).pdfImport.pageNumber,1);
 const preserved=await page.locator('#geometry').innerHTML(),fileName=await page.locator('#workspace-filename').textContent();
 await page.locator('#file').setInputFiles({name:'two-pages.pdf',mimeType:'application/pdf',buffer:layeredPdf({pages:2,image:true})});await page.locator('#pdf-page-picker').waitFor({state:'visible'});await page.locator('#pdf-page-cancel').click();await page.waitForFunction(()=>document.querySelector('#busy').hidden);
 assert.equal(await page.locator('#geometry').innerHTML(),preserved);assert.equal(await page.locator('#workspace-filename').textContent(),fileName);
 await page.locator('#file').setInputFiles({name:'two-pages.pdf',mimeType:'application/pdf',buffer:layeredPdf({pages:2,image:true})});await page.locator('#pdf-page-picker').waitFor({state:'visible'});await page.locator('#pdf-page-number').selectOption('1');await page.locator('#pdf-page-confirm').click();await waitImport();
 const second=await project();assert.equal(second.pdfImport.pageNumber,2);assert.equal(second.pdfImport.pageCount,2);assert.equal(second.paths.filter(p=>p.kind==='image').length,1);
 const lastGeometry=await page.locator('#geometry').innerHTML();
 await page.locator('#file').setInputFiles({name:'invalid.pdf',mimeType:'application/pdf',buffer:Buffer.from('Not a PDF')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('заголовок'));await page.waitForFunction(()=>document.querySelector('#busy').hidden);assert.equal(await page.locator('#geometry').innerHTML(),lastGeometry);assert.equal((await project()).pdfImport.pageNumber,2);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'PASS PDF real Worker: baseline layer failure reproduced; layer/text/curve/scale/paint, raster silhouette, both EPS, project reopen, multipage choice/cancel/image',sourceNodes,finalNodes:finalProject.paths.reduce((n,p)=>n+p.points.length,0),width:before.width,height:before.height,visual,totalMs:Math.round(performance.now()-start)}));
}finally{await browser?.close();server.kill();}
