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
 // Newly staged editing must not modify the source compound geometry even
 // after pointerup. The owner document is serialized only on editor exit.
 assert.ok(await page.locator('#manual-patches .manual-staged-segment').count()>0);
 const initialMarkup=await page.locator('#geometry').innerHTML();
 assert.equal(await page.locator('#busy').isHidden(),true);
 assert.match(await page.locator('#status').textContent(),/Локальная правка сохранена/);
 const afterFirst=await page.locator('#geometry').innerHTML();
 assert.equal(afterFirst,initialMarkup);
 // Undo/redo are local, with no full-document geometry rebuild.
 await page.keyboard.press('Control+z');
 assert.equal(await page.locator('#geometry').innerHTML(),initialMarkup);
 await page.keyboard.press('Control+y');
 assert.equal(await page.locator('#geometry').innerHTML(),initialMarkup);
 // Six more actual mouse releases on the same local glyph. The entire
 // 2300-curve geometry DOM remains byte-for-byte untouched.
 for(let i=0;i<6;i++){
   const node=page.locator('#manual-glyphs .curve-node').first();
   const rect=await node.boundingBox();assert.ok(rect);
   const startX=rect.x+rect.width/2,startY=rect.y+rect.height/2;
   await page.mouse.move(startX,startY);
   await page.mouse.down();
   await page.mouse.move(startX+2,startY+1);
   await page.mouse.up();
   assert.equal(await page.locator('#geometry').innerHTML(),initialMarkup);
 }
 const staged=await page.locator('#manual-patches .manual-staged-segment').count();
 assert.ok(staged>0&&staged<50,'local overlays must be bounded by touched segments');
 await page.locator('#node-done').click();
 await page.waitForFunction(()=>!document.body.classList.contains('curve-editing'),{},{timeout:30000});
 assert.equal(await page.locator('#manual-patches .manual-staged-segment').count(),0);
 assert.equal(await page.locator('#manual-glyphs .curve-node').count(),0);
 assert.notEqual(await page.locator('#geometry').innerHTML(),initialMarkup,
   'the entire document is rebuilt once, only on explicit editor exit');
 assert.deepEqual(errors,[]);
 console.log('PASS alpha56 stress browser: 2300 C, 40 pointermoves and 7 mouseups without whole-figure rebuild, local undo/redo, one final batch commit');
}finally{await browser?.close();server.kill();}
