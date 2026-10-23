import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {epsSaveCandidate,epsSaveDecision,epsSaveWarningText} from '../web/eps-save-flow.js';
import {exportEps} from '../web/eps-export.js';

const settings={diagnosticTolerance:.01,smoothingAmount:.08,optimizationTolerance:.03};
function doc(){return {format:'relief-forge',version:1,width:80,height:40,sourceFileName:'user-original.eps',
  paths:[{closed:false,points:[[1,1],[20,1],[20,25]]}]};}
function preview(original,after=doc()){
 return {source:structuredClone(original),result:after,hasGeometryChange:true,
   stats:{tolerance:settings.optimizationTolerance,diagnosticTolerance:settings.diagnosticTolerance,
     smoothingAmount:settings.smoothingAmount}};
}

test('only a complete, full-document zero-issue scan permits automatic EPS commit',()=>{
  assert.deepEqual(epsSaveDecision({complete:true,fullScope:true,issueCount:0},true),
    {action:'apply-and-save',count:0,verified:true});
  assert.deepEqual(epsSaveDecision({complete:true,fullScope:true,issueCount:0},false),
    {action:'save',count:0,verified:true});
  assert.equal(epsSaveDecision({complete:true,fullScope:true,issueCount:2},true).action,'warn');
  assert.equal(epsSaveDecision({complete:false,fullScope:true,issueCount:0},true).action,'warn');
  assert.equal(epsSaveDecision({complete:true,fullScope:false,issueCount:0},true).action,'warn');
  assert.equal(epsSaveDecision({complete:true,fullScope:true,issueCount:null},true).action,'warn');
  assert.equal(epsSaveDecision({complete:true,fullScope:true,issueCount:null},true).verified,false);
  assert.match(epsSaveWarningText(epsSaveDecision({complete:true,fullScope:true,issueCount:21},true)),/21 замечание/);
  assert.match(epsSaveWarningText(epsSaveDecision({complete:true,fullScope:true,issueCount:12},true)),/12 замечаний/);
  assert.match(epsSaveWarningText(epsSaveDecision({complete:true,fullScope:true,issueCount:3},true)),/3 замечания/);
  assert.match(epsSaveWarningText(epsSaveDecision({complete:false,fullScope:true,issueCount:0},true)),/Не удалось полностью проверить/);
});

test('candidate uses actual result only for current geometry and matching tolerances',()=>{
  const before=doc(),after=doc();
  after.paths[0].points[1]=[20,2];
  const p=preview(before,after);
  assert.deepEqual(epsSaveCandidate(before,p,settings),{document:after,autoApply:true,reason:'verified-candidate'});
  const old=structuredClone(before),frozen=structuredClone(p);
  assert.equal(epsSaveCandidate(before,p,{...settings,smoothingAmount:.4}).autoApply,false);
  assert.equal(epsSaveCandidate(before,p,{...settings,optimizationTolerance:.04}).autoApply,false);
  assert.equal(epsSaveCandidate({...before,paths:[{closed:false,points:[[1,1],[20,1],[20,26]]}]},p,settings).autoApply,false);
  assert.equal(epsSaveCandidate(before,{...p,hasGeometryChange:false},settings).autoApply,false);
  assert.equal(epsSaveCandidate(before,null,settings).autoApply,false);
  assert.deepEqual(before,old,'save preflight never mutates document');
  assert.deepEqual(p,frozen,'save preflight never mutates preview');
});

test('save anyway always exports confirmed original geometry, not unchecked preview',()=>{
  const before=doc(),after=doc();after.paths[0].points[1]=[25,9];
  const p=preview(before,after);
  const decision=epsSaveDecision({complete:true,fullScope:true,issueCount:7},true);
  assert.equal(decision.action,'warn');
  assert.notEqual(exportEps(before),exportEps(p.result));
  assert.match(exportEps(before),/%!PS-Adobe/);
});

test('UI warning supports cancel, explicit override, and keeps EPS filename/history',()=>{
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(html,/id="eps-save-warning" class="eps-save-warning"/);
  assert.match(html,/Вернуться к редактированию/);
  assert.match(html,/Сохранить EPS всё равно/);
  assert.match(app,/if\(decision.action==='warn'\)\{showEpsSaveWarning\(decision\);return;\}/);
  assert.match(app,/epsSaveCandidate\(doc,curvePreview,readEpsSaveSettings\(\)\)/);
  assert.match(app,/if\(!fresh.autoApply\)/);
  assert.match(app,/precomputed=prepareEpsOutput\(fresh.document\)/);
  assert.match(app,/if\(!applyUnifiedChanges\(\)\)/);
  assert.match(app,/planDiagnosticBatches\(samples,samples\.map/);
  assert.match(app,/plan\.batches\.length===1&&!plan\.partial/);
  assert.match(app,/if\(!plan\.batches\.length\|\|uncheckedContours\|\|plan\.skipped\.length\)/);
  assert.match(app,/Array\.isArray\(data\.output\?\.issues\)/);
  assert.match(app,/scope:'all-vectors'/);
  assert.match(app,/epsResultFilename\(doc.sourceFileName\|\|doc.epsImport\?\.name\|\|'relief-forge.eps'\)/);
  assert.match(app,/record\('export-eps'/);
});
