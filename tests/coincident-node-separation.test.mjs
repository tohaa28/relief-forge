import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {separateCoincidentNonadjacentNodes} from '../web/coincident-node-separation.js';
import {curveNodes} from '../web/curve-edit.js';
import {nativeIntersections} from '../web/native-intersections.js';
import {exportEps} from '../web/eps-export.js';
const points=[[-2,0],[0,0],[2,0],[4,1],[2,2],[0,0],[-2,2]];
const vector=(p,offset=[0,0])=>{
  const commands=p.map((a,i)=>[i?'L':'M',...a]);
  return {kind:'vector',artwork:'<path d="'+commands.map(x=>x.join(' ')).join(' ')+
    '" fill="none" stroke="#123456" stroke-width="0.12"/>',
    commands,points:p.map(x=>x.slice()),offset,closed:false};
};
const doc=path=>({format:'relief-forge',version:1,width:80,height:80,paths:[path]});
const fix=(d,tol=.01)=>separateCoincidentNonadjacentNodes(d,[0],tol,{Parser:DOMParser});
test('non-neighbour touch is separated without flattening, adding nodes or losing paint',()=>{
  const original=doc(vector(points,[6,7])),snapshot=structuredClone(original);
  const repaired=fix(original);
  assert.equal(repaired.stats.separated,1);
  assert.equal(repaired.stats.skipped,0);
  assert.deepEqual(original,snapshot);
  assert.equal(repaired.document.paths[0].commands.length,original.paths[0].commands.length);
  const nodes=curveNodes(repaired.document.paths[0]);
  assert.ok(Math.hypot(nodes[1].point[0]-nodes[5].point[0],
    nodes[1].point[1]-nodes[5].point[1])>.01);
  assert.equal(nativeIntersections([repaired.document.paths[0]]).length,0);
  assert.match(repaired.document.paths[0].artwork,/stroke="#123456"/);
  assert.match(exportEps(repaired.document),/ m$/m);
});
test('disabled selection leaves original document untouched',()=>{
  const original=doc(vector(points)),result=separateCoincidentNonadjacentNodes(
    original,[],.01,{Parser:DOMParser});
  assert.deepEqual(result.document,original);
  assert.equal(result.stats.separated,0);
});
test('adjacent duplicates and a legitimate Z seam are never separated',()=>{
  const adj=doc(vector([[0,0],[2,0],[2,0],[4,0]]));
  assert.equal(fix(adj).stats.detected,0);
  const p=vector([[0,0],[4,0],[4,4],[0,4]]);
  p.commands.push(['Z']);p.closed=true;
  assert.equal(fix(doc(p)).stats.detected,0);
});
test('hard X-shaped crossing is rejected instead of introducing a nearby crossing',()=>{
  const source=doc(vector([[-2,0],[0,0],[2,0],[4,4],[0,-2],[0,0],[0,2]]));
  const outcome=fix(source);
  assert.equal(outcome.stats.separated,0);
  assert.deepEqual(outcome.document,source);
});
test('native cubic handles retain command types after a local successful shift',()=>{
  const p=vector(points);
  p.commands=[['M',-2,0],['C',-1,0,-.5,0,0,0],
    ['C',.5,0,1.5,0,2,0],['L',4,1],['L',2,2],
    ['C',1,1,0.5,.5,0,0],['C',-.5,.6,-1.5,1,-2,2]];
  p.artwork='<path d="'+p.commands.map(x=>x.join(' ')).join(' ')+
    '" fill="none" stroke="#123456"/>';
  const original=doc(p),result=fix(original);
  assert.equal(result.stats.separated,1);
  assert.deepEqual(result.document.paths[0].commands.map(x=>x[0]),
    p.commands.map(x=>x[0]));
  assert.equal(result.document.paths[0].points.length,p.points.length);
  assert.match(result.document.paths[0].artwork,/stroke="#123456"/);
});
test('no guesswork on invalid tolerance and image paths',()=>{
  const source=doc(vector(points));
  assert.throws(()=>fix(source,0),/допуск/);
  assert.throws(()=>fix(source,NaN),/допуск/);
  const image=doc({kind:'image',points:[],offset:[0,0]});
  assert.deepEqual(fix(image).document,image);
});
