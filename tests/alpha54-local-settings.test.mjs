import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {diagnoseLocalNodes,mergeLocalIssues,manualCheckRadius} from '../web/local-node-diagnostics.js';

const open=(a,b)=>({kind:'vector',artwork:'<path/>',
  commands:[['M',...a],['L',...b]],offset:[0,0]});
const closed=(x,y)=>({kind:'vector',artwork:'<path/>',
  commands:[['M',x,y],['L',x+1,y],['L',x+1,y+1],['Z']],offset:[0,0]});

test('local scanner only examines selected radius and preserves unrelated defects',()=>{
  const doc={paths:[open([1,1],[4,1]),open([90,90],[94,90])]};
  const local=diagnoseLocalNodes(doc,[1,1],.8,.01);
  assert.equal(local.complete,true);
  assert.ok(local.segments<4);
  assert.deepEqual(local.issues.filter(i=>i.kind==='open').map(i=>i.path),[0]);
  const original=[{kind:'open',path:0,other:0,point:[1,1]},
    {kind:'open',path:1,other:1,point:[90,90]}];
  const fixed={paths:[closed(1,1),doc.paths[1]]};
  const newLocal=diagnoseLocalNodes(fixed,[1,1],.8,.01);
  assert.equal(newLocal.complete,true);
  const merged=mergeLocalIssues(original,newLocal.issues,[1,1],.8,
    {complete:true,changedPath:0,changedClosed:true});
  assert.equal(merged.some(i=>i.kind==='open'&&i.path===0),false);
  assert.equal(merged.some(i=>i.kind==='open'&&i.path===1),true);
  assert.deepEqual(mergeLocalIssues(original,newLocal.issues,[1,1],.8,
    {complete:false,changedPath:0,changedClosed:true}),original,
    'never remove a witness when the scoped scan failed');
});
test('manual radius stays bounded in mm, respects display zoom and tolerance',()=>{
 assert.ok(manualCheckRadius({width:10,height:10},1000,1000,.01)>=.04);
 assert.equal(manualCheckRadius({width:1000,height:1000},1000,1000,.01),2);
});
test('a bounded local window reports saturation without clearing original issues',()=>{
 const s={paths:[...Array.from({length:30},(_,i)=>open([1,1+i*.005],[3,1+i*.005]))]};
 const result=diagnoseLocalNodes(s,[1,1],.5,.01,{maxSegments:5});
 assert.equal(result.complete,false);
 assert.equal(result.reason,'local-segment-budget');
 assert.equal(result.issues.length,0);
});
test('draft parameters do not trigger full diagnosis until Apply; editor worker is local',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 assert.match(app,/function settingsChanged\(\)/);
 assert.match(app,/function validatedDraft\(\)/);
 const block=app.slice(app.indexOf("function requestRecalculation(){"),
   app.indexOf("function spawnWorker(){"));
 assert.match(block,/\$\('apply-changes'\)\.onclick/);
 assert.doesNotMatch(block,/oninput=.*requestRecalculation|onchange=requestRecalculation/);
 assert.match(app,/if\(local\)scheduleManualDiagnostic\(\)/);
 assert.match(app,/local-node-worker\.js/);
 assert.match(css,/#editor-settings \.settings-grid/);
 for(const id of ['tolerance','smoothing-amount','optimization-tolerance','micro-width','micro-height','merge-overlaps','remove-micro','selection-only','clearance-threshold'])
  assert.ok(html.includes('id="'+id+'"'),'missing '+id);
 assert.match(html,/id="editor-settings"/);
 assert.match(html,/id="settings-pending"/);
 assert.match(app,/M6 6L10 10 M14 14L18 18/);
});
