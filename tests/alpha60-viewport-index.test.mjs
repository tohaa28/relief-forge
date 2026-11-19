import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildManualViewportIndex} from '../web/manual-viewport-index.js';

const doc=(n=1975)=>({
 width:120,height:80,paths:Array.from({length:n},(_,i)=>{
  const x=(i%79)*1.45+1,y=Math.floor(i/79)*1.4+1;
  const commands=[['M',x,y],['C',x+.12,y,x+.3,y+.4,x+.7,y+.4],
    ['Q',x+.95,y+.4,x+.95,y+.9],['L',x,y+.9],['Z']];
  return {kind:'vector',offset:[0,0],commands,closed:true,
    artwork:'<path/>',points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))};
 })
});
test('1975 independent contours: zoom lookup restricts to viewport and never enumerates 7900 segments',()=>{
 const source=doc(),original=JSON.stringify(source),index=buildManualViewportIndex(source);
 const metadata=index.stats();
 assert.equal(metadata.total,1975*4);
 assert.ok(metadata.buckets>100);
 const visible=index.query({x:52,y:17,width:1.5,height:1.5},{limit:420,padding:.1});
 const counts=visible.reduce((n,e)=>n+e.segments,0);
 assert.ok(counts>0&&counts<100,
   'zoom viewport should contain very few Bézier pieces, actual: '+counts);
 assert.ok(index.stats().lastCandidates<1000,
   'spatial buckets should avoid scanning 7900 pieces: '+index.stats().lastCandidates);
 assert.ok(visible.some(g=>g.path!==0),'not just the first selected curve');
 assert.equal(JSON.stringify(source),original);
});
test('full viewport and extreme zoom out return bounded local shape budget',()=>{
 const index=buildManualViewportIndex(doc());
 const wide=index.query({x:0,y:0,width:120,height:80},{limit:420});
 assert.ok(wide.reduce((sum,g)=>sum+g.segments,0)<=420);
 assert.ok(wide.length<=420);
 const absent=index.query({x:10000,y:10000,width:.01,height:.01});
 assert.deepEqual(absent,[]);
});
test('native shape d conserves C/Q commands and closure edge from Z',()=>{
 const index=buildManualViewportIndex({
  width:60,height:40,paths:[{kind:'vector',offset:[0,0],
   artwork:'<path/>',closed:true,points:[[0,0],[20,0]],
   commands:[['M',0,0],['C',5,10,15,10,20,0],['Q',25,10,20,20],['Z']]}]
 });
 const result=index.query({x:0,y:0,width:40,height:40},{padding:0});
 assert.equal(result.length,1);
 assert.equal(result[0].segments,3);
 assert.match(result[0].d,/C5 10 15 10 20 0/);
 assert.match(result[0].d,/Q25 10 20 20/);
 assert.match(result[0].d,/L0 0/);
});
test('zoom hot path parks complex source before viewBox manipulation and batches wheel frames',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/function enableManualViewportMode\(\)/);
 assert.match(app,/while\(geometry\.firstChild\)parkedGeometry\.appendChild\(geometry\.firstChild\)/);
 assert.match(app,/if\(curveEditing\(\)\)enableManualViewportMode\(\); \/\/ BEFORE DOM invalidation/);
 assert.match(app,/manualWheelBatch\.factor\*=factor/);
 assert.match(app,/if\(!manualWheelFrame\)manualWheelFrame=requestAnimationFrame/);
 assert.match(app,/manualViewportIndex\.query\(frame,/);
 assert.match(app,/manualLocalElements\.set\(item\.path,pair\)/);
 assert.match(app,/function disableManualViewportMode\(\)/);
});
test('imported giant EPS snapshot does not occupy browser-session journal',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 assert.match(app,/if\(detail\?\.stats\?\.budget\?\.document\)/);
 assert.match(app,/const \{document:_document,\.\.\.budget\}=detail\.stats\.budget/);
 assert.match(app,/journal\.push\(\{at:new Date\(\)\.toISOString\(\),action,detail\}\)/);
});
