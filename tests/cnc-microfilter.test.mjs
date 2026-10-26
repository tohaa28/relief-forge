import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {closedSubpathBounds,removeTinyClosedSubpaths} from '../web/cnc-microfilter.js';
import {geometryCommands,exportEps,exportColoredEps,verifyEpsOutputGeometry} from '../web/eps-export.js';

const paint={fill:'#ff0000',stroke:'none',fillRule:'evenodd',strokeWidthMm:0.03,opacity:1};
const path=commands=>({kind:'vector',closed:true,commands,offset:[0,0],
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="#ff0000" fill-rule="evenodd"/>',
  paint:{...paint},points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))});
const square=(x,y,w,h)=>[['M',x,y],['L',x+w,y],['L',x+w,y+h],
 ['L',x,y+h],['Z']];
const doc=paths=>({format:'relief-forge',version:1,width:50,height:50,paths});
test('CNC default .1×.1 removes standalone closed object, preserves original DO',()=>{
 const source=doc([path(square(2,2,.04,.07)),path(square(3,3,2,1))]);
 const baseline=structuredClone(source);
 const {document,stats}=removeTinyClosedSubpaths(source);
 assert.equal(stats.removedSubpaths,1);
 assert.equal(stats.removedObjects,1);
 assert.equal(document.paths.length,1);
 assert.deepEqual(source,baseline);
 assert.deepEqual(document.paths[0],source.paths[1]);
 assert.equal(verifyEpsOutputGeometry(document,{content:exportEps(document),source:'outline'}).realNodes,4);
});
test('CNC compound evenodd: removes inner closed detail without changing surrounding original Bézier',()=>{
 const large=[['M',0,0],['C',3,-2,7,-2,10,0],['L',10,10],['L',0,10],['Z']];
 const tiny=square(2,2,.04,.04);
 const source=doc([path([...large,...tiny])]);
 const {document,stats}=removeTinyClosedSubpaths(source);
 assert.equal(stats.removedSubpaths,1);
 assert.equal(stats.removedObjects,0);
 assert.equal(document.paths.length,1);
 assert.deepEqual(geometryCommands(document.paths[0]),large);
 assert.equal(document.paths[0].paint.fillRule,'evenodd');
 assert.ok(document.paths[0].artwork.includes('fill-rule="evenodd"'));
 assert.equal(verifyEpsOutputGeometry(document,{content:exportEps(document),source:'outline'}).realNodes,4);
 const colored=exportColoredEps(document);
 assert.match(colored.content,/setrgbcolor/);
});
test('Exact extrema of cubic, not control hull or endpoint bounding box, determine removal',()=>{
 const tooWide=[['M',0,0],['C',0.5,0,0.5,0,0,0],['L',0,0.01],['Z']];
 const bbox=closedSubpathBounds(tooWide);
 assert.ok(bbox.width>.3&&bbox.width<.5);
 assert.equal(removeTinyClosedSubpaths(doc([path(tooWide)])).stats.removedSubpaths,0);
 const bigHandlesTinyCurve=[['M',0,0],['C',.12,0,-.12,0,0,0],['L',0,.02],['Z']];
 assert.ok(closedSubpathBounds(bigHandlesTinyCurve).width<.1);
 assert.equal(removeTinyClosedSubpaths(doc([path(bigHandlesTinyCurve)])).stats.removedSubpaths,1);
});
test('CNC protects narrow long closed slots, open traces, and exactly-on-boundary squares',()=>{
 const long=path(square(0,0,4,.001));
 const opened=path([['M',1,1],['L',1.03,1.03]]);opened.closed=false;
 const boundary=path(square(3,3,.1,.02));
 const result=removeTinyClosedSubpaths(doc([long,opened,boundary]));
 assert.equal(result.stats.removedSubpaths,0);
 assert.equal(result.document.paths.length,3);
 assert.equal(result.stats.retainedOpen,1);
});
test('CNC independent width and height thresholds, disabled option leaves EPS intact',()=>{
 const source=doc([path(square(1,2,.04,.08)),path(square(1,4,1,2))]);
 const off=removeTinyClosedSubpaths(source,{enabled:false,width:.1,height:.1});
 assert.deepEqual(off.document,source);
 assert.equal(exportEps(off.document),exportEps(source));
 assert.equal(removeTinyClosedSubpaths(source,{width:.03,height:.1}).stats.removedSubpaths,0);
 assert.equal(removeTinyClosedSubpaths(source,{width:.05,height:.07}).stats.removedSubpaths,0);
 assert.equal(removeTinyClosedSubpaths(source,{width:.05,height:.09}).stats.removedSubpaths,1);
 assert.throws(()=>removeTinyClosedSubpaths(source,{width:0,height:.1}),/габариты/i);
});
test('CNC preserves compound object if only one decorated multi-element artwork cannot be reconstructed safely',()=>{
 const compound=path([...square(0,0,4,4),...square(1,1,.02,.02)]);
 compound.paint=undefined;compound.artwork='<g><path d="M0 0L4 4" fill="blue"/><path d="M1 1L1.02 1.02" fill="red"/></g>';
 const r=removeTinyClosedSubpaths(doc([compound]));
 assert.equal(r.stats.skippedUnsafe,1);
 assert.deepEqual(r.document.paths[0],compound);
});
test('Small geometry filter wired only into AFTER and stale EPS preview guarded by settings',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const after=readFileSync(new URL('../web/after-result.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.equal((app.match(/removeTinyClosedSubpaths\(budget.document/g)||[]).length,2);
 assert.match(app,/stats.micro=filtered.stats/);
 assert.match(app,/micro:filtered.stats/);
 assert.match(app,/beforeDoc:clone\(doc\)/);
 assert.match(after,/s\.micro\?\.width!==settings\.microWidth/);
 assert.match(html,/id="remove-micro"[^>]*checked/);
 assert.match(html,/id="micro-width"[^>]*value="0.1"/);
 assert.match(html,/id="micro-height"[^>]*value="0.1"/);
});
