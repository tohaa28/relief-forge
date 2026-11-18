import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseLocalNodeArea,localNodeRadius} from '../web/local-node-diagnostics.js';

const line=(...points)=>({closed:false,points});
const oldOpen={kind:'open',path:0,other:0,point:[0,0]};
test('local closure removes only the edited open witness and retains other areas',()=>{
 const source={paths:[line([0,0],[5,0],[5,5]),line([50,50],[60,50])]};
 const elsewhere={kind:'open',path:1,other:1,point:[50,50]};
 const before=diagnoseLocalNodeArea(source,[oldOpen,elsewhere],
   {path:0,point:[0,0],radius:.5,tolerance:.01});
 assert.equal(before.verified,true);
 assert.ok(before.issues.some(i=>i.kind==='open'&&i.path===0));
 const fixed={paths:[{...source.paths[0],closed:true},source.paths[1]]};
 const after=diagnoseLocalNodeArea(fixed,[oldOpen,elsewhere],
   {path:0,point:[0,0],radius:.5,tolerance:.01});
 assert.equal(after.verified,true);
 assert.equal(after.issues.filter(i=>i.kind==='open'&&i.path===0).length,0);
 assert.ok(after.issues.some(i=>i.kind==='open'&&i.path===1));
 assert.ok(after.partial,'local verification cannot certify untouched paths');
 const undo=diagnoseLocalNodeArea(source,after.issues,
   {path:0,point:[0,0],radius:.5,tolerance:.01});
 assert.ok(undo.issues.some(i=>i.kind==='open'&&i.path===0));
});

test('short segment is re-evaluated only within the local cursor radius',()=>{
 const damaged=line([0,0],[.002,0],[5,0]),far=line([50,50],[60,50]);
 const old={kind:'short',path:0,other:0,point:[.001,0]};
 const fixed=line([0,0],[5,0]);
 const before=diagnoseLocalNodeArea({paths:[damaged,far]},[old],
   {path:0,point:[.001,0],radius:.3,tolerance:.01});
 assert.ok(before.issues.some(i=>i.kind==='short'));
 const after=diagnoseLocalNodeArea({paths:[fixed,far]},before.issues,
   {path:0,point:[.001,0],radius:.3,tolerance:.01});
 assert.equal(after.issues.some(i=>i.kind==='short'),false);
 assert.equal(after.scope.length,1);
});

test('native anchor comparisons find distinct branches but not adjoining nodes',()=>{
 const path=line([0,0],[5,0],[5,5],[0,.006],[-1,2]);
 const {issues,comparisons,anchors}=diagnoseLocalNodeArea({paths:[path]},[],
  {path:0,point:[0,0],radius:.1,tolerance:.01});
 assert.equal(issues.filter(i=>i.kind==='near_node').length,1);
 assert.equal(issues.some(i=>i.kind==='coincident'),false);
 assert.ok(comparisons>0&&anchors<=3);
 const noisy=line(...Array.from({length:10000},(_,i)=>[i/100000,0]));
 const previous=[{...oldOpen}];
 const bounded=diagnoseLocalNodeArea({paths:[noisy]},previous,{
   path:0,point:[0,0],radius:.2,tolerance:.01,maxAnchors:100
 });
 assert.equal(bounded.verified,false);
 assert.deepEqual(bounded.issues,previous,'never erase a marker when local work is capped');
 assert.ok(localNodeRadius(.01,.01)<1,'local recheck is a small screen-space radius');
});

test('right inspector is unified, tooltip-rich, and numeric drafts cannot trigger automatic calculation',()=>{
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 const card=html.match(/<section id="settings-card"[\s\S]*?<\/section>/)?.[0];
 assert.ok(card);
 for(const id of ['tolerance','clearance-threshold','selection-only','smoothing-amount',
   'optimization-tolerance','optimization-range','merge-overlaps','remove-micro','micro-width','micro-height']){
   const tag=card.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'))?.[0];
   assert.ok(tag,id);
   assert.match(tag,/title="[^"]{40,}"/,id+' must explain the value on hover');
 }
 assert.match(html,/<details id="processing-report"/);
 assert.match(css,/\.settings-card \.setting-row/);
 assert.match(app,/markSettingsDirty\(\)/);
 assert.match(app,/\$\('apply-changes'\)\.onclick=\(\)=>\{void applySettingsAndChanges\(\);\}/);
 assert.doesNotMatch(app,/\$\('smoothing-amount'\)\.onchange=requestRecalculation/);
 assert.match(app,/scheduleManualLocalRecheck\(\)/);
 assert.match(app,/function finalizePendingSettingsApply\(preview\)/);
 assert.match(app,/kind==='remove'\s*\?'<svg/,'remove cursor has only a bare X, no opaque disk');
});
