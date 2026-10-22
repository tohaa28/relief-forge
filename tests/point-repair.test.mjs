import test from 'node:test';
import assert from 'node:assert/strict';
import {repairVectorPoints} from '../web/point-repair.js';
import {sampledContours,worldData} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

const vector=commands=>({kind:'vector',commands,closed:commands.at(-1)[0]==='Z',offset:[3,7],
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),artwork:'<path fill="none" stroke="#34465b"/>'});
const doc=paths=>({format:'relief-forge',version:1,width:40,height:30,paths});

test('diagnostic closure consumes the explicit endpoint once, retaining exact cubic geometry',()=>{
  const path=vector([['M',0,0],['C',1,0,2,1,2,2],['C',0,2,-1,1,0,0],['Z']]);
  const snapshot=structuredClone(path),samples=sampledContours(path,.01)[0];
  assert.equal(samples.closed,true);
  assert.notDeepEqual(samples.points[0],samples.points.at(-1));
  assert.ok(samples.points.length>4,'the closing cubic still contributes its whole arc');
  assert.deepEqual(path,snapshot);
  const near=vector([['M',0,0],['L',2,0],['L',2,2],['L',.001,0],['Z']]);
  assert.deepEqual(sampledContours(near,.01)[0].points.at(-1),[3.001,7],
    'a merely nearby closing endpoint remains a genuine short edge');
  const interior=vector([['M',0,0],['L',2,0],['L',2,0],['L',2,2],['L',0,0],['Z']]);
  assert.equal(sampledContours(interior,.01)[0].points.filter(p=>p[0]===5&&p[1]===7).length,2,
    'real interior coincident nodes must not disappear during diagnosis');
});

test('point repair removes a tiny segment while retaining following C handles and translation',()=>{
  const path=vector([['M',0,0],['L',.002,0],['C',1,0,2,1,3,1]]);
  const source=doc([path]),snapshot=structuredClone(source);
  const result=repairVectorPoints(source,[0],.01);
  assert.equal(result.stats.removedNodes,1);
  assert.deepEqual(result.document.paths[0].commands,[['M',0,0],['C',1,0,2,1,3,1]]);
  assert.deepEqual(result.document.paths[0].offset,[3,7]);
  assert.match(worldData(result.document.paths[0]),/^M3 7C/);
  assert.match(exportEps(result.document),/ C$/m);
  assert.deepEqual(source,snapshot,'unapplied repair must leave original geometry untouched');
});

test('a close-ended cubic loop is never deleted just because its anchors coincide',()=>{
  const source=doc([vector([['M',0,0],['C',3,0,3,3,0,0],['Z']])]);
  const result=repairVectorPoints(source,[0],.01);
  assert.equal(result.stats.removedNodes,0);
  assert.deepEqual(result.document,source);
});

test('native gap closing snaps only the endpoint, preserving all cubic handles and subpaths',()=>{
  const path=vector([['M',0,0],['C',1,0,2,0,2,2],['C',1,3,-1,1,.002,.001],
    ['M',10,10],['L',12,10]]);
  const result=repairVectorPoints(doc([path]),[0],.01);
  assert.equal(result.stats.closedGaps,1);
  assert.deepEqual(result.document.paths[0].commands,[['M',0,0],['C',1,0,2,0,2,2],
    ['C',1,3,-1,1,0,0],['Z'],['M',10,10],['L',12,10]]);
  assert.equal(result.document.paths[0].closed,false,'the last independent subpath remains open');
});

test('point repair preserves excluded and unsupported artwork, ambiguous contours and tiny whole objects',()=>{
  const tiny=vector([['M',0,0],['L',.001,0],['L',.002,0]]);
  const masked={...tiny,artwork:'<g clip-path="url(#clip)"><path/></g>'};
  const source=doc([tiny,masked,{closed:false,points:[[10,0],[12,0]]},
    {closed:false,points:[[12,0],[13,1]]},{closed:false,points:[[12,0],[13,-1]]}]);
  const result=repairVectorPoints(source,[0,1,2,3,4],.01);
  assert.deepEqual(result.document,source);
  assert.equal(result.stats.skipped,1);
  assert.equal(result.stats.removedNodes,0);
  assert.equal(result.stats.closedGaps,0);
  const excluded=repairVectorPoints(doc([vector([['M',0,0],['L',0,0],['L',1,0]])]),[],.01);
  assert.equal(excluded.stats.removedNodes,0);
  assert.throws(()=>repairVectorPoints(source,[0],NaN),/допуск/);
});

test('polyline repairs keep implicit closure canonical without flattening other curves',()=>{
  const original=doc([{closed:true,points:[[0,0],[3,0],[3,3],[0,0]]}]);
  const result=repairVectorPoints(original,[0],.01);
  assert.equal(result.stats.removedNodes,1);
  assert.deepEqual(result.document.paths[0],{closed:true,points:[[0,0],[3,0],[3,3]]});
});
