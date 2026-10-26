import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {removeTinyClosedObjects} from '../web/tiny-closed-objects.js';
import {exportEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {chooseAfterSnapshot} from '../web/after-result.js';

const V=commands=>({kind:'vector',closed:commands.at(-1)?.[0]==='Z',offset:[0,0],
  commands,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#202020"/>',
  paint:{fill:'#202020',stroke:'none',fillRule:'nonzero',opacity:1}});
const rect=(x,y,w,h)=>[['M',x,y],['L',x+w,y],['L',x+w,y+h],
 ['L',x,y+h],['Z']];
const doc=paths=>({width:30,height:25,paths,sourceFileName:'source.eps'});
test('default 0.1 x 0.1 mm: prune only closed objects with BOTH strict dimensions smaller',()=>{
 const small=V(rect(0,0,.05,.075)),tall=V(rect(2,0,.05,.11)),
   wide=V(rect(4,0,.11,.05)),open=V(rect(6,0,.02,.02).slice(0,-1)),
   edge=V(rect(8,0,.1,.05));
 const original=doc([small,tall,wide,open,edge]),saved=structuredClone(original);
 const r=removeTinyClosedObjects(original);
 assert.equal(r.stats.removedObjects,1);
 assert.equal(r.stats.removedSubpaths,1);
 assert.equal(r.document.paths.length,4);
 assert.deepEqual(original,saved,'DO must be untouched');
 assert.deepEqual(r.document.paths.map(p=>p.commands),
   [tall,wide,open,edge].map(p=>p.commands));
});
test('independent small closed subpath inside a large compound can be removed without changing all other commands',()=>{
 const outer=rect(1,1,10,10),small=rect(15,15,.06,.08),other=rect(18,1,1,1);
 const compound=V([...outer,...small,...other]);
 const out=removeTinyClosedObjects(doc([compound]));
 assert.equal(out.stats.removedSubpaths,1);
 assert.equal(out.stats.removedObjects,0);
 assert.deepEqual(out.document.paths[0].commands,[...outer,...other]);
 assert.equal(out.document.paths[0].points.length,8);
 const eps=exportEps(out.document);
 const verified=verifyEpsOutputGeometry(out.document,{content:eps,source:'outline'});
 assert.equal(verified.realNodes,8);
});
test('small nested hole within a larger compound is protected even with threshold enabled',()=>{
 const compound=V([...rect(1,1,10,10),...rect(2,2,.05,.05)]);
 const result=removeTinyClosedObjects(doc([compound]));
 assert.deepEqual(result.document.paths[0].commands,compound.commands);
 assert.equal(result.stats.protectedNested,1);
 assert.equal(result.stats.removedSubpaths,0);
});
test('quadratic and cubic bounds use real curve extrema, not only Bézier endpoints',()=>{
 const cubic=V([['M',0,0],['C',0,1,.05,1,.05,0],
   ['L',0,0],['Z']]);
 const quad=V([['M',1,0],['Q',1.05,1,1.1,0],['L',1,0],['Z']]);
 const out=removeTinyClosedObjects(doc([cubic,quad]));
 assert.equal(out.document.paths.length,2);
 const trulySmall=V([['M',0,0],['C',.03,.03,.05,.03,.07,.06],
  ['L',0,0],['Z']]);
 assert.equal(removeTinyClosedObjects(doc([trulySmall])).document.paths.length,0);
});
test('disabled, selected scope and adjustable width/height preserve other vectors',()=>{
 const small=V(rect(0,0,.08,.07)),big=V(rect(1,1,.2,.09));
 const source=doc([small,big]);
 assert.deepEqual(removeTinyClosedObjects(source,{enabled:false}).document,source);
 assert.equal(removeTinyClosedObjects(source,{width:.25,height:.1}).document.paths.length,0);
 assert.equal(removeTinyClosedObjects(source,{indices:[1]}).document.paths.length,2);
 assert.equal(removeTinyClosedObjects(source,{indices:[0]}).document.paths.length,1);
 assert.throws(()=>removeTinyClosedObjects(source,{width:0}),/Габариты/);
});
test('tiny shapes with clipping, image or open geometry remain protected',()=>{
 const masked=V(rect(0,0,.02,.02));masked.artwork='<path d="M0 0L.02 0L.02 .02Z" clip-path="url(#safe)"/>';
 const raster={kind:'image',closed:true,points:[[0,0]],commands:[],artwork:'<image/>'};
 const open=V([['M',0,0],['L',.01,.01]]);
 const result=removeTinyClosedObjects(doc([masked,raster,open]));
 assert.equal(result.document.paths.length,3);
 assert.equal(result.stats.skipped,1);
});
test('EPS refuses stale preview when filter or dimensions change, but accepts matching AFTER',()=>{
 const source=doc([V(rect(0,0,.05,.05)),V(rect(2,2,1,1))]);
 const removed=removeTinyClosedObjects(source);
 const preview={source:structuredClone(source),result:removed.document,
  stats:{diagnosticTolerance:.01,smoothingAmount:.05,tolerance:.02,mergeOverlaps:true,
    scope:[0,1],tinyCleanup:removed.stats}};
 const settings={diagnosticTolerance:.01,smoothingAmount:.05,optimizationTolerance:.02,
   mergeOverlaps:true,scope:[0,1],tinyEnabled:true,tinyWidth:.1,tinyHeight:.1};
 assert.equal(chooseAfterSnapshot(source,preview,settings,null,null).valid,true);
 assert.equal(chooseAfterSnapshot(source,preview,{...settings,tinyWidth:.2},null,null).valid,false);
 assert.equal(chooseAfterSnapshot(source,preview,{...settings,tinyEnabled:false},null,null).valid,false);
});
test('both normal and large EPS routes filter AFTER, without touching original DO or EPS source',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.equal((app.match(/removeTinyClosedObjects\(budget\.document/g)||[]).length,2);
 assert.match(app,/importedComparison\(importedBefore,after\)/);
 assert.match(app,/tinyEnabled:\$\('remove-tiny-closed'\)\.checked/);
 assert.match(app,/tinyWidth:Number\(\$\('tiny-width'\)\.value\)/);
 assert.match(app,/tinyHeight:Number\(\$\('tiny-height'\)\.value\)/);
});
