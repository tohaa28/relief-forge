import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as mupdf from 'mupdf';
import {DOMParser} from '@xmldom/xmldom';
import {epsProgram,epsMetadata,interpretEps,recoverOutlineOnlyEps} from '../web/eps-pipeline.js';
import {recoverUnpaintedCorelOutlines} from '../web/corel-outline.js';
import {importRichSvg,exportDocument,sampledContours,worldData,safeFragment} from '../web/rich-svg.js';
const root=new URL('../',import.meta.url),fixture=new Uint8Array(readFileSync(new URL('tests/fixtures/eps/curves-text-clip.eps',root)));
const context=vm.createContext({process,require:createRequire(import.meta.url),console,Buffer,WebAssembly,TextDecoder,TextEncoder,URL,setTimeout,clearTimeout,__dirname:new URL('web/vendor/ghostscript/',root).pathname});
vm.runInContext(readFileSync(new URL('web/vendor/ghostscript/gs-core.js',root),'utf8'),context);
const wasmBinary=readFileSync(new URL('web/vendor/ghostscript/gs-core.wasm',root));
async function runGhostscript(program,args,fonts=[]){
  const logs=[],core=await context.createGhostscriptCore({wasmBinary,print:s=>logs.push(String(s)),printErr:s=>logs.push(String(s))});
  core.FS.mkdir('/fonts');core.FS.writeFile('/input.eps',program);
  for(const f of fonts)core.FS.writeFile('/fonts/'+f.name,f.bytes);
  let code=0;try{code=core.callMain(args)||0;}catch(e){if(typeof e.status==='number')code=e.status;else throw e;}
  if(code)throw Error(logs.join('\n'));return {pdf:core.FS.readFile('/output.pdf').slice(),logs};
}
const convert=bytes=>interpretEps(bytes,{runGhostscript,mupdf});
test('DOS EPS binary header and trailer / HiRes bounding boxes',()=>{
  const b=new Uint8Array(30+fixture.length);b.set([0xc5,0xd0,0xd3,0xc6]);const v=new DataView(b.buffer);v.setUint32(4,30,true);v.setUint32(8,fixture.length,true);b.set(fixture,30);
  assert.deepEqual(epsProgram(b),fixture);assert.equal(epsMetadata(fixture).widthPt,288);
  v.setUint32(8,b.length,true);assert.throws(()=>epsProgram(b),/диапазон/);
  assert.deepEqual(epsMetadata(new TextEncoder().encode('%!PS\n%%BoundingBox: (atend)\n%%BeginDocument: nested\n%%BoundingBox: 0 0 1 1\n%%EndDocument\n%%Trailer\n%%BoundingBox: -5 -6 95 44')).boundingBox,[-5,-6,95,44]);
});
test('real Ghostscript WASM → MuPDF WASM retains curves, clipping, outlined text, units and SVG/project round trip',async()=>{
  const r=await convert(fixture);assert.equal(r.widthPt,288);assert.equal(r.heightPt,144);
  const doc=importRichSvg(r.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.ok(Math.abs(doc.width-101.6)<1e-6);assert.ok(Math.abs(doc.height-50.8)<1e-6);
  assert.ok(doc.paths.length>=8);assert.match(doc.svgDefs,/clipPath/);assert.ok(doc.paths.some(p=>p.commands.some(s=>s[0]==='C')));
  assert.match(doc.paths.map(p=>p.artwork).join(''),/fill="#ff0000"/);
  assert.match(exportDocument(doc),/clip-path="url\(#rf-import-/);
  const saved=JSON.parse(JSON.stringify(doc));assert.equal(exportDocument(saved),exportDocument(doc));
  const reopened=importRichSvg(exportDocument(doc),{Parser:DOMParser});assert.ok(Math.abs(reopened.width-doc.width)<1e-6);assert.equal(reopened.paths.length,doc.paths.length);
  const curve=doc.paths.find(p=>p.commands.some(s=>s[0]==='C')),original=worldData(curve);assert.ok(sampledContours(curve,.01)[0].points.length>curve.points.length);assert.equal(worldData(curve),original);
});
test('procedural PostScript, absent showpage, bitmap colorimage, compound holes and CMYK',async()=>{
  const ps=`%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 100 100
/box {newpath 0 0 moveto 10 0 lineto 10 10 lineto closepath fill} bind def
0 1 1 0 setcmykcolor 3 {box 20 0 translate} repeat
initmatrix newpath 10 30 moveto 90 30 lineto 90 90 lineto 10 90 lineto closepath 30 50 moveto 30 70 lineto 70 70 lineto 70 50 lineto closepath eofill
gsave 5 5 translate 15 15 scale 2 2 8 [2 0 0 -2 0 2] {<ff000000ff000000ffffffff>} false 3 colorimage grestore
%%EOF`;
  const r=await convert(new TextEncoder().encode(ps)),d=importRichSvg(r.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.ok(d.paths.length>=5);assert.ok(d.paths.some(p=>p.kind==='image'));assert.match(exportDocument(d),/data:image\/png;base64,/);assert.ok(d.paths.some(p=>p.commands.filter(s=>s[0]==='M').length>1));
});
test('broken PostScript is rejected',async()=>{await assert.rejects(()=>convert(new TextEncoder().encode('%!PS\n%%BoundingBox: 0 0 10 10\nnot_a_postscript_operator')),/undefined|Error/);});
test('SVG arcs, transforms, uses and compound curves preserve geometry and reject active/external content',()=>{
  const d=importRichSvg('<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="50mm" viewBox="0 0 100 50"><defs><path id="a" d="M0 0H10V10Z"/></defs><use href="#a" x="20" transform="translate(2 3)"/><g transform="scale(2)"><path d="M1 2q2 3 4 5t4 5a2 3 0 0 1 2 3Z" fill-rule="evenodd"/></g></svg>',{Parser:DOMParser});
  assert.deepEqual(d.paths[0].points,[[22,3],[32,3],[32,13]]);assert.ok(d.paths[1].commands.some(s=>s[0]==='C'));
  assert.throws(()=>safeFragment('<script>alert(1)</script>',DOMParser));assert.throws(()=>safeFragment('<image href="https://evil.test/image"/>',DOMParser));
});


test('unpainted CorelDRAW EPS restores exact cubic curves for display and Rust diagnosis',async()=>{
  const input=new Uint8Array(readFileSync(new URL('tests/fixtures/eps/corel-unpainted.eps',root)));
  const bytesBefore=Buffer.from(input);
  const restored=recoverUnpaintedCorelOutlines(input,epsMetadata(input));
  assert.equal(restored.count,2);
  assert.match(restored.svg,/fill="none" stroke="#34465b"/);
  assert.match(restored.svg,/C 60 45 90 45 105 20/);
  const interpreted=await convert(input);
  assert.equal(interpreted.outlineRecovery?.count,2);
  assert.ok(interpreted.warnings.some(s=>s.includes('непечатаемых контуров')));
  const doc=importRichSvg(interpreted.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.equal(doc.paths.length,2);
  assert.ok(Math.abs(doc.width-100*25.4/72)<1e-8);
  assert.ok(Math.abs(doc.height-40*25.4/72)<1e-8);
  assert.ok(doc.paths.some(p=>p.commands.some(c=>c[0]==='C')));
  assert.ok(doc.paths.every(p=>p.closed&&p.kind==='vector'));
  const originalCommands=doc.paths.map(p=>JSON.stringify(p.commands));
  const flattened=doc.paths.flatMap(p=>sampledContours(p,0.01));
  assert.equal(flattened.length,2);
  assert.ok(flattened.reduce((n,p)=>n+p.points.length,0)>8);
  assert.deepEqual(doc.paths.map(p=>JSON.stringify(p.commands)),originalCommands);
  assert.deepEqual(Buffer.from(input),bytesBefore);
  const reopened=importRichSvg(exportDocument(doc),{Parser:DOMParser});
  assert.equal(reopened.paths.length,2);
});

test('Corel outline fallback is limited to certified, simple, unpainted single-page source',()=>{
  const input=new Uint8Array(readFileSync(new URL('tests/fixtures/eps/corel-unpainted.eps',root)));
  const text=new TextDecoder('latin1').decode(input),metadata=epsMetadata(input);
  const run=t=>recoverUnpaintedCorelOutlines(new TextEncoder().encode(t),metadata);
  assert.equal(run(text.replace('CorelDRAW','NotCorel')),null);
  assert.equal(run(text.replace('N\n%%PageTrailer','S\n%%PageTrailer')),null);
  assert.equal(run(text.replace('30 20 L','30 20 L\nsomeUnsafeProcedure')),null);
  assert.equal(run(text.replace('30 20 L','30000000 20 L')),null);
  assert.equal(run(text.replace('%%PageTrailer','%%Page: 2 2\n%%PageTrailer')),null);
  assert.equal(run(text.replace('30 20 L','30 20 L\n10 10 10 10 10 10 C\nstroke')),null);
});

test('CorelDRAW path-only EPS is returned immediately without loading Ghostscript or MuPDF',async()=>{
  const bytes=new Uint8Array(readFileSync(new URL('tests/fixtures/eps/corel-unpainted.eps',root)));
  const original=Buffer.from(bytes);
  let ghostscriptCalls=0;
  const fallback=()=>{ghostscriptCalls++;throw Error('Heavy interpreter should NOT be launched');};
  const fast=recoverOutlineOnlyEps(bytes);
  assert.equal(fast.outlineRecovery.count,2);
  assert.ok(fast.warnings[0].includes('только для просмотра'));
  const result=await interpretEps(bytes,{runGhostscript:fallback,mupdf:null});
  assert.equal(ghostscriptCalls,0);
  assert.equal(result.svg,fast.svg);
  assert.equal(result.metadata.widthPt,100);
  assert.equal(result.metadata.heightPt,40);
  assert.deepEqual(Buffer.from(bytes),original);
  const doc=importRichSvg(result.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.equal(doc.paths.length,2);
  assert.ok(doc.paths.some(p=>p.commands.some(c=>c[0]==='C')));
});

test('unrecognized/painted EPS cannot bypass normal Ghostscript importer',()=>{
  const base=readFileSync(new URL('tests/fixtures/eps/corel-unpainted.eps',root),'utf8');
  const encoded=t=>new TextEncoder().encode(t);
  assert.equal(recoverOutlineOnlyEps(encoded(base.replace('CorelDRAW','Unknown'))),null);
  assert.equal(recoverOutlineOnlyEps(encoded(base.replace('30 20 L','30 20 L\nstroke'))),null);
  assert.equal(recoverOutlineOnlyEps(encoded(base.replace('N\n%%PageTrailer','fill\n%%PageTrailer'))),null);
});
