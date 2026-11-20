import {readFileSync} from 'node:fs';
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

test('alpha57 setting applies only through explicit button in both preview flows',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(html,/id="separate-coincident" type="checkbox" checked/);
 assert.equal(app.match(/settingChecked\('separate-coincident'\)\?/g).length,2);
 assert.match(app,/const next=readSettingsForm\(\),error=validateSettingsDraft\(next\)/);
});

test('auto separation spreads close nonadjacent branches by less than the full tolerance',()=>{
 const nearby=points.map((p,i)=>i===5?[0,.006]:p);
 const original=doc(vector(nearby));
 const {document,stats}=separateCoincidentNonadjacentNodes(original,[0],.01,{Parser:DOMParser,includeNearby:true});
 assert.equal(stats.separatedNearby,1);
 assert.ok(stats.movedMm<.01);
 const nodes=curveNodes(document.paths[0]);
 assert.ok(Math.hypot(nodes[1].point[0]-nodes[5].point[0],nodes[1].point[1]-nodes[5].point[1])>.01);
 assert.equal(nativeIntersections(document.paths).length,0);
});
