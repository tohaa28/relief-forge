import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {screenToDocumentPoint} from '../web/manual-viewport-performance.js';
import {zoomBox} from '../web/central-comparison.js';
const port=process.env.ALPHA75_PORT||'8107',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const instrument=`
 window.__viewSamples={renders:0};const originalRender=render;
 render=(...args)=>{window.__viewSamples.renders++;return originalRender(...args);};
 window.__loadViewScene=(value,stage)=>{
  const wasReady=ready;ready=false;openValue(value,'view-zoom-synthetic.rf.json');ready=wasReady;
  clearTimeout(clearanceTimer);clearanceWorker?.terminate();clearanceWorker=null;
  issues=[{kind:'short',point:[5,5],path:0,other:0,nodePoints:[[5,5],[5.005,5]]}];
  if(stage){appliedComparison={beforeDoc:structuredClone(doc),preparedDoc:structuredClone(doc),afterDoc:structuredClone(doc),beforeIssues:issues,preparedIssues:issues,afterIssues:issues};compareStage=stage;}
  else appliedComparison=null;
  render();
 };
 window.__viewSnapshot=()=>JSON.stringify({doc,past,future,issues,comparison:currentComparison(),selected:[...selected]});
 `;
 await page.route('**/app.js*',async r=>{
  const source=process.env.ALPHA75_URL?await(await r.fetch()).text():readFileSync(new URL(process.env.ALPHA75_BASELINE?'../.alpha75-before-app.js':'../web/app.js',import.meta.url),'utf8');
  await r.fulfill({contentType:'text/javascript',body:source+instrument});
 });
 await page.goto(process.env.ALPHA75_URL||'http://localhost:'+port);
 await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 const commands=[];
 for(let row=0;row<40;row++){commands.push(['M',2,2+row*2]);for(let i=1;i<=500;i++){
  const x=2+i*.2,y=2+row*2+.3*Math.sin(i*.15);commands.push(['C',x-.14,y-.1,x-.06,y+.1,x,y]);
 }}
 const makePath=commands=>({kind:'vector',commands,offset:[0,0],points:commands.map(c=>c.slice(-2)),closed:false,
  paint:{fill:'none',stroke:'#234567',opacity:1,strokeWidthMm:.1},artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="none" stroke="#234567"/>'});
 const large={format:'relief-forge',version:1,width:110,height:85,paths:[makePath(commands)]};
 const many={...large,paths:Array.from({length:1975},(_,i)=>makePath([['M',i%50*2,Math.floor(i/50)*2],['C',i%50*2+.2,Math.floor(i/50)*2+.4,i%50*2+.6,Math.floor(i/50)*2+.4,i%50*2+.8,Math.floor(i/50)*2]]))};
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const reports=[];
 for(const [name,scene,stage] of [['compound',large,null],['many-after',many,'after'],['before',large,'before'],['prepared',large,'prepared']]){
  await page.evaluate(({scene,stage})=>window.__loadViewScene(scene,stage),{scene,stage});
  await page.waitForTimeout(80);
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('curve-editing')),false);
  const snapshot=await page.evaluate(()=>window.__viewSnapshot());
  await page.evaluate(()=>{
   window.__viewSamples.renders=0;window.__viewWrites=0;window.__geometryMutations=0;
   window.__keptGeometry=document.querySelector('#geometry').firstChild;
   window.__keptSidebar=document.querySelector('#paths').firstChild;
   window.__viewObserver=new MutationObserver(rs=>window.__viewWrites+=rs.filter(r=>r.attributeName==='viewBox').length);
   window.__viewObserver.observe(document.querySelector('#canvas'),{attributes:true});
   window.__geoObserver=new MutationObserver(rs=>window.__geometryMutations+=rs.filter(r=>r.type==='childList'||r.attributeName==='d').length);
   window.__geoObserver.observe(document.querySelector('#geometry'),{childList:true,subtree:true,attributes:true});
  });
  const initial=await page.locator('#canvas').evaluate(c=>{const b=c.viewBox.baseVal,r=c.getBoundingClientRect();return {view:{x:b.x,y:b.y,width:b.width,height:b.height},rect:{left:r.left,top:r.top,width:r.width,height:r.height}};});
  let expected=initial.view;
  const events=Array.from({length:60},(_,i)=>({x:500+i%4*30,y:370+i%3*20,delta:i%4===3?30:-30}));
  for(const e of events)expected=zoomBox(expected,e.delta>0?1.15:1/1.15,screenToDocumentPoint(e.x,e.y,initial.rect,expected));
  const burstMs=await page.evaluate(events=>{const c=document.querySelector('#canvas'),t=performance.now();for(const e of events)c.dispatchEvent(new WheelEvent('wheel',{clientX:e.x,clientY:e.y,deltaY:e.delta,bubbles:true,cancelable:true}));return performance.now()-t;},events);
  await page.waitForFunction(()=>{
   const c=document.querySelector('#canvas'),b=c.viewBox.baseVal,r=document.querySelector('.issue-ring');
   return window.__viewWrites>0&&r&&Math.abs(Number(r.getAttribute('r'))/
    Math.max(b.width/c.clientWidth,b.height/c.clientHeight)-7)<1e-5;
  });
  const report=await page.evaluate(()=>{
   window.__viewObserver.disconnect();window.__geoObserver.disconnect();const c=document.querySelector('#canvas'),b=c.viewBox.baseVal,
    ring=document.querySelector('.issue-ring'),unit=Math.max(b.width/c.clientWidth,b.height/c.clientHeight);
   return {renders:window.__viewSamples.renders,writes:window.__viewWrites,geometryMutations:window.__geometryMutations,
    retained:window.__keptGeometry===document.querySelector('#geometry').firstChild&&window.__keptSidebar===document.querySelector('#paths').firstChild,
    view:c.getAttribute('viewBox').split(/\s+/).map(Number),ringPixels:ring?Number(ring.getAttribute('r'))/unit:null};
  });
  report.cameraError=Math.max(...Object.values(expected).map((v,i)=>Math.abs(v-report.view[i])));
  if(!process.env.ALPHA75_BASELINE)assert.ok(report.cameraError<1e-7,'every moving-cursor step must be retained: '+report.cameraError);
  assert.equal(await page.evaluate(()=>window.__viewSnapshot()),snapshot,'zoom never modifies model/history/diagnostics/selection');
  assert.ok(Math.abs(report.ringPixels-7)<1e-5,'issue rings keep 7px radius');
  if(!process.env.ALPHA75_BASELINE){assert.equal(report.renders,0);assert.equal(report.writes,1);assert.equal(report.geometryMutations,0);assert.equal(report.retained,true);}
  reports.push({name,burstMs,...report});
 }
 if(!process.env.ALPHA75_BASELINE){
  const decorationWrites=await page.evaluate(async()=>{
   const canvas=document.querySelector('#canvas'),ring=document.querySelector('.issue-ring');
   let writes=0,frames=0;
   const observer=new MutationObserver(records=>{writes+=records.length;});
   observer.observe(ring,{attributes:true,attributeFilter:['r']});
   const camera=new MutationObserver(records=>{frames+=records.length;});
   camera.observe(canvas,{attributes:true,attributeFilter:['viewBox']});
   const rect=canvas.getBoundingClientRect();
   for(let i=0;i<8;i++){
    canvas.dispatchEvent(new WheelEvent('wheel',{clientX:rect.left+rect.width/2,
      clientY:rect.top+rect.height/2,deltaY:120,cancelable:true}));
    await new Promise(resolve=>requestAnimationFrame(resolve));
   }
   const during=writes;
   await new Promise(resolve=>setTimeout(resolve,170));
   observer.disconnect();camera.disconnect();
   return {during,after:writes,frames};
  });
  assert.deepEqual(decorationWrites,{during:0,after:1,frames:8},
    'each frame updates the camera and the marker is resized once after the gesture');
  const before=await page.locator('#canvas').getAttribute('viewBox');
  await page.evaluate(()=>{
   const c=document.querySelector('#canvas');
   c.dispatchEvent(new WheelEvent('wheel',{clientX:600,clientY:450,deltaY:-30,cancelable:true,bubbles:true}));
   c.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:600,clientY:450,bubbles:true}));
  });
  await page.waitForTimeout(50);
  assert.equal(await page.locator('#canvas').getAttribute('viewBox'),before,'pointerdown cancels an undisplayed camera before interaction');
  await page.locator('#zoom-in').click();await page.waitForTimeout(50);
  await page.locator('#zoom-out').click();await page.waitForTimeout(50);
  const roundtrip=(await page.locator('#canvas').getAttribute('viewBox')).split(/\s+/).map(Number);
  before.split(/\s+/).map(Number).forEach((v,i)=>assert.ok(Math.abs(v-roundtrip[i])<1e-5,'button zoom inverse'));
  await page.evaluate(()=>{
   document.querySelector('#canvas').dispatchEvent(new WheelEvent('wheel',{clientX:600,clientY:450,deltaY:-30,cancelable:true,bubbles:true}));
   document.querySelector('#fit').click();
  });
  await page.waitForTimeout(50);
  const fitted=(await page.locator('#canvas').getAttribute('viewBox')).split(/\s+/).map(Number);
  assert.ok(Math.abs(fitted[2]-125.4)<1e-7,'Fit wins over queued zoom');
  const kept=await page.evaluate(()=>window.__keptGeometry===document.querySelector('#geometry').firstChild);
  assert.equal(kept,true,'Fit retains full vector DOM');
  await page.setViewportSize({width:1200,height:870});await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>window.__keptGeometry===document.querySelector('#geometry').firstChild),true,'resize resizes decorations without remounting vectors');
  const radiusPixels=await page.locator('.issue-ring').evaluate(r=>{const c=document.querySelector('#canvas'),b=c.viewBox.baseVal;return Number(r.getAttribute('r'))/Math.max(b.width/c.clientWidth,b.height/c.clientHeight);});
  assert.ok(Math.abs(radiusPixels-7)<1e-7);
  await page.evaluate(()=>{
   document.querySelector('#canvas').dispatchEvent(new WheelEvent('wheel',{clientX:600,clientY:450,deltaY:-30,cancelable:true,bubbles:true}));
   document.querySelector('.issue-ring').dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:600,clientY:450,bubbles:true}));
  });
  await page.waitForTimeout(100);
  const focused=(await page.locator('#canvas').getAttribute('viewBox')).split(/\s+/).map(Number);
  assert.ok(Math.abs(focused[0]+focused[2]/2-5)<1e-7&&Math.abs(focused[1]+focused[3]/2-5)<1e-7,'issue focus wins over queued zoom');
 }
 console.log('View zoom reports '+JSON.stringify(reports));
 if(process.env.ALPHA75_REPORT)writeFileSync(process.env.ALPHA75_REPORT,JSON.stringify(reports,null,2));
 assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill();}

