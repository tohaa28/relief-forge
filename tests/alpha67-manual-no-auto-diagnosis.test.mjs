import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
test('manual editor exit commits with a deferred diagnostics-only refresh of known defects',()=>{
 const code=app.match(/function exitDeferredCurveEditor\(\)\{[\s\S]*?\n\}\n\s*let anchorViewportCache/)?.[0];
 assert.ok(code);
 assert.match(code,/changed\('curve-session-commit',\{skipDiagnostics:true,preserveIssues:true\}\)/);
 assert.doesNotMatch(code,/requestRecalculation\(\)|calculate\(0\)|scheduleManualLocalRecheck\(\)/);
 assert.match(code,/if\(previous.length\)scheduleManualMarkerCheck/);
 assert.match(code,/\}else render\(\);/,'unchanged exit must not schedule scan');
 assert.match(app,/if\(skipDiagnostics\)return;\n  if\(retainsIssuesDuringManualChange/);
 assert.match(app,/clearTimeout\(settingsTimeout\);clearTimeout\(clearanceTimer\)/);
});
test('stale scan results cannot be displayed as zero problems or markers',()=>{
 assert.match(app,/manualReviewPending\?'—':visibleIssues\.length/);
 assert.match(app,/manualReviewPending\)\$\('summary'\)\.textContent=/);
 assert.match(app,/if\(!preserveIssues\)issues=\[\];\s*metrics=\[\];diagnosticComplete=false;manualDiagnosticsPending=false/);
 assert.match(app,/if\(manualReviewPending\|\|manualClearancePaused\)\{[\s\S]*?layer\.replaceChildren\(\)/);
 assert.match(app,/changed\('undo',\{skipDiagnostics:manualReviewPending\}\)/);
 assert.match(app,/changed\('redo',\{skipDiagnostics:manualReviewPending\}\)/);
});
test('user-initiated defect scan only diagnoses, does not start automatic optimization',()=>{
 assert.match(html,/id="recheck-defects"/);
 assert.match(app,/\$\('recheck-defects'\)\.onclick=\(\)=>\{/);
 assert.match(app,/calculate\(0,\{diagnosticsOnly:true,preserveUnverified:manualReviewPending\}\)/);
 assert.match(app,/if\(diagnosticsOnly\)\{[\s\S]*?record\('user-requested-diagnostics'/);
 assert.match(app,/manualReviewPending=false;manualClearancePaused=false;\n        markersVisible=true/);
});

test('unchanged exit pauses clearance Worker without mislabeling existing valid defect witnesses',()=>{
 assert.match(app,/suppressNextDiagnostic=true;manualClearancePaused=true;\n  clearTimeout\(settingsTimeout\)/);
 assert.match(app,/\}else render\(\);\n  status\(updated\.size/);
 assert.match(app,/manualReviewPending=skipDiagnostics;\n  manualClearancePaused=skipDiagnostics;/);
 assert.match(app,/manualReviewPending=false;manualClearancePaused=false;/);
});
