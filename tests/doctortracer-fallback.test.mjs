import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {needsDoctorTracer,rasterPlan,vectorRasterSvg,doctorTracerWorkerUrl,
  traceWithDoctorTracer,remapDoctorTracerSvg,maskSimilarity,acceptRetracing,
  rasterizeDocument,paintDocumentSilhouette,validateDoctorTracerRgba,
  scaledDoctorTracerPlan,isDoctorTracerNodeBudgetError,traceDocumentWithNodeBudget,
  blackTransparentRgba8,downsampleBlackTransparentRgba8,
  compareSegmentedAlpha} from '../web/doctortracer-fallback.js';
const p=(coordinates,closed=true)=>({
  kind:'vector',artwork:'<path fill="none" stroke="#123"/>',offset:[0,0],
  commands:coordinates.map((pt,i)=>[i?'L':'M',...pt]).concat(closed?[['Z']]:[]),
  points:coordinates,closed
});
const doc=(paths=[p([[10,15],[20,15],[20,25],[10,25]])])=>({
  format:'relief-forge',version:1,width:60,height:45,paths,
  sourceFileName:'input.eps',epsImport:{name:'input.eps',originalBase64:'hidden'}
});
const complete=count=>({issues:Array.from({length:count},(_,i)=>({kind:'self_intersection',point:[i,1]})),
  complete:true,fullScope:true});
test('strict trigger at 11 confirmed remaining defects even with partial large-document diagnosis',()=>{
  assert.equal(needsDoctorTracer(complete(10)),false);
  assert.equal(needsDoctorTracer(complete(11)),true);
  assert.equal(needsDoctorTracer({...complete(11),complete:false}),true);
  assert.equal(needsDoctorTracer({...complete(11),fullScope:false}),true);
  assert.equal(needsDoctorTracer(complete(20),{scopeComplete:false}),false);
  assert.equal(needsDoctorTracer(complete(20),{alreadyAttempted:true}),false);
});
test('complex PARTIAL scan starts the worker while candidate still requires COMPLETE re-diagnosis',()=>{
  const scan={...complete(15),complete:false,fullScope:false};
  assert.equal(needsDoctorTracer(scan),true);
  assert.equal(acceptRetracing(15,{...complete(3),complete:false},
    {iou:.998,areaRatio:1}),false,'incomplete AFTER result cannot replace source');
  assert.equal(acceptRetracing(15,{...complete(3),fullScope:false},
    {iou:.998,areaRatio:1}),false,'unknown cross-batch issues cannot silently pass');
});

test('cropped raster keeps physical mm, imposes 2400 px / eight million pixel cap and never changes original',()=>{
  const input=doc(),copy=structuredClone(input),plan=rasterPlan(input);
  assert.ok(plan.x<10&&plan.y<15&&plan.widthMm<60&&plan.heightMm<45);
  assert.ok(plan.dpi<=300&&plan.width*plan.height<=8000000);
  const svg=vectorRasterSvg(input,plan);
  assert.match(svg,/preserveAspectRatio="none"/);
  assert.match(svg,/fill="#000"/);
  assert.match(svg,/viewBox="/);
  assert.deepEqual(input,copy);
  const huge=doc([p([[0,0],[100000,0],[100000,100000],[0,100000]])]);
  huge.width=100000;huge.height=100000;
  const limited=rasterPlan(huge);
  assert.ok(limited.width<=2400&&limited.height<=2400);
  assert.throws(()=>rasterPlan(doc([{kind:'image',points:[]}])),/вектор/);
});
test('compound path holes stay evenodd inside one filled shape during rasterization',()=>{
 const paths=[['M',0,0],['L',20,0],['L',20,20],['L',0,20],['Z'],
   ['M',5,5],['L',5,15],['L',15,15],['L',15,5],['Z']];
 const vector={kind:'vector',artwork:'<path/>',offset:[0,0],commands:paths,
   points:paths.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),closed:true};
 const input=doc([vector]);
 const raster=vectorRasterSvg(input,rasterPlan(input));
 assert.equal((raster.match(/<path /g)||[]).length,1);
 assert.match(raster,/fill-rule="evenodd"/);
 assert.match(raster,/M0 0.*Z M5 5/);
});

