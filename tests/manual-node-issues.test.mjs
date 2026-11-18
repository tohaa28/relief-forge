import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {issuesForManualEditor,resolveManualIssues,retainsIssuesDuringManualChange}
  from '../web/manual-issue-state.js';

const example={kind:'open',path:0,other:0,point:[1,2]};
test('entering manual editor uses CURRENT diagnosed AFTER, not the stale source defects',()=>{
 const source=[{...example,point:[1,2]}];
 const after=[{kind:'near_node',path:1,other:1,point:[7,8]}];
 const preview={hasGeometryChange:true,afterDiagnosed:true,
   afterDiagnosticComplete:false,comparisonData:{afterIssues:after}};
 const snapshot=issuesForManualEditor(preview,'after',source,true);
 assert.deepEqual(snapshot.issues,after);
 assert.equal(snapshot.complete,false);
 assert.equal(snapshot.verified,true);
 after[0].point[0]=12;
 assert.deepEqual(snapshot.issues[0].point,[7,8],'snapshot must be detached');
 assert.deepEqual(issuesForManualEditor(preview,'before',source,true).issues,source);
 const unfinished=issuesForManualEditor({...preview,afterDiagnosed:false},'after',source,true);
 assert.deepEqual(unfinished.issues,[]);
 assert.equal(unfinished.verified,false,'do not draw source defects on different AFTER geometry');
});

test('editing and Undo retain witnesses until a completed rescan removes them',()=>{
 for(const action of ['curve-node-move','curve-node-handle','curve-node-delete','undo','redo'])
   assert.equal(retainsIssuesDuringManualChange('nodes',action),true,action);
 assert.equal(retainsIssuesDuringManualChange('select','curve-node-move'),false);
 assert.equal(retainsIssuesDuringManualChange('nodes','import-new'),false);
 assert.deepEqual(resolveManualIssues([example],[]),[],
   'successful scan can prove the open endpoint is now closed');
 assert.deepEqual(resolveManualIssues([example],[],{failed:true}),[example],
   'failed scan cannot silently make an unresolved error vanish');
 assert.deepEqual(resolveManualIssues([example],[example],{failed:true}),[example]);
});

test('editor renders diagnostic rings without hiding or intercepting Bézier handles',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 const markers=readFileSync(new URL('../web/issue-markers.js',import.meta.url),'utf8');
 assert.match(app,/const marked=markersVisible\?renderIssueMarkers/);
 assert.match(app,/interactive:!curveEditing\(\)/);
 assert.match(app,/retainsIssuesDuringManualChange\(mode,action\)/);
 assert.match(app,/issues=curveEditing\(\)\?resolveManualIssues/);
 assert.match(css,/\.curve-editing #markers,\.curve-editing #markers \*\{pointer-events:none!important\}/);
 assert.match(markers,/interactive\?\s*\{/);
 assert.match(markers,/class:'problem-marker','aria-hidden':'true'/);
 assert.doesNotMatch(app,/В режиме «Узлы» цветные отметки скрыты/);
});
