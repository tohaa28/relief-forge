import test from 'node:test';
import assert from 'node:assert/strict';
import {protectPreviewNodeBudget,realNodeCount,previewBudgetMessage} from '../web/preview-node-budget.js';
import {exportEps,exportColoredEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {recoverOutlineOnlyEps} from '../web/eps-pipeline.js';
import {importRichSvg} from '../web/rich-svg.js';
import {DOMParser} from '@xmldom/xmldom';

const shape=n=>({kind:'vector',closed:true,artwork:'<path d="M 0 0"/>',offset:[0,0],
  commands:[['M',0,0],...Array.from({length:n-1},(_,i)=>['L',i+1,(i%2)*.01]),['Z']],points:[[0,0]]});
const doc=n=>({width:3000,height:100,paths:[shape(n)],sourceFileName:'complex.eps'});
test('Union must not replace a 48-node optimized curve with 2840 polygon nodes',()=>{
  const source=doc(120),preUnion=doc(48),inflated=doc(2840);
  const frozen=structuredClone(source);
  const result=protectPreviewNodeBudget(source,preUnion,inflated);
  assert.equal(result.reason,'union-node-growth');
  assert.equal(result.final,48);assert.equal(realNodeCount(result.document),48);
  assert.match(previewBudgetMessage(result),/отменён/);
  assert.deepEqual(source,frozen);
});
test('accept actual node reduction; rollback even pre-Union increases',()=>{
  assert.equal(protectPreviewNodeBudget(doc(80),doc(40),doc(24)).final,24);
  const r=protectPreviewNodeBudget(doc(80),doc(120),doc(90));
  assert.equal(r.final,80);assert.equal(r.reason,'optimized-node-growth');
});
test('real EPS result reimport preserves exactly the preview M/L/C anchor count',()=>{
  const budget=protectPreviewNodeBudget(doc(120),doc(30),doc(2000));
  const eps=exportEps(budget.document);
  assert.deepEqual(verifyEpsOutputGeometry(budget.document,{content:eps,source:'outline'}),
    {status:'matching-after',realNodes:30});
  const restored=recoverOutlineOnlyEps(new TextEncoder().encode(eps));
  assert.ok(restored?.svg);
  const reopened=importRichSvg(restored.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.equal(realNodeCount(reopened),30);
  const tampered=eps.replace('\nN\n','\n1 1 L\nN\n');
  assert.notEqual(tampered,eps,'test must alter serialized EPS');
  assert.throws(()=>verifyEpsOutputGeometry(budget.document,{content:tampered,source:'outline'}),/не совпадает/);
});
test('repainted RGB EPS carries identical actual commands, never denser polys',()=>{
  const c={kind:'vector',artwork:'<path d="M 1 1 C 5 1 8 8 10 10"/>',offset:[0,0],closed:false,
    commands:[['M',1,1],['C',5,1,8,8,10,10],['L',20,10]],points:[[1,1],[10,10],[20,10]],
    paint:{fill:'none',stroke:'#000000',strokeWidthMm:0.1}};
  const d={width:30,height:20,paths:[c]},rgb=exportColoredEps(d);
  assert.equal(rgb.source,'repainted-rgb');
  assert.equal(verifyEpsOutputGeometry(d,rgb).realNodes,3);
  assert.throws(()=>verifyEpsOutputGeometry(d,{...rgb,content:rgb.content.replace(/ C\n/, ' L\n')}),/не совпадает/);
});
