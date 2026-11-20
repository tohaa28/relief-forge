import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeferredCurveEditor} from '../web/deferred-curve-editor.js';
import {smoothVectorPath,smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {validateCurveChange,validateDocumentCurveChange} from '../web/curve-quality.js';
import {geometryCommands,exportEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {manualVectorBounds} from '../web/manual-viewport-performance.js';

const path=(commands,offset=[0,0])=>({kind:'vector',commands,offset,closed:false,
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),artwork:'<path/>',
  paint:{fill:'none',stroke:'#123456',opacity:1,strokeWidthMm:.1}});
const bent=()=>path([['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]],[10,20]);

test('viewport bounds include translated Bézier handles outside the endpoint rectangle',()=>{
  const arch=path([['M',0,0],['C',0,30,10,30,10,0]],[50,60]);
  assert.deepEqual(manualVectorBounds(arch),{x0:50,y0:60,x1:60,y1:90});
  assert.equal(manualVectorBounds({kind:'image'}),null);
});

test('smoothing a translated Bézier changes real handles while retaining world anchors, paint and source',()=>{
  const source=bent(),copy=structuredClone(source),r=smoothVectorPath(source,.05);
  assert.ok(r.changed>0,JSON.stringify(r.quality));
  assert.deepEqual(geometryCommands(r.path).map(c=>c.slice(-2)),geometryCommands(source).map(c=>c.slice(-2)));
  assert.notDeepEqual(geometryCommands(r.path),geometryCommands(source));
  assert.deepEqual(r.path.paint,source.paint);assert.deepEqual(source,copy);
  assert.equal(r.quality.accepted,true);
  const document={width:40,height:40,paths:[source]};
  const out=smoothAndOptimizePaths(document,[0],.05,.00001);
  assert.ok(out.stats.smoothed>0,JSON.stringify(out.stats.quality));
  const eps=exportEps(out.document);
  assert.equal(verifyEpsOutputGeometry(out.document,{content:eps,source:'outline'}).realNodes,3);
});

test('curve quality compares world geometry: offset-only movement is rejected, equivalent encoding is accepted',()=>{
  const original=bent(),moved=structuredClone(original);moved.offset[0]+=2;
  assert.equal(validateCurveChange(original,moved).accepted,false,'same local commands do not mean same world curve');
  const world=path(geometryCommands(original));
  assert.equal(validateCurveChange(original,world).accepted,true);
  const before={paths:[original]},after={paths:[world]};
  assert.equal(validateDocumentCurveChange(before,after).accepted,true,'do not add the offset twice in document verification');
});

test('bounded viewport query selects nearest hulls and caches strings; local edits and Undo invalidate just affected segments',()=>{
  const commands=[['M',0,0]];
  for(let i=1;i<=4000;i++)commands.push(['C',i-.7,0,i-.3,1,i,0]);
  const source=path(commands,[10,20]),editor=createDeferredCurveEditor(source);
  const first=editor.visibleSegmentSVG([2010,20],10000,{limit:40});
  assert.equal(first.length,40);
  assert.ok(first.every(v=>Math.abs(v.index-2000)<=21),'nearest controls, not first commands');
  assert.ok(editor.segmentIndexStats().lastVisibleSerialized<=40);
  assert.deepEqual(editor.visibleSegmentSVG([2010,20],10000,{limit:40}),first);
  assert.equal(editor.segmentIndexStats().lastVisibleSerialized,0);
  editor.moveAnchor(2000,[2010,20.2]);
  const changed=editor.visibleSegmentSVG([2010,20],10000,{limit:40});
  assert.notDeepEqual(changed,first);
  assert.ok(editor.segmentIndexStats().lastVisibleSerialized<=2);
  assert.ok(editor.undoLocal());
  assert.deepEqual(editor.visibleSegmentSVG([2010,20],10000,{limit:40}),first);
  assert.deepEqual(source.commands,commands,'viewport queries and editor operations never mutate the source');
});
