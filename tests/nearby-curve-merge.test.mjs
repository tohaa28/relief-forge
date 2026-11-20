import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {mergeNearbyGeometry} from '../web/nearby-curve-merge.js';
import {nativeIntersections} from '../web/native-intersections.js';
import {exportEps} from '../web/eps-export.js';

const path=(commands,{paint='black',fill=true,offset=[0,0]}={})=>({
  kind:'vector',offset,commands,closed:commands.at(-1)?.[0]==='Z',
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+
    '" fill="'+(fill?paint:'none')+'" stroke="'+(fill?'none':paint)+'"/>'
});
const doc=paths=>({format:'relief-forge',version:1,width:100,height:100,paths});
const repair=(source,tolerance=.05,options={})=>mergeNearbyGeometry(source,
  source.paths.map((_,i)=>i),tolerance,{Parser:DOMParser,...options});
const rect=(x=0,paint='black')=>path([
  ['M',x,0],['L',x+6,0],['L',x+6,6],['L',x,6],['Z']
],{paint});

test('alpha69: local welding of near-adjacent vertices retains filled contour, colour, EPS and Undo source',()=>{
  const commands=[['M',0,0],['L',8,0],['L',8,.03],['L',8,8],['L',0,8],['Z']];
  const source=doc([path(commands,{paint:'#123456'})]),snapshot=structuredClone(source);
  const after=repair(source,.05);
  assert.deepEqual(source,snapshot,'the preview never mutates the original document');
  assert.equal(after.stats.weldedNodes,1,'one 0.03-mm edge must collapse under 0.05-mm tolerance');
  assert.equal(after.document.paths[0].commands.length,commands.length-1);
  assert.deepEqual(after.document.paths[0].commands.map(c=>c[0]),['M','L','L','L','Z']);
  assert.match(after.document.paths[0].artwork,/fill="#123456"/);
  assert.equal(nativeIntersections([after.document.paths[0]]).filter(h=>h.crossing).length,0);
  assert.match(exportEps(after.document),/@c\nN\n/,'default EPS outline export retains a closed native path');
});
test('alpha69: tight tolerance and disabled selection do not alter geometry',()=>{
  const source=doc([path([['M',0,0],['L',8,0],['L',8,.03],['L',8,8],['L',0,8],['Z']])]);
  assert.equal(repair(source,.005).stats.weldedNodes,0);
  assert.deepEqual(mergeNearbyGeometry(source,[],.05,{Parser:DOMParser}).document,source);
  assert.throws(()=>repair(source,0),/Допуск/);
  assert.throws(()=>repair(source,1.1),/Допуск/);
});
test('alpha69: never weld an entire triangular filled object down to a line',()=>{
  const source=doc([path([['M',0,0],['L',.01,0],['L',0,.01],['Z']])]);
  const after=repair(source,.05);
  assert.deepEqual(after.document,source);
  assert.equal(after.stats.weldedNodes,0);
});
test('alpha69: near-identical same-paint closed curves are truly merged; different fill kept',()=>{
  const a=rect(),b=rect(.012),c=rect(.012,'red');
  const source=doc([a,b,c]),snapshot=structuredClone(source);
  const after=repair(source,.05);
  assert.deepEqual(source,snapshot);
  assert.equal(after.stats.mergedCurves,1);
  assert.equal(after.document.paths.length,2);
  assert.equal(after.document.paths[0].artwork,a.artwork);
  assert.equal(after.document.paths[1].artwork,c.artwork);
  assert.deepEqual(repair(source,.005).document,source);
});
test('alpha69: style and selection must prevent deleting an unselected near-copy',()=>{
  const source=doc([rect(),rect(.01)]);
  const res=mergeNearbyGeometry(source,[0],.05,{Parser:DOMParser});
  assert.deepEqual(res.document,source);
  assert.equal(res.stats.mergedCurves,0);
});
test('alpha69: uniquely paired open strokes become one continuous native contour',()=>{
  const a=path([['M',0,0],['L',1,0]],{fill:false,paint:'#173946'});
  const b=path([['M',1.03,0],['L',2,0]],{fill:false,paint:'#173946'});
  const source=doc([a,b]),after=repair(source,.05);
  assert.equal(after.stats.connectedOpen,1);
  assert.equal(after.document.paths.length,1);
  assert.deepEqual(after.document.paths[0].commands.map(c=>c[0]),['M','L','L']);
  assert.match(after.document.paths[0].artwork,/stroke="#173946"/);
  assert.equal(after.document.paths[0].commands[2][1],2);
});
test('alpha69: crossing ambiguity and deliberately nearby filled shapes are not joined',()=>{
  const a=path([['M',0,0],['L',1,0]],{fill:false});
  const b=path([['M',1.02,0],['L',2,0]],{fill:false});
  const c=path([['M',1.025,0],['L',2,1]],{fill:false});
  const ambiguous=doc([a,b,c]),result=repair(ambiguous,.05);
  assert.equal(result.stats.connectedOpen,0);
  assert.deepEqual(result.document,ambiguous);
  const filled=doc([rect(0),rect(6.025)]);
  assert.equal(repair(filled,.05).document.paths.length,2,
    'a narrow intentional gap between filled shapes is not permission for a Boolean bridge');
});
test('alpha69: staged option and both normal/large previews use the same distance',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(html,/id="merge-nearby" type="checkbox" checked/);
  assert.match(html,/id="merge-nearby-distance" type="number" min="0.0001" max="1"[^>]*value="0.05"/);
  assert.match(html,/id="merge-nearby-strict" type="checkbox" checked/);
  assert.equal((app.match(/mergeNearbyGeometry\(selfHealed.document,/g)||[]).length,2);
  assert.match(app,/const next=readSettingsForm\(\),error=validateSettingsDraft\(next\)/);
  assert.match(app,/const after=nearby.document/);
  assert.match(app,/nearbyOptions:\{enabled:settingChecked\('merge-nearby'\)/);
  assert.match(app,/changed\('curve-session-commit',\{skipDiagnostics:true\}\)/,
    'closing manual node editor still must not trigger a background global diagnostic');
});
