import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {deduplicateExactVectors} from '../web/exact-native-dedup.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {protectPreviewNodeBudget} from '../web/preview-node-budget.js';
import {exportEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {validateDocumentCurveChange} from '../web/curve-quality.js';

const paint={fill:'#16293c',stroke:'none',fillRule:'nonzero',opacity:1};
function vector(commands,color=paint){
 return {kind:'vector',closed:true,offset:[0,0],paint:{...color},commands,
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#16293c"/>'};
}
const bezier=()=>vector([['M',0,0],['C',1,-.5,3,-.5,4,0],['L',4,4],
  ['C',3,4.5,1,4.5,0,4],['Z']]);
const rect=(x,y)=>vector([['M',x,y],['L',x+4,y],['L',x+4,y+4],['L',x,y+4],['Z']]);
const doc=paths=>({width:80,height:40,paths});
test('exact native Bézier copies are removed without introducing any split node',()=>{
 const a=bezier(), b=bezier(),before=doc([a,b]);
 const out=deduplicateExactVectors(before);
 assert.equal(out.stats.removed,1);
 assert.equal(out.stats.removedNodes,4);
 assert.equal(out.document.paths.length,1);
 assert.deepEqual(out.document.paths[0].commands,b.commands);
 assert.deepEqual(before,doc([a,b]),'input remains untouched');
 const eps=exportEps(out.document);
 assert.equal(verifyEpsOutputGeometry(out.document,{content:eps,source:'outline'}).realNodes,4);
});
test('last identical opaque fill dominates an intervening mark, but semitransparent and unselected artwork is protected',()=>{
 const original=bezier(), mark=rect(1,1), last=bezier();
 assert.deepEqual(deduplicateExactVectors(doc([original,mark,last])).keptOriginalIndices,[1,2]);
 assert.equal(deduplicateExactVectors(doc([original,last]),{indices:[0]}).stats.removed,0);
 const half=vector(original.commands,{...paint,opacity:.5});
 assert.equal(deduplicateExactVectors(doc([half,half])).stats.removed,0);
});
test('paint-safe dedup survives later inflated Boolean result rollback',()=>{
 const native=bezier(),source=doc([native,structuredClone(native)]);
 const merged=mergeOverlappingObjects(source,{tolerance:.01});
 assert.equal(merged.stats.exactRemoved,1);
 assert.equal(merged.safeDocument.paths.length,1);
 assert.deepEqual(merged.safeDocument.paths[0].commands,native.commands);
 const inflated=doc([vector([['M',0,0],...Array.from({length:500},(_,i)=>['L',i/10,Math.sin(i/10)]),['Z']])]);
 const budget=protectPreviewNodeBudget(source,merged.safeDocument,inflated);
 assert.equal(budget.reason,'union-node-growth');
 assert.equal(budget.document.paths.length,1);
 assert.deepEqual(budget.document.paths[0].commands,native.commands);
});
test('original selected indices survive dedup and group replacement',()=>{
 const same=bezier(), src=doc([same,rect(20,0),structuredClone(same)]);
 const r=mergeOverlappingObjects(src,{indices:[0,2]});
 assert.deepEqual(r.selectedIndices,[1]);
 assert.equal(r.document.paths.length,2);
 assert.deepEqual(r.document.paths[1].commands,same.commands);
});
test('large unchanged documents do not fail only because global sampling exceeds 20k points',()=>{
 const long=n=>vector([['M',0,0],...Array.from({length:n},(_,i)=>['L',i*.001,i%2*.001]),['Z']]);
 const input=doc([long(7001),long(7001),long(7001)]);
 const outcome=validateDocumentCurveChange(input,structuredClone(input),{tolerance:.01});
 assert.equal(outcome.accepted,true,JSON.stringify(outcome));
 assert.equal(outcome.scoped,true);
});
test('both preview routes run Union before smoothing, and export uses cached AFTER',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const normal=app.slice(app.indexOf('function buildUnifiedPreview(){'),app.indexOf('function applyUnifiedChanges(){'));
 const large=app.slice(app.indexOf('async function buildLargeUnifiedPreview(indices){'),
  app.indexOf('// After calculation belongs to the immutable optimized result'));
 assert.ok(normal.indexOf('mergeOverlappingObjects(')<normal.indexOf('smoothAndOptimizePaths('));
 assert.ok(large.indexOf('mergeOverlappingObjects(')<large.indexOf('smoothVectorPath('));
 assert.match(normal,/checkPreviewAfter\(pv\)/);
 assert.match(large,/checkPreviewAfter\(pv\)/);
 assert.match(app,/prepareEpsOutput\(chosen.document\)/);
});

test('source-dominant Union retains the exact original cubic when a smaller filled object lies inside',()=>{
 const large=bezier();
 const little=vector([['M',1,1],['L',2,1],['L',2,2],['L',1,2],['Z']]);
 const input=doc([large,little]);
 const result=mergeOverlappingObjects(input,{tolerance:.01});
 assert.equal(result.stats.weldedGroups,1);
 assert.equal(result.document.paths.length,1);
 assert.deepEqual(result.document.paths[0].commands,large.commands,
   'no new L anchors may be added to existing containing Bezier');
 const eps=exportEps(result.document);
 assert.equal(verifyEpsOutputGeometry(result.document,{content:eps,source:'outline'}).realNodes,4);
});
test('transparent layered artwork is not welded or native-deduplicated',()=>{
 const ink={...paint,opacity:.5};
 const same=vector(bezier().commands,ink);
 const input=doc([same,structuredClone(same)]);
 const r=mergeOverlappingObjects(input,{tolerance:.01});
 assert.equal(r.document.paths.length,2);
 assert.equal(r.stats.weldedGroups,0);
 assert.equal(r.stats.exactRemoved,0);
});
