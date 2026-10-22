import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import * as mupdf from 'mupdf';
import {DOMParser} from '@xmldom/xmldom';
import {epsProgram,epsMetadata,interpretEps} from '../web/eps-pipeline.js';
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
