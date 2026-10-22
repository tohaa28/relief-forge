import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {curveNodes,moveCurveNode,addCurveNode,deleteCurveNode,nearestCurveSegment} from '../web/curve-edit.js';
import {importRichSvg,exportDocument} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

const options={Parser:DOMParser};
const vector=commands=>({kind:'vector',commands,closed:commands.at(-1)[0]==='Z',offset:[0,0],
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),artwork:'<path d="M0 0" fill="none" stroke="#007"/>'});
const at=(p,c,t)=>{
  const points=[p,...Array.from({length:(c.length-1)/2},(_,i)=>c.slice(1+i*2,3+i*2))];
  while(points.length>1){for(let i=0;i<points.length-1;i++)points[i]=points[i].map((v,j)=>v*(1-t)+points[i+1][j]*t);points.pop();}
  return points[0];
};
const close=(a,b,eps=1e-9)=>assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<eps,JSON.stringify({a,b}));

test('adding a cubic or quadratic node preserves the exact curve at all sampled parameters',()=>{
  for(const c of [['C',1,4,5,-2,8,1],['Q',3,5,8,1]]){
    const source=vector([['M',0,0],c]),snapshot=structuredClone(source),split=.37;
    const result=addCurveNode(source,1,split,options);
    assert.equal(result.commands.length,3);
    for(let i=0;i<=100;i++){
      const t=i/100,p=t<=split?at([0,0],result.commands[1],t/split):
        at(result.commands[1].slice(-2),result.commands[2],(t-split)/(1-split));
      close(p,at([0,0],c,t));
    }
    assert.deepEqual(source,snapshot);
    assert.equal(result.commands[1][0],c[0]);
  }
});

test('move translates anchor and adjacent cubic handles, including closed explicit seam, without flattening',()=>{
  const source=vector([['M',0,0],['C',1,0,2,1,3,1],['C',4,1,1,2,0,0],['Z']]);
  assert.equal(curveNodes(source).length,2,'closing endpoint aliases M rather than a duplicate editable node');
  const moved=moveCurveNode(source,0,[1,2],options);
  assert.deepEqual(moved.commands,[['M',1,2],['C',2,2,2,1,3,1],['C',4,1,2,4,1,2],['Z']]);
  const inner=moveCurveNode(source,1,[4,2],options);
  assert.deepEqual(inner.commands[1],['C',1,0,3,2,4,2]);
  assert.deepEqual(inner.commands[2],['C',5,2,1,2,0,0]);
});

test('deleting a newly inserted cubic node reconstructs its original unsplit geometry',()=>{
  const source=vector([['M',0,0],['C',1,4,5,-2,8,1],['C',10,2,11,1,12,1]]);
  const inserted=addCurveNode(source,1,.37,options),deleted=deleteCurveNode(inserted,1,options);
  assert.equal(deleted.commands.length,source.commands.length);
  source.commands.forEach((c,j)=>c.slice(1).forEach((v,i)=>assert.ok(Math.abs(v-deleted.commands[j][i+1])<1e-10)));
});

test('node editing preserves inherited paint, clipping, transform and translation in SVG round trip',()=>{
  const doc=importRichSvg('<svg xmlns="http://www.w3.org/2000/svg" width="60mm" height="40mm" viewBox="0 0 30 20"><defs><clipPath id="c"><rect width="30" height="20"/></clipPath></defs><g fill="#f00" stroke="#07a" opacity=".6" clip-path="url(#c)" transform="translate(2 1) scale(2)"><path d="M0 0 C1 2 3 2 4 0"/></g></svg>',options);
  const source=structuredClone(doc.paths[0]);source.offset=[3,4];
  const node=curveNodes(source)[1];
  const moved=moveCurveNode(source,node.index,[node.point[0]+2,node.point[1]+1],options);
  const svg=exportDocument({...doc,paths:[moved]}),reopened=importRichSvg(svg,options);
  assert.match(svg,/fill="#f00"/);assert.match(svg,/stroke="#07a"/);assert.match(svg,/clip-path=/);assert.match(svg,/opacity=".6"/);
  const actual=curveNodes(reopened.paths[0]),expected=curveNodes(moved);
  expected.forEach((n,i)=>close(actual[i].point,n.point));
  assert.deepEqual(source.offset,[3,4]);
});

test('deleting an interior cubic node retains outer tangent handles and all other subpaths',()=>{
  const source=vector([['M',0,0],['C',1,0,2,1,3,1],['C',4,1,5,0,6,0],['M',10,10],['L',12,10]]);
  const result=deleteCurveNode(source,1,options);
  assert.deepEqual(result.commands,[['M',0,0],['C',1,0,5,0,6,0],['M',10,10],['L',12,10]]);
  assert.deepEqual(source.commands[1],['C',1,0,2,1,3,1]);
});

test('closed start deletion rotates contour safely, while endpoint deletion preserves open topology',()=>{
  const closed=vector([['M',0,0],['L',4,0],['L',4,4],['L',0,4],['Z']]);
  const result=deleteCurveNode(closed,0,options);
  assert.deepEqual(curveNodes(result).map(n=>n.point),[[4,0],[4,4],[0,4]]);
  assert.equal(result.closed,true);
  const open={points:[[0,0],[2,1],[4,0]],closed:false};
  assert.deepEqual(deleteCurveNode(open,0,options).points,[[2,1],[4,0]]);
  assert.deepEqual(deleteCurveNode(open,2,options).points,[[0,0],[2,1]]);
  assert.throws(()=>deleteCurveNode({points:[[0,0],[1,1]],closed:false},0,options),/два узла/);
});

test('inserting on implicit closing edge and nearest-segment picking preserve closure and offsets',()=>{
  const source=vector([['M',0,0],['L',4,0],['L',4,4],['Z']]);source.offset=[10,20];
  const hit=nearestCurveSegment(source,[12,22]);
  assert.equal(hit.index,3);assert.ok(hit.distance<1e-6);
  const result=addCurveNode(source,3,.5,options);
  assert.deepEqual(curveNodes(result).map(n=>n.point),[[10,20],[14,20],[14,24],[12,22]]);
  assert.equal(result.closed,true);
});

test('EPS keeps cubic commands after add, move and delete; raster and unsafe artwork are refused',()=>{
  const source=vector([['M',0,0],['C',1,2,3,2,4,0],['C',5,-1,6,0,7,0]]);
  const added=addCurveNode(source,1,.5,options),moved=moveCurveNode(added,1,[2,2],options),removed=deleteCurveNode(moved,1,options);
  assert.equal(removed.commands.filter(c=>c[0]==='C').length,2);
  assert.match(exportEps({width:20,height:20,paths:[removed]}),/ C$/m);
  assert.throws(()=>curveNodes({kind:'image'}),/Изображение/);
  assert.throws(()=>addCurveNode(source,1,0,options),/между/);
  assert.throws(()=>moveCurveNode(source,0,[NaN,1],options),/координата/);
  assert.throws(()=>moveCurveNode({...source,artwork:'<g><path/><path/></g>'},0,[1,1],options),/без потери/);
});
