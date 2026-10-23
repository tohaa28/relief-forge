import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planDiagnosticBatches,isSupportedDrop,droppedFiles,MAX_DIAGNOSTIC_POINTS} from '../web/large-file-support.js';
const read=p=>readFileSync(new URL('../web/'+p,import.meta.url),'utf8');
const path=(count,closed=false)=>({closed,points:Array.from({length:count},(_,i)=>[i,i%9])});

test('Small path batch verifies all nodes without truncation',()=>{
  const plan=planDiagnosticBatches([path(28),path(76)], [5,8]);
  assert.equal(plan.batches.length,1);
  assert.equal(plan.partial,false);
  assert.equal(plan.totalPoints,104);
  assert.deepEqual(plan.batches[0].scope,[5,8]);
  assert.deepEqual(plan.batches[0].paths.map(p=>p.points.length),[28,76]);
});
test('Thousands of anchors are scanned in bounded batches with explicit incomplete certification',()=>{
  const plan=planDiagnosticBatches([path(950),path(1100),path(700),path(1450)],[1,3,5,7]);
  assert.ok(plan.batches.length>=3);
  assert.equal(plan.partial,true);
  assert.equal(plan.split,false);
  assert.ok(plan.batches.every(b=>b.points<=MAX_DIAGNOSTIC_POINTS));
  assert.equal(plan.batches.flatMap(b=>b.scope).length,4);
  assert.equal(plan.batches.reduce((n,b)=>n+b.points,0),4200);
});
test('One enormous closed path retains adjacent edges in overlap chunks and refuses full verification',()=>{
  const plan=planDiagnosticBatches([path(10021,true)],[33]);
  assert.equal(plan.partial,true);assert.equal(plan.split,true);
  assert.ok(plan.batches.every(b=>b.points<=2000));
  assert.ok(plan.batches.flatMap(b=>b.paths).every(p=>!p.closed));
  let prev=null;
  for(const b of plan.batches){
    const p=b.paths[0].points;
    if(prev)assert.deepEqual(prev,p[0],'adjacent original edge not lost between windows');
    prev=p.at(-1);
  }
  assert.deepEqual(prev,[10020,10020%9]);
});
test('Unparseable path is reported as skipped and never certified clean',()=>{
  const plan=planDiagnosticBatches([path(10),{points:[[1,2],[NaN,5]]}],[0,1]);
  assert.equal(plan.skipped.length,1);
  assert.equal(plan.covered,1);
  assert.equal(plan.partial,true);
});
test('Drag-and-drop accepts exact supported file extensions, rejecting disguised and multi-file batches',()=>{
  assert.ok(isSupportedDrop({name:'gerb.EPS'}));
  assert.ok(isSupportedDrop({name:'client.epsf'}));
  assert.ok(isSupportedDrop({name:'drawing.svg'}));
  assert.ok(isSupportedDrop({name:'restored.json'}));
  assert.equal(isSupportedDrop({name:'photo.png'}),false);
  assert.equal(isSupportedDrop({name:'virus.eps.exe'}),false);
  assert.deepEqual(droppedFiles({dataTransfer:{files:[{name:'x.EPS'},{name:'bad.jpg'}]}}).map(x=>x.name),['x.EPS']);
});
test('Large EPS has visible stage, percent, cancellation, user-facing partial notice, and drop overlay',()=>{
  const app=read('app.js'),html=read('index.html'),css=read('style.css');
  for(const id of ['task-status','task-stage','task-progress','task-percent','task-count','drop-overlay'])
    assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(app,/function progressStage\(stage,percent,detail=''\)/);
  assert.match(app,/async function runProgressiveDiagnostics\(indices,tolerance\)/);
  assert.match(app,/async function buildLargeUnifiedPreview\(indices\)/);
  assert.match(app,/async function saveEpsWithPreflight\(\)/);
  assert.match(app,/const plan=planDiagnosticBatches\(contours,scope\)/);
  assert.match(app,/complete=!plan.partial&&!unreadable.length/);
  assert.match(app,/if\(plan.batches.length===1&&!plan.partial\)/);
  assert.match(app,/showEpsSaveWarning\(epsSaveDecision\(\{/);
  assert.match(app,/window.addEventListener\('dragover'/);
  assert.match(app,/window.addEventListener\('drop'/);
  assert.match(app,/file.stream\(\).getReader\(\)/);
  assert.match(app,/origin='dialog'/);
  assert.match(app,/file.name,true\)/);
  assert.match(css,/\.drop-overlay\[hidden\]\{display:none\}/);
  assert.match(css,/#busy.compact #import-progress\{display:block/);
});
