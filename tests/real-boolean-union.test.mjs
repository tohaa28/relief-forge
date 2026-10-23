import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeOverlappingObjects} from '../web/overlap-merge.js';
import {unionFilledPaths,filledPathsOverlap,polygonUnionEngine} from '../web/polygon-union.js';
import {exportEps} from '../web/eps-export.js';
import {readFileSync} from 'node:fs';

const paint={fill:'#231f20',stroke:'none',fillRule:'nonzero'};
const d=paths=>({format:'relief-forge',width:50,height:50,paths,sourceFileName:'sample.eps'});
const path=(commands,ink=paint)=>({
  kind:'vector',closed:true,commands,offset:[0,0],paint:{...ink},
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#231f20"/>'
});
const rect=(x,y,w,h,ink=paint)=>path([
  ['M',x,y],['L',x+w,y],['L',x+w,y+h],['L',x,y+h],['Z']],ink);
const area=commands=>{
  let rings=[],ring=null;for(const c of commands){
    if(c[0]==='M'){ring=[];rings.push(ring);ring.push([c[1],c[2]]);}
    if(c[0]==='L')ring.push([c[1],c[2]]);
  }
  return rings.reduce((sum,r)=>sum+Math.abs(r.reduce((a,p,i)=>{
    const q=r[(i+1)%r.length];return a+p[0]*q[1]-q[0]*p[1];
  },0))/2,0);
};

test('Clipper is vendored and true Union cuts away internal overlapping boundaries',()=>{
  assert.match(polygonUnionEngine,/Clipper/);
  const before=d([rect(0,0,10,10),rect(5,0,10,10)]);
  const original=structuredClone(before);
  const result=mergeOverlappingObjects(before,{tolerance:.01});
  assert.equal(result.stats.weldedGroups,1);
  assert.equal(result.stats.compoundGroups,0);
  assert.equal(result.document.paths.length,1);
  assert.equal(result.document.paths[0].commands.filter(c=>c[0]==='M').length,1);
  assert.ok(Math.abs(area(result.document.paths[0].commands)-150)<.01);
  assert.deepEqual(before,original);
  assert.match(exportEps(result.document),/%%RF-OutlinePaths: 1/);
});
test('two closed filled cubic Bézier shapes yield real polygon union, not a compound collection',()=>{
  const curve=(shift)=>path([
    ['M',shift,0],['C',shift+2,-1,shift+6,-1,shift+8,0],
    ['L',shift+8,10],['C',shift+6,11,shift+2,11,shift,10],['Z']]);
  const a=curve(0),b=curve(4);
  assert.equal(filledPathsOverlap(a,b,{tolerance:.01}),true);
  const r=mergeOverlappingObjects(d([a,b]),{tolerance:.01});
  assert.equal(r.stats.weldedGroups,1);
  assert.equal(r.document.paths.length,1);
  assert.equal(r.document.paths[0].commands.filter(c=>c[0]==='M').length,1,
    'no internal painted overlap may remain in AFTER');
  assert.ok(r.document.paths[0].commands.filter(c=>c[0]==='L').length>10);
  assert.equal(r.document.paths[0].paint.fillRule,'evenodd');
  assert.ok(r.stats.flattenedVertices>0);
});
test('a CorelDRAW-style single filled compound path containing overlapping subpaths is normalized',()=>{
  const a=rect(0,0,10,10),b=rect(4,0,10,10);
  const compound=path([...a.commands,...b.commands]);
  const r=mergeOverlappingObjects(d([compound]),{tolerance:.01});
  assert.equal(r.stats.before,1);
  assert.equal(r.stats.after,1);
  assert.equal(r.stats.normalizedObjects,1);
  assert.equal(r.document.paths[0].commands.filter(c=>c[0]==='M').length,1);
  assert.ok(Math.abs(area(r.document.paths[0].commands)-140)<.01);
});
test('single compound with outer contour and inner opposite-winding hole preserves counters',()=>{
  const outer=rect(0,0,20,20).commands;
  // opposite orientation: keep this cavity as a genuine hole under nonzero rule
  const inner=[['M',5,5],['L',5,15],['L',15,15],['L',15,5],['Z']];
  const cutout=path([...outer,...inner]);
  const r=mergeOverlappingObjects(d([cutout]),{tolerance:.01});
  assert.equal(r.stats.normalizedObjects,1);
  assert.equal(r.stats.holes,1);
  assert.equal(r.document.paths[0].commands.filter(c=>c[0]==='M').length,2);
  assert.equal(r.document.paths[0].paint.fillRule,'evenodd');
});
test('point-contact, different inks and open stroke geometry are never wrongly welded',()=>{
  const a=rect(0,0,10,10),b=rect(10,10,10,10);
  assert.equal(filledPathsOverlap(a,b,{tolerance:.01}),false);
  const c=rect(4,0,10,10,{fill:'#ffffff',stroke:'none'});
  const r=mergeOverlappingObjects(d([a,b,c]),{tolerance:.01});
  assert.equal(r.stats.weldedGroups,0);
  assert.equal(r.document.paths.length,3);
  const open={kind:'vector',closed:false,points:[[0,0],[5,5],[10,0]],paint:{fill:'none',stroke:'#231f20'}};
  const x=mergeOverlappingObjects(d([open,structuredClone(open)]),{tolerance:.01});
  assert.equal(x.stats.weldedGroups,0);
});
test('the calculation displays actual union in AFTER and reuse existing optimized result for export',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  assert.match(app,/mergeOverlappingObjects\(optimized.document/);
  assert.match(app,/mergeOverlappingObjects\(result/);
  assert.match(app,/const pv=\{source:clone\(doc\),result:after/);
  assert.match(app,/checkPreviewAfter\(pv\)/);
  assert.match(app,/prepareEpsOutput\(chosen.document\)/);
  assert.doesNotMatch(app,/function saveEpsWithPreflight\(/);
});
