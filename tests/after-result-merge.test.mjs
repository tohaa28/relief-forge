import test from 'node:test';
import assert from 'node:assert/strict';
import {chooseAfterSnapshot,afterSaveDecision,afterSaveMessage} from '../web/after-result.js';
import {diagnoseAfterDocument} from '../web/after-diagnostics.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {exportEps} from '../web/eps-export.js';

const settings={diagnosticTolerance:.01,smoothingAmount:.05,optimizationTolerance:.02,mergeOverlaps:true};
const plain=(pts,closed=false,paint)=>({kind:'vector',closed,points:pts,paint});
const doc=paths=>({format:'relief-forge',version:1,width:100,height:100,sourceFileName:'client.eps',paths});
const rect=(x,y,w,h,paint={fill:'#cc0000',stroke:'none'})=>
  plain([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],true,paint);
function preview(before,after,issues,complete=true){
  return {source:structuredClone(before),result:after,hasGeometryChange:true,
    stats:{tolerance:settings.optimizationTolerance,
      diagnosticTolerance:settings.diagnosticTolerance,
      smoothingAmount:settings.smoothingAmount,mergeOverlaps:true},
    comparisonData:{afterIssues:issues},afterDiagnosed:true,
    afterDiagnosticComplete:complete,afterScope:'full'};
}

test('a repaired but imperfect AFTER document is saved unchanged after an explicit warning',()=>{
 const before=doc([plain([[0,0],[10,0]])]),
   after=doc([plain([[0,0],[20,0]])]);
 const original=structuredClone(before),p=preview(before,after,[{point:[11,0],kind:'short'}]);
 const chosen=chooseAfterSnapshot(before,p,settings,null,null);
 assert.equal(chosen.valid,true);assert.equal(chosen.document,after);
 assert.equal(afterSaveDecision(chosen).action,'warn');
 assert.match(afterSaveMessage(afterSaveDecision(chosen)),/результат ПОСЛЕ/);
 assert.notEqual(exportEps(chosen.document),exportEps(before));
 assert.deepEqual(before,original);
 const clean=preview(before,after,[],true);
 assert.equal(afterSaveDecision(chooseAfterSnapshot(before,clean,settings,null,null)).action,'save');
 assert.equal(afterSaveDecision(chooseAfterSnapshot(before,preview(before,after,[],false),settings,null,null)).action,'warn');
 assert.equal(chooseAfterSnapshot(before,p,{...settings,mergeOverlaps:false},null,null).valid,false);
 assert.equal(chooseAfterSnapshot({...before,width:101},p,settings,null,null).valid,false);
});

test('cached AFTER diagnostic locates unresolved issues on correct source objects',async()=>{
 const d=doc([plain([[0,0],[10,0]]),plain([[0,20],[10,20]])]);
 let calls=0;
 const report=await diagnoseAfterDocument(d,.01,{
   runBatch:async input=>{
     calls++;assert.equal(input[3],2);
     return {diagnosticComplete:true,issues:[{path:1,other:1,point:[5,20],kind:'short'}]};
   }
 });
 assert.equal(calls,1);
 assert.equal(report.complete,true);
 assert.deepEqual(report.issues.map(x=>[x.path,x.other,x.point]),[[1,1,[5,20]]]);
 const huge=doc([plain(Array.from({length:3000},(_,i)=>[i*.01,0]))]);
 let blocks=0;
 const partial=await diagnoseAfterDocument(huge,.01,{
   runBatch:async()=>{blocks++;return {diagnosticComplete:true,issues:[]};}
 });
 assert.ok(blocks>=2);assert.equal(partial.complete,false);
});

test('true union of overlapping filled rectangles removes interior boundaries',()=>{
 const before=doc([rect(0,0,10,10),rect(5,0,10,10)]);
 const original=structuredClone(before);
 const {document,stats}=mergeOverlappingObjects(before);
 assert.equal(stats.before,2);assert.equal(stats.after,1);
 assert.equal(stats.weldedGroups,1);
 const commands=document.paths[0].commands;
 const xs=commands.filter(c=>c[0]!=='Z').map(c=>c[1]);
 assert.equal(Math.min(...xs),0);assert.equal(Math.max(...xs),15);
 const ps=exportEps(document);
 assert.match(ps,/%!PS-Adobe/);
 assert.deepEqual(before,original,'boolean union must never mutate original document');
});

