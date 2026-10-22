import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {exportEps} from '../web/eps-export.js';
import {recoverOutlineOnlyEps,epsMetadata,interpretEps} from '../web/eps-pipeline.js';
import {importRichSvg} from '../web/rich-svg.js';

const forbidden=/^\s*(?:stroke|fill|eofill|setlinewidth|setgray|setrgbcolor|setcmykcolor|setcolor|showpage)\b/gm;
const roundTrip=ps=>importRichSvg(recoverOutlineOnlyEps(new TextEncoder().encode(ps)).svg,{unitsPerInch:72,Parser:DOMParser});

test('legacy EPS strips colors and all print widths from styled imported vectors',()=>{
  const source={width:50,height:25,paths:[
    {kind:'vector',artwork:'<path stroke="#ff0000" stroke-width="10" fill="#00ff00"/>',offset:[1,2],
      commands:[['M',0,0],['C',7,0,12,8,20,10],['Z']],points:[[0,0],[20,10]],closed:true},
    {closed:false,points:[[3,4],[13,14]]}
  ]};
  const unchanged=JSON.stringify(source);
  const ps=exportEps(source);
  assert.equal(JSON.stringify(source),unchanged);
  assert.match(ps,/%%Creator: Relief Forge/);
  assert.match(ps,/%%RF-OutlinePaths: 1/);
  assert.doesNotMatch(ps,forbidden);
  assert.doesNotMatch(ps,/#ff0000|#00ff00|set(?:rgb|cmyk|gray)color|setlinewidth|setlinecap/i);
  assert.equal((ps.match(/^N$/gm)||[]).length,1);
  const converted=roundTrip(ps);
  assert.equal(converted.paths.length,2);
  assert.ok(converted.paths[0].commands.some(c=>c[0]==='C'));
  assert.equal(converted.paths[0].closed,true);
  assert.equal(converted.paths[1].closed,false);
  assert.ok(Math.abs(converted.width-50)<1e-5);
  assert.ok(Math.abs(converted.height-25)<1e-5);
});
test('export and local reimport preserve multiple open EPS subpaths',()=>{
  const doc={width:100,height:100,paths:[
    {closed:false,points:[[0,0],[10,10]]},
    {closed:false,points:[[20,20],[30,20],[40,20]]},
    {closed:true,points:[[70,30],[80,30],[80,40]]}
  ]};
  const ps=exportEps(doc);
  const restored=roundTrip(ps);
  assert.equal(restored.paths.length,3);
  assert.deepEqual(restored.paths.map(p=>p.closed),[false,false,true]);
  assert.ok(restored.paths.every(p=>p.kind!=='image'));
  assert.deepEqual(epsMetadata(new TextEncoder().encode(ps)).boundingBox,[0,0,284,284]);
});
test('unpainted export does not initialize heavy interpreters',async()=>{
  const ps=exportEps({width:20,height:10,paths:[{points:[[0,0],[10,0],[10,10]],closed:true}]});
  let called=false;
  const result=await interpretEps(new TextEncoder().encode(ps),{
    runGhostscript:()=>{called=true;throw Error('legacy outline must use direct importer');},mupdf:null
  });
  assert.equal(called,false);
  assert.equal(result.outlineRecovery.source,'relief-forge-outline-paths');
  assert.equal(result.outlineRecovery.count,1);
});
test('legacy EPS exported from supplied-style Corel fixture keeps actual Bezier paths',()=>{
  const raw=new Uint8Array(readFileSync(new URL('fixtures/eps/corel-unpainted.eps',import.meta.url)));
  const doc=importRichSvg(recoverOutlineOnlyEps(raw).svg,{unitsPerInch:72,Parser:DOMParser});
  const ps=exportEps(doc),again=roundTrip(ps);
  assert.equal(again.paths.length,doc.paths.length);
  assert.equal(again.paths.filter(p=>p.closed).length,doc.paths.filter(p=>p.closed).length);
  const before=doc.paths.reduce((sum,p)=>sum+p.commands.filter(c=>c[0]==='C').length,0);
  const after=again.paths.reduce((sum,p)=>sum+p.commands.filter(c=>c[0]==='C').length,0);
  assert.equal(after,before);
  assert.doesNotMatch(ps,forbidden);
});
test('legacy EPS export fails safely on empty and unsupported geometries',()=>{
  assert.throws(()=>exportEps({width:10,height:10,paths:[]}),/нет векторных/);
  assert.throws(()=>exportEps({width:0,height:20,paths:[{points:[[1,2]]}]}),/размер/);
  assert.throws(()=>exportEps({width:10,height:10,paths:[{kind:'image'}]}),/растровые/);
});
