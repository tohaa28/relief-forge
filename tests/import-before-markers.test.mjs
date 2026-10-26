import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {beginImportBefore,captureImportBefore,importedComparison} from '../web/import-before.js';
import {activeComparisonFrame} from '../web/central-comparison.js';
import {exportEps} from '../web/eps-export.js';

const vec=commands=>({kind:'vector',closed:false,commands,offset:[0,0],
  artwork:'<path/>',points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))});
const original={width:70,height:40,paths:[vec([['M',0,0],['C',5,10,15,-10,20,0],
  ['L',20,20]]),vec([['M',40,0],['L',45,0]])]};
const err={kind:'intersection',path:0,other:1,a:0,b:0,point:[12,7]};
test('DO keeps native original Bézier commands and their initial diagnostic markers',()=>{
 const first=beginImportBefore(original);
 const before=structuredClone(original);
 const snapshot=captureImportBefore(first,[err],false);
 const changed={...structuredClone(original),paths:[vec([['M',0,0],['L',20,0]])]};
 const comp=importedComparison(snapshot,changed,[{kind:'short',path:0,point:[0,0]}]);
 assert.equal(comp.beforeIssues.length,1);
 assert.deepEqual(comp.beforeIssues[0],err);
 assert.deepEqual(comp.beforeDoc,before);
 assert.notEqual(exportEps(comp.beforeDoc),exportEps(changed));
 const stage=activeComparisonFrame(comp,'before',changed,[]);
 assert.deepEqual(stage.document,before);
 assert.equal(stage.issues[0].kind,'intersection');
 assert.equal(stage.readOnly,true);
 assert.deepEqual(activeComparisonFrame(comp,'after',changed,[]).document,changed);
});
test('initial diagnosis snapshot never changes when later edits and re-diagnostics happen',()=>{
 const incoming=beginImportBefore(original);
 const accepted=captureImportBefore(incoming,[err],true);
 const first=importedComparison(accepted,structuredClone(original));
 assert.deepEqual(captureImportBefore(accepted,[{kind:'duplicate'}],false),accepted);
 first.beforeDoc.paths[0].commands[0][1]=9999;
 first.beforeIssues[0].point[0]=555;
 assert.deepEqual(importedComparison(accepted,original).beforeDoc,original);
 assert.deepEqual(importedComparison(accepted,original).beforeIssues,[err]);
 assert.equal(incoming.issues,null);
 assert.equal(importedComparison(incoming,original),null);
});
test('APP sets DO after initial import and keeps selection stable across preview and AFTER check',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/importedBefore=beginImportBefore\(doc\);compareStage='before';fit\(\)/);
 assert.match(app,/importedBefore=captureImportBefore\(importedBefore,issues,complete\)/);
 assert.match(app,/beforeDoc:clone\(doc\),afterDoc:after,beforeIssues:clone\(issues\)/);
 assert.match(app,/curvePreview=pv;compareStage='before';/);
 assert.doesNotMatch(app,/markersVisible=true;compareStage='after';/);
 assert.match(app,/importedComparison\(importedBefore,after\)/);
});
