import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeUnionPaths} from '../web/native-boolean.js';
import {verifyNativeUnionProof} from '../web/native-union-proof.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {protectPreviewNodeBudget,realNodeCount} from '../web/preview-node-budget.js';
import {validateCurveChange,validateDocumentCurveChange} from '../web/curve-quality.js';
import {nativeIntersections} from '../web/native-intersections.js';
import {refineNativeDiagnostics} from '../web/native-diagnostic-refinement.js';
import {exportEps,exportColoredEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
const path=commands=>({kind:'vector',artwork:'<path/>',commands,offset:[0,0],closed:true,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),paint:{fill:'#234567',stroke:'none',fillRule:'nonzero'}});
const rect=(x,y,w,h)=>path([['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']]);
const doc=paths=>({width:50,height:50,paths});
const applied=inputs=>{const r=nativeUnionPaths(inputs);return {...path(r.commands),paint:{fill:'#234567',stroke:'none',fillRule:'evenodd'},nativeUnionProof:r.proof};};

test('Union retains exact untouched cubic controls, with no sampling anchors',()=>{
 const p=path([['M',0,0],['C',1,-2,3,-2,4,0],['L',4,4],['C',3,6,1,6,0,4],['Z']]);
 const result=applied([p]);assert.equal(verifyNativeUnionProof(result),true);
 assert.equal(result.commands.filter(c=>c[0]==='C').length,2);
 assert.equal(result.commands.filter(c=>c[0]==='L').length,1);
 assert.equal(result.nativeUnionProof.newJunctions,0);
 assert.ok(result.commands.some(c=>JSON.stringify(c)===JSON.stringify(p.commands[1])));
});
test('native Union retains quadratic degree instead of refitting cubic polygons',()=>{
 const p=path([['M',0,0],['Q',2,-3,4,0],['L',4,4],['L',0,4],['Z']]),r=applied([p]);
 assert.equal(verifyNativeUnionProof(r),true);assert.equal(r.commands.filter(c=>c[0]==='Q').length,1);
});
test('necessary four cross-boundary cuts may exceed the old global node ceiling',()=>{
 const source=doc([rect(0,2,6,2),rect(2,0,2,6)]),r=mergeOverlappingObjects(source),out=r.document.paths[0];
 assert.equal(source.paths.length,2);assert.equal(r.document.paths.length,1);
 assert.equal(realNodeCount(source),8);assert.equal(realNodeCount(r.document),12);
 assert.equal(out.nativeUnionProof.newJunctions,4);assert.equal(verifyNativeUnionProof(out),true);
 const budget=protectPreviewNodeBudget(source,source,r.document);
 assert.equal(budget.reason,null);assert.equal(budget.final,12);
});
test('stale or forged provenance cannot authorize extra nodes',()=>{
 const source=doc([rect(0,2,6,2),rect(2,0,2,6)]),r=mergeOverlappingObjects(source).document;
 const bad=structuredClone(r);bad.paths[0].commands[1][1]+=.01;
 assert.equal(verifyNativeUnionProof(bad.paths[0]),false);
 assert.equal(protectPreviewNodeBudget(source,source,bad).reason,'union-node-growth');
 const forged=structuredClone(r);forged.paths[0].nativeUnionProof.input[0][0][1]+=1;
 assert.equal(protectPreviewNodeBudget(source,source,forged).reason,'union-node-growth');
});
test('collinear source edges are joined without artificial internal anchors',()=>{
 const out=applied([rect(0,0,10,10),rect(5,0,10,10)]);
 assert.equal(realNodeCount(doc([out])),4);assert.equal(verifyNativeUnionProof(out),true);
});
test('exact duplicate cleanup keeps topmost opaque copy and selected-only scope',()=>{
 const a=rect(0,0,3,3),b=structuredClone(a);a.tag='earlier';b.tag='later';
 const r=mergeOverlappingObjects(doc([a,b]));assert.equal(r.stats.removedExact,1);assert.equal(r.document.paths[0].tag,'later');
 assert.equal(mergeOverlappingObjects(doc([a,b]),{indices:[0]}).stats.removedExact,0);
 const transparent={...a,paint:{...a.paint,opacity:.5}};
 assert.equal(mergeOverlappingObjects(doc([transparent,structuredClone(transparent)])).stats.removedExact,0);
});
test('both EPS modes serialize the accepted native AFTER without additional cuts',()=>{
 const r=mergeOverlappingObjects(doc([rect(0,2,6,2),rect(2,0,2,6)])).document,original=structuredClone(r);
 for(const prepared of [{content:exportEps(r),source:'outline'},exportColoredEps(r)])assert.deepEqual(verifyEpsOutputGeometry(r,prepared),{status:'matching-after',realNodes:12});
 assert.deepEqual(r,original);
});
test('native geometry rejects an invented sampling-chord crossing',()=>{
 const a=path([['M',0,0],['C',0,.01,1,.01,1,0]]),b=path([['M',.5,-.01],['L',.5,.001]]);
 a.closed=b.closed=false;
 assert.equal(nativeIntersections([a,b]).length,0);
 const r=refineNativeDiagnostics(doc([a,b]),[{kind:'intersection',path:0,other:1,point:[.5,0]}]);
 assert.equal(r.complete,true);assert.equal(r.issues.length,0);
});
test('native intersection markers use the actual cubic point',()=>{
 const a=path([['M',0,0],['C',0,1,1,1,1,0]]),b=path([['M',.5,-1],['L',.5,1]]);
 a.closed=b.closed=false;const r=refineNativeDiagnostics(doc([a,b]),[]);
 assert.equal(r.issues.length,1);assert.ok(Math.abs(r.issues[0].point[1]-.75)<1e-12);
});
test('sampling points never become coincident native anchors or short cubic spans',()=>{
 const a=path([['M',0,0],['C',0,1,1,1,1,0]]),b=path([['M',.5,.751],['L',.5,2]]);a.closed=b.closed=false;
 const r=refineNativeDiagnostics(doc([a,b]),[{kind:'coincident',path:0,other:1,point:[.5,.75]}],null,.01);
 assert.equal(r.issues.filter(i=>i.kind==='coincident').length,0);
 const loop=path([['M',0,0],['C',2,0,2,2,0,0],['Z']]);
 assert.equal(refineNativeDiagnostics(doc([loop]),[{kind:'short',path:0,other:0,point:[0,0]}]).issues.some(i=>i.kind==='short'),false);
});
test('a one-ULP Z closure is numerical roundoff, while a real short closing edge is retained',()=>{
 const loop=gap=>path([['M',100,100],['L',110,100],['L',110,110],['L',100,110],['L',100,100+gap],['Z']]);
 assert.equal(refineNativeDiagnostics(doc([loop(1.4210854715202004e-14)]),[]).issues.some(i=>i.kind==='short'),false);
 assert.equal(refineNativeDiagnostics(doc([loop(.000001)]),[]).issues.some(i=>i.kind==='short'),true);
});
test('optimization may not introduce or move anchors even within its fit tolerance',()=>{
 const a=path([['M',0,0],['C',1,0,2,0,3,0]]),b=path([['M',0,0],['C',1,0,2,0,3.001,0]]);
 assert.equal(validateCurveChange(a,b,{tolerance:.1}).reason,'new-or-moved-anchor');
});
test('unchanged large document does not fail a synthetic 20000-sample cap',()=>{
 const p=path([['M',0,0],...Array.from({length:7001},(_,i)=>['L',i+1,(i%2)*.01])]);
 const d=doc([p,structuredClone(p),structuredClone(p)]);
 assert.equal(validateDocumentCurveChange(d,structuredClone(d)).accepted,true);
});
