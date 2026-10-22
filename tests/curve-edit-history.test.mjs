import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {DOMParser} from '@xmldom/xmldom';
import {addCurveNode,deleteCurveNode} from '../web/curve-edit.js';
import {importRichSvg} from '../web/rich-svg.js';
import {exportEps} from '../web/eps-export.js';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('actual editor commits one checkpoint per operation, refuses invalid deletion, and Undo retains node selection',()=>{
  const source=importRichSvg('<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="10mm" viewBox="0 0 20 10"><path d="M0 0C1 2 3 2 4 0" fill="none" stroke="red"/></svg>',{Parser:DOMParser});
  source.sourceFileName='client.eps';
  const buttons={undo:{}},past=[],messages=[];
  const context={doc:structuredClone(source),selected:new Set([0]),activeCurveNode:null,
    past,future:[],busy:false,clone:structuredClone,curveEditing:()=>true,
    checkpoint:before=>past.push(structuredClone(before||context.doc)),changed:()=>{},
    status:message=>messages.push(message),$:id=>buttons[id]};
  vm.createContext(context);
  vm.runInContext(app.slice(app.indexOf('function changeCurveNode('),app.indexOf('function removeActiveCurveNode(')),context);
  context.changeCurveNode(0,'delete',p=>deleteCurveNode(p,0,{Parser:DOMParser}));
  assert.equal(past.length,0,'refused operation must not create an Undo checkpoint');
  assert.deepEqual(context.doc,source);
  assert.equal(messages.length,1);
  context.changeCurveNode(0,'add',p=>addCurveNode(p,1,.5,{Parser:DOMParser}));
  assert.equal(past.length,1);
  assert.equal(context.doc.paths[0].commands.length,3);
  assert.equal(context.doc.sourceFileName,'client.eps');
  const edited=structuredClone(context.doc);
  vm.runInContext(app.split(/\r?\n/).find(line=>line.startsWith("$('undo').onclick=")),context);
  buttons.undo.onclick();
  assert.deepEqual(context.doc,source);
  assert.deepEqual([...context.selected],[0],'editable curve stays selected after Undo');
  assert.deepEqual(context.future,[edited]);
  const reopened=JSON.parse(JSON.stringify({...context.doc,history:{past:context.past,future:context.future}}));
  assert.equal(exportEps(reopened),exportEps(source));
  assert.deepEqual(reopened.history.future[0],edited);
});
