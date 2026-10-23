import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {repairVectorPoints} from '../web/point-repair.js';
import {smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {refitBooleanUnion} from '../web/union-refit.js';
import {protectPreviewNodeBudget,realNodeCount} from '../web/preview-node-budget.js';
import {sampledContours,importRichSvg} from '../web/rich-svg.js';
import {diagnoseAfterDocument} from '../web/after-diagnostics.js';
import {exportEps,exportColoredEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {recoverOutlineOnlyEps} from '../web/eps-pipeline.js';
const rect=(x,y,w,h)=>[['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']];
// A negative-winding inner ring must survive as a hole in the true Union.
const commands=[...rect(0,0,20,20),...rect(10,0,20,20),['M',2,2],['L',2,6],['L',6,6],['L',6,2],['Z']];
const fixture={format:'relief-forge',version:1,width:40,height:30,paths:[{kind:'vector',closed:true,offset:[0,0],commands,
 points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),paint:{fill:'#222222',stroke:'none'},artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'"/>'}]};
const source=process.env.VERIFY_PROJECT?JSON.parse(fs.readFileSync(process.env.VERIFY_PROJECT,'utf8')):fixture;
const frozen=structuredClone(source),indices=source.paths.map((_,i)=>i),tolerance=Number(process.env.VERIFY_TOLERANCE||.02),timings={};
const measure=(name,fn)=>{const t=performance.now(),result=fn();timings[name]=Math.round(performance.now()-t);return result;};
const repaired=measure('repair',()=>repairVectorPoints(source,indices,.01));
const optimized=measure('smoothOptimize',()=>smoothAndOptimizePaths(repaired.document,indices,.05,tolerance,.01));
const merged=measure('union',()=>mergeOverlappingObjects(optimized.document,{indices,tolerance:.01,cleanupTolerance:tolerance}));
const refitted=measure('refit',()=>refitBooleanUnion(merged.document,tolerance));
const budget=protectPreviewNodeBudget(source,optimized.document,refitted.document);
assert.equal(budget.reason,null,'the reference scene must actually apply Union');
assert.ok(merged.stats.normalizedObjects+merged.stats.weldedGroups>0);
assert.ok(budget.final<=budget.before);
const C=globalThis.ClipperLib,scale=100000;
function shape(document,{outline=false}={}){
 const normalized=[];
 for(const p of document.paths){
  const polygons=sampledContours(p,.0005).map(c=>{assert.equal(c.closed,true);return c.points.map(([x,y])=>({X:Math.round(x*scale),Y:Math.round(y*scale)}));});
  const clip=new C.Clipper(C.Clipper.ioStrictlySimple),out=new C.Paths();clip.AddPaths(polygons,C.PolyType.ptSubject,true);
  if(outline){normalized.push(...polygons);continue;}
  const rule=p.paint?.fillRule==='evenodd'?C.PolyFillType.pftEvenOdd:C.PolyFillType.pftNonZero;
  assert.ok(clip.Execute(C.ClipType.ctUnion,out,rule,rule));normalized.push(...out);
 }
 const clip=new C.Clipper(C.Clipper.ioStrictlySimple),tree=new C.PolyTree();clip.AddPaths(normalized,C.PolyType.ptSubject,true);
 const rule=outline?C.PolyFillType.pftEvenOdd:C.PolyFillType.pftNonZero;
 assert.ok(clip.Execute(C.ClipType.ctUnion,tree,rule,rule));
 const topology={outer:0,holes:0},rings=[];let perimeter=0;
 const visit=node=>{for(const child of node.Childs()){const ring=child.Contour();if(ring.length>=3){topology[child.IsHole()?'holes':'outer']++;rings.push(ring);ring.forEach((p,i)=>{const q=ring[(i+1)%ring.length];perimeter+=Math.hypot(p.X-q.X,p.Y-q.Y)/scale;});}visit(child);}};visit(tree);
 return {topology,rings,perimeter};
}
const reference=shape(merged.document),final=shape(budget.document);
if(!process.env.VERIFY_PROJECT)assert.deepEqual(final.topology,{outer:1,holes:1});assert.deepEqual(final.topology,reference.topology,'refit preserves every outer component and hole');
const xor=new C.Clipper(),difference=new C.Paths();xor.AddPaths(reference.rings,C.PolyType.ptSubject,true);xor.AddPaths(final.rings,C.PolyType.ptClip,true);
assert.ok(xor.Execute(C.ClipType.ctXor,difference,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero));
const xorArea=difference.reduce((n,r)=>n+Math.abs(C.Clipper.Area(r))/scale**2,0),areaBudget=Math.max(1e-8,reference.perimeter*tolerance*2);
assert.ok(xorArea<=areaBudget,'refit filled silhouette must remain within perimeter/tolerance area budget');
const {instance}=await WebAssembly.instantiate(fs.readFileSync('web/engine.wasm'),{}),e=instance.exports;
const runBatch=async input=>{const ptr=e.input_alloc(input.length);new Float64Array(e.memory.buffer,ptr,input.length).set(input);assert.equal(e.run(ptr,input.length),0);return JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,e.result_ptr(),e.result_len())));};
const before=await diagnoseAfterDocument(source,.01,{runBatch}),t=performance.now(),after=await diagnoseAfterDocument(budget.document,.01,{runBatch});timings.diagnose=Math.round(performance.now()-t);
assert.equal(after.complete,true,'regression scene must have complete diagnostic coverage');assert.equal(after.issues.length,0);
const outline={source:'outline',content:exportEps(budget.document)},rgb=exportColoredEps(budget.document,{Parser:DOMParser});
verifyEpsOutputGeometry(budget.document,outline);verifyEpsOutputGeometry(budget.document,rgb);
const reopened=recoverOutlineOnlyEps(new TextEncoder().encode(outline.content));assert.ok(reopened?.svg);
const doc=importRichSvg(reopened.svg,{unitsPerInch:72,Parser:DOMParser});assert.equal(realNodeCount(doc),budget.final);
const roundtrip=await diagnoseAfterDocument(doc,.01,{runBatch});assert.equal(roundtrip.issues.length,0);assert.equal(roundtrip.complete,true);
assert.deepEqual(shape(doc,{outline:true}).topology,final.topology,'unpainted EPS wires retain nested hole geometry');assert.deepEqual(source,frozen);
if(process.env.UNION_OUTPUT)fs.writeFileSync(process.env.UNION_OUTPUT,outline.content);
console.log(JSON.stringify({status:'PASS Union/holes/silhouette/real-WASM/EPS-roundtrip',beforeNodes:budget.before,preUnionNodes:budget.optimized,afterNodes:budget.final,beforeIssues:before.issues.length,afterIssues:after.issues.length,complete:after.complete,topology:final.topology,xorAreaMm2:xorArea,areaBudgetMm2:areaBudget,timingsMs:timings}));
