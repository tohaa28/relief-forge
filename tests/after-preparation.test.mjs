import test from 'node:test';
import assert from 'node:assert/strict';
import {combineWorkingCopy,prepareAfterCopy} from '../web/after-preparation.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {geometryCommands,exportEps,verifyEpsOutputGeometry} from '../web/eps-export.js';
import {activeComparisonFrame} from '../web/central-comparison.js';

const vector=(commands,paint={fill:'none',stroke:'#000000',strokeWidthMm:.1,opacity:1,fillRule:'nonzero'})=>({
  kind:'vector',commands,paint,offset:[0,0],closed:commands.at(-1)[0]==='Z',
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),artwork:'<path/>'});
const rect=(x,paint)=>vector([['M',x,1],['L',x+4,1],['L',x+4,5],['L',x,5],['Z']],paint);
const source=paths=>({width:30,height:15,paths});

test('disconnected native curves form one editable object without changing coordinates or original',()=>{
  const a=vector([['M',1,1],['C',2,3,4,3,5,1]]);a.offset=[2,1];
  const input=source([a,rect(10)]),original=structuredClone(input);
  const out=combineWorkingCopy(input,[0,1]);
  assert.equal(out.document.paths.length,1);
  assert.deepEqual(out.document.paths[0].commands,input.paths.flatMap(geometryCommands));
  assert.equal(out.stats.combined,true);
  assert.deepEqual(input,original);
  const eps=exportEps(out.document);
  assert.equal(verifyEpsOutputGeometry(out.document,{content:eps,source:'outline'}).realNodes,6);
});

test('Boolean union then compound includes disconnected islands and preserves a hole',async()=>{
  const paint={fill:'#000000',stroke:'none',opacity:1,fillRule:'evenodd'};
  const ring=vector([...rect(1,paint).commands,
    ['M',2,2],['L',4,2],['L',4,4],['L',2,4],['Z']],paint);
  const input=source([ring,rect(12,paint)]),original=structuredClone(input),events=[];
  const prepared=await prepareAfterCopy(input,[0,1],{
    union:async(copy,indices)=>{events.push('union');return mergeOverlappingObjects(copy,{indices});},
    onPrepared:out=>{events.push('combined');assert.equal(out.document.paths.length,1);},
    diagnose:async document=>{
      events.push('diagnose');assert.equal(document.paths.length,1);
      assert.equal(document.paths[0].commands.filter(c=>c[0]==='M').length,3);
      return {issues:[],complete:true,fullScope:true};
    }
  });
  assert.deepEqual(events,['union','combined','diagnose']);
  assert.deepEqual(input,original);
  assert.deepEqual(prepared.before,original);
  assert.equal(prepared.document.paths[0].paint.fillRule,'evenodd');
});

test('selected parts combine at the first selected position while other objects remain intact',()=>{
  const input=source([rect(1),rect(8),rect(16)]);
  const out=combineWorkingCopy(input,[0,2]);
  assert.deepEqual(out.indices,[0]);assert.equal(out.document.paths.length,2);
  assert.deepEqual(out.document.paths[1],input.paths[1]);
  assert.equal(out.document.paths[0].commands.filter(c=>c[0]==='M').length,2);
});

test('different paint, masked paths and unverified Union stay explicit, never guessed',()=>{
  const a=rect(1),b=rect(8);b.paint.stroke='#ff0000';
  assert.equal(combineWorkingCopy(source([a,b]),[0,1]).stats.reason,'incompatible-paint');
  b.paint=a.paint;b.artwork='<path clip-path="url(#clip)"/>';
  assert.equal(combineWorkingCopy(source([a,b]),[0,1]).stats.reason,'unsupported-appearance');
  assert.equal(combineWorkingCopy(source([a,a]),[0,1],{rejectedGroups:1}).stats.reason,'unverified-union');
});

test('failed/cancelled preparation cannot diagnose or mutate the original',async()=>{
  const input=source([rect(1),rect(8)]),before=structuredClone(input);
  let cancelled=false,diagnosed=false;
  await assert.rejects(prepareAfterCopy(input,[0,1],{
    union:async copy=>{copy.paths=[];cancelled=true;return {document:copy,selectedIndices:[],stats:{}};},
    cancelled:()=>cancelled,diagnose:()=>{diagnosed=true;}
  }),/отменена/);
  assert.equal(diagnosed,false);assert.deepEqual(input,before);
  await assert.rejects(prepareAfterCopy(input,[0,1],{union:async()=>{throw Error('Union failed');}}),/Union failed/);
  assert.deepEqual(input,before);
});

test('defects on the combined copy are separate from immutable original and repaired result',()=>{
  const before=source([rect(1),rect(8)]),prepared=combineWorkingCopy(before,[0,1]).document;
  const issue={kind:'short',path:0,point:[1,1]};
  const comparison={beforeDoc:before,beforeIssues:[],preparedDoc:prepared,preparedIssues:[issue],
    afterDoc:source([rect(1)]),afterIssues:[]};
  assert.equal(activeComparisonFrame(comparison,'before').document.paths.length,2);
  assert.equal(activeComparisonFrame(comparison,'prepared').document.paths.length,1);
  assert.deepEqual(activeComparisonFrame(comparison,'prepared').issues,[issue]);
  assert.deepEqual(activeComparisonFrame(comparison,'after').issues,[]);
});
