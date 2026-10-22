import test from 'node:test';
import assert from 'node:assert/strict';
import {optimizeVectorPath,optimizePaths,selectedVectorIndices,smoothVectorPath,smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {exportEps} from '../web/eps-export.js';

const mid=(a,b)=>a.map((v,i)=>(v+b[i])/2);
function splitCubic([p0,p1,p2,p3]){
 const a=mid(p0,p1),b=mid(p1,p2),c=mid(p2,p3),d=mid(a,b),e=mid(b,c),m=mid(d,e);
 return [[p0,a,d,m],[m,e,c,p3]];
}
test('reduce exact collinear nodes with zero loss and preserve open/closed topology',()=>{
 const original={closed:false,points:[[0,0],[2,0],[4,0],[5,0],[6,3]]};
 const snapshot=structuredClone(original);
 const result=optimizeVectorPath(original,.01);
 assert.ok(result.removed>=2);
 assert.equal(result.maxError,0);
 assert.deepEqual(original,snapshot);
 assert.equal(result.path.closed,false);
 assert.deepEqual(result.path.points[0],[0,0]);
 assert.deepEqual(result.path.points.at(-1),[6,3]);
 const closed=optimizeVectorPath({closed:true,points:[[0,0],[2,0],[4,0],[4,4],[0,4]]},.01);
 assert.equal(closed.path.closed,true);
 assert.equal(closed.path.commands.at(-1)[0],'Z');
});
test('consecutive split cubic segments can merge as a cubic within tunable tolerance',()=>{
 const source=[[0,0],[6,0],[12,6],[18,6]];
 const [a,b]=splitCubic(source);
 const path={kind:'vector',artwork:'<path d="M..."/>',offset:[0,0],closed:false,points:[a[0],a[3],b[3]],
  commands:[['M',...a[0]],['C',...a[1],...a[2],...a[3]],['C',...b[1],...b[2],...b[3]]]};
 const previous=structuredClone(path);
 const result=optimizeVectorPath(path,.4);
 assert.equal(result.before,2);
 assert.equal(result.after,1);
 assert.equal(result.removed,1);
 assert.ok(result.maxError<=.4);
 assert.equal(result.path.commands[1][0],'C');
 assert.deepEqual(result.path.commands[1].slice(-2),source[3]);
 assert.deepEqual(path,previous,'must never alter the imported Bezier original');
 const eps=exportEps({width:30,height:15,paths:[result.path]});
 assert.match(eps,/^[-\d. ]+ C$/m);
 assert.doesNotMatch(eps,/^\s*(?:stroke|fill|setlinewidth)\b/gm);
});
test('multi-object optimization does not modify excluded objects or source',()=>{
 const src={format:'relief-forge',version:1,width:100,height:100,paths:[
  {points:[[0,0],[1,0],[2,0]],closed:false},
  {points:[[10,0],[11,0],[12,0]],closed:false},
  {points:[[50,50],[60,60]],closed:false}
 ]};
 const copy=structuredClone(src),optimized=optimizePaths(src,[1],.01);
 assert.equal(optimized.stats.original,2);
 assert.equal(optimized.stats.result,1);
 assert.equal(optimized.stats.removed,1);
 assert.deepEqual(optimized.document.paths[0],src.paths[0]);
 assert.deepEqual(optimized.document.paths[2],src.paths[2]);
 assert.deepEqual(src,copy);
});
test('optimization rejects invalid tolerance and refuses to alter raster',()=>{
 assert.throws(()=>optimizeVectorPath({points:[[0,0],[1,0]]},0),/Допуск/);
 assert.throws(()=>optimizeVectorPath({points:[[0,0],[1,0]]},20),/Допуск/);
 assert.throws(()=>optimizeVectorPath({kind:'image',points:[[0,0],[1,1]]},.02),/Растров/);
 assert.throws(()=>optimizeVectorPath({commands:[['L',1,2]],artwork:'<path/>',offset:[0,0]},.02),/начальная точка/);
});


test('UI optimizer vector selection excludes raster and includes selected curves',()=>{
 const doc={paths:[
  {points:[[0,0],[1,0]],closed:false},
  {kind:'image',points:[[1,1]],closed:false},
  {kind:'vector',commands:[['M',0,0]],artwork:'<path/>',points:[[0,0]],closed:false}
 ]};
 assert.deepEqual(selectedVectorIndices(doc,new Set(),true),[0,2]);
 assert.deepEqual(selectedVectorIndices(doc,new Set([2]),true),[2]);
 assert.deepEqual(selectedVectorIndices(doc,new Set([1,2]),true),[2]);
 assert.deepEqual(selectedVectorIndices(doc,new Set([2]),false),[0,2]);
});


test('smoothing changes cubic handles, not only marker visibility or node count',()=>{
  const source={kind:'vector',artwork:'<path/>',offset:[0,0],closed:false,
    points:[[0,0],[3,0],[6,.5]],commands:[
      ['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]
    ]};
  const snapshot=structuredClone(source);
  const changed=smoothVectorPath(source,.15);
  assert.ok(changed.changed>0,'tangent handles must actually be adjusted');
  assert.notDeepEqual(changed.path.commands,source.commands,'After must have modified curve geometry');
  assert.equal(changed.path.commands.filter(x=>x[0]==='C').length,2,'smoothing retains true cubic paths');
  assert.ok(changed.maxError<.15,'computed geometry change stays inside smoothing tolerance');
  assert.deepEqual(source,snapshot,'source must remain exactly unchanged until Apply');
  const doc={width:10,height:10,paths:[source]};
  const candidate=smoothAndOptimizePaths(doc,[0],.15,.00001);
  assert.ok(candidate.stats.smoothed>0,'combined workflow must carry smoothing into After');
  assert.notDeepEqual(candidate.document.paths[0].commands,source.commands);
  assert.deepEqual(doc.paths[0],source);
  assert.match(exportEps(candidate.document),/ C$/m);
});
test('zero smoothing preserves all source curves and original colors',()=>{
 const source={kind:'vector',artwork:'<path stroke="#ffaa00"/>',offset:[0,0],closed:false,
 points:[[0,0],[3,0],[6,.5]],commands:[['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]]};
 const result=smoothVectorPath(source,0);
 assert.equal(result.changed,0);
 assert.deepEqual(result.path,source);
});
