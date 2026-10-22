import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {screenUnitsPerPixel,renderIssueMarkers} from '../web/issue-markers.js';
import {issueColors} from '../web/vector-points.js';
import {activeComparisonFrame} from '../web/central-comparison.js';

const layer=()=>new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>','image/svg+xml').documentElement.firstChild;
const issue=(kind='self_intersection',point=[12,33])=>({kind,point,path:0,other:0});

test('problem rings remain fourteen screen pixels across in tall, wide and zoomed viewports',()=>{
  for(const [view,w,h] of [[{width:60,height:110},500,600],[{width:200,height:20},500,600],
    [{width:6,height:11},500,600],[{width:20,height:60},320,180]]){
    const unit=screenUnitsPerPixel(view,w,h),parent=layer();
    renderIssueMarkers(parent,[issue()],unit);
    const ring=parent.firstChild.getElementsByTagName('circle')[1];
    const pixels=Number(ring.getAttribute('r'))*Math.min(w/view.width,h/view.height)*2;
    assert.ok(Math.abs(pixels-14)<1e-9,'size must use the limiting dimension of SVG meet');
  }
});

test('markers provide high-contrast rings, numbers, coordinates and a stable focus target without changing issues',()=>{
  const parent=layer(),issues=[issue(),issue('short',[4,5])],snapshot=structuredClone(issues);
  assert.equal(renderIssueMarkers(parent,issues,.2),2);
  const group=parent.firstChild;
  assert.equal(group.getAttribute('data-issue'),'0');
  assert.equal(group.getAttribute('tabindex'),'0');
  assert.equal(group.getAttribute('role'),'button');
  assert.match(group.getAttribute('aria-label'),/1\. Самопересечение.*12\.000.*33\.000/);
  assert.equal(group.getElementsByTagName('text')[0].textContent,'1');
  assert.equal(group.getElementsByTagName('circle')[1].getAttribute('stroke'),issueColors.self_intersection);
  assert.equal(parent.lastChild.getElementsByTagName('text')[0].textContent,'2');
  assert.deepEqual(issues,snapshot);
});

test('Before and After markers track only their own diagnostic stage, including no remaining defects',()=>{
  const source={paths:[]},comparison={beforeDoc:source,afterDoc:source,beforeIssues:[issue('short')],afterIssues:[]};
  const before=layer(),after=layer();
  renderIssueMarkers(before,activeComparisonFrame(comparison,'before',source,[]).issues,1);
  renderIssueMarkers(after,activeComparisonFrame(comparison,'after',source,[]).issues,1);
  assert.equal(before.childNodes.length,1);
  assert.equal(after.childNodes.length,0,'fixed points must not be misrepresented as remaining problems');
  comparison.afterIssues=[issue('self_intersection')];
  renderIssueMarkers(after,activeComparisonFrame(comparison,'after',source,[]).issues,1);
  assert.equal(after.childNodes.length,1);
});

test('invalid coordinates are skipped with source indices preserved and a bounded overlay size',()=>{
  const parent=layer();
  renderIssueMarkers(parent,[issue('short',[NaN,0]),issue('open')],1);
  assert.equal(parent.firstChild.getAttribute('data-issue'),'1');
  assert.equal(parent.firstChild.getElementsByTagName('text')[0].textContent,'2');
  const limited=layer();
  assert.equal(renderIssueMarkers(limited,Array.from({length:1005},()=>issue()),1),1000);
});
