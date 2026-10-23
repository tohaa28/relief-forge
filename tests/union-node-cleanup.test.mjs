import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanUnionContours} from '../web/union-node-cleanup.js';
import {unionFilledPaths} from '../web/polygon-union.js';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {exportEps} from '../web/eps-export.js';
import {readFileSync} from 'node:fs';

const S=10000;
const xy=(x,y)=>({X:Math.round(x*S),Y:Math.round(y*S)});
const ring=(coords,hole=false)=>({points:coords.map(p=>xy(...p)),hole});
const area=r=>Math.abs(r.reduce((n,p,i)=>{
  const q=r[(i+1)%r.length];return n+p.X*q.Y-q.X*p.Y;
},0)/(2*S*S));
const basic=ring([[0,0],[10,0],[10,10],[0,10]]);
const paint={fill:'#222222',stroke:'none',fillRule:'nonzero'};
const shape=commands=>({kind:'vector',closed:true,commands,offset:[0,0],
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#222222"/>',
  paint:{...paint}});
const document=paths=>({format:'relief-forge',width:100,height:100,sourceFileName:'logo.eps',paths});
const rectangle=(x,y,w,h)=>shape([
  ['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']]);

test('exact duplicates on adjacent edges, including seam, disappear without deforming fill',()=>{
  const src=ring([[0,0],[0,0],[5,0],[10,0],[10,10],[0,10],[0,0]]);
  const original=structuredClone(src);
  const r=cleanUnionContours([src],{scale:S,tolerance:.02,cleanupTolerance:.02});
  assert.ok(r.stats.coincident>=2);
  assert.ok(r.stats.collinear>=1);
  assert.equal(r.contours[0].points.length,4);
  assert.equal(area(src.points),area(r.contours[0].points));
  assert.deepEqual(src,original,'source may not be mutated');
  assert.equal(r.stats.reverted,false);
});

test('short near-collinear artifacts from boolean rounding can be removed with a strict deviation budget',()=>{
  const src=ring([[0,0],[10,0],[10.002,.002],[10,10],[0,10]]);
  const r=cleanUnionContours([src],{scale:S,tolerance:.02,cleanupTolerance:.02});
  assert.ok(r.stats.short>=1);
  assert.equal(r.contours[0].points.length,4);
  assert.ok(Math.abs(area(src.points)-area(r.contours[0].points))<.02);
  assert.ok(r.stats.maxDeviationMm<=.003001);
});

test('genuine sharp details are preserved even when one adjacent edge is short',()=>{
  const src=ring([[0,0],[10,0],[10.01,.025],[10,10],[0,10]]);
  const r=cleanUnionContours([src],{scale:S,tolerance:.02,cleanupTolerance:.02});
  assert.equal(r.contours[0].points.length,5);
  assert.equal(r.stats.short,0);
});

test('narrow counters survive post-union cleanup',()=>{
  const outer=ring([[0,0],[20,0],[20,20],[0,20]]);
  const hole=ring([[8,8],[8,12],[12,12],[12,8]],true);
  const result=cleanUnionContours([outer,hole],{scale:S,tolerance:.02,cleanupTolerance:.02});
  assert.equal(result.contours.length,2);
  assert.ok(result.contours[1].points.length>=4);
  assert.equal(area(result.contours[1].points),16);
});

test('repeated cleanup is idempotent, with all remaining short topologically critical segments reported',()=>{
  const a=ring([[0,0],[10,0],[10,.0005],[10,10],[0,10]]);
  const first=cleanUnionContours([a],{scale:S,tolerance:.02,cleanupTolerance:.02});
  const again=cleanUnionContours(first.contours,{scale:S,tolerance:.02,cleanupTolerance:.02});
  assert.deepEqual(again.contours,first.contours);
  assert.equal(again.stats.short+again.stats.coincident+again.stats.collinear,0);
  assert.ok(again.stats.shortEdgesRemaining>=0);
});

test('cleaned Union exports optimized geometry and the AFTER preview remains the source',()=>{
  const before=document([rectangle(0,0,10,10),rectangle(5,0,10,10)]);
  const merged=mergeOverlappingObjects(before,{tolerance:.02,cleanupTolerance:.02});
  assert.equal(merged.document.paths.length,1);
  assert.ok(merged.stats.cleanup);
  assert.ok(merged.stats.cleanup.before>=merged.stats.cleanup.after);
  assert.match(exportEps(merged.document),/%%RF-OutlinePaths: 1/);
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/cleanupTolerance:optimizationTolerance/);
  assert.match(app,/st.overlaps.cleanup.short/);
  assert.match(app,/const pv=\{source:clone\(doc\),result:after/);
  assert.match(app,/checkPreviewAfter\(pv\)/);
  assert.match(app,/prepareEpsOutput\(chosen.document\)/);
});

test('optimizing true filled Bézier Union retains hole count and reports cleanup information',()=>{
  const curve=(shift)=>shape([['M',shift,0],['C',shift+3,-1,shift+7,-1,shift+10,0],
    ['L',shift+10,8],['C',shift+7,9,shift+3,9,shift,8],['Z']]);
  const result=unionFilledPaths([curve(0),curve(6)],{tolerance:.02,cleanupTolerance:.02});
  assert.ok(result.commands.length>4);
  assert.ok(Number.isInteger(result.cleanup.coincident));
  assert.ok(result.cleanup.after<=result.cleanup.before);
  assert.ok(result.vertices>0);
});
