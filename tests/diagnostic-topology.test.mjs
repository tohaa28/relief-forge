import test from 'node:test';
import assert from 'node:assert/strict';
import {planDiagnosticBatches,mapDiagnosticIssue} from '../web/large-file-support.js';
import {diagnoseAfterDocument} from '../web/after-diagnostics.js';
import {validateCurveChange} from '../web/curve-quality.js';
import {sampledContours} from '../web/rich-svg.js';
import {optimizeVectorPath} from '../web/curve-optimizer.js';
const poly=(points,closed=true)=>({points,closed});
const circle=(n,closed=true)=>poly(Array.from({length:n},(_,i)=>[100*Math.cos(i*2*Math.PI/n),100*Math.sin(i*2*Math.PI/n)]),closed);
const opens=paths=>paths.flatMap((p,i)=>p.closed?[]:[{kind:'open',path:i,other:i,a:0,b:p.points.length-1,point:p.points[0]}]);
test('closed contour split into two windows never reports invented open contours',async()=>{
  const doc={paths:[circle(2444)]},frozen=structuredClone(doc);
  const report=await diagnoseAfterDocument(doc,.01,{runBatch:async input=>{
    const paths=[];let k=4;for(let i=0;i<input[3];i++){const closed=Boolean(input[k++]),n=input[k++],points=[];for(let j=0;j<n;j++)points.push([input[k++],input[k++]]);paths.push({closed,points});}
    return {issues:opens(paths),diagnosticComplete:true};
  }});
  assert.equal(report.issues.length,0);assert.equal(report.complete,false);assert.deepEqual(doc,frozen);
});
test('long genuinely open contour is reported once with original endpoint indices',()=>{
  const p=circle(4500,false),plan=planDiagnosticBatches([p],[9]);
  const issues=plan.batches.flatMap(b=>opens(b.paths).map(i=>mapDiagnosticIssue(i,b)).filter(Boolean));
  assert.equal(issues.length,1);assert.equal(issues[0].path,9);assert.equal(issues[0].b,4499);
});
test('closed split includes closing edge but no artificial closing chords',()=>{
  const p=circle(4010),plan=planDiagnosticBatches([p],[0]);
  const edges=plan.batches.flatMap(b=>b.paths.flatMap(p=>p.points.slice(1).map((v,i)=>[p.points[i],v])));
  assert.equal(edges.length,p.points.length);
  for(let i=0;i<edges.length;i++)assert.deepEqual(edges[i],[p.points[i],p.points[(i+1)%p.points.length]]);
  const b=plan.batches[1],mapped=mapDiagnosticIssue({kind:'short',path:0,other:0,a:5,b:5,point:b.paths[0].points[5]},b);
  assert.equal(mapped.a,2004);
});
test('quality check rejects lost closure, extra nodes, new short segments and new crossings',()=>{
  const square=poly([[0,0],[10,0],[10,10],[0,10]]);
  assert.equal(validateCurveChange(square,{...square,closed:false}).reason,'closure-or-subpath-change');
  assert.equal(validateCurveChange(square,poly([[0,0],[5,0],[10,0],[10,10],[0,10]])).reason,'node-increase');
  assert.equal(validateCurveChange(square,poly([[0,0],[.001,0],[10,10],[0,10]])).reason,'new-short-segment');
  const open=poly([[0,0],[10,0],[10,10],[0,10]],false),crossed=poly([[0,0],[10,10],[0,10],[10,0]],false);
  assert.equal(validateCurveChange(open,crossed).reason,'new-intersection');
  assert.equal(validateCurveChange(square,poly([[0,0],[0,10],[10,10],[10,0]])).reason,'collapsed-or-reversed-ring');
});
test('quality check is location-aware: removing an old crossing cannot pay for a new one',()=>{
  const old=poly([[0,0],[10,10],[0,10],[10,0]],false),shift=poly(old.points.map(([x,y])=>[x+100,y]),false);
  assert.equal(validateCurveChange(old,shift).reason,'new-intersection');
});
test('optimizer really reduces stored commands and reports independent quality checks',()=>{
  const before=poly([[0,0],[1,0],[2,0],[3,0]],false),copy=structuredClone(before),r=optimizeVectorPath(before,.01);
  assert.equal(r.removed,2);assert.equal(r.quality.accepted,true);assert.equal(r.path.commands.length,2);assert.deepEqual(before,copy);
});

test('exact geometric closure without Z is not a gap; nearby endpoints remain open',()=>{
  const p=poly([[0,0],[10,0],[10,10],[0,0]],false),frozen=structuredClone(p);
  assert.equal(sampledContours(p,.01)[0].closed,true);
  assert.equal(sampledContours(p,.01)[0].points.length,3);
  assert.deepEqual(p,frozen);
  const near=poly([[0,0],[10,0],[10,10],[0,.001]],false);
  assert.equal(sampledContours(near,.01)[0].closed,false);
});

test('document guard checks new contacts between independent objects',async()=>{
  const {validateDocumentCurveChange}=await import('../web/curve-quality.js');
  const a=poly([[0,0],[10,0]],false),b=poly([[5,1],[5,2]],false);
  assert.equal(validateDocumentCurveChange({paths:[a,b]},{paths:[a,poly([[5,-1],[5,2]],false)]}).reason,'new-intersection');
});
