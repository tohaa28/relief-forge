import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {recoverUnpaintedCorelOutlines} from '../web/corel-outline.js';
import {epsMetadata,recoverOutlineOnlyEps,interpretEps} from '../web/eps-pipeline.js';
import {importRichSvg} from '../web/rich-svg.js';
import {assessImportedGeometry} from '../web/import-integrity.js';

const original=readFileSync(new URL('./fixtures/eps/corel-unpainted.eps',import.meta.url),'utf8');
const encoded=text=>new TextEncoder().encode(text);
const prelude='@rax %Note: Object\n10 20 110 60 @E\n/$fm 1 def\n';
function syntheticCase(){
  const text=original.replace('%%EndPageSetup','%%EndPageSetup\n'+prelude);
  return text.replace('60 45 90 45 105 20 C','60 45 90 45 105 20 c');
}
test('CorelDRAW c (lowercase) is a real curveto and is normalized to editable cubic C',()=>{
  const text=syntheticCase(),raw=encoded(text),originalBytes=Buffer.from(raw);
  const meta=epsMetadata(raw),result=recoverUnpaintedCorelOutlines(raw,meta);
  assert.ok(result,'CorelDRAW path-only parser must recover lower-case c');
  assert.equal(result.count,2);
  assert.match(result.svg,/C 60 45 90 45 105 20/);
  const doc=importRichSvg(result.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.equal(doc.paths.length,2);
  assert.equal(doc.paths[1].commands.filter(c=>c[0]==='C').length,1);
  assert.equal(doc.paths[1].points.length,2,'only real command anchors, no flattened fake nodes');
  assert.equal(assessImportedGeometry(doc,{format:'eps',source:'Corel lowercase c.eps'}).count,2);
  assert.deepEqual(Buffer.from(raw),originalBytes,'import never mutates EPS bytes');
});
test('real EPS worker fast path bypasses Ghostscript even with mixed c and C',async()=>{
  const input=encoded(syntheticCase());let slow=0;
  const direct=recoverOutlineOnlyEps(input);
  assert.equal(direct.outlineRecovery.count,2);
  const interpreted=await interpretEps(input,{
    runGhostscript:()=>{slow++;throw Error('No Ghostscript should be required');},
    mupdf:null
  });
  assert.equal(slow,0);
  assert.equal(interpreted.svg,direct.svg);
});
test('an unusual complex/Corel page with unsupported path operators is safely refused',()=>{
  const cases=[
    syntheticCase().replace('60 45 90 45 105 20 c','1 1 1 1 1 1 c\nfill'),
    syntheticCase().replace('60 45 90 45 105 20 c','60 45 90 45 105 20 cubicTo'),
    syntheticCase().replace('60 45 90 45 105 20 c','60 45 90 45 105 20 c\nclip')
  ];
  for(const text of cases){
    const raw=encoded(text);
    assert.equal(recoverUnpaintedCorelOutlines(raw,epsMetadata(raw)),null);
    assert.equal(recoverOutlineOnlyEps(raw),null);
  }
});
test('regression shape: many mixed-case curveto commands retain one anchor per curve and all closed paths',()=>{
  const count=53;
  const paths=[];
  for(let i=0;i<count;i++){
    const off=i*1.2;
    paths.push(off+' 20 m\n'+(off+.2)+' 21 '+(off+.6)+' 21 '+(off+.8)+' 20 '+(i%7===0?'c':'C')+
      '\n'+(off+.8)+' 18 L\n@c');
  }
  const text=original.replace(/%%EndPageSetup[\s\S]*?%%PageTrailer/,
    '%%EndPageSetup\n'+prelude+paths.join('\n')+'\nN\n%%PageTrailer');
  const raw=encoded(text),result=recoverOutlineOnlyEps(raw);
  assert.ok(result);
  assert.equal(result.outlineRecovery.count,count);
  const doc=importRichSvg(result.svg,{unitsPerInch:72,Parser:DOMParser});
  assert.equal(doc.paths.length,count);
  assert.equal(doc.paths.flatMap(p=>p.commands).filter(c=>c[0]==='C').length,count);
  assert.equal(doc.paths.flatMap(p=>p.commands).filter(c=>c[0]==='Z').length,count);
});
