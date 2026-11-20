import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {nativeIntersections} from '../web/native-intersections.js';
import {repairSelfIntersections} from '../web/self-intersection-repair.js';
import {exportEps} from '../web/eps-export.js';
const make=commands=>({kind:'vector',artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+
  '" fill="none" stroke="#123456" stroke-width="0.1"/>',commands,
  points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),closed:commands.at(-1)[0]==='Z',offset:[0,0]});
const doc=p=>({format:'relief-forge',version:1,width:100,height:100,paths:[p]});
const run=(d,options={})=>repairSelfIntersections(d,[0],.01,{Parser:DOMParser,...options});
const little=[['M',0,0],['L',2.2,0],['L',1.8,.02],['L',2.2,-.02],['L',3,0]];
test('alpha68 exact crossing exposes two curve parameters, not sampled guesses',()=>{
 const hits=nativeIntersections([make(little)]).filter(h=>h.kind==='self_intersection');
 assert.ok(hits.length>0,'fixture must be a genuine crossing');
 assert.ok(hits.some(h=>h.segments?.length===2&&h.times.every(Number.isFinite)));
});
test('alpha68 hybrid removes a small nonadjacent loop without editing source or losing paint',()=>{
 const source=doc(make(little)),original=structuredClone(source);
 const outcome=run(source);
 assert.deepEqual(source,original);
 assert.ok(outcome.stats.detected>=1);
 assert.ok(outcome.stats.removedLoops>=1,'open thin loop should be safely removed');
 assert.equal(nativeIntersections([outcome.document.paths[0]]).filter(h=>h.kind==='self_intersection').length,0);
 assert.match(outcome.document.paths[0].artwork,/stroke="#123456"/);
 assert.match(exportEps(outcome.document),/ C$/m);
});
test('alpha68 strategy and size gates are explicit and non-destructive',()=>{
 const source=doc(make(little));
 assert.deepEqual(run(source,{mode:'handles'}).document,source,'line segments have no cubic handles');
 assert.deepEqual(run(source,{mode:'loops',size:'micro'}).document,source,'0.4 mm loop exceeds micro threshold');
 assert.throws(()=>run(source,{mode:'unknown'}),/режим/);
 assert.throws(()=>repairSelfIntersections(source,[0],0,{Parser:DOMParser}),/допуск/);
 assert.deepEqual(repairSelfIntersections(source,[],.01,{Parser:DOMParser}).document,source);
});
test('alpha68 closed filled bowtie is protected in strict mode; unfixable does not add nodes',()=>{
 const a=make([['M',0,0],['L',4,4],['L',0,4],['L',4,0],['Z']]);
 a.artwork=a.artwork.replace('fill="none"','fill="#000"');a.closed=true;
 const source=doc(a),res=run(source,{mode:'loops',preserve:true});
 assert.deepEqual(res.document,source);
 assert.equal(res.stats.removedLoops,0);
});
test('alpha68 settings are staged; both preview pipelines use the same native repair',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(html,/id="repair-self-intersections" type="checkbox" checked/);
 assert.match(html,/id="self-intersection-preserve" type="checkbox" checked/);
 assert.match(html,/id="self-intersection-size"[^>]*>[\s\S]*?value="all" selected/);
 assert.equal((app.match(/repairSelfIntersections\(untangled.document,/g)||[]).length,2);
 assert.match(app,/const next=readSettingsForm\(\),error=validateSettingsDraft\(next\)/);
 assert.match(app,/settingSelects.has\(id\)\?\$\(id\)\.value/);
 assert.match(app,/selfIntersectionSettings:|stats.selfIntersectionSettings=/);
});

test('repair limit applies across all paths, including independent open loops',()=>{
 const first=make(little),second=make(little.map(([op,x,y])=>[op,x+10,y]));
 const source={...doc(first),paths:[first,second]};
 const result=repairSelfIntersections(source,[0,1],.01,{Parser:DOMParser,maxRepairs:1});
 assert.equal(result.stats.removedLoops,1);
 assert.equal(result.stats.limited,1);
 assert.deepEqual(result.document.paths[1],second);
});

test('simple paths do not exhaust the budget for paths requiring intersection checks',()=>{
 const simple=make([['M',20,0],['L',21,0]]),loop=make(little);
 const source={...doc(simple),paths:[simple,loop]};
 const result=repairSelfIntersections(source,[0,1],.01,{Parser:DOMParser,maxPaths:1});
 assert.equal(result.stats.removedLoops,1);
 assert.deepEqual(result.document.paths[0],simple);
});
