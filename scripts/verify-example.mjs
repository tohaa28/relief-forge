import fs from 'node:fs';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {epsProgram,epsMetadata,recoverOutlineOnlyEps} from '../web/eps-pipeline.js';
import {importRichSvg,sampledContours} from '../web/rich-svg.js';
import {smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {repairVectorPoints} from '../web/point-repair.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {refitBooleanUnion} from '../web/union-refit.js';
import {protectPreviewNodeBudget,realNodeCount} from '../web/preview-node-budget.js';
import {exportEps,exportColoredEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {diagnoseAfterDocument} from '../web/after-diagnostics.js';
import {recoverUnpaintedCorelOutlines} from '../web/corel-outline.js';
const input=process.env.VERIFY_EPS||'tests/fixtures/eps/corel-unpainted.eps';
const bytes=fs.readFileSync(input);
const recovered=recoverOutlineOnlyEps(bytes)||recoverUnpaintedCorelOutlines(epsProgram(bytes),epsMetadata(bytes));if(!process.env.VERIFY_PROJECT)assert.ok(recovered?.svg);
const source=process.env.VERIFY_PROJECT?JSON.parse(fs.readFileSync(process.env.VERIFY_PROJECT,'utf8')):importRichSvg(recovered.svg,{unitsPerInch:72,Parser:DOMParser}),snapshot=structuredClone(source);
const {instance}=await WebAssembly.instantiate(fs.readFileSync('web/engine.wasm'),{}),e=instance.exports;
const runBatch=async input=>{const ptr=e.input_alloc(input.length);new Float64Array(e.memory.buffer,ptr,input.length).set(input);assert.equal(e.run(ptr,input.length),0);return JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,e.result_ptr(),e.result_len())));};
const before=await diagnoseAfterDocument(source,.01,{runBatch});
console.log(JSON.stringify({stage:'before',objects:source.paths.length,nodes:realNodeCount(source),issues:before.issues.length,complete:before.complete}));
for(const tolerance of (process.env.VERIFY_TOLERANCES||".005,.02,.046,.1").split(",").map(Number))for(const union of [false,true]){
 const start=performance.now(),indices=source.paths.map((_,i)=>i);
 const repaired=repairVectorPoints(source,indices,.01);
 const optimized=smoothAndOptimizePaths(repaired.document,indices,.05,tolerance,.01).document;
 const merged=union?mergeOverlappingObjects(optimized,{indices,tolerance:.01,cleanupTolerance:tolerance}).document:optimized;
 const refitted=refitBooleanUnion(merged,tolerance).document;
 const result=protectPreviewNodeBudget(source,optimized,refitted);
 const report=await diagnoseAfterDocument(result.document,.01,{runBatch});
 assert.ok(realNodeCount(result.document)<=realNodeCount(source));
 assert.ok(!report.issues.some(i=>i.kind==='open')||before.issues.some(i=>i.kind==='open'));
 for(const mode of ['outline','rgb']){
  const prepared=mode==='outline'?{content:exportEps(result.document),source:'outline'}:exportColoredEps(result.document,{Parser:DOMParser});
  verifyEpsOutputGeometry(result.document,prepared);
  if(mode==='outline'){
   const back=recoverOutlineOnlyEps(new TextEncoder().encode(prepared.content));assert.ok(back?.svg);
   const roundtrip=importRichSvg(back.svg,{unitsPerInch:72,Parser:DOMParser});
   assert.equal(realNodeCount(roundtrip),realNodeCount(result.document));
   assert.equal(roundtrip.paths.flatMap(p=>sampledContours(p,.01)).filter(p=>p.closed).length,result.document.paths.flatMap(p=>sampledContours(p,.01)).filter(p=>p.closed).length);
  }
 }
 assert.deepEqual(source,snapshot);
 console.log(JSON.stringify({tolerance,union,nodes:realNodeCount(result.document),issues:report.issues.length,complete:report.complete,budget:result.reason,ms:Math.round(performance.now()-start)}));
}
