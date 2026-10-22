import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {
  curveNodes,curveHandles,curveNodeType,moveCurveHandle,setCurveNodeType,
  setCurveSegmentType,reverseCurveDirection,closeCurveAtNode,breakCurveAtNode
} from '../web/curve-edit.js';
import {exportEps} from '../web/eps-export.js';
import {readFileSync} from 'node:fs';

const opts={Parser:DOMParser};
const cubic=(commands,closed=false)=>({kind:'vector',closed,offset:[0,0],commands,
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="M0 0" fill="none" stroke="blue"/>'});
const source=()=>cubic([['M',0,0],['C',1,1,2,3,4,0],['C',6,1,7,0,8,0]]);
const vector=(a,b)=>a.map((v,i)=>v-b[i]);
const length=v=>Math.hypot(...v);
const close=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<=eps, a+' != '+b);
const opposite=(h)=>{
  const v=vector(h.handles.find(x=>x.side==='in').point,h.anchor);
  const w=vector(h.handles.find(x=>x.side==='out').point,h.anchor);
  close(v[0]*w[1]-v[1]*w[0],0);
  assert.ok(v[0]*w[0]+v[1]*w[1]<0,'the tangents must point in opposite directions');
  return [v,w];
};

test('cusp lets handles rotate independently, smooth keeps line and lengths, symmetric mirrors length',()=>{
  const initial=source(),smooth=setCurveNodeType(initial,1,'smooth',opts);
  assert.equal(curveNodeType(smooth,1),'smooth');
  const before=curveHandles(smooth,1),[v,w]=opposite(before);
  assert.ok(Math.abs(length(v)-length(w))>1);
  const moved=moveCurveHandle(smooth,1,'out',[6,6],opts);
  const [v2,w2]=opposite(curveHandles(moved,1));
  close(length(v2),length(v));assert.ok(length(w2)>length(w));
  const symmetric=setCurveNodeType(initial,1,'symmetric',opts);
  assert.equal(curveNodeType(symmetric,1),'symmetric');
  const [v3,w3]=opposite(curveHandles(symmetric,1));close(length(v3),length(w3));
  const adjusted=moveCurveHandle(symmetric,1,'in',[3,4],opts);
  const [v4,w4]=opposite(curveHandles(adjusted,1));close(length(v4),length(w4));
  const cusp=setCurveNodeType(symmetric,1,'cusp',opts);
  const prior=curveHandles(cusp,1).handles.find(h=>h.side==='in').point;
  const changed=moveCurveHandle(cusp,1,'out',[7,4],opts);
  assert.deepEqual(curveHandles(changed,1).handles.find(h=>h.side==='in').point,prior);
  assert.equal(curveNodeType(changed,1),'cusp');
  assert.deepEqual(initial,source(),'editing must not mutate the caller');
});

test('open endpoints cannot become symmetric; invalid handle coordinates do not change original',()=>{
  const p=source(),copy=structuredClone(p);
  assert.throws(()=>setCurveNodeType(p,0,'symmetric',opts),/два смежных/);
  assert.throws(()=>moveCurveHandle(p,1,'out',[NaN,0],opts),/координата/);
  assert.deepEqual(p,copy);
});

test('straight polyline becomes a real C curve, keeps editable handles and EPS cubic commands',()=>{
  const source={kind:'vector',closed:false,points:[[0,0],[10,0],[20,0]]};
  const curved=setCurveSegmentType(source,1,'curve',opts);
  assert.ok(curved.artwork,'curve must be promoted from plain polyline to persistent SVG');
  assert.deepEqual(curved.commands[2],['C',10+10/3,0,10+20/3,0,20,0]);
  const refined=moveCurveHandle(curved,1,'out',[15,5],opts);
  assert.deepEqual(refined.commands[2].slice(1,3),[15,5]);
  assert.match(exportEps({width:40,height:30,paths:[refined]}),/ C$/m);
  assert.equal(source.artwork,undefined);
  const straight=setCurveSegmentType(refined,1,'line',opts);
  assert.equal(straight.commands[2][0],'L');
});

test('reverse traversal preserves Bézier handles, contour closure and unrelated subpaths',()=>{
  const p=cubic([['M',0,0],['C',1,2,4,3,8,1],['M',10,10],['L',20,10]]);
  const reverse=reverseCurveDirection(p,opts);
  assert.deepEqual(reverse.commands,[['M',8,1],['C',4,3,1,2,0,0],['M',20,10],['L',10,10]]);
  const twice=reverseCurveDirection(reverse,opts);
  assert.deepEqual(twice.commands,p.commands);
  const closed=cubic([['M',0,0],['C',2,2,4,0,5,0],['L',5,5],['Z']],true);
  const reversed=reverseCurveDirection(closed,opts);
  assert.equal(reversed.commands.at(-1)[0],'Z');
  assert.deepEqual(curveNodes(reversed).map(n=>n.point),[[0,0],[5,5],[5,0]]);
  assert.equal(reversed.commands.filter(x=>x[0]==='C').length,1);
});

test('breaking/closing contours preserves commands and does not flatten cubics',()=>{
  const original=source();
  const split=breakCurveAtNode(original,1,opts);
  assert.equal(split.commands.filter(x=>x[0]==='M').length,2);
  assert.equal(split.commands.filter(x=>x[0]==='C').length,2);
  const closed=closeCurveAtNode(original,1,opts);
  assert.equal(closed.commands.at(-1)[0],'Z');
  const opened=breakCurveAtNode(closed,1,opts);
  assert.equal(opened.commands.at(-1)[0]!=='Z',true);
  assert.deepEqual(original,source());
});

test('UI provides active toolbar, handle drags, shortcuts, and Corel-style right-click items',()=>{
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
  for(const id of ['node-move','node-add','node-remove','node-handles','node-cusp',
    'node-smooth','node-symmetric','node-line','node-curve','node-break','node-reverse','node-close','node-context'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(app,/moveCurveHandle\(drag.before.paths\[drag.path\]/);
  assert.match(app,/contextmenu/);
  assert.match(app,/changeCurveNode\(path,name,op,true\)/);
  assert.match(css,/curve-tangent-guide/);
  assert.match(css,/curve-control-handle/);
});
