import test from 'node:test';
import assert from 'node:assert/strict';
import {smoothVectorPath,smoothPaths,visibleGeometryChange} from '../web/curve-smoothing.js';
import {optimizePaths} from '../web/curve-optimizer.js';
import {worldData} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

const original={
  kind:'vector',offset:[0,0],artwork:'<path d="M 0 0 C 2 0 4 0 6 0 C 8 0.9 10 5 12 5" stroke="#ff0000"/>',
  commands:[['M',0,0],['C',2,0,4,0,6,0],['C',8,.9,10,5,12,5]],
  points:[[0,0],[6,0],[12,5]],closed:false
};
function cubic(c,p,t){
 const u=1-t,point=i=>c.slice(i,i+2),a=point(1),b=point(3),d=point(5);
 return [
  p[0]*u**3+3*a[0]*u*u*t+3*b[0]*u*t*t+d[0]*t**3,
  p[1]*u**3+3*a[1]*u*u*t+3*b[1]*u*t*t+d[1]*t**3
 ];
}
test('smoothing changes actual C Bézier controls, not only SVG appearance',()=>{
 const before=structuredClone(original);
 const low=smoothVectorPath(original,.01),high=smoothVectorPath(original,.2);
 assert.ok(high.joints>=1);
 assert.ok(high.maxHandleShift>low.maxHandleShift);
 assert.ok(high.maxHandleShift<=.2+1e-9);
 assert.notDeepEqual(high.path.commands,original.commands);
 assert.match(worldData(high.path),/C/);
 assert.match(high.path.artwork,/stroke="#34465b"/);
 const beforePoint=cubic(before.commands[2],before.commands[1].slice(-2),.12);
 const afterPoint=cubic(high.path.commands[2],high.path.commands[1].slice(-2),.12);
 assert.ok(Math.hypot(beforePoint[0]-afterPoint[0],beforePoint[1]-afterPoint[1])>1e-5,
   'sampling actual curve geometry must confirm visible path change');
 assert.deepEqual(original,before,'source curves never modified');
});
test('smoothing protects sharp corners and preserves original closed contours',()=>{
 const corner={
  kind:'vector',artwork:'<path/>',offset:[0,0],closed:true,
  commands:[['M',0,0],['C',2,0,4,0,6,0],['C',6,2,6,4,6,6],['Z']],
  points:[[0,0],[6,0],[6,6]]
 };
 const result=smoothVectorPath(corner,.3);
 assert.equal(result.joints,0,'90-degree corner must remain sharp');
 assert.deepEqual(result.path.commands,corner.commands);
 assert.equal(result.path.closed,true);
 assert.throws(()=>smoothVectorPath(corner,2.1),/размер/i);
});
test('after geometry is actually smoothed/optimized and EPS retains cubic curves',()=>{
 const source={format:'relief-forge',version:1,width:15,height:10,paths:[original,
  {kind:'image',points:[[0,0]],closed:false}]};
 const smoothed=smoothPaths(source,[0],.15);
 const optimized=optimizePaths(smoothed.document,[0],.00001);
 assert.ok(smoothed.stats.joints>=1);
 assert.ok(visibleGeometryChange(source,optimized.document,[0]));
 assert.deepEqual(optimized.document.paths[1],source.paths[1]);
 assert.ok(optimized.document.paths[0].commands.some(c=>c[0]==='C'));
 const eps=exportEps({...optimized.document,paths:optimized.document.paths.filter(p=>p.kind!=='image')});
 assert.match(eps,/^[-\d. ]+ C$/m);
 assert.doesNotMatch(eps,/^\s*(?:stroke|fill|setlinewidth)\b/gm);
});
