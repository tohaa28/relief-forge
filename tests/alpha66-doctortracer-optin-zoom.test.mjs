import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {heavyManualScene,screenToDocumentPoint} from '../web/manual-viewport-performance.js';
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
test('DoctorTracer is an opt-in staged checkbox, disabled by default, never runs when off',()=>{
 assert.match(html,/id="doctortracer-enabled" type="checkbox"/);
 assert.doesNotMatch(html,/id="doctortracer-enabled"[^>]*checked/);
 assert.match(app,/'doctortracer-enabled','repair-self-intersections','self-intersection-mode'/);
 assert.match(app,/if\(!settingChecked\('doctortracer-enabled'\)\)\{[\s\S]*?return report;/);
 assert.match(app,/if\(settingChecked\('doctortracer-enabled'\)\)void prepareImportBlackMask\(doc\)/);
 assert.match(app,/else\{ \$\('doctortracer-status'\)[\s\S]*?if\(ready\)calculate\(0\);/);
 assert.match(app,/modified\.every\(id=>id==='doctortracer-enabled'\|\|id==='clearance-threshold'\)/);
});
test('manual viewport isolation depends on total commands even with one path',()=>{
 assert.equal(heavyManualScene([{kind:'vector',commands:Array.from({length:7546},()=>['C'])}]),true);
 assert.equal(heavyManualScene([{kind:'vector',commands:Array.from({length:60},()=>['L'])}]),false);
 assert.equal(heavyManualScene(Array.from({length:40},()=>({kind:'vector',points:[[0,0]]}))),true);
 assert.equal(heavyManualScene([{kind:'image',points:Array(8000)}]),false);
 assert.match(app,/manualSceneHeavy=heavyManualScene\(doc\.paths\)/);
 assert.doesNotMatch(app,/curveEditing\(\)\&\&doc\.paths\.length>25/);
 assert.match(app,/if\(!document\.body\.classList\.contains\('manual-local-zoom'\)\)refreshLocalZoomGeometry\(\)/);
});
test('manual cursor mapping accounts for xMidYMid letterboxing and zoom without SVG matrix',()=>{
 const rect={left:100,top:200,width:1000,height:500},view={x:10,y:20,width:100,height:100};
 assert.deepEqual(screenToDocumentPoint(600,450,rect,view),[60,70]);
 assert.deepEqual(screenToDocumentPoint(350,200,rect,view),[10,20]);
 assert.deepEqual(screenToDocumentPoint(850,700,rect,view),[110,120]);
 assert.equal(screenToDocumentPoint(0,0,{...rect,width:0},view),null);
 assert.match(app,/manualScreenRect\?\?=canvas\.getBoundingClientRect\(\)/);
 assert.match(app,/screenToDocumentPoint\(e\.clientX,e\.clientY,manualScreenRect,canvas\.viewBox\.baseVal\)/);
 assert.match(app,/window\.addEventListener\('scroll',\(\)=>\{manualScreenRect=null;\},true\)/);
});

test('viewport panning rebuild threshold compares actual previous viewport, not off-center focused anchor',()=>{
 assert.match(app,/manualViewportCenter&&Math\.hypot\(center\[0\]-manualViewportCenter\[0\]/);
 assert.match(app,/manualViewportCenter=center/);
 assert.doesNotMatch(app,/const moved=manualGlyphCenter&&/);
});
test('enabling DoctorTracer applies to existing AFTER preview on Apply without reimport',()=>{
 assert.match(app,/modified\.includes\('doctortracer-enabled'\)&&settingChecked\('doctortracer-enabled'\)&&[\s\S]*?curvePreview\?\.afterDiagnosed\)void checkPreviewAfter\(curvePreview\)/);
});

test('manual editor builds a native segment index and local geometry before any node click',()=>{
 assert.match(app,/if\(heavyManualScene\(doc\.paths\)&&Number\.isInteger\(primary\)&&localEditor\(primary\)\)manualFocus=/);
 assert.match(app,/render\(\);\n  if\(manualFocus\)drawLocalEditorOverlay\(\);/);
});
