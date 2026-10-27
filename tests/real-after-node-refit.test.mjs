import test from 'node:test';
import assert from 'node:assert/strict';
import {refitBooleanUnion,isUnchangedUnion} from '../web/union-refit.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {curveNodes} from '../web/curve-edit.js';
import {exportEps} from '../web/eps-export.js';
import {readFileSync} from 'node:fs';

const commands=(coords)=>[['M',...coords[0]],...coords.slice(1).map(([x,y])=>['L',x,y]),['Z']];
const path=(cmds,flattened=true)=>({
  kind:'vector',closed:true,offset:[0,0],unionFlattened:flattened,
  commands:cmds,points:cmds.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  paint:{fill:'#222222',stroke:'none',fillRule:'evenodd'},
  artwork:'<path d="'+cmds.map(c=>c.join(' ')).join(' ')+'" fill="none" stroke="#222"/>'
});
const doc=(paths)=>({format:'relief-forge',version:1,width:100,height:100,paths,sourceFileName:'8048531.eps'});
const circle=Array.from({length:180},(_,i)=>{
  const a=Math.PI*2*i/180;return [40+17*Math.cos(a),40+17*Math.sin(a)];
});
const nodeCount=p=>p.commands.filter(c=>['M','L','C','Q'].includes(c[0])).length;

test('post-Union refit removes many artificial L vertices and returns actual cubic anchors',()=>{
  const before=doc([path(commands(circle))]);
  const source=structuredClone(before);
  const result=refitBooleanUnion(before,.04);
  assert.deepEqual(before,source,'refit must not mutate source');
  assert.equal(result.stats.originalNodes,180);
  assert.ok(result.stats.finalNodes<120,
    'real optimizer should reduce curve anchors, got '+result.stats.finalNodes);
  assert.ok(result.stats.cubicSegments>0,'curved silhouette should use cubic Bézier segments');
  assert.equal(curveNodes(result.document.paths[0]).length,nodeCount(result.document.paths[0]),
    'node editor shows exact command endpoints, not flattened sampling points');
  assert.equal(result.stats.finalNodes,nodeCount(result.document.paths[0]));
  assert.equal(isUnchangedUnion(result.document.paths[0]),true);
  assert.ok(result.stats.maxDeviationEstimate<=.04,'bounded fit budget');
  assert.match(exportEps(result.document),/%!PS-Adobe/);
});

test('post-Union optimization improves with adjustable tolerance and does not multiply nodes',()=>{
  const input=doc([path(commands(circle))]);
  const tight=refitBooleanUnion(input,.002);
  const loose=refitBooleanUnion(input,.12);
  assert.ok(loose.stats.finalNodes<=tight.stats.finalNodes,
    'stronger tolerance must not increase number of real anchors');
  assert.ok(tight.stats.finalNodes<=180);
  const again=refitBooleanUnion(loose.document,.12);
  assert.ok(again.stats.finalNodes<=loose.stats.finalNodes);
  assert.ok(again.stats.originalNodes===loose.stats.finalNodes);
});

test('untouched original cubic paths remain cubic and are not converted to sample polylines',()=>{
  const cubic={...path([['M',0,0],['C',10,0,10,10,20,10],['L',0,10],['Z']],false)};
  const r=refitBooleanUnion(doc([cubic]),.1);
  assert.equal(r.stats.refitPaths,0);
  assert.deepEqual(r.document.paths[0].commands,cubic.commands);
});

test('changed Bézier nodes invalidate cached union stamp; untouched nodes do not',()=>{
  const c=refitBooleanUnion(doc([path(commands(circle))]),.05).document.paths[0];
  assert.ok(isUnchangedUnion(c));
  const altered=structuredClone(c);
  altered.commands[1][altered.commands[1].length-1]+=.5;
  assert.equal(isUnchangedUnion(altered),false);
});

test('Union output is refitted in AFTER, opening node editor commits that exact snapshot with Undo',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const overlap=readFileSync(new URL('../web/overlap-merge.js',import.meta.url),'utf8');
  assert.match(app,/refitBooleanUnion\(merged\.document,optimizationTolerance\)/);
  assert.match(app,/let budget=protectPreviewNodeBudget\(doc,merged\.safeDocument,optimized\.document\)/);
  assert.match(app,/const after=filtered\.document/);
  assert.match(app,/removeTinyClosedSubpaths\(budget\.document/);
  assert.match(app,/if\(curvePreview&&compareStage==='after'\)/);
  assert.match(app,/!applyUnifiedChanges\(\)/);
  assert.match(app,/mode='nodes';nodeTool='move'/);
  assert.match(app,/curveNodesTyped\(p\)/);
  assert.match(app,/actualNodesBefore:actualCount\(doc\)/);
  assert.match(app,/actualNodesAfter:actualCount\(after\)/);
  assert.match(app,/checkPreviewAfter\(pv\)/);
  assert.match(app,/prepareEpsOutput\(chosen\.document\)/);
  assert.match(overlap,/isUnchangedUnion\(path\)/);
  assert.match(overlap,/nativeUnionProof:welded.proof/);
});

test('native Union keeps the exact AFTER and bypasses polygon refit',()=>{
  const p=(x)=>path(commands([[x,0],[x+10,0],[x+10,10],[x,10]]),false);
  const src=doc([p(0),p(5)]);
  const merged=mergeOverlappingObjects(src,{tolerance:.02,cleanupTolerance:.02});
  assert.equal(merged.document.paths.length,1);
  assert.equal(merged.document.paths[0].nativeUnionProof.kind,'native-bezier-union-v1');
  const result=refitBooleanUnion(merged.document,.04);
  assert.ok(result.stats.finalNodes<=result.stats.originalNodes);
  assert.equal(result.stats.refitPaths,0);
  assert.deepEqual(result.document.paths[0].commands,merged.document.paths[0].commands);
  assert.equal(curveNodes(result.document.paths[0]).length,
    nodeCount(result.document.paths[0]));
});
