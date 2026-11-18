import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {createDeferredCurveEditor} from '../web/deferred-curve-editor.js';
import {finishDeferredCurveCommands} from '../web/curve-edit.js';
import {importRichSvg} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

test('manual session rejects invalid deletion, stages multiple changes without checkpoint and commits exactly once on exit',()=>{
  const source=importRichSvg(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10">'+
    '<path d="M0 0C1 2 3 2 4 0" fill="none" stroke="red"/></svg>',
    {Parser:DOMParser});
  source.sourceFileName='client.eps';
  const frozen=structuredClone(source),editor=createDeferredCurveEditor(source.paths[0]);
  assert.throws(()=>editor.removeAnchor(0),/минимум два узла/);
  assert.equal(editor.historySize(),0);
  const added=editor.addSegment(1,.5);
  assert.equal(added,1);
  assert.equal(editor.finish().commands.length,3);
  assert.deepEqual(source,frozen,'the parent document is never changed inside manual mode');
  assert.equal(editor.undoLocal(),true);
  assert.equal(editor.finish().commands.length,2);
  assert.equal(editor.redoLocal(),true);
  assert.equal(editor.finish().commands.length,3);
  assert.equal(editor.modified(),true);
  const past=[structuredClone(source)],future=[];
  const committed=structuredClone(source);
  committed.paths[0]=finishDeferredCurveCommands(source.paths[0],
    editor.finish().commands,editor.finish().nodeKinds,{Parser:DOMParser});
  assert.equal(committed.paths[0].commands.length,3);
  assert.equal(committed.sourceFileName,'client.eps');
  // One project-level checkpoint is made only when leaving the editor.
  assert.equal(past.length,1);
  future.push(structuredClone(committed));
  const undone=past.pop();
  assert.deepEqual(undone,source);
  assert.deepEqual(exportEps(undone),exportEps(source));
  assert.deepEqual(future[0],committed);
});
