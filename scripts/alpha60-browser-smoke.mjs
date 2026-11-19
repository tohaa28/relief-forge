// Actual headless Chromium regression. This is NOT a mock Canvas2D or fake
// image decoder: it runs the shipped ES modules and real Path2D Canvas API.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const port=Number(process.env.ALPHA60_PORT||8779);
const server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:String(port)},stdio:'ignore'
});
let browser;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let online=false;
  for(let i=0;i<60;i++){
    try{const r=await fetch('http://127.0.0.1:'+port+'/index.html');online=r.ok;if(online)break;}
    catch{}
    await sleep(200);
  }
  if(!online)throw Error('HTTP static server did not start');
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  page.setDefaultTimeout(180000);
  await page.goto('http://127.0.0.1:'+port+'/index.html',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
    const tracer=await import('/doctortracer-fallback.js?browser=alpha60');
    const {buildManualViewportIndex}=await import('/manual-viewport-index.js?browser=alpha60');
    const doc={format:'relief-forge',version:1,width:110,height:160,paths:[]};
    for(let i=0;i<1975;i++){
      const x=(i%79)*1.31+.6,y=Math.floor(i/79)*5.2+.6;
      const commands=[['M',x,y]];
      for(let j=0;j<11;j++){
        const at=x+j*.04,yy=y+j*.019;
        commands.push(['C',at+.016,yy+.014,at+.026,yy+.024,at+.04,yy+.019]);
      }
      commands.push(['Z']);
      doc.paths.push({kind:'vector',artwork:'<path/>',closed:true,offset:[0,0],
        commands,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))});
    }
    const started=performance.now(),plan=tracer.rasterPlan(doc),stages=[];
    const originalBitmap=globalThis.createImageBitmap;
    globalThis.createImageBitmap=()=>{throw Error('Image decoder MUST NOT be used');};
    let raster;
    try{raster=await tracer.rasterizeDocument(doc,plan,{
      onProgress:e=>stages.push(e.processed)
    });}finally{globalThis.createImageBitmap=originalBitmap;}
    const rasterMs=performance.now()-started;
    let painted=0;for(let i=3;i<raster.pixels.length;i+=4)painted+=raster.pixels[i]>128?1:0;
    const indexStart=performance.now();
    const index=buildManualViewportIndex(doc);
    const indexedMs=performance.now()-indexStart;
    const startedQuery=performance.now();
    let visible=0;
    for(let k=0;k<160;k++){
      const frame={x:52+(k%12)*.03,y:28+(k%7)*.03,width:1.1,height:1.5};
      visible=index.query(frame,{limit:420,padding:.32})
        .reduce((n,g)=>n+g.segments,0);
    }
    const queriesMs=performance.now()-startedQuery;
    // Independently check a real even-odd Canvas fill. Compound holes must
    // remain transparent when black silhouette is rasterized.
    const q={format:'relief-forge',version:1,width:30,height:30,paths:[{
      kind:'vector',artwork:'<path/>',offset:[0,0],closed:true,
      commands:[['M',0,0],['L',30,0],['L',30,30],['L',0,30],['Z'],
        ['M',8,8],['L',8,22],['L',22,22],['L',22,8],['Z']],points:[[0,0]]
    }]};
    const hollow=await tracer.rasterizeDocument(q,{
      width:300,height:300,widthMm:30,heightMm:30,x:0,y:0
    });
    const at=(x,y)=>hollow.pixels[(y*300+x)*4+3];
    return {rasterMs,indexedMs,queriesMs,painted,width:raster.width,height:raster.height,
      paths:doc.paths.length,segments:index.stats().total,candidates:index.stats().lastCandidates,
      progressSteps:stages.length,openHole:at(150,150),closedEdge:at(20,20),visible};
  });
  assert.equal(result.paths,1975);
  assert.equal(result.segments,1975*12);
  assert.ok(result.painted>100,'Canvas raster is not empty');
  assert.ok(result.progressSteps>=40,'cooperative native batches run');
  assert.equal(result.openHole,0,'even-odd hole is transparent');
  assert.equal(result.closedEdge,255,'filled exterior is opaque');
  assert.ok(result.queriesMs<2500,'160 viewport scans should not freeze the UI');
  assert.ok(result.visible<100,'deep zoom should not render the full document');
  console.log('Chromium alpha60: '+JSON.stringify(result));
}finally{
  await browser?.close();
  server.kill();
}
