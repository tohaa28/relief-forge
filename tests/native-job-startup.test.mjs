import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnchorIndex,nearbyAnchors,updateAnchorPosition} from '../web/manual-edit-performance.js';
import {runNativeJob,cancelNativeJobs} from '../web/native-jobs.js';
test('native Worker startup cannot wait forever for missing imports',async()=>{
 const saved=globalThis.Worker;let terminated=false;
 globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 try{await assert.rejects(runNativeJob({}, {startupTimeoutMs:15}),/модуль геометрии/);assert.equal(terminated,true);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});
test('readiness ends the startup deadline without imposing it on actual geometry work',async()=>{
 const saved=globalThis.Worker;
 globalThis.Worker=class{postMessage(){setTimeout(()=>this.onmessage({data:{ready:true}}),0);setTimeout(()=>this.onmessage({data:{output:42}}),35);}terminate(){}};
 try{assert.equal(await runNativeJob({}, {startupTimeoutMs:15}),42);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});
test('Cancel terminates a loading Worker and rejects its pending job',async()=>{
 const saved=globalThis.Worker;let terminated=false;
 globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 try{const result=runNativeJob({});cancelNativeJobs();await assert.rejects(result,/отменён/);assert.equal(terminated,true);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});

test('marker refresh terminates a ready Worker that never returns a result',async()=>{
 const saved=globalThis.Worker;let terminated=false;
 globalThis.Worker=class{
  postMessage(){queueMicrotask(()=>this.onmessage({data:{ready:true}}));}
  terminate(){terminated=true;}
 };
 try{
  await assert.rejects(runNativeJob({}, {executionTimeoutMs:20}),/время проверки маркеров/);
  assert.equal(terminated,true);
 }finally{cancelNativeJobs();globalThis.Worker=saved;}
});

test('the glyph index follows relocated anchors and prioritizes the visible rectangle',()=>{
 const nodes=[{index:0,point:[0,0]},{index:1,point:[-.2,0]}];
 const index=buildAnchorIndex(nodes);
 nodes[0].point=[101,0];
 updateAnchorPosition(index,0,nodes[0].point);
 assert.deepEqual(nearbyAnchors(index,[0,0],1).map(node=>node.index),[1]);
 assert.deepEqual(nearbyAnchors(index,[101,0],1).map(node=>node.index),[0]);
 const edge=buildAnchorIndex([{index:0,point:[-2,0]},{index:1,point:[3,0]}]);
 assert.deepEqual(nearbyAnchors(edge,[0,0],5,{limit:1,viewport:{x:-1,y:-1,width:5,height:2}}).map(node=>node.index),[1]);
});
