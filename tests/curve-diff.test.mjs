import test from 'node:test';
import assert from 'node:assert/strict';
import {removedCurveAnchors,changedCurveIndices} from '../web/curve-diff.js';
import {optimizePaths} from '../web/curve-optimizer.js';
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
test('higher optimization degree and same smoothing tolerance never breaks source shapes',()=>{
 const src={width:30,height:10,paths:[{closed:false,points:[[0,0],[1,0],[2,0],[3,0],[4,0],[5,0]]}]};
 const low=optimizePaths(src,[0],.01,2),high=optimizePaths(src,[0],.01,20);
 assert.ok(high.stats.result<=low.stats.result);
 assert.equal(high.document.paths[0].points[0][0],0);
 assert.equal(high.document.paths[0].points.at(-1)[0],5);
 assert.equal(src.paths[0].points.length,6);
 assert.throws(()=>optimizePaths(src,[0],.01,1),/Степень/);
});
