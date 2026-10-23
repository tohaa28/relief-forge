import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {geometryStamp,paintFromArtwork,intactOriginalEps,rgbFromPaint} from '../web/eps-paint.js';
import {exportColoredEps,exportEps} from '../web/eps-export.js';
import {selectIssueMarkerIndices,renderIssueMarkers,issueWithinContourBounds} from '../web/issue-markers.js';
import {readFileSync} from 'node:fs';
const p=([x,y],i=0)=>({points:[[0,0],[20,2],[20,10]],closed:false,kind:'vector',
  commands:[['M',0,0],['C',6,0,15,1,20,2],['L',20,10]],offset:[0,0],
  artwork:'<g fill="none" stroke="#f24827" stroke-width="0.25"><path d="M0 0 C6 0 15 1 20 2 L20 10"/></g>'});
const doc=()=>({format:'relief-forge',version:1,width:100,height:50,paths:[p([0,0])]});
test('unmodified colored EPS returns exact bytes, even with original CMYK',()=>{
  const d=doc(),bytes=Buffer.from('%!PS-Adobe-3.0 EPSF-3.0\n1 0 0 1 setcmykcolor\n','latin1');
  d.epsImport={originalBase64:bytes.toString('base64'),originalGeometryStamp:geometryStamp(d)};
  assert.equal(intactOriginalEps(d),true);
  const result=exportColoredEps(d,{Parser:DOMParser});
  assert.equal(result.source,'exact-original');
  assert.deepEqual(Buffer.from(result.content),bytes);
  d.paths[0].commands[1][1]+=0.2;
  assert.equal(intactOriginalEps(d),false);
  const edited=exportColoredEps(d,{Parser:DOMParser});
  assert.equal(edited.source,'repainted-rgb');
  assert.match(edited.content,/setrgbcolor/);
  assert.match(edited.content,/stroke/);
  assert.doesNotMatch(edited.content,/setcmykcolor/);
  assert.match(exportEps(d),/%%RF-OutlinePaths: 1/);
});
test('solid original stroke/fill survives editing and unsupported CSS is rejected',()=>{
  const d=doc();
  d.paths[0].paint=paintFromArtwork('<g fill="#aabbcc"><path d="M0 0L5 5" stroke="rgb(250, 20, 0)" stroke-width="1.2"/></g>',{Parser:DOMParser});
  const rendered=exportColoredEps(d,{Parser:DOMParser});
  assert.match(rendered.content,/setrgbcolor\nfill/);
  assert.match(rendered.content,/setrgbcolor\n[\d.]+ setlinewidth\nstroke/);
  assert.deepEqual(rgbFromPaint('#f42').map(x=>Math.round(x*255)),[255,68,34]);
  assert.throws(()=>rgbFromPaint('url(#gradient)'),/точно перенести/);
  d.paths[0].paint={unsupported:'Непрозрачность не поддерживается'};
  assert.throws(()=>exportColoredEps(d,{Parser:DOMParser}),/Непрозрачность/);
});
test('spatially stratified marker sampling covers the whole logo instead of the first 1000 only',()=>{
  const issues=[
    ...Array.from({length:9400},(_,i)=>({point:[8+i%9,72+i%4],path:0,other:0,kind:'short'})),
    ...Array.from({length:600},(_,i)=>({point:[54+i%8,4+i%6],path:1,other:1,kind:'short'}))
  ];
  const chosen=selectIssueMarkerIndices(issues,1000,{x:0,y:0,width:100,height:100});
  assert.equal(chosen.length,1000);
  assert.ok(chosen.filter(i=>issues[i].point[1]<20).length>=100,'upper motif must be represented');
  assert.ok(chosen.filter(i=>issues[i].point[1]>70).length>=100,'bottom lettering must still be represented');
  const docSvg=new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>','image/svg+xml');
  const layer=docSvg.documentElement.firstChild;
  assert.equal(renderIssueMarkers(layer,issues,.1,{x:0,y:0,width:100,height:100}),1000);
  const ids=[...layer.childNodes].map(node=>Number(node.getAttribute('data-issue')));
  assert.ok(ids.some(i=>i>=9400));
  assert.equal(layer.getElementsByTagName('text').length,0,'dense canvas must not show thousands of overlapping numbers');
});
test('out-of-place worker coordinates are rejected before drawing; valid crossing near source is retained',()=>{
  const contours=[{points:[[20,20],[30,20],[30,30]],closed:false}];
  assert.equal(issueWithinContourBounds({point:[25,25],path:0,other:0},contours,.1),true);
  assert.equal(issueWithinContourBounds({point:[25,180],path:0,other:0},contours,.1),false);
  assert.equal(issueWithinContourBounds({point:[NaN,2],path:0,other:0},contours,.1),false);
});
test('UI asks a real save mode and retains marker original source-index mapping',()=>{
  const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
  assert.match(html,/id="eps-color-choice"/);
  assert.match(html,/name="eps-color-mode" value="outline"/);
  assert.match(html,/name="eps-color-mode" value="original"/);
  assert.match(app,/const prepared=prepareEpsOutput\(chosen.document\)/);
  assert.match(app,/originalGeometryStamp:geometryStamp\(next\)/);
  assert.match(app,/issueInBounds\(issue\)/);
  assert.match(app,/renderIssueMarkers\(\$\('markers'\),visibleIssues,markerUnit,/);
});
