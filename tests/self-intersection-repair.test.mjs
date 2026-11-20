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

test('a single handle removes a tiny cubic crossing inside tolerance',()=>{
 const source=doc(make([['M',0,0],['C',.015,.015,-.015,.015,.005,0]]));
 assert.equal(nativeIntersections(source.paths).filter(h=>h.crossing).length,1);
 const {document,stats}=run(source,{mode:'handles'});
 const [before,after]=[source.paths[0],document.paths[0]].map(p=>p.commands[1]);
 assert.equal(stats.correctedHandles,1);
 assert.ok(stats.maxDeviationMm<=.01);
 assert.notDeepEqual(after.slice(1,3),before.slice(1,3));
 assert.deepEqual(after.slice(3),before.slice(3),'other handle and endpoint are preserved');
 assert.equal(nativeIntersections(document.paths).filter(h=>h.crossing).length,0);
});

test('witnessed crossings are prioritized when eligible paths outnumber repair slots',()=>{
 const ordinary=make([['M',20,0],['L',21,0],['L',21,1],['L',22,1]]);
 const loop=make(little),source={...doc(ordinary),paths:[ordinary,loop]};
 const {document,stats}=repairSelfIntersections(source,[0,1],.01,{Parser:DOMParser,maxPaths:1});
 assert.equal(stats.removedLoops,1);
 assert.deepEqual(document.paths[0],ordinary);
 assert.equal(nativeIntersections([document.paths[1]]).filter(h=>h.crossing).length,0);
});

test('tiny open loop is trimmed at its native intersection without a bridge',()=>{
 const tiny=little.map(([op,x,y])=>[op,x*.01,y*.01]);
 const source=doc(make(tiny));
 const {document,stats}=run(source,{mode:'loops'});
 assert.equal(stats.removedLoops,1);
 assert.ok(stats.maxDeviationMm<=.01);
 assert.ok(document.paths[0].commands.every(c=>c[0]==='M'||c[0]==='L'));
 assert.equal(nativeIntersections(document.paths).filter(h=>h.crossing).length,0);
});

test('separation preserves the microloop and opens a gap at its former crossing',()=>{
 const tiny=little.map(([op,x,y])=>[op,x*.1,y*.1]);
 const source=doc(make(tiny)),original=structuredClone(source);
 const {document,stats}=run(source,{mode:'separate'});
 const result=document.paths[0];
 const starts=result.commands.filter(c=>c[0]==='M');
 assert.deepEqual(source,original);
 assert.equal(stats.separatedLoops,1);
 assert.equal(stats.removedLoops,0);
 assert.equal(starts.length,2);
 assert.equal(result.commands.at(-1)[0],'Z');
 assert.equal(nativeIntersections([result]).length,0);
 const join=result.commands[1].slice(1),closedStart=starts[1].slice(1);
 const gap=Math.hypot(join[0]-closedStart[0],join[1]-closedStart[1]);
 assert.ok(gap>0&&gap<=.01);
 assert.match(result.artwork,/stroke="#123456"/);
});

test('separation leaves filled shapes and non-micro loops intact',()=>{
 const a=make([['M',0,0],['L',.04,.04],['L',0,.04],['L',.04,0],['Z']]);
 const closed=run(doc(a),{mode:'separate'});
 assert.equal(closed.stats.separatedLoops,1);
 assert.equal(closed.document.paths[0].commands.filter(c=>c[0]==='Z').length,2);
 a.artwork=a.artwork.replace('fill="none"','fill="#000"');
 for(const source of [doc(a),doc(make(little))]){
  const result=run(source,{mode:'separate',preserve:false});
  assert.equal(result.stats.separatedLoops,0);
  assert.deepEqual(result.document,source);
 }
});
