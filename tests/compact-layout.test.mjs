import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('information panel is hidden by default and can be reopened without losing tools',()=>{
  assert.match(html,/<main id="main-layout" class="left-collapsed">/);
  assert.match(html,/<aside class="left" id="info-panel" hidden>/);
  assert.match(html,/<button id="toggle-info"[^>]*aria-controls="info-panel" aria-expanded="false"/);
  assert.match(css,/main\.left-collapsed\{grid-template-columns:/);
  assert.match(css,/#info-panel\[hidden\]\{display:none\}/);
  assert.match(app,/\$\('toggle-info'\)\.onclick=/);
  assert.match(app,/panel\.hidden=!expanded/);
  for(const id of ['width','height','paths','fonts','heal-copy','import-report']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
});
test('document creation tools are in a closed-by-default native disclosure',()=>{
  assert.match(html,/<details id="creation-tools" class="creation-tools"><summary>Создание документа<\/summary>/);
  assert.doesNotMatch(html,/<details id="creation-tools"[^>]*\bopen\b/);
  const menu=html.slice(html.indexOf('id="creation-tools"'),html.indexOf('</details>'));
  for(const id of ['new','save','export','select','line','rect','circle','undo','redo','delete','demo'])assert.ok(menu.includes('id="'+id+'"'),id);
  const header=html.slice(html.indexOf('<header>'),html.indexOf('</header>'));
  assert.ok(header.includes('id="open"')&&header.includes('id="export-eps"'));
  for(const id of ['save','export','new','select','undo','redo','delete'])assert.ok(!header.includes('id="'+id+'"'),'Button must not be in header: '+id);
  const nav=html.slice(html.indexOf('<nav>'),html.indexOf('</nav>'));
  for(const id of ['fit','zoom-in','zoom-out'])assert.ok(nav.includes('id="'+id+'"'),id);
});


test('diagnostic legend, issue list and all manual actions are collapsed by default',()=>{
  for(const id of ['legend-panel','point-controls','issues-panel','manual-repairs']){
    assert.match(html,new RegExp('<details id="'+id+'"'));
    assert.doesNotMatch(html,new RegExp('<details id="'+id+'"[^>]*\\bopen\\b'));
  }
  const repairs=html.slice(html.indexOf('id="manual-repairs"'),html.indexOf('</details>',html.indexOf('id="manual-repairs"')));
  for(const action of [1,2,3,4,5,6,7,8])assert.ok(repairs.includes('data-action="'+action+'"'),'manual action '+action);
  assert.match(css,/\.compact-section>summary/);
});
test('central comparison includes toggles, exit and distinct node overlay',()=>{
  assert.match(html,/id="central-compare"/);
  for(const id of ['compare-before','compare-after','compare-exit','nodes','markers']){
    assert.ok(html.includes('id="'+id+'"'),id);
  }
  assert.match(css,/\.healthy-anchors\{fill:#fff;/);
  assert.match(css,/\.path\{stroke-width:\.75px\}/);
  assert.match(app,/activeComparisonFrame\(comparison,compareStage,doc,issues\)/);
  assert.match(app,/compareStage='after'/);
});

test('file history presents date / original filename / result in a closed section',()=>{
  const start=html.indexOf('id="file-history-panel"');
  assert.ok(start>0);
  const area=html.slice(start,html.indexOf('</details>',start));
  assert.match(area,/>Дата<\/th>/);
  assert.match(area,/>Имя файла<\/th>/);
  assert.match(area,/>Результат<\/th>/);
  for(const id of ['file-history-count','file-history-rows','file-history-note'])assert.ok(area.includes('id="'+id+'"'),id);
  assert.doesNotMatch(html,/<details id="file-history-panel"[^>]*\bopen\b/);
  assert.match(app,/function renderFileHistory\(\)/);
  assert.match(app,/updateFileHistory\(\{diagnosis:/);
  assert.match(app,/epsResultFilename\(doc\.sourceFileName/);
  assert.match(app,/sourceFileName:basename\(value\.sourceFileName\)/);
  assert.match(css,/\.file-history-table/);
});

test('unified autoheal has one Apply action, problems and both smoothing/optimization sizes',()=>{
 const start=html.indexOf('<aside class="right">');
 const manual=html.indexOf('<details id="manual-repairs"',start);
 assert.ok(start>0&&manual>start);
 const area=html.slice(start,manual);
 assert.match(area,/<h2>Автоисправление<\/h2>/);
 for(const id of ['issues-panel','issues','issue-count','summary','tolerance',
                  'smoothing-amount','optimization-tolerance','optimization-range','apply-changes'])
   assert.ok(area.includes('id="'+id+'"'),id);
 assert.equal((area.match(/<button\b/g)||[]).length,3,
   'only Apply plus two visibility toggles, no old start/cancel/preview buttons');
 assert.match(area, /<button id="apply-changes" class="primary" disabled>[^]*?Применить изменения<\/button>/);
 for(const id of ['auto-heal','auto-apply','auto-discard','optimize-preview','optimize-apply','optimize-cancel','diagnose'])
   assert.ok(!html.includes('id="'+id+'"'),id);
 assert.match(app,/function buildUnifiedPreview\(\)/);
 assert.match(app,/function applyUnifiedChanges\(\)/);
 assert.match(app,/repairVectorPoints\(doc,scope,diagnosticTolerance\)/);
 assert.match(app,/smoothAndOptimizePaths\(repaired.document,scope,smoothingAmount,optimizationTolerance\)/);
 assert.match(app,/const different=scope\.some\(i=>worldData/);
 assert.match(app,/task\.action===0\)buildUnifiedPreview\(\)/);
 assert.match(app,/if\(!action\.startsWith\('import-'\)&&action!=='unified-apply'\)requestRecalculation\(\)/);
 assert.match(app,/if\(ready&&doc\.paths\.some\(p=>p\.kind!=='image'\)\)calculate\(0\)/);
 assert.match(app,/class:'comparison-path '/);
 assert.match(app,/class:'comparison-ghost'/);
});
