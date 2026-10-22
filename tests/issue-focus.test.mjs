import test from 'node:test';
import assert from 'node:assert/strict';
import {issueViewBox} from '../web/issue-focus.js';

test('focuses defect coordinates at stable physical scale without modifying source',()=>{
  const view={x:-10,y:-10,width:320,height:160},point=[90,40],sheet={width:300,height:200};
  const next=issueViewBox(view,point,sheet,0.01);
  assert.deepEqual(next,{x:80,y:35,width:20,height:10});
  assert.deepEqual(view,{x:-10,y:-10,width:320,height:160});
  assert.deepEqual(point,[90,40]);
});
test('keeps original view ratio and does not zoom out when already close',()=>{
  const original={x:3,y:5,width:1,height:2};
  const next=issueViewBox(original,[11,13],{width:100,height:100},0.01);
  assert.deepEqual(next,{x:10.5,y:12,width:1,height:2});
  assert.deepEqual(issueViewBox(next,[11,13],{width:100,height:100},0.01),next);
});
test('tolerance affects view only, edge markers still center on coordinate',()=>{
  assert.deepEqual(issueViewBox({x:0,y:0,width:300,height:150},[0,0],{width:300,height:200},5),
    {x:-50,y:-25,width:100,height:50});
});
test('rejects invalid issue or view coordinates without throwing',()=>{
  const view={x:0,y:0,width:100,height:50},sheet={width:100,height:50};
  for(const bad of [[NaN,0],[Infinity,0],[1],[1,'2'],null])assert.equal(issueViewBox(view,bad,sheet,0.01),null);
  assert.equal(issueViewBox({...view,width:0},[1,2],sheet,0.01),null);
  assert.equal(issueViewBox(view,[1,2],sheet,0),null);
  assert.equal(issueViewBox(view,[1,2],{width:0,height:100},0.01),null);
});
