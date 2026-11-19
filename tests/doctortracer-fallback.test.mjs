import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {needsDoctorTracer,rasterPlan,vectorRasterSvg,doctorTracerWorkerUrl,
  traceWithDoctorTracer,remapDoctorTracerSvg,maskSimilarity,acceptRetracing,
  rasterizeDocument} from '../web/doctortracer-fallback.js';
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
test('strict trigger only at >10 residual defects on fully diagnosed complete selection',()=>{
  assert.equal(needsDoctorTracer(complete(10)),false);
  assert.equal(needsDoctorTracer(complete(11)),true);
  assert.equal(needsDoctorTracer({...complete(11),complete:false}),false);
  assert.equal(needsDoctorTracer({...complete(11),fullScope:false}),false);
  assert.equal(needsDoctorTracer(complete(20),{scopeComplete:false}),false);
  assert.equal(needsDoctorTracer(complete(20),{alreadyAttempted:true}),false);
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
    'https://tohaa28.github.io/DoctorTracer/worker.js');
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
    {pixels:new Uint8Array(4*12*10),width:12,height:10},
    {pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory:factory,
      progress:(pct,stage)=>seen.push([pct,stage])});
  assert.match(createdUrl,/DoctorTracer\/worker\.js$/);
  assert.equal(sent.category,'hard');assert.equal(sent.colors,2);
  assert.equal(sent.detail,2);assert.equal(sent.gpu,false);
  assert.equal(out.paths,1);assert.equal(terminated,true);
  assert.deepEqual(seen,[[55,'Построение кривых']]);
});
test('worker failure and explicit abort never return a synthetic successful vector',async()=>{
  const workerFactory=()=>({postMessage(){queueMicrotask(()=>this.onmessage(
    {data:{error:'WASM unavailable'}}));},terminate(){}});
  await assert.rejects(traceWithDoctorTracer({pixels:new Uint8Array(8),width:1,height:2},
    {pageUrl:'https://tohaa28.github.io/relief-forge/',workerFactory}),/WASM unavailable/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(traceWithDoctorTracer({pixels:new Uint8Array(8),width:1,height:2},
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
test('AFTER integration takes source, rechecks candidate and keeps undo; does not rerun on every edit',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(app,/retryUnfixableWithDoctorTracer\(preview,report,callRust,generation\)/);
  assert.match(app,/rasterPlan\(source\)/);
  assert.match(app,/remapDoctorTracerSvg\(source,traced\.svg,plan\)/);
  assert.match(app,/acceptRetracing\(originalCount,checked,similarity\)/);
  assert.match(app,/preview\.result=candidate/);
  assert.match(app,/preview\.comparisonData\.afterDoc=candidate/);
  assert.match(app,/checkpoint\(baseline\);doc=clone\(pv\.result\)/);
  assert.match(html,/id="doctortracer-status"/);
});
