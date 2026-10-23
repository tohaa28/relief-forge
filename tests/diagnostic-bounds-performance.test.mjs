import test from 'node:test';
import assert from 'node:assert/strict';
import {createIssueBoundsValidator,issueWithinContourBounds} from '../web/issue-markers.js';
test('batch bounds are computed once, keep inclusive tolerance and reject invalid markers',()=>{
 let reads=0;
 const points=Array.from({length:2000},(_,i)=>({[Symbol.iterator]:function*(){reads++;yield i;yield i%20;}}));
 const check=createIssueBoundsValidator([{points}],.01);
 assert.equal(reads,2000);
 for(let i=0;i<10000;i++)assert.equal(check({path:0,other:0,point:[100,10]}),true);
 assert.equal(reads,2000,'marker validation must not rescan contour vertices');
 assert.equal(check({path:0,point:[-.02,0]}),true);
 assert.equal(check({path:0,point:[-.021,0]}),false);
 assert.equal(check({path:3,other:4,point:[100,10]}),false);
 assert.equal(check({path:0,point:[NaN,0]}),false);
 assert.equal(check({path:0,point:[100,10,3]}),false);
});
test('new diagnostic job gets new bounds after edits; no stale global cache',()=>{
 const paths=[{points:[[0,0],[10,10]]}];
 assert.equal(createIssueBoundsValidator(paths)({path:0,point:[5,5]}),true);
 paths[0].points=[[100,100],[110,110]];
 assert.equal(createIssueBoundsValidator(paths)({path:0,point:[5,5]}),false);
 assert.equal(issueWithinContourBounds({path:0,point:[105,105]},paths),true);
});
