import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const port='8098';
const server=spawn(process.execPath,['scripts/serve.mjs'],{
 env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']
});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1360,height:920}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:'+port);
 await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 // Synthetic 2300-C single compound vector: actual customer PDF has 7545 C.
 // No proprietary/user document bytes are included in the public test.
 let d='M 1 20';
 for(let i=1;i<=2300;i++){
  const x=1+i*.065,y=20+3*Math.sin(i*.014);
  d+=' C '+(x-.043)+' '+(20+3*Math.sin((i-.67)*.014))+
     ' '+(x-.022)+' '+(20+3*Math.sin((i-.33)*.014))+
     ' '+x+' '+y;
 }
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="155mm" height="45mm" viewBox="0 0 155 45">'+
   '<path stroke="#234567" fill="none" d="'+d+'"/></svg>';
 await page.locator('#file').setInputFiles({
  name:'synthetic-2300-beziers.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)
 });
 await page.waitForFunction(()=>
  document.querySelector('#auto-status').textContent.includes('Предварительный')&&
  document.querySelector('#busy').hidden,
  {},{timeout:180000});
 await page.locator('#curve-edit').click();
 await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
 const total=await page.locator('#geometry .curve-node').count();
 assert.ok(total>0&&total<=240,'editor must virtualize huge anchor list: '+total);
 const anchor=page.locator('#geometry .curve-node').first();
 const bb=await anchor.boundingBox();assert.ok(bb);
 const start={x:bb.x+bb.width/2,y:bb.y+bb.height/2};
 await page.mouse.move(start.x,start.y);
 await page.mouse.down();
 assert.equal(await page.locator('.manual-live-patch').count(),1);
 await page.evaluate(()=>{
  window.__manualMutations=0;
  window.__manualObserver=new MutationObserver(records=>{
    window.__manualMutations+=records.filter(x=>x.type==='childList').length;
  });
  window.__manualObserver.observe(document.querySelector('#geometry'),{childList:true,subtree:true});
 });
 for(let i=1;i<=40;i++)
  await page.mouse.move(start.x+i*.25,start.y+i*.15);
 await page.waitForTimeout(80);
 const report=await page.evaluate(()=>({
  mutations:window.__manualMutations,
  activeNodes:document.querySelectorAll('#geometry .curve-node').length,
  localD:document.querySelector('.manual-live-patch')?.getAttribute('d')||'',
  pending:!!document.querySelector('#busy:not([hidden])')
 }));
 assert.equal(report.mutations,0,'pointermove must not rebuild global geometry DOM');
 assert.ok(report.activeNodes<=240);
 assert.ok(report.localD.length>0&&report.localD.length<400);
 assert.ok((report.localD.match(/C/g)||[]).length<=2);
 assert.equal(report.pending,false,'the editor must never launch a full-document Worker while dragging');
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Локально перепроверена область'),{},{timeout:120000});
 assert.equal(await page.locator('#busy').isHidden(),true);
 await page.keyboard.press('Control+z');
 await page.waitForFunction(()=>document.querySelector('#busy').hidden,{},{timeout:30000});
 assert.deepEqual(errors,[]);
 console.log('PASS alpha55 stress browser: 2300 cubic segments, <=240 anchor DOM, 40 pointermoves/zero geometry rebuilds, tiny patch, local confirm, Undo');
}finally{await browser?.close();server.kill();}