test('identical Bezier geometry is deduplicated without replacing cubic handles',()=>{
 const c=[['M',1,1],['C',2,5,8,5,10,1],['L',1,1],['Z']];
 const path={kind:'vector',commands:c,offset:[0,0],closed:true,
   points:c.filter(x=>x[0]!=='Z').map(x=>x.slice(-2)),
   artwork:'<path d="M1 1C2 5 8 5 10 1L1 1Z" fill="none" stroke="#222"/>',
   paint:{fill:'none',stroke:'#222',strokeWidthMm:.1}};
 const d=doc([structuredClone(path),structuredClone(path)]);
 const r=mergeOverlappingObjects(d);
 assert.equal(r.document.paths.length,1);
 assert.equal(r.stats.removedExact,1);
 assert.deepEqual(r.document.paths[0].commands,c);
});

test('crossing cubic objects become one editable compound object while keeping both cubics',()=>{
 const a={kind:'vector',closed:false,offset:[0,0],
   commands:[['M',0,0],['C',3,0,7,10,10,10]],
   points:[[0,0],[10,10]],artwork:'<path d="M0 0 C3 0 7 10 10 10" fill="none" stroke="#222"/>',
   paint:{fill:'none',stroke:'#222',strokeWidthMm:.1}};
 const b={...structuredClone(a),commands:[['M',0,10],['C',3,10,7,0,10,0]],
   points:[[0,10],[10,0]]};
 b.artwork='<path d="M0 10 C3 10 7 0 10 0" fill="none" stroke="#222"/>';
 const r=mergeOverlappingObjects(doc([a,b]));
 assert.equal(r.document.paths.length,1);
 assert.equal(r.stats.compoundGroups,1);
 assert.equal(r.document.paths[0].commands.filter(x=>x[0]==='C').length,2);
 assert.equal(r.document.paths[0].commands.filter(x=>x[0]==='M').length,2);
});

test('disjoint and differently colored objects are never merged',()=>{
 const a=rect(0,0,10,10),b=rect(20,0,10,10),
   c=rect(5,0,10,10,{fill:'#00ff00',stroke:'none'});
 const r=mergeOverlappingObjects(doc([a,b,c]));
 assert.equal(r.document.paths.length,3);
});

test('changing selected object scope invalidates cached AFTER before export',()=>{
 const before=doc([rect(0,0,10,10),rect(20,0,10,10)]),after=structuredClone(before);
 const p=preview(before,after,[]);p.stats.scope=[0];
 assert.equal(chooseAfterSnapshot(before,p,{...settings,scope:[0]},null,null).valid,true);
 assert.equal(chooseAfterSnapshot(before,p,{...settings,scope:[1]},null,null).valid,false);
 assert.equal(chooseAfterSnapshot(before,p,{...settings,scope:[0,1]},null,null).valid,false);
});

test('selected-only Union leaves an unselected filled compound byte-identical',()=>{
 const first=rect(50,50,10,10),a=rect(0,0,10,10),b=rect(5,0,10,10);
 const cmds=[...a.points.map((v,i)=>[i?'L':'M',...v]),['Z'],...b.points.map((v,i)=>[i?'L':'M',...v]),['Z']];
 const compound={kind:'vector',closed:true,offset:[0,0],commands:cmds,
  points:cmds.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),paint:{fill:'#cc0000',stroke:'none'},
  artwork:'<path d="'+cmds.map(c=>c.join(' ')).join(' ')+'"/>'};
 const src=doc([first,compound]),copy=structuredClone(src);
 const selected=mergeOverlappingObjects(src,{indices:[0]});
 assert.deepEqual(selected.document.paths[1],compound);assert.deepEqual(src,copy);
 assert.equal(selected.stats.normalizedObjects,0);
 const all=mergeOverlappingObjects(src);
 assert.equal(all.stats.normalizedObjects,1);assert.notDeepEqual(all.document.paths[1].commands,compound.commands);
});
