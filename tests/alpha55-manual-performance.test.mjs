import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAnchorIndex,nearbyAnchors,createLiveCurvePatch,drawLiveCurvePatch}
  from '../web/manual-edit-performance.js';

const dense=(n=7545)=>{
 const commands=[['M',0,0]],points=[[0,0]];
 for(let i=1;i<=n;i++){
  const p=[i*.012,.8*Math.sin(i*.035)];
  commands.push(['C',(i-.67)*.012,.8*Math.sin((i-.67)*.035),
    (i-.33)*.012,.8*Math.sin((i-.33)*.035),...p]);
  points.push(p);
 }
 return {kind:'vector',closed:false,artwork:'<path d="M0 0" stroke="#123" fill="none"/>',
   offset:[0,0],commands,points};
};
test('7545 native Bézier segments expose at most 240 nearby nodes on any screen',()=>{
 const path=dense(),nodes=path.points.map((point,i)=>({point,index:i,type:'cusp',part:0,ordinal:i}));
 const index=buildAnchorIndex(nodes);
 assert.equal(index.nodes.length,7546);
 const visible=nearbyAnchors(index,[40,0],.7,{limit:240,includeIndex:3210});
 assert.ok(visible.length<=241);
 assert.ok(visible.some(n=>n.index===3210));
 assert.equal(new Set(visible.map(n=>n.index)).size,visible.length);
 assert.ok(index.buckets.size>1);
 assert.equal(nearbyAnchors(index,[1e6,1e6],1).length,0);
});

test('mousemove patch touches only incident C curves and leaves huge source immutable',()=>{
 const path=dense(),original=JSON.stringify(path);
 const node={part:0,ordinal:3500,index:3500,point:[...path.points[3500]]};
 const patch=createLiveCurvePatch(path,node);
 const target=[node.point[0]+.1,node.point[1]+.2];
 const d=drawLiveCurvePatch(patch,target);
 assert.equal((d.match(/C/g)||[]).length,2);
 assert.ok(d.length<250,'live SVG must be constant-size despite 7545 segments');
 assert.notEqual(d,drawLiveCurvePatch(patch,node.point));
 for(let i=0;i<500;i++)drawLiveCurvePatch(patch,[target[0]+i*.0001,target[1]]);
 assert.equal(JSON.stringify(path),original,'drag preview never mutates the document');
});

test('single control handle redraw changes only its incident local Bézier',()=>{
 const path=dense(500),point=[...path.points[250]];
 const patch=createLiveCurvePatch(path,{part:0,ordinal:250,index:250,point},
   {handle:'out',type:'smooth'});
 const svg=drawLiveCurvePatch(patch,[point[0]+.05,point[1]+.1]);
 assert.equal((svg.match(/C/g)||[]).length,2);
 assert.match(svg,/^M/);
});

test('extreme zoom-out of collapsed geometry never walks millions of empty buckets',()=>{
 const index=buildAnchorIndex(Array.from({length:2000},(_,i)=>({
  index:i,point:[i*1e-8,0],part:0,ordinal:i
 })));
 const start=performance.now();
 const result=nearbyAnchors(index,[0,0],200,{limit:240});
 assert.equal(result.length,240);
 assert.ok(performance.now()-start<250,'degenerate zoom-out should scan occupied buckets only');
});
