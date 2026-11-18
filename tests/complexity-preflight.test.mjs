import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectDocumentComplexity,largeFileWarning} from '../web/complexity-preflight.js';
const enc=new TextEncoder();
function dosEps(postscript){
  const source=enc.encode(postscript);
  const binary=new Uint8Array(30+source.length+9);
  binary.set([0xc5,0xd0,0xd3,0xc6],0);
  const view=new DataView(binary.buffer);
  view.setUint32(4,30,true);view.setUint32(8,source.length,true);
  view.setUint32(20,30+source.length,true);view.setUint32(24,9,true);
  binary.set(source,30);binary.fill(0xff,30+source.length);
  return binary;
}
test('Corel-style DOS EPS counts PS commands, never TIFF preview bytes',()=>{
  const ps='%!PS-Adobe-3.0 EPSF-3.0\n'+
    Array.from({length:1933},(_,i)=>i+' 0 m\n').join('')+
    Array.from({length:12965},()=> '1 2 3 4 5 6 C\n').join('')+'@c\n%%EOF\n';
  const result=inspectDocumentComplexity(dosEps(ps),'8101921-1.eps');
  assert.equal(result.contours,1933);
  assert.equal(result.curves,12965);
  assert.equal(result.large,true);
  assert.match(largeFileWarning(result),/Обработка будет замедлена/);
  assert.match(largeFileWarning(result),/неполная диагностика/);
});
test('Small EPS does not show false warning',()=>{
  const r=inspectDocumentComplexity(enc.encode('%!PS\n1 2 m\n1 2 3 4 5 6 C\n'),'small.eps');
  assert.equal(r.large,false);assert.equal(r.contours,1);assert.equal(r.curves,1);
  assert.equal(largeFileWarning(r),'');
});
test('DOS EPS header is bounded and cannot read invalid or preview-only offsets',()=>{
  const b=dosEps('%!PS\n1 2 m\n');
  new DataView(b.buffer).setUint32(8,9999999,true);
  assert.equal(inspectDocumentComplexity(b,'broken.eps').estimated,false);
  assert.equal(inspectDocumentComplexity(b,'broken.eps').invalidHeader,true);
});
test('Large sampled PDF/SVG documents can warn after actual geometry planning',()=>{
  const r={large:true,totalPoints:24500};
  assert.match(largeFileWarning(r),/24.500|24 500|24 500/u);
});
