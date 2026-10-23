import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DOMParser} from '@xmldom/xmldom';
import {importRichSvg} from '../web/rich-svg.js';
import {assessImportedGeometry,EmptyVectorImportError} from '../web/import-integrity.js';
import {inspectWorkspace,shortWorkspaceDiagnosis} from '../web/workspace-health.js';

const emptySvg='<svg xmlns="http://www.w3.org/2000/svg" width="240pt" height="120pt" viewBox="0 0 240 120"></svg>';
const emptyDocument=()=>importRichSvg(emptySvg,{unitsPerInch:72,Parser:DOMParser});
const actualDocument=()=>importRichSvg('<svg xmlns="http://www.w3.org/2000/svg" width="240pt" height="120pt" viewBox="0 0 240 120"><path d="M10 20L70 50" stroke="black"/></svg>',{unitsPerInch:72,Parser:DOMParser});

test('regression from 8049569 report: EPS with 0 objects must not be accepted as successful import',()=>{
  const parsed=emptyDocument();
  assert.equal(parsed.paths.length,0);
  assert.throws(()=>assessImportedGeometry(parsed,{format:'eps',
    source:'8049569_10_29.10.eps',conversion:{svg:emptySvg,logs:['empty Ghostscript page']}}),
  error=>error instanceof EmptyVectorImportError&&error.code==='EPS_EMPTY_GEOMETRY'&&
    error.message.includes('0 контуров')&&error.message.includes('8049569_10_29.10.eps'));
});
test('valid vector EPS remains accepted and reports vector count',()=>{
  const parsed=actualDocument();
  const checked=assessImportedGeometry(parsed,{format:'eps',source:'vector.eps',
    conversion:{svg:'<svg><path /></svg>',logs:[]}});
  assert.equal(checked.count,1);
  assert.equal(checked.vectors,1);
  assert.equal(checked.empty,false);
});
test('intentionally empty PDF page remains valid, but reported as empty',()=>{
  const checked=assessImportedGeometry(emptyDocument(),{format:'pdf',source:'blank.pdf',allowEmpty:true});
  assert.equal(checked.count,0);
  assert.equal(checked.empty,true);
});
test('workspace no longer claims that a successfully opened empty EPS is healthy',()=>{
  const bare={hidden:true,childElementCount:0,
    getBoundingClientRect:()=>({x:0,y:0,width:989,height:786}),
    style:{setProperty(){}}};
  const canvas={...bare,viewBox:{baseVal:{x:-9.952,y:-9.952,width:95.398,height:162.073}}};
  const styleOf=()=>({display:'block',visibility:'visible',opacity:'1',width:'989px',height:'786px'});
  const health=inspectWorkspace({canvas,workspace:bare,geometry:bare,mascot:bare,
    documentLoaded:true,documentPaths:0,documentType:'eps',styleOf});
  assert.equal(health.ok,false);
  assert.ok(health.issues.includes('empty-import'));
  assert.match(shortWorkspaceDiagnosis(health),/0 объектов/);
});
test('failed conversion is visible in detailed diagnostics without exposing source file bytes',()=>{
  const bare={hidden:true,childElementCount:0,getBoundingClientRect:()=>({x:0,y:0,width:700,height:500})};
  const canvas={...bare,viewBox:{baseVal:{x:0,y:0,width:100,height:100}}};
  const styleOf=()=>({display:'block',visibility:'visible',opacity:'1',width:'700px',height:'500px'});
  const h=inspectWorkspace({canvas,workspace:bare,geometry:bare,mascot:bare,
    documentPaths:0,documentLoaded:false,documentType:'project',
    importFailure:{source:'8049569_10_29.10.eps',code:'EPS_EMPTY_GEOMETRY',
      message:'0 контуров'},styleOf});
  assert.equal(h.ok,false);
  assert.ok(h.issues.includes('import-failed'));
  assert.deepEqual(h.importFailure,{source:'8049569_10_29.10.eps',code:'EPS_EMPTY_GEOMETRY',message:'0 контуров'});
});
test('real imported EPS must be checked BEFORE constructing EPS metadata or replacing existing document',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const posParse=app.indexOf('const next=importRichSvg(data.result.svg');
  const posGuard=app.indexOf('assessImportedGeometry(next');
  const posCommit=app.indexOf('openValue(next,name,true)',posParse);
  assert.ok(posParse>=0&&posParse<posGuard&&posGuard<posCommit);
  assert.match(app,/lastImportFailure=\{source:name/);
  assert.match(app,/workspaceScan\(\{manual:true\}\)/);
  assert.match(app,/importFailure:lastImportFailure/);
});
test('empty EPS rendered by Ghostscript must be rejected instead of returning empty document',()=>{
  const source=readFileSync(new URL('../web/eps-pipeline.js',import.meta.url),'utf8');
  assert.match(source,/if\(!hasVisibleGeometry&&!recovery\)/);
  assert.match(source,/пустую страницу/);
  assert.match(source,/recoverUnpaintedCorelOutlines\(program,metadata\)/);
});
