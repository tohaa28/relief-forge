import test from 'node:test';
import assert from 'node:assert/strict';
import {checkEditedDefects} from '../web/edited-defects.js';

test('edited contours get new witnesses even if the previous marker list is empty',()=>{
  const doc={paths:[{points:[[0,0],[2,2]],closed:false},{points:[[0,2],[2,0]],closed:false}]};
  const report=checkEditedDefects(doc,[],[0],.01);
  assert.equal(report.complete,true);
  assert.ok(report.issues.some(i=>i.kind==='open'&&i.path===0));
  assert.ok(report.issues.some(i=>i.kind==='intersection'));
  assert.ok(!report.issues.some(i=>i.kind==='open'&&i.path===1));
});

test('an old marker of a separated pair is removed while unrelated witnesses survive',()=>{
  const doc={paths:[{points:[[0,0],[2,2]],closed:false},{points:[[10,2],[12,0]],closed:false}]};
  const fixed={kind:'intersection',path:0,other:1,point:[1,1]};
  const unrelated={kind:'open',path:1,other:1,point:[10,2]};
  const report=checkEditedDefects(doc,[fixed,unrelated],[0],.01);
  assert.equal(report.checked,1);
  assert.ok(!report.issues.includes(fixed));
  assert.ok(report.issues.includes(unrelated));
});