test('open curves rasterize as thin lines rather than solid fills',()=>{
  const input=doc([p([[1,1],[4,4],[7,1]],false)]);
  const svg=vectorRasterSvg(input,rasterPlan(input));
  assert.match(svg,/fill="none" stroke="#000" stroke-width="/);
});
test('DoctorTracer worker is only loaded from deployed same-origin GitHub Pages path',()=>{
  assert.equal(doctorTracerWorkerUrl('https://tohaa28.github.io/relief-forge/'),
    'https://tohaa28.github.io/DoctorTracer/worker.js?v=0.21.1');
  assert.throws(()=>doctorTracerWorkerUrl('http://localhost:8765/relief-forge/'),/origin/);
  assert.throws(()=>doctorTracerWorkerUrl('https://attacker.example/'),/origin/);
});
test('worker handshake uses native DoctorTracer hard-edge Rust WASM request with ownership transfer',async()=>{
  let sent,terminated=false,createdUrl='';
  const factory=(url,{type})=>{
    createdUrl=url;assert.equal(type,'module');
    return {postMessage(data,transfer){
      sent=data;assert.deepEqual(transfer,[data.pixels]);queueMicrotask(()=>this.onmessage({
        data:{progress:55,stage:'Построение кривых'}}));
      queueMicrotask(()=>this.onmessage({data:{svg:'<svg><path d="M0 0L1 0Z"/></svg>',paths:1,backend:'Rust WASM'}}));
    },terminate(){terminated=true;}};
  };
  const seen=[];
  const out=await traceWithDoctorTracer(
    {pixels:Uint8Array.from({length:4*12*10},(_,i)=>i%4===3?255:0),width:12,height:10},
    {pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory:factory,
      progress:(pct,stage)=>seen.push([pct,stage])});
  assert.match(createdUrl,/DoctorTracer\/worker\.js\?v=0\.21\.1$/);
  assert.equal(sent.category,'hard');assert.equal(sent.colors,1);
  assert.deepEqual(sent.palette,[[0,0,0]]);
  assert.equal(sent.detail,2);assert.equal(sent.gpu,false);
  assert.equal(out.paths,1);assert.equal(terminated,true);
  assert.deepEqual(seen,[[55,'Построение кривых']]);
});
test('worker failure and explicit abort never return a synthetic successful vector',async()=>{
  const workerFactory=()=>({postMessage(){queueMicrotask(()=>this.onmessage(
    {data:{error:'WASM unavailable'}}));},terminate(){}});
  await assert.rejects(traceWithDoctorTracer({pixels:Uint8Array.from([0,0,0,255,0,0,0,255]),width:1,height:2},
    {pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory}),/WASM unavailable/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(traceWithDoctorTracer({pixels:Uint8Array.from([0,0,0,255,0,0,0,255]),width:1,height:2},
    {pageUrl:'https://tohaa28.github.io/relief-forge/',signal:controller.signal}),/отменена/);
});
test('trace SVG remapping respects original document millimetres and strips stale import bytes',()=>{
  const source=doc(),snapshot=structuredClone(source);
  const plan={x:10,y:15,widthMm:10,heightMm:10,width:100,height:100,dpi:254};
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">'+
    '<path d="M0 0 L100 0 L100 100 L0 100 Z" fill="#000"/></svg>';
  const out=remapDoctorTracerSvg(source,svg,plan,{Parser:DOMParser});
  assert.equal(out.paths.length,1);
  assert.ok(Math.abs(out.paths[0].commands[0][1]-10)<1e-7);
  assert.ok(Math.abs(out.paths[0].commands[0][2]-15)<1e-7);
  assert.ok(Math.abs(out.paths[0].commands[1][1]-20)<1e-7);
  assert.ok(Math.abs(out.paths[0].commands[2][2]-25)<1e-7);
  assert.match(out.paths[0].artwork,/matrix\(/);
  assert.equal(out.width,60);assert.equal(out.height,45);
  assert.equal(out.sourceFileName,'input.eps');
  assert.equal(out.epsImport,undefined);
  assert.equal(out.doctorTracer.approximation,true);
  assert.deepEqual(source,snapshot);
});
test('fidelity and diagnosis must both improve before a replacement is allowed',()=>{
  const a={width:2,height:1,pixels:new Uint8Array([0,0,0,255,0,0,0,0])};
  const b={width:2,height:1,pixels:new Uint8Array([0,0,0,255,0,0,0,0])};
  const same=maskSimilarity(a,b);
  assert.equal(same.iou,1);assert.equal(same.areaRatio,1);
  assert.equal(acceptRetracing(11,complete(10),same),true);
  assert.equal(acceptRetracing(11,complete(11),same),false);
  assert.equal(acceptRetracing(10,complete(0),same),false);
  assert.equal(acceptRetracing(12,{...complete(0),complete:false},same),false);
  assert.equal(acceptRetracing(11,complete(0),{iou:.9,areaRatio:1}),false);
  assert.equal(acceptRetracing(11,complete(0),{iou:1,areaRatio:1.2}),false);
  assert.equal(maskSimilarity(a,{...b,pixels:new Uint8Array(8)}).iou,0);
});
test('rasterizer can run with injected bitmap and Canvas 2D, no network or file mutation',async()=>{
  const input=doc(),plan=rasterPlan(input),src=structuredClone(input);
  let created=false,closed=false;
  const output=await rasterizeDocument(input,plan,{
    bitmap:async blob=>{created=blob.type==='image/svg+xml';return {close(){closed=true;}};},
    canvasFactory:()=>({getContext:()=>({
      clearRect(){},drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(plan.width*plan.height*4)})
    })})
  });
  assert.equal(created,true);assert.equal(closed,true);
  assert.equal(output.pixels.length,plan.width*plan.height*4);
  assert.deepEqual(input,src);
});

test('native 0.21.1 payload is validated RGBA8 exactly before ArrayBuffer ownership transfer',()=>{
 const input={width:2,height:1,pixels:Uint8Array.from([0,0,0,255,0,0,0,0])};
 assert.deepEqual(validateDoctorTracerRgba(input),{
   width:2,height:1,bytes:8,opaque:1,transparent:1,format:'RGBA8'});
 assert.throws(()=>validateDoctorTracerRgba({...input,pixels:new Uint8Array(7)}),/RGBA/);
 assert.throws(()=>validateDoctorTracerRgba({...input,pixels:new Uint8Array(8)}),/не содержит/);
 assert.throws(()=>validateDoctorTracerRgba({...input,width:0}),/RGBA/);
});
test('direct Canvas 2D rasterizer does not attempt SVG Blob decoding on 1975 imported EPS paths',async()=>{
 const document=doc(Array.from({length:1975},(_,i)=>
   p([[i%50,i%50],[i%50+1,i%50],[i%50+1,i%50+1],[i%50,i%50+1]])));
 const snapshot=JSON.stringify(document),plan={x:0,y:0,widthMm:70,heightMm:70,width:140,height:140};
 const calls={moves:0,lines:0,fills:0,strokes:0,transform:null,saved:0};
 const ctx={
  clearRect(){},save(){calls.saved++;},restore(){calls.saved--;},
  setTransform(...v){calls.transform=v;},beginPath(){},
  moveTo(){calls.moves++;},lineTo(){calls.lines++;},
  bezierCurveTo(){},quadraticCurveTo(){},closePath(){},
  fill(rule){assert.equal(rule,'evenodd');calls.fills++;},stroke(){calls.strokes++;},
  getImageData(){return {data:new Uint8ClampedArray(plan.width*plan.height*4).fill(255)}}
 };
 const raster=await rasterizeDocument(document,plan,{
  canvasFactory:()=>({getContext:()=>ctx})
 });
 assert.equal(raster.backend,'canvas2d-direct');
 assert.equal(raster.pixels.byteLength,plan.width*plan.height*4);
 assert.equal(calls.fills,1975);
 assert.deepEqual(calls.transform.slice(0,4),[2,0,0,2]);
 assert.ok(Math.abs(calls.transform[4])<1e-12);
 assert.ok(Math.abs(calls.transform[5])<1e-12);
 assert.equal(calls.saved,0);
 assert.equal(JSON.stringify(document),snapshot);
 assert.ok(validateDoctorTracerRgba(raster).opaque>0);
});
test('direct Canvas 2D renderer paints compound holes in one evenodd fill and open curves as stroke',()=>{
 const geometry={...doc().paths[0],commands:[
  ['M',0,0],['L',20,0],['L',20,20],['L',0,20],['Z'],
  ['M',5,5],['L',5,15],['L',15,15],['L',15,5],['Z'],
  ['M',22,22],['C',24,22,26,25,28,25]
 ]};
 const kinds=[],ctx={
  clearRect(){},save(){},restore(){},setTransform(){},
  beginPath(){kinds.push('begin');},moveTo(){},lineTo(){},quadraticCurveTo(){},
  bezierCurveTo(){kinds.push('bezier');},closePath(){},
  fill(rule){kinds.push('fill:'+rule);},stroke(){kinds.push('stroke');}
 };
 paintDocumentSilhouette(ctx,doc([geometry]),{x:0,y:0,widthMm:30,heightMm:30,width:300,height:300});
 assert.equal(kinds.filter(v=>v==='fill:evenodd').length,1);
 assert.equal(kinds.filter(v=>v==='stroke').length,1);
 assert.equal(kinds.filter(v=>v==='bezier').length,1);
});

test('AFTER integration takes source, rechecks candidate and keeps undo; does not rerun on every edit',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(app,/retryUnfixableWithDoctorTracer\(preview,report,callRust,generation\)/);
  assert.match(app,/appearanceRasterPlan\(source\)/);
  assert.match(app,/doctorMaskCache\.get\(preview\.doctorMaskToken\)/);
  assert.match(app,/traceDocumentWithNodeBudget\(source,plan,/);
  assert.match(app,/acceptRetracing\(originalCount,checked,similarity,\{threshold:0\}\)/);
  assert.match(app,/preview\.result=candidate/);
  assert.match(app,/preview\.comparisonData\.afterDoc=candidate/);
  assert.match(app,/checkpoint\(baseline\);doc=clone\(pv\.result\)/);
  assert.match(html,/id="doctortracer-status"/);
});


test('bounded node-budget fallback retries the original artwork at 70 percent, preserving mm',async()=>{
 const source=doc(),snapshot=structuredClone(source);
 const plan={x:3,y:5,widthMm:45,heightMm:30,width:1200,height:800,dpi:300};
 const rasters=[],attempts=[],retries=[];
 const out=await traceDocumentWithNodeBudget(source,plan,{
  firstRaster:{width:1200,height:800},
  rasterize:async(_s,p)=>{rasters.push([p.width,p.height]);return {width:p.width,height:p.height};},
  trace:async r=>{attempts.push([r.width,r.height]);return {svg:'<svg/>',backend:'mock'};},
  remap:(_s,_svg,p)=>{
   if(p.width===1200)throw Error('SVG: превышен лимит 200000 узлов');
   return {pathCount:1};
  },onRetry:r=>retries.push(r)
 });
 assert.deepEqual(attempts,[[1200,800],[840,560]]);
 assert.deepEqual(rasters,[[840,560]]);
 assert.equal(retries.length,1);
 assert.equal(out.attempts,2);
 assert.equal(out.tracePlan.widthMm,45);
 assert.equal(out.tracePlan.heightMm,30);
 assert.deepEqual(source,snapshot);
});
test('unrelated SVG error aborts immediately; persistent node budget stops after three retries',async()=>{
 const source=doc(),plan={x:0,y:0,widthMm:30,heightMm:20,width:1000,height:600,dpi:300};
 let calls=0;
 const options={firstRaster:{width:1000,height:600},
  rasterize:async(_s,p)=>({width:p.width,height:p.height}),
  trace:async()=>{calls++;return {svg:'<svg/>'};}};
 await assert.rejects(traceDocumentWithNodeBudget(source,plan,{
  ...options,remap:()=>{throw Error('SVG: неподдерживаемая геометрия');}
 }),/неподдерживаемая геометрия/);
 assert.equal(calls,1);
 await assert.rejects(traceDocumentWithNodeBudget(source,plan,{
  ...options,remap:()=>{throw Error('SVG: превышен лимит 200000 узлов');}
 }),/200000 узлов/);
 assert.equal(calls,4);
});
test('cancellation stops follow-up retries; invalid scale series cannot increase limits',async()=>{
 const source=doc(),plan={x:0,y:0,widthMm:30,heightMm:20,width:1000,height:600,dpi:300};
 const ctrl=new AbortController();
 await assert.rejects(traceDocumentWithNodeBudget(source,plan,{
  firstRaster:{width:1000,height:600},signal:ctrl.signal,
  trace:async()=>{ctrl.abort();return {svg:'<svg/>'};},
  remap:()=>{throw Error('candidate should never be parsed');}
 }),/отменена/);
 assert.equal(isDoctorTracerNodeBudgetError(Error('SVG: превышен лимит 200000 узлов')),true);
 assert.equal(isDoctorTracerNodeBudgetError(Error('SVG: parse failed')),false);
 assert.throws(()=>scaledDoctorTracerPlan(plan,1),/масштаб/);
 await assert.rejects(traceDocumentWithNodeBudget(source,plan,{scales:[1,1]}),/некорректный план/);
});


test('alpha62: black RGBA mask resets all RGB channels but preserves every antialiased alpha',()=>{
 const alphas=[0,1,63,127,128,254,255];
 const rgba=Uint8Array.from(alphas.flatMap((a,i)=>[255-i,10+i,160-i,a]));
 const result=blackTransparentRgba8(rgba);
 assert.strictEqual(result,rgba,'in-place normalization avoids duplicate multi-megabyte buffers');
 assert.deepEqual(Array.from(rgba),alphas.flatMap(a=>[0,0,0,a]));
 assert.throws(()=>blackTransparentRgba8(new Uint8Array(3)),/RGBA8/);
 assert.throws(()=>blackTransparentRgba8(new Uint8ClampedArray(4)),/RGBA8/);
});

test('alpha62: Canvas output normalizes colored fringe to black/transparent mask',async()=>{
 const plan={x:0,y:0,widthMm:30,heightMm:10,width:3,height:1,dpi:2.54};
 const src=doc(),snapshot=structuredClone(src);
 const rgb=[230,240,250,0,120,140,160,127,240,100,50,255];
 const ctx={
  clearRect(){},save(){},restore(){},setTransform(){},beginPath(){},
  moveTo(){},lineTo(){},bezierCurveTo(){},quadraticCurveTo(){},closePath(){},
  fill(){},stroke(){},getImageData:()=>({data:new Uint8ClampedArray(rgb)})
 };
 const out=await rasterizeDocument(src,plan,{
  canvasFactory:()=>({getContext:(name,options)=>{
   assert.equal(name,'2d');assert.equal(options.alpha,true);return ctx;
  }})
 });
 assert.equal(out.mask,'black-transparent-rgba8');
 assert.deepEqual(Array.from(out.pixels),[0,0,0,0,0,0,0,127,0,0,0,255]);
 assert.deepEqual(src,snapshot);
});

test('alpha62: DoctorTracer Worker receives only black RGB + alpha and packed transfer from a view',async()=>{
 const backing=Uint8Array.from([7,7,7,7,255,255,255,0,240,120,60,127,
   50,80,140,255,8,8,8,8]);
 const pixels=backing.subarray(4,16),snapshot=Array.from(backing);
 let transferred,seen;
 const factory=()=>({postMessage(data,transfer){
  transferred=transfer;seen=data;
  queueMicrotask(()=>this.onmessage({data:{
   svg:'<svg><path d="M0 0 L1 0 Z"/></svg>',paths:1,backend:'Rust WASM'}}));
 },terminate(){}});
 const out=await traceWithDoctorTracer({pixels,width:3,height:1},{
  pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory:factory
 });
 assert.equal(out.paths,1);
 assert.deepEqual(Array.from(new Uint8Array(seen.pixels)),[
  0,0,0,0,0,0,0,127,0,0,0,255
 ]);
 assert.equal(seen.pixels.byteLength,3*1*4);
 assert.equal(transferred.length,1);
 assert.strictEqual(transferred[0],seen.pixels);
 assert.deepEqual(Array.from(backing),snapshot,'non-packed source view not mutated');
});

test('alpha62: production integration normalizes BOTH initial and retry rasters before Worker',()=>{
 const source=readFileSync(new URL('../web/doctortracer-fallback.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(source,/const pixels=blackTransparentRgba8\(new Uint8Array\(/);
 assert.match(source,/const pixels=blackTransparentRgba8\(/);
 assert.match(source,/worker\.postMessage\(\{pixels:pixels\.buffer/);
 assert.match(source,/alpha:true,willReadFrequently:true/);
 assert.match(app,/firstRaster:raster,scales:\[1\],signal:abort\.signal/);
 assert.match(source,/downsampleBlackTransparentRgba8\(referenceRaster,current\.width,current\.height\)/);
 assert.match(source,/await rasterize\(source,current,\{signal\}\)/);
});


test('alpha63: each retry uses one explicit ink while transparency stays an independent mask',async()=>{
 const plan={x:0,y:0,widthMm:48,heightMm:20,width:1000,height:400,dpi:300};
 const input=doc(),requested=[],traces=[];
 await traceDocumentWithNodeBudget(input,plan,{
  firstRaster:{width:1000,height:400},
  rasterize:async(_s,p)=>({width:p.width,height:p.height}),
  trace:async r=>{requested.push([r.width,r.height]);return{
    svg:'<svg/>',paths:2,paletteCount:1,backend:'Rust WASM'};},
  remap:(_source,_svg,p)=>{
    if(p.width===1000)throw Error('SVG: превышен лимит 200000 узлов');
    return {paths:[]};
  },
  onTraced:trace=>traces.push(trace)
 });
 assert.deepEqual(requested,[[1000,400],[700,280]]);
 assert.equal(traces.length,2);
 assert.deepEqual(traces.map(x=>x.paletteCount),[1,1]);
 assert.deepEqual(traces.map(x=>x.attempt),[1,2]);
});

test('alpha63: DoctorTracer hard-edge palette fixes black as the sole ink and never treats transparency as an ink',async()=>{
 const sent=[];
 const mockWorker=()=>({postMessage(data){
   sent.push({category:data.category,colors:data.colors,palette:data.palette,
    w:data.width,h:data.height,rgba:Array.from(new Uint8Array(data.pixels))});
   queueMicrotask(()=>this.onmessage({data:{svg:'<svg><path d="M0 0L1 1Z"/></svg>',
     paths:1,metrics:{palette:[[0,0,0]]},backend:'Rust WASM'}}));
 },terminate(){}});
 const out=await traceWithDoctorTracer({
   width:3,height:1,pixels:Uint8Array.from([
      250,180,90,0, 220,100,80,96, 100,90,80,255])
 },{pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory:mockWorker});
 assert.equal(sent[0].colors,1);
 assert.deepEqual(sent[0].palette,[[0,0,0]]);
 assert.deepEqual(sent[0].rgba,[0,0,0,0,0,0,0,96,0,0,0,255]);
 assert.equal(out.paletteCount,1);
 assert.equal(out.paths,1);
});


test('alpha64: area-weighted retry keeps original 1px lines physically thin and preserves subpixel alpha',()=>{
 const pixels=new Uint8Array(4*4*4);
 for(let y=0;y<4;y++){
  const i=(y*4+1)*4;pixels.set([171,115,41,255],i);
 }
 const original=Array.from(pixels);
 const out=downsampleBlackTransparentRgba8({width:4,height:4,pixels},2,2);
 assert.equal(out.backend,'original-alpha-box-downsample');
 assert.equal(out.mask,'black-transparent-rgba8');
 assert.deepEqual(Array.from(out.pixels),[
  0,0,0,128,0,0,0,0,
  0,0,0,128,0,0,0,0
 ]);
 assert.deepEqual(Array.from(pixels),original,'source mask remains immutable');
 assert.throws(()=>downsampleBlackTransparentRgba8({width:4,height:4,pixels},5,3),/опорной/);
});

test('alpha64: fractional-size resampling conserves integrated alpha mass within quantization bound',()=>{
 const pixels=new Uint8Array(9*7*4);
 for(let i=0;i<9*7;i++){
  pixels[4*i]=(i*7)%255;
  pixels[4*i+3]=(i*73+27)%256;
 }
 const src={width:9,height:7,pixels};
 const out=downsampleBlackTransparentRgba8(src,4,3);
 const originalAlpha=pixels.reduce((sum,v,i)=>sum+(i%4===3?v:0),0);
 const reducedAlpha=out.pixels.reduce((sum,v,i)=>sum+(i%4===3?v:0),0)*9*7/(4*3);
 assert.ok(Math.abs(originalAlpha-reducedAlpha)<(9*7/(4*3))*6.1,
  'box-resampled alpha coverage is conserved apart from 8-bit rounding');
 assert.ok(Array.from(out.pixels).every((v,i)=>i%4===3||v===0));
});

test('alpha64: physical stroke width stays fixed on 45-percent retry',()=>{
 const open=doc([p([[10,15],[20,20]],false)]);
 const base=rasterPlan(open),low=scaledDoctorTracerPlan(base,.45);
 assert.ok(base.strokeWidthMm>0);
 assert.equal(low.strokeWidthMm,base.strokeWidthMm);
 assert.ok(Math.max(low.widthMm/low.width,low.heightMm/low.height)>base.strokeWidthMm*2);
 const widths=[];
 for(const plan of [base,low]){
  const ctx={
   clearRect(){},save(){},restore(){},setTransform(){},
   beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
   bezierCurveTo(){},closePath(){},fill(){},
   stroke(){widths.push(this.lineWidth);}
  };
  paintDocumentSilhouette(ctx,open,plan);
 }
 assert.deepEqual(widths,[base.strokeWidthMm,base.strokeWidthMm]);
});

test('alpha64: worker segmentation alpha audit identifies background pollution before vector parsing',async()=>{
 const mask=Uint8Array.from([1,0,1,0]);
 const segmented=Uint8Array.from([0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,255]);
 const report=compareSegmentedAlpha(mask,segmented);
 assert.equal(report.iou,1/3);
 assert.equal(report.areaRatio,1);
 assert.equal(report.sourcePixels,2);
 assert.equal(report.segmentedPixels,2);
 assert.throws(()=>compareSegmentedAlpha(mask,new Uint8Array(12)),/неверная длина/);
 const worker=()=>({postMessage(data){
  assert.equal(data.colors,1);
  queueMicrotask(()=>this.onmessage({data:{
   svg:'<svg><path d="M0 0L1 1Z"/></svg>',paths:1,backend:'Rust WASM CPU',
   segments:segmented.buffer}}));
 },terminate(){}});
 const traced=await traceWithDoctorTracer({width:4,height:1,
  pixels:Uint8Array.from([
   0,0,0,255,0,0,0,0,0,0,0,255,0,0,0,0])},{
    pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory:worker
 });
 assert.deepEqual(traced.segmentation,report);
});

test('alpha64: retry downsamples independent original mask, never re-rasterizes enlarged 1px strokes',async()=>{
 const source=doc(),snapshot=structuredClone(source);
 const plan={x:0,y:0,widthMm:40,heightMm:40,width:4,height:4,dpi:2.54,strokeWidthMm:10};
 const pixels=new Uint8Array(4*4*4);
 for(let y=0;y<4;y++)pixels[(y*4+1)*4+3]=255;
 const original={width:4,height:4,pixels:new Uint8Array(pixels)};
 const firstRaster={width:4,height:4,pixels:new Uint8Array(pixels)};
 const calls=[],reports=[];
 const out=await traceDocumentWithNodeBudget(source,plan,{
  firstRaster,referenceRaster:original,
  rasterize:async()=>{throw Error('must not repaint geometry on retry');},
  trace:async(r)=>{
   calls.push({width:r.width,rgba:Array.from(r.pixels),backend:r.backend});
   return {svg:'<svg/>',paths:1,segmentation:{iou:1,areaRatio:1}};
  },
  scales:[1,.5],
  remap:(_s,_svg,p)=>{
   if(p.width===4)throw Error('SVG: превышен лимит 200000 узлов');
   return {ok:true};
  },
  onTraced:info=>reports.push(info)
 });
 assert.equal(out.attempts,2);
 assert.deepEqual(calls.map(c=>c.width),[4,2]);
 assert.equal(calls[1].backend,'original-alpha-box-downsample');
 assert.deepEqual(calls[1].rgba,[
   0,0,0,128,0,0,0,0,
   0,0,0,128,0,0,0,0
 ]);
 assert.deepEqual(Array.from(original.pixels),Array.from(pixels));
 assert.deepEqual(source,snapshot);
 assert.deepEqual(reports.map(r=>r.segmentation?.iou),[1,1]);
 await assert.rejects(traceDocumentWithNodeBudget(source,plan,{
   firstRaster,referenceRaster:firstRaster,
   trace:async()=>({svg:'<svg/>'})
 }),/независима/);
});
