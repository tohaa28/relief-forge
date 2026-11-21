import test from 'node:test';
import {appearanceRasterPlan,doctorTracerHandoffPlan} from '../web/doctortracer-appearance.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rasterizeDocumentAlpha,maskSimilarity,validateDoctorTracerRgba} from '../web/doctortracer-fallback.js';
import {PREPARED_RASTER_DPI,PREPARED_RASTER_MAX_SIDE,PREPARED_RASTER_MAX_PIXELS,
  WORKER_RASTER_MAX_SIDE,WORKER_RASTER_MAX_PIXELS,
  preparedRasterPlan,boundedWorkerRasterPlan,
  workerRasterFromPreparedMask,createDoctorTracerMaskCache} from '../web/doctortracer-prepared.js';

const input=()=>({width:80,height:60,sourceFileName:'test.eps',paths:[{
  kind:'vector',points:[[10,10],[20,10],[20,20],[10,20]],closed:true
}]});

test('alpha65: imported file plans full 600 dpi black raster prior to vector diagnostics',()=>{
  const source=input(),plan=preparedRasterPlan(source);
  assert.equal(PREPARED_RASTER_DPI,600);
  assert.equal(plan.dpi,600);
  assert.ok(plan.width>=200&&plan.height>=200);
  assert.ok(plan.width<=PREPARED_RASTER_MAX_SIDE&&plan.height<=PREPARED_RASTER_MAX_SIDE);
  assert.ok(plan.width*plan.height<=PREPARED_RASTER_MAX_PIXELS);
  assert.equal(source.paths.length,1,'preparing a mask cannot mutate source vectors');
});

test('alpha65: huge documents are bounded; effective DPI is explicit, not mislabeled 600',()=>{
  const huge=input();huge.width=1500;huge.height=1500;
  huge.paths[0].points=[[0,0],[1450,0],[1450,1450],[0,1450]];
  const plan=preparedRasterPlan(huge);
  assert.ok(plan.dpi<600);
  assert.ok(Math.max(plan.width,plan.height)<=PREPARED_RASTER_MAX_SIDE);
  assert.ok(plan.width*plan.height<=PREPARED_RASTER_MAX_PIXELS);
});

test('alpha65: 600dpi mask cache stores only alpha and reuses it until source invalidation',async()=>{
  const source=input(),events=[];
  const cache=createDoctorTracerMaskCache({rasterize:async(_doc,plan,options)=>{
    events.push({dpi:plan.dpi,stage:'pre-raster'});
    options.onProgress?.(.75);
    const alpha=new Uint8Array(plan.width*plan.height);alpha.fill(255);
    return {alpha,width:plan.width,height:plan.height,backend:'test-alpha'};
  }});
  const token=cache.invalidate();
  const prepared=await cache.prepare(source,{onProgress:f=>events.push({progress:f})});
  assert.equal(prepared.generation,token);
  assert.equal(prepared.source,source);
  assert.equal(prepared.alpha.length,prepared.plan.width*prepared.plan.height);
  assert.equal(prepared.plan.dpi,600);
  assert.equal(cache.get(token),prepared);
  assert.equal(prepared.pixels,undefined,'never keep a duplicate full RGBA');
  assert.deepEqual(events[0],{dpi:600,stage:'pre-raster'});
  assert.deepEqual(events[1],{progress:.75});
  cache.invalidate();
  assert.equal(cache.get(token),null);
});

test('alpha65: in-flight raster is discarded if a different document opens',async()=>{
  const source=input(),cache=createDoctorTracerMaskCache({rasterize:
    async(_doc,plan)=>{await Promise.resolve();cache.invalidate();
      return {alpha:new Uint8Array(plan.width*plan.height),width:plan.width,height:plan.height};}
  });
  const p=await cache.prepare(source);
  assert.equal(p,null);
  assert.equal(cache.get(cache.generation),null);
});

test('alpha65: Worker receives black RGBA materialized from cached 8-bit alpha',()=>{
 const plan={x:0,y:0,widthMm:2,heightMm:2,width:2,height:2,dpi:25.4};
 const prepared={plan,alpha:Uint8Array.from([0,64,192,255])};
 const work=workerRasterFromPreparedMask(prepared);
 assert.equal(work.mask,'black-transparent-rgba8');
 assert.deepEqual(Array.from(work.pixels),[
   0,0,0,0, 0,0,0,64,
   0,0,0,192, 0,0,0,255
 ]);
 assert.deepEqual(Array.from(prepared.alpha),[0,64,192,255]);
 assert.throws(()=>validateDoctorTracerRgba({width:2,height:2,pixels:new Uint8Array(12)}),/RGBA/);
});

test('alpha65: reduced Worker RGBA preserves original millimetres and area-weighted alpha',()=>{
 const plan={x:0,y:0,widthMm:4,heightMm:4,width:4,height:4,dpi:25.4};
 const alpha=new Uint8Array(16);
 for(let y=0;y<4;y++)alpha[y*4+1]=255;
 const prepared={plan,alpha},workPlan={...plan,width:2,height:2,dpi:12.7};
 const work=workerRasterFromPreparedMask(prepared,workPlan);
 assert.deepEqual(Array.from(work.pixels),[
  0,0,0,128,0,0,0,0,
  0,0,0,128,0,0,0,0
 ]);
 assert.deepEqual(Array.from(alpha),[0,255,0,0,0,255,0,0,0,255,0,0,0,255,0,0]);
 assert.throws(()=>workerRasterFromPreparedMask(prepared,{...workPlan,x:1}),/несовместимые/);
});

