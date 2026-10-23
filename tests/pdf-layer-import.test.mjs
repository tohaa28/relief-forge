import test from 'node:test';
import assert from 'node:assert/strict';
import * as mupdf from '../web/vendor/mupdf/mupdf.js';
import {DOMParser} from '@xmldom/xmldom';
import {pdfPages,pdfPageToSvg} from '../web/pdf-pipeline.js';
import {importRichSvg,safeFragment} from '../web/rich-svg.js';
import {layeredPdf} from './fixtures/pdf/layered-fixture.mjs';
const strictParser=class{parseFromString(s,type){return new DOMParser({onError(level,message){throw Error(message);}}).parseFromString(s,type);}};
test('PDF layer namespace survives extraction into independent editable fragments',()=>{
 const result=pdfPageToSvg(layeredPdf(),mupdf,0),doc=importRichSvg(result.svg,{unitsPerInch:72,Parser:strictParser});
 assert.equal(doc.width,50.8);assert.equal(doc.height,25.4);assert.ok(doc.paths.length>1);
 assert.ok(doc.paths.some(p=>p.commands.some(c=>c[0]==='C')));
 for(const p of doc.paths){assert.ok(p.paint&&!p.paint.unsupported);safeFragment(p.artwork,strictParser);assert.match(p.artwork,/xmlns:inkscape=/);}
 assert.match(result.svg,/inkscape:label=/);assert.equal(doc.paths.filter(p=>p.kind==='image').length,0);
});
test('PDF namespace adaptation preserves raw drawing bytes and named layer attributes',()=>{
 const bytes=layeredPdf(),d=mupdf.Document.openDocument(bytes,'application/pdf'),p=d.loadPage(0),buffer=new mupdf.Buffer(),writer=new mupdf.DocumentWriter(buffer,'svg','text=path,no-reuse-images');
 try{const device=writer.beginPage(p.getBounds());p.run(device,mupdf.Matrix.identity);device.close();writer.endPage();writer.close();
  const raw=buffer.asString(),fixed=pdfPageToSvg(bytes,mupdf,0).svg;
  assert.equal(fixed.replace(/(<g) xmlns:inkscape="[^"]*"/g,'$1'),raw);
 }finally{writer.destroy();buffer.destroy();p.destroy();d.destroy();}
});
test('layered multipage PDF and embedded raster keep page metadata and actual image',()=>{
 const bytes=layeredPdf({pages:2,image:true});assert.equal(pdfPages(bytes,mupdf).length,2);
 const result=pdfPageToSvg(bytes,mupdf,1),doc=importRichSvg(result.svg,{unitsPerInch:72,Parser:strictParser});
 assert.equal(result.metadata.pageNumber,2);assert.equal(result.metadata.pageCount,2);assert.equal(doc.paths.filter(p=>p.kind==='image').length,1);
 for(const p of doc.paths)safeFragment(p.artwork,strictParser);
});
