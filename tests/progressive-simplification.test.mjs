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

test('closest anchors win over flatter geometry, across selected contours',()=>{
  const sharp={points:[[0,0],[4,0],[8,0],[9,3],[9.2,3],[17,8],[22,10]],closed:false};
  const flat={points:[[0,25],[4,25],[8,25],[12,25]],closed:false};
  const source={paths:[flat,sharp]};
  const {changes,stats}=planProgressiveSimplification(source,[0,1],40);
  assert.equal(stats.removed,1);
  assert.deepEqual(changes.map(change=>change.index),[1]);
  const x=changes[0].commands.map(command=>command[1]);
  assert.equal(x.filter(value=>value===9||value===9.2).length,1);
  assert.ok(x.includes(4));
  assert.ok(x.includes(8));
});

test('out-and-back spike is removed before a closer ordinary pair',()=>{
  const spike={points:[[0,-4],[0,0],[5,.18],[0,.4],[0,4]],closed:false};
  const nearby={points:[[12,-4],[12,-.1],[12,-.05],[12,4]],closed:false};
  const {changes}=planProgressiveSimplification({paths:[nearby,spike]},[0,1],50);
  assert.deepEqual(changes.map(c=>c.index),[1]);
  assert.deepEqual(changes[0].commands,[['M',0,-4],['L',0,0],['L',0,.4],['L',0,4]]);
});

test('bent spike is removed together and joins the surrounding curve with a cubic bridge',()=>{
  const spike={points:[[-.3,-4],[0,0],[5,.12],[5.05,.25],[5,.38],[0,.55],[.5,4]],closed:false};
  const {changes,stats}=planProgressiveSimplification({paths:[spike]},[0],50);
  assert.equal(stats.removed,3);
  assert.equal(changes[0].commands[2][0],'C');
  assert.deepEqual(changes[0].commands[2].slice(-2),[0,.55]);
  assert.deepEqual(changes[0].commands[1],['L',0,0]);
});

test('spike repair crosses the start of a ring and distinguishes a normal acute corner',()=>{
  const ring={points:[[5,.18],[0,.4],[0,4],[-4,4],[-4,-4],[0,-4],[0,0]],closed:true};
  const ringPlan=planProgressiveSimplification({paths:[ring]},[0],50);
  assert.equal(ringPlan.stats.spikes,1);
  assert.equal(ringPlan.changes[0].commands.at(-1)[0],'Z');
  assert.ok(!ringPlan.changes[0].commands.some(command=>command[1]===5));
  const acute={points:[[-4,-2],[0,0],[5,.18],[0,.4],[-4,2],[0,4]],closed:false};
  const acutePlan=planProgressiveSimplification({paths:[acute]},[0],50);
  assert.equal(acutePlan.stats.spikes,0);
});
