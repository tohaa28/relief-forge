import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8099';
const server=spawn(process.execPath,['scripts/serve.mjs'],{
 env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']
});
await new Promise((resolve,reject)=>{
 server.stdout.once('data',resolve);server.once('error',reject);
});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://localhost:'+port);
 await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 assert.equal(await page.locator('#doctortracer-enabled').isChecked(),false,
   'doctortracer must be opt-in, disabled on first load');
 const count=2300;
 const commands=['M 1 40'];
 for(let i=1;i<=count;i++){
  const x=1+i*.052,y=40+5*Math.sin(i*.03);
  commands.push('C '+(x-.035)+' '+(40+5*Math.sin((i-.67)*.03))+' '+
    (x-.017)+' '+(40+5*Math.sin((i-.33)*.03))+' '+x+' '+y);
 }
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="140mm" height="80mm" viewBox="0 0 140 80">'+
   '<path fill="none" stroke="black" d="'+commands.join(' ')+'"/></svg>';
 await page.locator('#file').setInputFiles({
  name:'single-2300-cubic-alpha66.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
 });
 await page.waitForFunction(()=>document.querySelector('#busy').hidden&&
   document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),
   {},{timeout:120000});
 assert.match(await page.locator('#doctortracer-status').textContent(),/отключён/);
 // AFTER may legitimately remove thousands of redundant Bézier anchors.
 // Select original BEFORE to stress the pathological 2300-C source precisely.
 await page.locator('#compare-before').click();
 await page.locator('#curve-edit').click();
 await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
 const scene=await page.evaluate(()=>({
   commandCount:(document.querySelector('#geometry').innerHTML.match(/C/g)||[]).length,
   manualGlyphs:document.querySelectorAll('#manual-glyphs .curve-node').length,
   sourceGlyphs:document.querySelectorAll('#geometry .curve-node').length,
   classes:document.body.className
 }));
 assert.ok(scene.commandCount>1000,
   'stress test must retain dense original BEFORE, not optimized AFTER: '+JSON.stringify(scene));
 const original=await page.locator('#geometry').innerHTML();
 // Zoom around a real indexed anchor, not an empty center of the page.
 const glyph=page.locator('#manual-glyphs .curve-node').first();
 assert.ok(await glyph.count()>0,
   'manual index must prime before node selection: '+JSON.stringify(scene));
 const point=await glyph.boundingBox();
 assert.ok(point,'focus anchor is visible');
 const cx=point.x+point.width/2,cy=point.y+point.height/2;
 await page.mouse.move(cx,cy);
 const wheelDurations=[];
 for(let i=0;i<20;i++){
   const started=performance.now();
   await page.mouse.wheel(0,-90);
   wheelDurations.push(performance.now()-started);
 }
 await page.waitForFunction(()=>document.body.classList.contains('manual-local-zoom')&&
  document.querySelector('#manual-local-geometry .manual-local-stroke'));
 const inspection=await page.evaluate(()=>{
  const paths=document.querySelectorAll('#manual-local-geometry .manual-local-stroke');
  const base=document.querySelector('#geometry');
  return {baseHidden:getComputedStyle(base).display==='none',
   originalC:(base.innerHTML.match(/C/g)||[]).length,
   visibleC:[...paths].reduce((n,p)=>n+(p.getAttribute('d').match(/C/g)||[]).length,0),
   active:document.body.classList.contains('manual-local-zoom')};
 });
 assert.ok(inspection.originalC>600,'source should remain dense');
 assert.equal(inspection.baseHidden,true,'heavy source must be hidden at high zoom');
 assert.ok(inspection.visibleC>0&&inspection.visibleC<=600,
   'only 600 local C segments painted: '+JSON.stringify(inspection));
 assert.equal(await page.locator('#geometry').innerHTML(),original,
   'zoom must not mutate source SVG commands');
 assert.ok(Math.max(...wheelDurations)<3000,
   'individual zoom dispatch should not stall seconds: '+JSON.stringify(wheelDurations));
 await page.locator('#node-done').click();
 await page.waitForFunction(()=>!document.body.classList.contains('curve-editing'));
 assert.equal(await page.locator('#geometry').evaluate(el=>getComputedStyle(el).display!=='none'),true);
 assert.deepEqual(errors,[]);
 console.log('PASS browser alpha66 single-path high zoom: 2300 cubic segments, 20 wheel events, '
   +inspection.visibleC+' locally painted, source untouched, max zoom '+
   Math.round(Math.max(...wheelDurations))+'ms');
}finally{
 await browser?.close();server.kill();
}
