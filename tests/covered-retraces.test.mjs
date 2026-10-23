import test from 'node:test';import assert from 'node:assert/strict';
import {pruneCoveredRetraces} from '../web/covered-retraces.js';
import {repairVectorPoints} from '../web/point-repair.js';
const ring=[['M',0,0],['L',5,0],['L',10,0],['L',10,10],['L',0,10],['Z']];
const retrace=(x=2,y=0,b=8)=>[['M',x,y],['L',b,y],['L',x,y],['Z']];
const path=(commands,paint={fill:'#c00',stroke:'none',fillRule:'evenodd'})=>({kind:'vector',commands,closed:true,offset:[3,7],
 points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),paint,artwork:'<path/>'});
test('remove a covered closed A-B-A trace without changing surviving commands, paint or source',()=>{
 const p=path([...ring,...retrace()]),before=structuredClone(p),r=pruneCoveredRetraces(p);
 assert.equal(r.removedContours,1);assert.equal(r.removedNodes,3);assert.deepEqual(r.path.commands,ring);
 assert.deepEqual(r.path.paint,p.paint);assert.deepEqual(r.path.offset,[3,7]);assert.deepEqual(p,before);
 assert.equal(pruneCoveredRetraces(r.path).removedContours,0,'idempotent repair');
});
test('coverage may consist of adjacent reversed segments, but not an interval gap',()=>{
 const reverse=[['M',10,0],['L',5,0],['L',0,0],['L',0,10],['L',10,10],['Z']];
 assert.equal(pruneCoveredRetraces(path([...reverse,...retrace()])).removedContours,1);
 const partial=[['M',0,0],['L',4,0],['L',4,10],['L',0,10],['Z'],['M',6,0],['L',10,0],['L',10,10],['L',6,10],['Z']];
 assert.equal(pruneCoveredRetraces(path([...partial,...retrace()])).removedContours,0);
});
test('preserve uncovered, near-parallel and noncollinear zero-area contours',()=>{
 for(const trace of [retrace(2,.000001),retrace(-2,0,8),[['M',2,0],['L',8,0],['L',2,.001],['Z']],
  [['M',2,0],['L',8,2],['L',2,2],['L',8,0],['Z']]]){
  const p=path([...ring,...trace]);assert.equal(pruneCoveredRetraces(p).removedContours,0);assert.deepEqual(pruneCoveredRetraces(p).path,p);
 }
});
test('do not delete standalone traces or use duplicate degenerate contours to justify each other',()=>{
 for(const commands of [retrace(),[...retrace(),...retrace()]])assert.equal(pruneCoveredRetraces(path(commands)).removedContours,0);
});
test('stroked, unfilled, masked and curved looping objects remain unchanged',()=>{
 for(const p of [path([...ring,...retrace()],{fill:'none',stroke:'#c00'}),path([...ring,...retrace()],{fill:'#c00',stroke:'#000'}),
  {...path([...ring,...retrace()]),artwork:'<path clip-path="url(#c)"/>'},
  path([...ring,['M',2,0],['C',3,2,7,-2,2,0],['Z']])])assert.equal(pruneCoveredRetraces(p).removedContours,0);
});
test('a straight Bezier hull may cover a line, a bowing curve with the same endpoints cannot',()=>{
 for(const [y,expected] of [[0,1],[1,0]]){
  const curve=[['M',0,0],['C',3,y,7,y,10,0],['L',10,10],['L',0,10],['Z']];
  assert.equal(pruneCoveredRetraces(path([...curve,...retrace()])).removedContours,expected);
 }
});
test('native point-repair pipeline reports covered retraces and obeys selected-object scope',()=>{
 const p=path([...ring,...retrace()]),source={format:'relief-forge',version:1,width:20,height:20,paths:[p,p]},snapshot=structuredClone(source);
 const r=repairVectorPoints(source,[0],.01);assert.equal(r.stats.removedRetraces,1);assert.equal(r.stats.removedRetracedNodes,3);
 assert.deepEqual(r.document.paths[0].commands,ring);assert.deepEqual(r.document.paths[1],p);assert.deepEqual(source,snapshot);
});

test('work budget cannot license partially proven removal',()=>{
 const p=path([...ring,...retrace()]),r=pruneCoveredRetraces(p,{maxComparisons:1});
 assert.equal(r.removedContours,0);assert.equal(r.limited,true);assert.deepEqual(r.path,p);
 assert.throws(()=>pruneCoveredRetraces(p,{maxComparisons:0}));
});
