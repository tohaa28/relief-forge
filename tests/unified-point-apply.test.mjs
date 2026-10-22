import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {repairVectorPoints} from '../web/point-repair.js';
import {selectedVectorIndices,smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {worldData} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('the actual unified preview and Apply commit point repairs even when smoothing is zero',()=>{
  const commands=[['M',0,0],['L',0,0],['C',1,0,2,1,3,1]];
  const source={width:10,height:10,sourceFileName:'client.eps',paths:[{
    kind:'vector',artwork:'<path/>',commands,offset:[0,0],closed:false,
    points:commands.map(c=>c.slice(-2))
  }]};
  const elements={'selection-only':{checked:true},'smoothing-amount':{value:'0'},
    'optimization-tolerance':{value:'0.00001'},tolerance:{value:'0.01'},'optimization-result':{}};
  const changes=[],past=[],history=[];
  const context={doc:structuredClone(source),selected:new Set(),issues:[{kind:'short'}],
    diagnosticComplete:true,busy:false,ready:false,curvePreview:null,curveEditing:()=>false,
    $:id=>elements[id],clone:structuredClone,repairVectorPoints,selectedVectorIndices,
    smoothAndOptimizePaths,worldData,render:()=>{},record:()=>{},status:()=>{},
    checkpoint:before=>past.push(structuredClone(before)),updateFileHistory:patch=>history.push(patch)};
  context.changed=action=>{changes.push(action);context.curvePreview=null;};
  vm.createContext(context);
  const start=app.indexOf('function buildUnifiedPreview()');
  const finish=app.indexOf('function requestRecalculation()',start);
  vm.runInContext(app.slice(start,finish),context);
  const beforeEps=exportEps(source);
  context.buildUnifiedPreview();
  assert.equal(context.curvePreview.stats.pointRepairs.removedNodes,1);
  assert.equal(context.curvePreview.stats.smoothedJoints,0);
  assert.equal(context.curvePreview.hasGeometryChange,true);
  assert.deepEqual(context.doc,source);
  assert.equal(exportEps(context.doc),beforeEps,'export before Apply still uses original');
  assert.match(elements['optimization-result'].textContent,/Точки:.*1/);
  context.curvePreview.afterDiagnosed=true;
  context.curvePreview.afterDiagnosticComplete=true;
  context.applyUnifiedChanges();
  assert.equal(changes[0],'unified-apply');
  assert.deepEqual(past,[source],'point repair receives the same Undo checkpoint as smoothing');
  assert.notEqual(exportEps(context.doc),beforeEps);
  assert.equal(context.doc.paths[0].commands.filter(c=>c[0]==='C').length,1);
  assert.equal(history[0].repair.before,1);
  assert.equal(history[0].repair.after,0);
  context.doc=past.pop();
  assert.equal(exportEps(context.doc),beforeEps,'Undo restores exact original EPS geometry');
});
