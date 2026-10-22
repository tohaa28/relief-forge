import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {issueColors,anchors,visibleHealthyAnchors,circlePath} from '../web/vector-points.js';
import {recoverOutlineOnlyEps} from '../web/eps-pipeline.js';
import {importRichSvg} from '../web/rich-svg.js';

test('all exact Bezier anchors displayed, handles excluded, no curve resampling',()=>{
  const source={kind:'vector',artwork:'<path/>',offset:[3,4],
    commands:[['M',0,1],['C',4,5,6,7,8,9],['Q',10,11,12,13],['Z']]};
  const snap=JSON.stringify(source),a=anchors(source);
  assert.deepEqual(a,[[3,5],[11,13],[15,17]]);
  assert.equal(JSON.stringify(source),snap);
  assert.equal(anchors({kind:'image',commands:source.commands,artwork:'<image/>'}).length,0);
});
test('healthy nodes exclude issue locations and stay all visible otherwise',()=>{
  const doc={paths:[{points:[[0,0],[1,0],[2,0]],closed:false},
    {points:[[5,5],[6,6]],closed:false}]};
  assert.equal(visibleHealthyAnchors(doc,[],.01).length,5);
  const issues=[{kind:'short',point:[1,0],path:0},{kind:'intersection',point:[5,5],path:1}];
  const result=visibleHealthyAnchors(doc,issues,.01);
  assert.deepEqual(result.map(x=>x.point),[[0,0],[2,0],[6,6]]);
  assert.equal(circlePath(result,.5).match(/ a /g).length,6);
  assert.equal(visibleHealthyAnchors(doc,issues,.01).length,3);
});
test('distinct issue color mapping covers all Rust diagnostic kinds',()=>{
  const kinds=['open','coincident','short','duplicate','overlap','self_intersection','intersection'];
  assert.ok(kinds.every(k=>/^#[0-9a-f]{6}$/.test(issueColors[k])));
  assert.notEqual(issueColors.open,issueColors.short);
  assert.notEqual(issueColors.self_intersection,issueColors.intersection);
  assert.equal(issueColors.duplicate,issueColors.overlap);
});
test('Corel example exact real anchors visible even with no diagnostic marks',()=>{
  const source=new Uint8Array(readFileSync(new URL('fixtures/eps/corel-unpainted.eps',import.meta.url)));
  const recovered=recoverOutlineOnlyEps(source);
  const doc=importRichSvg(recovered.svg,{unitsPerInch:72,Parser:DOMParser});
  const normals=visibleHealthyAnchors(doc,[],.01);
  assert.equal(doc.paths.length,2);
  assert.ok(normals.length>=5);
  assert.match(circlePath(normals,.05),/ a /);
});