import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeControlBounds,gpuBroadphase,broadphaseShader} from '../web/gpu-broadphase.js';
import {assessUnionGroup} from '../web/union-group-budget.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {exportEps,verifyEpsOutputGeometry} from '../web/eps-export.js';

const paint={fill:'#101010',stroke:'none',fillRule:'nonzero',opacity:1};
const path=commands=>({kind:'vector',closed:true,offset:[0,0],paint:{...paint},
 commands,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
 artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#101010"/>'});
const rectangle=(x,y,w=10,h=10)=>path([['M',x,y],['L',x+w,y],
 ['L',x+w,y+h],['L',x,y+h],['Z']]);
const doc=paths=>({width:100,height:50,paths});
const nodeCount=p=>p.commands.filter(c=>['M','L','Q','C'].includes(c[0])).length;

test('per-group validator rejects 400 excess polygon anchors without modifying source',()=>{
 const source=rectangle(0,0);
 const jagged=path([['M',0,0],...Array.from({length:400},(_,i)=>['L',
  i*.02,((i%2)*.5)]),['Z']]);jagged.unionFlattened=true;
 const saved=structuredClone(source);
 const gated=assessUnionGroup([source],jagged,{tolerance:.001,
  globalLimit:1000,currentNodes:4});
 assert.equal(gated.accepted,false,JSON.stringify(gated));
 assert.equal(gated.reason,'group-node-inflation');
 assert.deepEqual(source,saved);
});
test('two overlapping rectangles accepted, distant originals untouched, precise cached EPS',()=>{
 const before=doc([rectangle(0,0),rectangle(5,0),rectangle(40,0)]);
 const copy=structuredClone(before);
 const combined=mergeOverlappingObjects(before,{tolerance:.01,cleanupTolerance:.02});
 assert.equal(combined.stats.acceptedGroups,1,JSON.stringify(combined.stats));
 assert.equal(combined.stats.rejectedGroups,0);
 assert.equal(combined.document.paths.length,2);
 assert.deepEqual(combined.document.paths[1].commands,copy.paths[2].commands);
 assert.ok(combined.stats.nodesAfterUnion<=combined.stats.nodesBefore);
 assert.deepEqual(before,copy);
 const eps=exportEps(combined.document);
 assert.equal(verifyEpsOutputGeometry(combined.document,{content:eps,source:'outline'}).realNodes,
   combined.document.paths.reduce((n,p)=>n+nodeCount(p),0));
});
test('GPU candidate broadphase is only a hint: exact CPU output remains identical',()=>{
 const input=doc([rectangle(0,0),rectangle(5,0),rectangle(40,0)]);
 const cpu=mergeOverlappingObjects(input,{tolerance:.01});
 const gpu=mergeOverlappingObjects(input,{tolerance:.01,gpuPairs:{
  mode:'webgpu',sourceCount:3,pairs:[[0,1]]}});
 assert.deepEqual(gpu.document.paths.map(p=>p.commands),cpu.document.paths.map(p=>p.commands));
 assert.equal(gpu.stats.gpuMode,'webgpu');
});
test('native GPU bounds include quadratic/cubic Bézier CONTROL HULL, not a sampled straight chord',()=>{
 const curved=path([['M',0,0],['C',-10,-50,15,50,5,0],['Q',-20,22,0,0],['Z']]);
 assert.deepEqual(nativeControlBounds(curved),[-20,-50,15,50]);
});
test('no adapter, unsupported geometry, huge canvas and small file all degrade to CPU',async()=>{
 const mock={gpu:{requestAdapter:async()=>null}};
 assert.equal((await gpuBroadphase(doc(Array.from({length:16},(_,i)=>rectangle(i*15,0))),
  {navigatorObject:mock})).mode,'cpu');
 assert.equal((await gpuBroadphase(doc([rectangle(0,0)]),
  {navigatorObject:mock})).reason,'small-document');
 assert.equal((await gpuBroadphase(doc(Array.from({length:17},(_,i)=>rectangle(i*15,0))),
  {navigatorObject:{}})).reason,'webgpu-unavailable');
});
test('GPU workgroup dispatch has readback and cannot replace CPU Boolean/EPS validation',()=>{
 assert.match(broadphaseShader,/@compute @workgroup_size\(64\)/);
 assert.match(broadphaseShader,/flags\.values\[index\]/);
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/await gpuBroadphase\(repaired.document/);
 assert.match(app,/await gpuBroadphase\(result/);
 assert.match(app,/refitBooleanUnion\(merged\.document/);
 assert.match(app,/prepareEpsOutput\(chosen.document\)/);
});

test('GPU compute path requests adapter, dispatches WGSL and reads back exact candidate flags',async()=>{
 const savedUsage=globalThis.GPUBufferUsage,savedMode=globalThis.GPUMapMode;
 globalThis.GPUBufferUsage={STORAGE:1,COPY_DST:2,COPY_SRC:4,MAP_READ:8,UNIFORM:16};
 globalThis.GPUMapMode={READ:1};
 const dispatches=[];let shader='',bindings;
 const createBuffer=({size})=>({bytes:new Uint8Array(size),mapAsync:async()=>{},
   getMappedRange(){return this.bytes.buffer;},unmap(){},destroy(){}});
 const device={
   limits:{maxStorageBufferBindingSize:1<<20},
   createBuffer,createShaderModule({code}){shader=code;return {code};},
   async createComputePipelineAsync(){return {getBindGroupLayout:()=>({})};},
   createBindGroup({entries}){bindings=entries;return entries;},
   createCommandEncoder(){
     let command;
     return {beginComputePass(){return {setPipeline(){},setBindGroup(){},
       dispatchWorkgroups(n){dispatches.push(n);},end(){}};},
       copyBufferToBuffer(source,sourceOffset,dest,destOffset,count){
         command=()=>dest.bytes.set(source.bytes.subarray(sourceOffset,sourceOffset+count),destOffset);
       },
       finish(){return {copy:command};}
     };
   },
   queue:{
     writeBuffer(buffer,offset,data){
       const bytes=data instanceof ArrayBuffer?new Uint8Array(data):
         new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
       buffer.bytes.set(bytes,offset);
     },
     submit(commands){
       const boxes=bindings[0].resource.buffer.bytes,
         out=bindings[1].resource.buffer.bytes,
         params=bindings[2].resource.buffer.bytes,
         n=new DataView(params.buffer).getUint32(0,true),
         padding=new DataView(params.buffer).getFloat32(4,true);
       const b=new Float32Array(boxes.buffer),flags=new Uint32Array(out.buffer);
       for(let i=0;i<n;i++)for(let j=i+1;j<n;j++){
         const a=4*i,c=4*j;
         flags[i*n+j]=Number(b[a]<=b[c+2]+padding&&b[c]<=b[a+2]+padding&&
           b[a+1]<=b[c+3]+padding&&b[c+1]<=b[a+3]+padding);
       }
       commands.forEach(c=>c.copy());
     }
   },destroy(){}
 };
 const navigatorObject={gpu:{requestAdapter:async()=>({
   requestDevice:async()=>device
 })}};
 try{
   const paths=Array.from({length:16},(_,i)=>rectangle(i===1?5:i*20,0));
   const report=await gpuBroadphase(doc(paths),{navigatorObject});
   assert.equal(report.mode,'webgpu',JSON.stringify(report));
   assert.equal(report.count,16);
   assert.ok(report.pairs.some(([a,b])=>a===0&&b===1));
   assert.ok(!report.pairs.some(([a,b])=>a===0&&b===15));
   assert.deepEqual(dispatches,[4],'256 pair flags dispatched in four 64-thread workgroups');
   assert.match(shader,/@compute @workgroup_size\(64\)/);
 }finally{
   if(savedUsage===undefined)delete globalThis.GPUBufferUsage;else globalThis.GPUBufferUsage=savedUsage;
   if(savedMode===undefined)delete globalThis.GPUMapMode;else globalThis.GPUMapMode=savedMode;
 }
});
