import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planProgressiveSimplification} from '../web/progressive-simplification.js';

const line={points:[[0,0],[.25,.01],[4,0],[6,3],[10,2],[12,5],[20,0]],closed:false};
const ring={points:Array.from({length:32},(_,i)=>[30+8*Math.cos(i*Math.PI/16),10+8*Math.sin(i*Math.PI/16)]),closed:true};
const document={paths:[line,ring]};

test('progressive simplification is optional, ordered and leaves open endpoints and closed rings',()=>{
  const source=structuredClone(document);
  assert.deepEqual(planProgressiveSimplification(document,[0,1],0).changes,[]);
  const medium=planProgressiveSimplification(document,[0,1],50);
  assert.ok(medium.changes[0]);
  assert.ok(!medium.changes[0].commands.some(command=>command[1]===.25));
  assert.ok(medium.changes[0].commands.some(command=>command[1]===4));
  const maximum=planProgressiveSimplification(document,[0,1],100);
  assert.deepEqual(maximum.changes[0].commands,[['M',0,0],['L',20,0]]);
  assert.equal(maximum.changes[1].commands.filter(command=>command[0]!=='Z').length,3);
  assert.equal(maximum.changes[1].commands.at(-1)[0],'Z');
  assert.ok(maximum.stats.removed>medium.stats.removed);
  assert.deepEqual(document,source);
});

test('cubic merging keeps Bezier geometry and respects scoped selection',()=>{
  const commands=[['M',0,0],['C',1,2,2,3,3,3],['C',4,3,5,1,6,1],
    ['C',7,1,8,4,9,4],['C',10,4,11,3,12,3]];
  const document={paths:[line,{kind:'vector',artwork:'<path/>',offset:[3,4],commands},ring]};
  const result=planProgressiveSimplification(document,[1],100);
  assert.equal(result.changes.length,1);
  assert.equal(result.changes[0].index,1);
  assert.deepEqual(result.changes[0].commands[0],['M',3,4]);
  assert.equal(result.changes[0].commands[1][0],'C');
  assert.deepEqual(result.changes[0].commands[1].slice(-2),[15,7]);
});

test('compound rings are retained and unsupported artwork is skipped',()=>{
  const polygon=points=>points.map((point,i)=>[i?'L':'M',...point]).concat([['Z']]);
  const inner=[[29,9],[29,11],[31,11],[31,9]];
  const compound={kind:'vector',artwork:'<path fill-rule="evenodd"/>',offset:[0,0],
    commands:[...polygon(ring.points),...polygon(inner)]};
  const referenced={...compound,offset:[100,0],artwork:'<use href="#shape"/>'};
  const result=planProgressiveSimplification({paths:[compound,referenced]},[0,1],100);
  assert.ok(result.stats.protected>=1);
  assert.equal(result.changes.length,1);
  const commands=result.changes[0].commands;
  assert.equal(commands.filter(command=>command[0]==='M').length,2);
  assert.equal(commands.filter(command=>command[0]==='Z').length,2);
  assert.ok(result.stats.removed>0);
});
