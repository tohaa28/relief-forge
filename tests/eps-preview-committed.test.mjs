import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {smoothAndOptimizePaths} from '../web/curve-optimizer.js';
import {exportEps} from '../web/eps-export.js';
import {worldData} from '../web/rich-svg.js';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
function fixture(){
  const path={
    kind:'vector',closed:false,offset:[0,0],
    artwork:'<path d="M 0 0 C1 0 2 0 3 0 C4 .1 5 .5 6 .5" fill="none" stroke="#e22"/>',
    points:[[0,0],[3,0],[6,.5]],
    commands:[['M',0,0],['C',1,0,2,0,3,0],['C',4,.1,5,.5,6,.5]]
  };
  return {format:'relief-forge',version:1,width:20,height:15,sourceFileName:'client-original.eps',paths:[path]};
}
const forbidden=/^\s*(?:stroke|fill|eofill|setlinewidth|setrgbcolor|setcmykcolor|setgray)\b/m;

test('smoothing changes Bezier control handles even without deleting an anchor, leaving original and its EPS untouched',()=>{
  const doc=fixture(),frozen=structuredClone(doc);
  const originalPath=worldData(doc.paths[0]);
  const confirmedEps=exportEps(doc);
  const preview=smoothAndOptimizePaths(doc,[0],.15,.00001);
  assert.equal(preview.stats.original,2);
  assert.equal(preview.stats.result,2,'smoothing may be meaningful without reducing node count');
  assert.equal(preview.stats.removed,0);
  assert.ok(preview.stats.smoothed>0,'the real Bezier smoothing kernel must execute');
  assert.ok(preview.stats.estimateCombinedError>0&&preview.stats.estimateCombinedError<.15);
  assert.notEqual(worldData(preview.document.paths[0]),originalPath,'After must use changed control handles');
  assert.deepEqual(doc,frozen,'before Apply, source document must remain bitwise-structurally unchanged');
  assert.equal(exportEps(doc),confirmedEps,'with active preview export the confirmed source, never After');
  assert.notEqual(exportEps(preview.document),confirmedEps,'after an explicit Apply the resulting EPS must differ');
  assert.doesNotMatch(confirmedEps,forbidden,'legacy ArtCAM output must not contain color or print marks');
  assert.doesNotMatch(exportEps(preview.document),forbidden,'applied EPS also remains paintless');
});

test('AFTER always displays remaining errors and saves precisely the cached optimized result',()=>{
  assert.match(html,/<button id="apply-changes" class="primary" disabled>[^]*?Применить изменения<\/button>/);
  assert.match(app,/\$\('apply-changes'\)\.onclick=applyUnifiedChanges/);
  assert.match(app,/checkpoint\(baseline\);doc=clone\(pv.result\)/);
  assert.match(app,/diagnoseAfterDocument\(preview.result,/);
  assert.match(app,/preview.comparisonData.afterIssues=report.issues/);
  assert.match(app,/preview\.comparisonData\.afterIssues=report\.issues/);
  assert.doesNotMatch(app,/markersVisible=true;compareStage='after'/);
  assert.match(app,/curvePreview=pv;if\(!comparisonSelectionExplicit\)compareStage='after'/);
  assert.match(app,/chooseAfterSnapshot\(doc,curvePreview,readEpsSaveSettings\(\)/);
  assert.match(app,/prepareEpsOutput\(chosen.document\)/);
  assert.match(app,/void checkPreviewAfter\(pv\)/);
  assert.match(html,/id="eps-save-warning"/);
  assert.match(html,/Сохранить результат ПОСЛЕ/);
  assert.doesNotMatch(app,/function saveEpsWithPreflight\(/);
});
