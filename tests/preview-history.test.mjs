import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('Undo and Redo operate on committed documents while an automatic preview exists',()=>{
  const original={paths:[{points:[[0,0],[1,0]]}]};
  const committed={paths:[{points:[[0,0],[2,0]]}]};
  const preview={result:{paths:[{points:[[0,0],[999,0]]}]}};
  const buttons={undo:{},redo:{}};
  const context={doc:structuredClone(committed),past:[structuredClone(original)],future:[],
    curvePreview:preview,busy:false,selected:new Set([0]),clone:structuredClone,
    $:id=>buttons[id]};
  context.changed=()=>{context.curvePreview=null;};
  vm.createContext(context);
  const availability=app.split(/\r?\n/).find(line=>line.includes("$('undo').disabled="));
  const handler=id=>app.split(/\r?\n/).find(line=>line.startsWith(`$('${id}').onclick=`));
  vm.runInContext(availability,context);
  assert.equal(buttons.undo.disabled,false,'preview must not prevent undo');
  vm.runInContext(handler('undo'),context);
  buttons.undo.onclick();
  assert.deepEqual(context.doc,original);
  assert.deepEqual(context.future,[committed],'unapplied preview never enters history');
  assert.equal(context.curvePreview,null);
  context.curvePreview=preview; // automatic recalculation after Undo
  vm.runInContext(availability,context);
  assert.equal(buttons.redo.disabled,false,'recalculation must not prevent redo');
  vm.runInContext(handler('redo'),context);
  buttons.redo.onclick();
  assert.deepEqual(context.doc,committed);
  assert.deepEqual(context.past,[original]);
  assert.equal(context.curvePreview,null);
});
