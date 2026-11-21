import test from 'node:test';
import assert from 'node:assert/strict';
import {ghostscriptRasterArgs,ghostscriptPngInfo,captureRasterSource,requireRasterSource} from '../web/ghostscript-raster.js';
test('direct Ghostscript rasterization disables antialias and resampling at render time',()=>{
 for(const dpi of [300,600,1200]){
  const args=ghostscriptRasterArgs('eps',dpi);
  for(const flag of ['-sDEVICE=png16malpha','-dGraphicsAlphaBits=1','-dTextAlphaBits=1','-dInterpolateControl=0','-dDownScaleFactor=1','-dEPSCrop','-r'+dpi])assert.ok(args.includes(flag));
  assert.ok(!args.some(a=>/pdfwrite|FitPage/.test(a)));
 }
 const args=ghostscriptRasterArgs('pdf',600,2);
 for(const flag of ['-dUseCropBox','-dFirstPage=3','-dLastPage=3'])assert.ok(args.includes(flag));
 assert.throws(()=>ghostscriptRasterArgs('pdf',600,-1));
});
test('source binding rejects stale EPS/PDF data and unpainted outlines',()=>{
 const doc={width:10,height:10,paths:[],svgDefs:'',sourceSvg:'<svg/>',pdfImport:{name:'a.pdf',pageIndex:1}};
 const bytes=Uint8Array.of(1,2,3),entry=captureRasterSource(doc,bytes,'pdf');
 assert.equal(requireRasterSource(doc,entry).bytes,bytes);
 assert.throws(()=>requireRasterSource({...doc,width:11},entry),/повторно/);
 assert.throws(()=>requireRasterSource({...doc,pdfImport:{name:'a.pdf',pageIndex:0}},entry),/повторно/);
 assert.throws(()=>requireRasterSource({epsImport:{outlineRecovery:{count:1}}},null),/непечатаемые/);
});
test('native PNG grid and DPI validation is read-only',()=>{
 const bytes=new Uint8Array(66),v=new DataView(bytes.buffer);
 v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(8,13);v.setUint32(12,0x49484452);
 v.setUint32(16,3001);v.setUint32(20,181);v.setUint8(24,8);v.setUint8(25,6);
 v.setUint32(33,9);v.setUint32(37,0x70485973);v.setUint32(41,47244);v.setUint32(45,47244);v.setUint8(49,1);
 const original=bytes.slice(),plan={width:3001,height:181,dpi:1200};
 assert.deepEqual(ghostscriptPngInfo(bytes,plan),{...plan,requestedDpi:1200});
 assert.deepEqual(bytes,original);
 assert.throws(()=>ghostscriptPngInfo(bytes,{...plan,dpi:600}),/DPI/);
 assert.throws(()=>ghostscriptPngInfo(bytes,{...plan,width:2400}),/размер страницы/);
});
