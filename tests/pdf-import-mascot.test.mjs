import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pdfProgram,pdfPages,pdfPageToSvg,PDF_MAX_BYTES,PDF_MAX_PAGES} from '../web/pdf-pipeline.js';
import {syncWorkspaceMascot} from '../web/mascot-visibility.js';
import {isSupportedDrop,droppedFiles} from '../web/large-file-support.js';

const bytes=new TextEncoder().encode('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
function fakeMuPdf(){
 const events=[];
 const mupdf={
  Matrix:{identity:[1,0,0,1,0,0]},
  Document:{openDocument:(data,mime)=>{
   events.push(['open',data.length,mime]);
   return {countPages:()=>3,loadPage:index=>{
     events.push(['page',index]);
     return {getBounds:()=>[0,0,index?612:300,index?792:200],
       run:(device,matrix)=>{events.push(['render',index]);device.rendered=index;},
       destroy:()=>events.push(['destroy-page',index])};
   },destroy:()=>events.push(['destroy-document'])};
  }},
  Buffer:class {asString(){return '<svg xmlns="http://www.w3.org/2000/svg" width="300pt" height="200pt"><path d="M0 0 C 10 20 30 20 40 0"/></svg>';}
    destroy(){events.push(['destroy-buffer']);}},
  DocumentWriter:class {
   constructor(buffer,format,options){events.push(['writer',format,options]);this.buffer=buffer;}
   beginPage(bounds){events.push(['begin',...bounds]);return {close:()=>events.push(['close-device']),
      destroy:()=>events.push(['destroy-device'])};}
   endPage(){events.push(['end-page']);}
   close(){events.push(['close-writer']);}
   destroy(){events.push(['destroy-writer']);}
  }
 };
 return {mupdf,events};
}
test('PDF header and size validation rejects unrelated and empty files',()=>{
 assert.deepEqual(pdfProgram(bytes),bytes);
 assert.throws(()=>pdfProgram(new TextEncoder().encode('not PDF')),/заголовок/);
 assert.throws(()=>pdfProgram(new Uint8Array()),/непустым/);
 assert.equal(PDF_MAX_BYTES,64*1024*1024);
 assert.equal(PDF_MAX_PAGES,500);
 assert.ok(pdfProgram(new TextEncoder().encode('prefix %PDF-1.5\n')).length);
});
test('PDF metadata supports multiple pages and returns real point bounds',()=>{
 const {mupdf,events}=fakeMuPdf();
 const pages=pdfPages(bytes,mupdf);
 assert.equal(pages.length,3);
 assert.deepEqual(pages.map(p=>p.number),[1,2,3]);
 assert.equal(pages[0].widthPt,300);
 assert.equal(pages[1].heightPt,792);
 assert.equal(events.filter(e=>e[0]==='destroy-page').length,3);
 assert.equal(events.filter(e=>e[0]==='destroy-document').length,1);
});
test('PDF selected page becomes vector SVG, without rendering unrelated pages to raster',()=>{
 const {mupdf,events}=fakeMuPdf();
 const result=pdfPageToSvg(bytes,mupdf,2);
 assert.equal(result.metadata.pageIndex,2);
 assert.equal(result.metadata.pageNumber,3);
 assert.equal(result.metadata.pageCount,3);
 assert.equal(result.widthPt,612);
 assert.match(result.svg,/<path d="M0 0 C/);
 assert.equal(events.filter(x=>x[0]==='render').length,1);
 assert.deepEqual(events.find(x=>x[0]==='render'),['render',2]);
 assert.ok(events.some(x=>x[0]==='writer'&&x[1]==='svg'&&x[2].includes('text=path')));
 assert.ok(events.some(x=>x[0]==='destroy-document'));
 assert.throws(()=>pdfPageToSvg(bytes,mupdf,3),/отсутствует/);
});
test('mascot is suppressed during read, after import, and recovered only on empty canvas',()=>{
 const values={},mascot={hidden:false,attributes:{},style:{
   setProperty:(n,v,p)=>{values[n]=[v,p];}
 },setAttribute(n,v){this.attributes[n]=v;}};
 const workspace={dataset:{}};
 assert.equal(syncWorkspaceMascot(mascot,workspace,{hasDocument:false,importing:true}),true);
 assert.equal(mascot.hidden,true);
 assert.deepEqual(values.display,['none','important']);
 assert.equal(workspace.dataset.contentLoaded,'true');
 assert.equal(mascot.attributes['aria-hidden'],'true');
 assert.equal(syncWorkspaceMascot(mascot,workspace,{hasDocument:true,importing:false}),true);
 assert.equal(mascot.hidden,true);
 assert.equal(syncWorkspaceMascot(mascot,workspace,{hasDocument:false,importing:false}),false);
 assert.equal(mascot.hidden,false);
 assert.deepEqual(values.display,['flex','important']);
 assert.equal(workspace.dataset.contentLoaded,'false');
});
test('PDF accepted via dialog and drop, and CSS makes mascot invisible regardless of flex styles',()=>{
 assert.equal(isSupportedDrop({name:'flyer.PDF'}),true);
 assert.deepEqual(droppedFiles({dataTransfer:{files:[{name:'p.pdf'},{name:'p.zip'}]}}).map(x=>x.name),['p.pdf']);
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../web/eps-worker.js',import.meta.url),'utf8');
 assert.match(html,/accept="[^"]*\.pdf/);
 for(const id of ['pdf-page-picker','pdf-page-number','pdf-page-count','pdf-page-confirm','pdf-page-cancel'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(css,/#mascot-welcome\[hidden\][^{]*\{[^}]*display:none!important/);
 assert.match(css,/\.workspace\[data-content-loaded="true"\] #mascot-welcome/);
 assert.match(app,/openingFile=true;updateMascot\(\)/);
 assert.match(app,/function render\(\)\{[^]*?updateMascot\(\)/);
 assert.match(app,/if\(data.type==='pages'\)/);
 assert.match(app,/pdfImport=\{name/);
 assert.match(app,/\\\.\(eps\|epsf\|epsi\|ps\|pdf\)/);
 assert.match(worker,/if\(data.kind==='pdf'\|\|data.type==='select-pdf-page'\)/);
 assert.match(worker,/const mupdf=await loadMupdf\(\)/);
 assert.match(worker,/pendingPdf=pdf.pdfProgram/);
 assert.match(app,/openValue\(next,name,true\)/);
});
