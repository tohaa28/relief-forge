import test from 'node:test';
import assert from 'node:assert/strict';
import {pdfPages,pdfPageToSvg} from '../web/pdf-pipeline.js';

function simpleVectorPdf(){
  let source='%PDF-1.4\n';
  const positions=[0];
  const put=(n,body)=>{
    positions[n]=Buffer.byteLength(source,'latin1');
    source+=n+' 0 obj\n'+body+'\nendobj\n';
  };
  put(1,'<< /Type /Catalog /Pages 2 0 R >>');
  put(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  put(3,'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents 4 0 R >>');
  const operators='0 0 0 RG 1 w 10 10 m 120 150 l S\n';
  put(4,'<< /Length '+Buffer.byteLength(operators,'latin1')+' >>\nstream\n'+operators+'endstream');
  const xref=Buffer.byteLength(source,'latin1');
  source+='xref\n0 5\n0000000000 65535 f \n';
  for(let n=1;n<=4;n++)source+=String(positions[n]).padStart(10,'0')+' 00000 n \n';
  source+='trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new Uint8Array(Buffer.from(source,'latin1'));
}

test('real MuPDF WASM parses a genuine one-page vector PDF and returns SVG path',async()=>{
  const mupdf=await import('../web/vendor/mupdf/mupdf.js');
  const source=simpleVectorPdf();
  const pages=pdfPages(source,mupdf);
  assert.equal(pages.length,1);
  assert.equal(pages[0].widthPt,300);
  assert.equal(pages[0].heightPt,200);
  const result=pdfPageToSvg(source,mupdf,0);
  assert.equal(result.metadata.pageNumber,1);
  assert.equal(result.metadata.pageCount,1);
  assert.match(result.svg,/<(?:path|polyline|line)\b/i);
  assert.ok(!result.svg.includes('<image'),'single vector PDF should remain vector');
});
