import test from 'node:test';
import assert from 'node:assert/strict';
import {composeRepairedDocument,mappedComparison,activeComparisonFrame,zoomBox} from '../web/central-comparison.js';

const original={format:'relief-forge',version:1,width:40,height:20,paths:[
  {kind:'vector',artwork:'<path/>',points:[[0,0],[10,0]],commands:[['M',0,0],['L',10,0]],offset:[0,0],closed:false},
  {points:[[12,0],[20,0]],closed:false},
  {points:[[22,0],[30,0]],closed:false},
  {points:[[32,0],[39,0]],closed:false}
]};
test('whole-document preview replaces only selected objects, retaining original SVG and unselected paths',()=>{
  const before=structuredClone(original),after=[{closed:true,points:[[12,0],[16,4],[20,0]]}];
  const result=composeRepairedDocument(original,[1,2],after);
  assert.deepEqual(result.afterIndices,[1]);
  assert.equal(result.document.paths.length,3);
  assert.deepEqual(result.document.paths[0],before.paths[0]);
  assert.deepEqual(result.document.paths[2],before.paths[3]);
  assert.deepEqual(result.document.paths[1],after[0]);
  assert.deepEqual(original,before,'preview must not mutate original EPS curves');
  assert.throws(()=>composeRepairedDocument(original,[999],after),/отсутствуют/);
});
test('sampled diagnostics map to exact original indices and repaired indices after replacement',()=>{
  const beforeIssues=[
    {kind:'open',path:0,other:0,point:[12,0]},
    {kind:'short',path:1,other:1,point:[14,2]},
    {kind:'intersection',path:2,other:1,point:[24,2]}
  ];
  const afterIssues=[{kind:'open',path:0,other:0,point:[15,1]}];
  // One selected SVG may generate two sampled contours, another one the third.
  const comparison=mappedComparison(original,[1,2],[1,1,2],beforeIssues,afterIssues,
    [{closed:false,points:[[12,0],[18,1]]}]);
  assert.deepEqual(comparison.beforeIssues.map(x=>x.path),[1,1,2]);
  assert.deepEqual(comparison.afterIssues.map(x=>x.path),[1]);
  const frameBefore=activeComparisonFrame(comparison,'before',original,[]);
  const frameAfter=activeComparisonFrame(comparison,'after',original,[]);
  assert.equal(frameBefore.document.paths.length,4);
  assert.equal(frameAfter.document.paths.length,3);
  assert.equal(frameBefore.issues.length,3);
  assert.equal(frameAfter.issues.length,1);
  assert.ok(frameAfter.readOnly);
  assert.equal(activeComparisonFrame(null,'after',original,[]).readOnly,false);
});
test('toolbar zoom maintains center and is reversible within coordinate tolerance',()=>{
  const base={x:-5,y:-2,width:50,height:20};
  const up=zoomBox(base,.8);
  assert.deepEqual(up,{x:0,y:0,width:40,height:16});
  const back=zoomBox(up,1.25);
  assert.deepEqual(back,base);
  const cursor=zoomBox(base,.5,[0,0]);
  assert.deepEqual(cursor,{x:-2.5,y:-1,width:25,height:10});
  assert.throws(()=>zoomBox(base,0),/масштаб/);
  assert.equal(zoomBox(base,1e10),null);
});
