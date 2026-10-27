import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gpuBroadphase} from '../web/gpu-broadphase.js';
const makePath=x=>({kind:'vector',closed:true,offset:[0,0],
  commands:[['M',x,0],['L',x+5,0],['L',x+5,5],['Z']],
  points:[[x,0],[x+5,0],[x+5,5]]});
test('hung WebGPU requestAdapter times out and returns CPU broadphase, never stalls opening EPS',async()=>{
  const paths=Array.from({length:18},(_,i)=>makePath(i*5));
  const mock={gpu:{requestAdapter:()=>new Promise(()=>{})}};
  const start=performance.now();
  const result=await gpuBroadphase({paths},{navigatorObject:mock,timeoutMs:35});
  assert.equal(result.mode,'cpu');
  assert.match(result.reason,/webgpu-timeout/);
  assert.ok(performance.now()-start<1000,'hung WebGPU must not make the app unusable');
});
test('a stalled GPU shader compile also falls back to CPU',async()=>{
 const paths=Array.from({length:18},(_,i)=>makePath(i*5));
 const fake={gpu:{requestAdapter:async()=>({requestDevice:async()=>({
   limits:{maxStorageBufferBindingSize:1<<24},
   createBuffer:()=>({destroy(){}}),
   createShaderModule:()=>({}),
   createComputePipelineAsync:()=>new Promise(()=>{}),
   queue:{writeBuffer(){}},destroy(){}
 })})}};
 const prev=globalThis.GPUBufferUsage,old=globalThis.GPUMapMode;
 globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4,MAP_READ:8,UNIFORM:16};
 globalThis.GPUMapMode={READ:1};
 try{const r=await gpuBroadphase({paths},{navigatorObject:fake,timeoutMs:35});
   assert.equal(r.mode,'cpu');assert.match(r.reason,/webgpu-timeout/);
 }finally{
   if(prev===undefined)delete globalThis.GPUBufferUsage;else globalThis.GPUBufferUsage=prev;
   if(old===undefined)delete globalThis.GPUMapMode;else globalThis.GPUMapMode=old;
 }
});
test('complex document gets cooperative per-object treatment even if source diagnostic was complete',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/const largeWork=plan\.totalPoints>2500\|\|indices\.length>150/);
 assert.match(app,/if\(complete&&!largeWork\)void buildUnifiedPreview\(\)/);
 assert.match(app,/else if\(!curveEditing\(\)\)void buildLargeUnifiedPreview\(indices\)/);
 assert.match(app,/progressStage\('Подготовка контуров перед Union'/);
});
test('fixed second editing row is visible, while info icon has explicit center alignment',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 const row=html.indexOf('id="manual-repairs"'),tool=html.indexOf('id="curve-node-tools"');
 const node=html.indexOf('id="node-done"');
 const context=html.indexOf('id="node-context"');
 assert.ok(tool<node&&node<row&&row<context);
 assert.match(html,/<div id="manual-repairs" class="curve-repairs-row"/);
 assert.doesNotMatch(html,/<details id="manual-repairs"/);
 assert.equal((html.match(/data-action="[1-8]"/g)||[]).length,8);
 assert.match(css,/#toggle-info > \.tool-icon/);
 assert.match(css,/#curve-node-tools \.curve-repairs-row/);
});
