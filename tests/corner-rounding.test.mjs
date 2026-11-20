import test from 'node:test';
import assert from 'node:assert/strict';
import {roundBezierCorners} from '../web/corner-rounding.js';
import {nativeParts,pointDistance} from '../web/native-bezier.js';
const path=(points,closed=false)=>({points,closed});
const run=(p,t=.5,options)=>roundBezierCorners({paths:[p]},[0],t,options);
test('sharp line corner becomes a real tangent cubic, source and free endpoints preserved',()=>{
 const p=path([[0,0],[10,0],[10,10]]),snapshot=structuredClone(p),r=run(p);
 assert.equal(r.stats.rounded,1);assert.equal(r.stats.rejected,false);assert.deepEqual(p,snapshot);
 const segments=nativeParts(r.document.paths[0])[0].segments.map(s=>s.controls);
 assert.deepEqual(segments.map(p=>p.length),[2,4,2]);
 assert.deepEqual(segments[0][0],[0,0]);assert.deepEqual(segments.at(-1).at(-1),[10,10]);
 const c=segments[1];assert.equal(c[0][1],c[1][1]);assert.equal(c[2][0],c[3][0]);
 assert.ok(r.stats.maxDeviationBound<=.5);
});
test('closed square rounds all four corners including closing seam',()=>{
 const r=run(path([[0,0],[10,0],[10,10],[0,10]],true));
 assert.equal(r.stats.rounded,4);assert.equal(r.document.paths[0].commands.filter(c=>c[0]==='C').length,4);
 assert.equal(nativeParts(r.document.paths[0])[0].closed,true);
});
test('zero is exact off, straight joins unchanged, budget is explicit',()=>{
 const p=path([[0,0],[10,0],[10,10],[20,10]]);
 assert.deepEqual(run(p,0).document.paths[0],p);
 assert.equal(run(path([[0,0],[1,0],[2,0]])).stats.rounded,0);
 assert.equal(run(p,.5,{maxCorners:1}).stats.rounded,1);
});
test('larger tolerance visibly increases corner setback',()=>{
 const p=path([[0,0],[10,0],[10,10]]);
 const end=t=>nativeParts(run(p,t).document.paths[0])[0].segments[0].controls.at(-1);
 assert.ok(pointDistance(end(.5),[10,0])>pointDistance(end(.05),[10,0])*9);
});
test('curved corner retains exact quadratic intervals and world offset',()=>{
 const p={artwork:'<path/>',commands:[['M',0,0],['Q',5,0,10,0],['Q',10,5,10,10]],offset:[20,30],points:[[0,0],[10,0],[10,10]],closed:false,paint:{fill:'none',stroke:'#123'}};
 const r=run(p);assert.equal(r.stats.rounded,1);assert.deepEqual(r.document.paths[0].paint,p.paint);
 assert.deepEqual(nativeParts(r.document.paths[0])[0].segments.map(s=>s.controls.length),[3,4,3]);
 assert.deepEqual(r.document.paths[0].commands[0],['M',20,30]);
});
test('new contact with nearby geometry rolls back rounding',()=>{
 const p=path([[0,0],[10,0],[10,10]]),base=run(p),c=nativeParts(base.document.paths[0])[0].segments[1].controls;
 // A short transverse obstacle through the midpoint of the new fillet, away from the original L.
 const m=c.reduce((v,p,i)=>v.map((x,j)=>x+p[j]*[1,3,3,1][i]/8),[0,0]);
 const doc={paths:[p,path([[m[0]-.001,m[1]-.001],[m[0]+.001,m[1]+.001]])]};
 const r=roundBezierCorners(doc,[0],.5);assert.equal(r.stats.rejected,true);assert.deepEqual(r.document,doc);
});
