import test from 'node:test';
import assert from 'node:assert/strict';
import {AUTO_STEPS,basicPaths,packedInput,isChanged,issueTotals,comparisonBox,proposedIssueLocations} from '../web/auto-repair.js';

test('autofix uses only existing deterministic Rust repair actions, never topology splitting',()=>{
  assert.deepEqual(AUTO_STEPS.map(s=>s.action),[2,1,3,4]);
  assert.ok(!AUTO_STEPS.some(s=>[5,6,7,8].includes(s.action)));
});
test('packed Rust ABI for preview stays non-destructive',()=>{
  const source=[{closed:false,points:[[0,0],[1,0],[1.004,0]]}];
  const before=JSON.stringify(source),input=packedInput(source,.01,2);
  assert.deepEqual(input,[.01,2,1,1,0,3,0,0,1,0,1.004,0]);
  assert.equal(JSON.stringify(source),before);
  assert.throws(()=>packedInput(source,0,2),/допуск/);
});
test('autofix viewbox before-after shares coordinates around problem',()=>{
  const before=[{points:[[0,0],[10,0]],closed:false}],after=[{points:[[0,0],[5,0],[10,0]],closed:false}];
  const issue={kind:'short',point:[5,0]};
  const box=comparisonBox(before,after,issue,.01);
  assert.ok(box.x<5&&box.x+box.width>5);
  assert.ok(box.y<=0&&box.y+box.height>=0);
  assert.ok(!isChanged(before,basicPaths(before)));
  assert.ok(isChanged(before,after));
});
test('preview compares original issues and marks remaining ones as unresolved',()=>{
  const before=[{kind:'short',point:[2,3]},{kind:'open',point:[7,8]}];
  const after=[{kind:'open',point:[7,8]}];
  assert.deepEqual(proposedIssueLocations(before,after,.01).map(i=>i.resolved),[true,false]);
  assert.deepEqual(issueTotals(before),{short:1,open:1});
});
