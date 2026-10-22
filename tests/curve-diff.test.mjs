import test from 'node:test';
import assert from 'node:assert/strict';
import {removedCurveAnchors,changedCurveIndices,changedBezierSites} from '../web/curve-diff.js';
import {optimizePaths,smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {worldData} from '../web/rich-svg.js';

function mid(a,b){return a.map((x,i)=>(x+b[i])/2);}
function split([p0,p1,p2,p3]){
 const a=mid(p0,p1),b=mid(p1,p2),c=mid(p2,p3),d=mid(a,b),e=mid(b,c),m=mid(d,e);
 return [[p0,a,d,m],[m,e,c,p3]];
}
test('optimized actual cubic path changes geometry and drops real Bezier anchor, not just count label',()=>{
 const [a,b]=split([[0,0],[5,0],[10,10],[15,10]]);
 const doc={width:20,height:20,paths:[{
  kind:'vector',closed:false,artwork:'<path d="M 0 0"/>',offset:[0,0],
  points:[a[0],a[3],b[3]],commands:[['M',...a[0]],['C',...a[1],...a[2],...a[3]],['C',...b[1],...b[2],...b[3]]]
 }]};
 const saved=structuredClone(doc);
 const result=optimizePaths(doc,[0],.4,10);
 assert.equal(result.stats.original,2);
 assert.equal(result.stats.result,1);
 assert.ok(result.stats.maxError<=.4);
 assert.equal(result.document.paths[0].commands.filter(s=>s[0]==='C').length,1);
 assert.notEqual(worldData(doc.paths[0]),worldData(result.document.paths[0]));
 assert.deepEqual(changedCurveIndices(doc,result.document,[0]),[0]);
 const missing=removedCurveAnchors(doc,result.document,[0]);
 assert.deepEqual(missing.map(x=>x.point),[a[3]]);
 assert.deepEqual(doc,saved,'comparison is non-destructive');
});
test('unchanged curves do not get false removed-node annotations',()=>{
 const doc={paths:[{closed:false,points:[[0,0],[1,1]]}]};
 assert.deepEqual(changedCurveIndices(doc,doc,[0]),[]);
 assert.deepEqual(removedCurveAnchors(doc,doc,[0]),[]);
});
test('smoothing-only Bezier handle changes are visible without removing an anchor',()=>{
 const original={width:10,height:10,paths:[{kind:'vector',artwork:'<path/>',offset:[0,0],closed:false,
  points:[[0,0],[3,0],[6,.5]],commands:[['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]]}]};
 const candidate=smoothAndOptimizePaths(original,[0],.15,.00001);
 assert.ok(candidate.stats.smoothed>0);
 assert.equal(candidate.stats.removed,0);
 assert.deepEqual(changedCurveIndices(original,candidate.document,[0]),[0]);
 assert.deepEqual(removedCurveAnchors(original,candidate.document,[0]),[]);
 assert.notDeepEqual(candidate.document.paths[0].commands,original.paths[0].commands);
 assert.deepEqual(original.paths[0].commands[1],['C',1,0,2,0,3,0]);
});

test('smoothing-only altered cubic handles produce visible change markers despite same anchor count',()=>{
 const before={paths:[{kind:'vector',offset:[0,0],artwork:'<path/>',points:[[0,0],[3,0],[6,.5]],
 commands:[['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]],closed:false}]};
 const result=smoothAndOptimizePaths(before,[0],.15,.00001);
 const sites=changedBezierSites(before,result.document,[0]);
 assert.ok(sites.length>=1);
 assert.ok(sites.every(x=>x.point.every(Number.isFinite)));
 assert.deepEqual(removedCurveAnchors(before,result.document,[0]),[]);
 assert.deepEqual(changedBezierSites(before,before,[0]),[]);
});
