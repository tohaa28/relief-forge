import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {verifyEpsOutputGeometry,geometryCommands} from '../web/eps-export.js';

const port='8105',server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Instrument the real module for an isolated viewport benchmark. Opening
  // this synthetic raw scene skips the unrelated autoheal/import benchmark.
  // No test hooks are shipped by the production app.
  const instrument=`
    window.__zoomSamples={};
    const timed=(name,fn)=>(...args)=>{const t=performance.now();try{return fn(...args);}
      finally{(window.__zoomSamples[name]??=[]).push(performance.now()-t);}};
    zoom=timed('zoom',zoom);
    refreshLocalZoomGeometry=timed('geometry',refreshLocalZoomGeometry);
    drawLocalEditorOverlay=timed('glyphs',drawLocalEditorOverlay);
    window.__loadZoomScene=value=>{const wasReady=ready;ready=false;openValue(value,'synthetic-20000-cubic.rf.json');ready=wasReady;render();};
    window.__zoomScene=()=>({commands:doc.paths[0].commands,localEdits:localEditCount,
      indices:[...localEditors.values()].map(e=>e.segmentIndexStats())});
  `;
  await page.route('**/app.js*',async r=>{
    const source=process.env.ALPHA73_URL?await (await r.fetch()).text():
      readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
    await r.fulfill({contentType:'text/javascript',body:source+instrument});
  });
  await page.goto(process.env.ALPHA73_URL||'http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const commands=[];
  for(let row=0;row<40;row++){
    commands.push(['M',2,2+row*2]);
    for(let i=1;i<=500;i++){
      const x=2+i*.2,y=2+row*2+.3*Math.sin(i*.15);
      commands.push(['C',x-.14,y-.1,x-.06,y+.1,x,y]);
    }
  }
  const scene={format:'relief-forge',version:1,width:110,height:85,paths:[{
    kind:'vector',offset:[0,0],commands,points:commands.map(c=>c.slice(-2)),closed:false,
    paint:{fill:'none',stroke:'#000000',opacity:1,strokeWidthMm:.1},
    artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="none" stroke="black"/>'}]};
  await page.evaluate(value=>window.__loadZoomScene(value),scene);
  await page.locator('#curve-edit').click();
  await page.waitForFunction(()=>document.body.classList.contains('curve-editing'));
  const source=await page.evaluate(()=>JSON.stringify(window.__zoomScene().commands));
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.mouse.move(600,460);
  const geometry=await page.locator('#geometry').innerHTML();
  await page.evaluate(()=>{
    window.__zoomSamples={};window.__viewWrites=0;
    window.__viewObserver=new MutationObserver(records=>{
      window.__viewWrites+=records.filter(r=>r.attributeName==='viewBox').length;
    });
    window.__viewObserver.observe(document.querySelector('#canvas'),{attributes:true});
  });
  const viewBefore=await page.locator('#canvas').evaluate(canvas=>{
    const b=canvas.viewBox.baseVal,r=canvas.getBoundingClientRect();
    const scale=Math.min(r.width/b.width,r.height/b.height),
      padX=(r.width-b.width*scale)/2,padY=(r.height-b.height*scale)/2;
    return {x:b.x,y:b.y,width:b.width,height:b.height,
      anchor:[b.x+(600-r.left-padX)/scale,b.y+(460-r.top-padY)/scale]};
  });
  const burst=await page.evaluate(()=>{
    const canvas=document.querySelector('#canvas'),t=performance.now();
    for(let i=0;i<60;i++)canvas.dispatchEvent(new WheelEvent('wheel',{
      clientX:600,clientY:460,deltaY:i%4===3?30:-30,bubbles:true,cancelable:true}));
    return performance.now()-t;
  });
  await page.waitForTimeout(250);
  const burstWrites=await page.evaluate(()=>{window.__viewObserver.disconnect();return window.__viewWrites;});
  assert.ok(burstWrites<=2,'60 wheel events must commit at most one viewBox per animation frame: '+burstWrites);
  const viewAfter=(await page.locator('#canvas').getAttribute('viewBox')).split(/\s+/).map(Number);
  const scale=1.15**-30;
  const expected=[viewBefore.anchor[0]+(viewBefore.x-viewBefore.anchor[0])*scale,
    viewBefore.anchor[1]+(viewBefore.y-viewBefore.anchor[1])*scale,viewBefore.width*scale,viewBefore.height*scale];
  viewAfter.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<1e-7,'coalescing retains every cursor-anchored wheel step'));
  for(let i=0;i<24;i++)await page.mouse.wheel(0,i%3===2?50:-50);
  await page.waitForTimeout(200);
  const samples=await page.evaluate(()=>window.__zoomSamples);
  const percentile=(values,p)=>values?.length?[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*p))]:0;
  const report={sceneSegments:20000,cpuThrottle:4,burst60Ms:burst,burstViewBoxWrites:burstWrites,
    zoomCalls:samples.zoom?.length||0,zoomP95Ms:percentile(samples.zoom,.95),
    geometryCalls:samples.geometry?.length||0,geometryTotalMs:samples.geometry?.reduce((a,b)=>a+b,0)||0,
    glyphCalls:samples.glyphs?.length||0,glyphP95Ms:percentile(samples.glyphs,.95),
    visibleC:await page.locator('#manual-local-geometry .manual-local-stroke').evaluateAll(
      paths=>paths.reduce((n,p)=>n+(p.getAttribute('d').match(/C/g)||[]).length,0))};
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__zoomScene().commands)),source);
  assert.equal(await page.evaluate(()=>window.__zoomScene().localEdits),0);
  assert.equal(await page.locator('#geometry').innerHTML(),geometry,'zoom never rebuilds the full source DOM');
  assert.ok(report.visibleC>0&&report.visibleC<=600);
  if(process.env.ALPHA73_BASELINE_FILE)writeFileSync(process.env.ALPHA73_BASELINE_FILE,JSON.stringify(report,null,2));
  console.log('Zoom benchmark '+JSON.stringify(report));
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});
  assert.deepEqual(errors,[]);
  await page.close();

  // Uninstrumented application: change the actual smoothing setting, Apply,
  // export the resulting native commands, and restore with Undo/Redo.
  const ui=await browser.newPage({viewport:{width:1440,height:980}});
  ui.on('pageerror',e=>errors.push(e.message));
  await ui.goto(process.env.ALPHA73_URL||'http://localhost:'+port);
  await ui.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const ready=()=>ui.waitForFunction(()=>document.querySelector('#busy').hidden&&
    !document.querySelector('#settings-pending').textContent.includes('Выполняется'),null,{timeout:120000});
  const project=async()=>{
    await ui.locator('#settings-pending').click(); // Leave an input before using document shortcuts.
    const event=ui.waitForEvent('download');await ui.keyboard.press('Control+Shift+s');
    return JSON.parse(readFileSync(await (await event).path(),'utf8'));
  };
  const apply=async()=>{await ui.locator('#apply-changes').click();await ready();};
  const open=async(svg,name)=>{
    await ui.locator('#file').setInputFiles({name,mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
    await ui.waitForFunction(()=>document.querySelector('#busy').hidden&&
      document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),null,{timeout:120000});
  };
  const curve=(x,y)=>'<path fill="none" stroke="#123456" d="M'+x+' '+y+
    ' C'+(x+1)+' '+y+' '+(x+2)+' '+y+' '+(x+3)+' '+y+
    ' C'+(x+4)+' '+(y+.1)+' '+(x+5)+' '+(y+.5)+' '+(x+6)+' '+(y+.5)+'"/>';
  await open('<svg xmlns="http://www.w3.org/2000/svg" width="12mm" height="8mm" viewBox="0 0 12 8">'+curve(1,2)+'</svg>','alpha73-smoothing.svg');
  await ui.evaluate(()=>{
    for(const id of ['merge-overlaps','merge-nearby','repair-self-intersections','separate-coincident','remove-micro']){
      const field=document.getElementById(id);field.checked=false;field.dispatchEvent(new Event('change'));
    }
  });
  await ui.locator('#smoothing-amount').fill('0');
  await ui.locator('#optimization-tolerance').fill('0.00001');
  await apply();
  const zero=await project(),initial=geometryCommands(zero.paths[0]);
  await ui.locator('#smoothing-amount').fill('0.05');
  // Draft changes remain staged; only the explicit Apply may write geometry.
  assert.deepEqual(geometryCommands((await project()).paths[0]),initial);
  await apply();
  const smoothed=await project(),actual=geometryCommands(smoothed.paths[0]);
  assert.equal(actual.filter(c=>c[0]==='C').length,2);
  assert.deepEqual(actual.map(c=>c.slice(-2)),initial.map(c=>c.slice(-2)));
  assert.notDeepEqual(actual,initial,'smoothing modifies real Bézier handles');
  const angle=commands=>{
    const a=commands[1],b=commands[2],anchor=a.slice(-2),u=[anchor[0]-a[3],anchor[1]-a[4]],
      v=[b[1]-anchor[0],b[2]-anchor[1]];
    return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/(Math.hypot(...u)*Math.hypot(...v)))))*180/Math.PI;
  };
  assert.ok(angle(actual)<angle(initial),'the tangent mismatch must actually decrease');
  const epsEvent=ui.waitForEvent('download');await ui.locator('#export-eps').click();
  await ui.locator('input[name="eps-color-mode"][value="outline"]').check();
  await ui.locator('#eps-color-confirm').click();
  if(await ui.locator('#eps-save-warning').isVisible())await ui.locator('#eps-save-anyway').click();
  const eps=readFileSync(await (await epsEvent).path(),'utf8');
  verifyEpsOutputGeometry(smoothed,{content:eps,source:'outline'});
  await ui.keyboard.press('Control+z');await ui.waitForTimeout(220);await ready();
  assert.deepEqual(geometryCommands((await project()).paths[0]),initial,'Undo restores unsmoothed handles');
  await ui.keyboard.press('Control+y');await ui.waitForTimeout(220);await ready();
  assert.deepEqual(geometryCommands((await project()).paths[0]),actual,'Redo restores the exported smoothed result');

  await ui.locator('#smoothing-amount').fill('0');await apply();
  const moved=structuredClone(zero.paths[0]);moved.offset=[10,20];
  const shiftedDocument={format:'relief-forge',version:1,width:40,height:40,paths:[moved]};
  await ui.locator('#file').setInputFiles({name:'alpha73-translated.rf.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify(shiftedDocument))});
  await ui.waitForFunction(()=>document.querySelector('#busy').hidden&&
    document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),null,{timeout:120000});
  await ui.locator('#smoothing-amount').fill('0.05');await apply();
  const shifted=geometryCommands((await project()).paths[0]),worldSource=geometryCommands(moved);
  assert.notDeepEqual(shifted,worldSource,'translated curves must also smooth in the actual application');
  assert.deepEqual(shifted.map(c=>c.slice(-2)),worldSource.map(c=>c.slice(-2)));
  await ui.locator('#smoothing-amount').fill('0');await apply();
  const copies=Array.from({length:151},(_,i)=>curve(1+i%15*8,1+Math.floor(i/15)*4)).join('');
  await open('<svg xmlns="http://www.w3.org/2000/svg" width="125mm" height="50mm" viewBox="0 0 125 50">'+copies+'</svg>','alpha73-large-smoothing.svg');
  await ui.locator('#smoothing-amount').fill('0.05');await apply();
  const large=await project();
  assert.equal(large.paths.length,1);
  assert.equal(large.paths[0].commands.filter(c=>c[0]==='C').length,302);
  assert.match(await ui.locator('#optimization-result').textContent(),/сглажено 151 стыков/);
  console.log('PASS alpha73 smoothing UI: staged zero/0.05mm, real handles and reduced tangent angle '+
    angle(initial).toFixed(4)+' → '+angle(actual).toFixed(4)+' degrees, anchors, translated project, EPS exact, Undo/Redo, large 151-join pipeline.');
  assert.deepEqual(errors,[]);
}finally{await browser?.close();server.kill();}
