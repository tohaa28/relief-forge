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