test('alpha65: bounded Worker plan permits 600 dpi on this complex EPS-sized bitmap',()=>{
 const plan={x:0,y:0,widthMm:106.85,heightMm:152.1,
   width:2524,height:3590,dpi:600};
 const work=boundedWorkerRasterPlan(plan);
 assert.equal(work.width,2524);
 assert.equal(work.height,3590);
 assert.equal(work.dpi,600);
 assert.ok(work.width*work.height<=WORKER_RASTER_MAX_PIXELS);
 assert.ok(work.height<=WORKER_RASTER_MAX_SIDE);
 const page=boundedWorkerRasterPlan({...plan,width:6000,height:6000});
 assert.ok(page.width*page.height<=WORKER_RASTER_MAX_PIXELS);
 assert.ok(page.width<=WORKER_RASTER_MAX_SIDE);
 assert.ok(page.dpi<600);
});

test('alpha65: full-resolution alpha8 and RGBA8 have identical source-vs-result IoU',()=>{
 const a=Uint8Array.from([0,64,192,255]);
 const b=Uint8Array.from([0,0,255,255]);
 const before={width:4,height:1,alpha:a};
 const after={width:4,height:1,alpha:b};
 assert.deepEqual(maskSimilarity(before,after),{iou:1,areaRatio:1,sourcePixels:2,resultPixels:2});
 const asRgba=values=>Uint8Array.from(Array.from(values).flatMap(v=>[0,0,0,v]));
 assert.deepEqual(maskSimilarity({...before,alpha:undefined,pixels:asRgba(a)},after),
  maskSimilarity(before,after));
 assert.throws(()=>maskSimilarity(before,{width:4,height:1,alpha:new Uint8Array(3)}),/alpha8/);
});

test('alpha65: 600dpi Canvas only reads alpha strips; no full RGBA image is cached',async()=>{
 const src=input(),plan={x:0,y:0,widthMm:20,heightMm:20,
   width:2,height:2,dpi:600,strokeWidthMm:.04};
 const alpha=[0,128,200,255],events=[],ctx={
  clearRect(){},save(){},restore(){},setTransform(){},beginPath(){},
  moveTo(){},lineTo(){},closePath(){},quadraticCurveTo(){},
  bezierCurveTo(){},fill(rule){assert.equal(rule,'evenodd');},stroke(){},
  getImageData(x,y,w,h){
   events.push(['strip',x,y,w,h]);
   return {data:Uint8ClampedArray.from(alpha.flatMap(a=>[255,0,200,a]))};
  }
 };
 const canvas={width:0,height:0,getContext(name,opts){
  assert.equal(name,'2d');assert.equal(opts.alpha,true);return ctx;
 }};
 const output=await rasterizeDocumentAlpha(src,plan,{canvasFactory:()=>canvas});
 assert.deepEqual(Array.from(output.alpha),alpha);
 assert.equal(output.alpha.length,4);
 assert.equal(output.bytes,4);
 assert.equal(output.backend,'canvas2d-direct-alpha');
 assert.deepEqual(events,[['strip',0,0,2,2]]);
 assert.equal(canvas.width,0);assert.equal(canvas.height,0);
 assert.deepEqual(src,input());
});


test('manual handoff supports exact 300, 600 and 1200 dpi without silent resizing',()=>{
 const page={width:210,height:297};
 for(const dpi of [300,600,1200]){
   const plan=appearanceRasterPlan(page,dpi);
   assert.deepEqual([plan.width,plan.height,plan.dpi],
     [Math.round(210*dpi/25.4),Math.round(297*dpi/25.4),dpi]);
 }
 assert.throws(()=>appearanceRasterPlan(page,450),/300, 600 или 1200/);
 assert.throws(()=>appearanceRasterPlan({width:420,height:297},1200),/слишком велик/);
});

test('DoctorTracer handoff raster matches the final 2400 px grid, with honest physical scale',()=>{
 const requested=appearanceRasterPlan({width:210,height:297},1200);
 const original=structuredClone(requested),plan=doctorTracerHandoffPlan(requested);
 assert.equal(plan.height,2400);
 assert.equal(plan.width,Math.round(requested.width*2400/requested.height));
 assert.equal(plan.requestedDpi,1200);
 assert.ok(Math.abs(plan.dpi-2400*25.4/297)<.01);
 assert.equal(plan.widthMm,210);assert.equal(plan.heightMm,297);
 assert.deepEqual(requested,original);
 for(const dpi of [300,600,1200]){
   const small=appearanceRasterPlan({width:10,height:10},dpi);
   assert.deepEqual(doctorTracerHandoffPlan(small),{...small,requestedDpi:dpi});
 }
});
