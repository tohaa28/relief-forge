import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectWorkspace,recoverWorkspace,fittedViewBox,boxesOverlap,shortWorkspaceDiagnosis,safeWorkspaceReport} from '../web/workspace-health.js';

function mockElement({x=0,y=0,width=750,height=550,display='block',visibility='visible',opacity='1',children=1,bbox={x:10,y:15,width:200,height:100}}={}){
 const props={},style={setProperty(k,v,priority){props[k]=[v,priority];}};
 const el={hidden:false,style,props,
   state:{x,y,width,height,display,visibility,opacity,bbox},
   childElementCount:children,
   getBoundingClientRect(){const {x,y,width,height}=this.state;return {x,y,width,height};},
   getBBox(){return this.state.bbox;},
   setAttribute(k,v){if(k!=='viewBox')this[k]=v;if(k==='viewBox'){const a=v.split(/\s+/).map(Number);
     this.viewBox.baseVal={x:a[0],y:a[1],width:a[2],height:a[3]};}},
   viewBox:{baseVal:{x:0,y:0,width:300,height:200}}};
 return el;
}
const styled=e=>({display:e.state.display,visibility:e.state.visibility,
  opacity:e.state.opacity,width:e.state.width+'px',height:e.state.height+'px'});
const scene=(options={})=>{
 const workspace=mockElement(options.workspace);
 const canvas=mockElement(options.canvas);
 const geometry=mockElement(options.geometry);
 const mascot=mockElement();
 const overlay=mockElement();mascot.hidden=true;overlay.hidden=true;
 return {canvas,workspace,geometry,mascot,overlay,documentPaths:1,documentLoaded:true,
   styleOf:styled,bounding:()=>geometry.getBBox()};
};
test('healthy populated SVG workspace does not reset viewBox or alter vector geometry',()=>{
 const s=scene(),view=inspectWorkspace(s);
 assert.equal(view.ok,true);assert.deepEqual(view.issues,[]);
 assert.deepEqual(recoverWorkspace(view,s),[]);
 assert.deepEqual(s.canvas.viewBox.baseVal,{x:0,y:0,width:300,height:200});
 assert.equal(shortWorkspaceDiagnosis(view),'Рабочее поле доступно');
});
test('detects hidden canvas or zero-sized layout and repairs display without replacing document',()=>{
 const s=scene({canvas:{display:'none',width:0,height:0},
   workspace:{height:0}});
 const view=inspectWorkspace(s);
 assert.ok(view.issues.includes('canvas-hidden'));assert.ok(view.issues.includes('zero-size'));
 const fixed=recoverWorkspace(view,{...s,viewportHeight:()=>800});
 assert.ok(fixed.includes('canvas-layout'));assert.ok(fixed.includes('workspace-layout'));
 assert.deepEqual(s.canvas.props.display,['block','important']);
 assert.deepEqual(s.workspace.props['min-height'],['440px','important']);
});
test('offscreen EPS geometry is centered in viewBox while valid current zoom remains unchanged',()=>{
 const s=scene({geometry:{bbox:{x:500,y:650,width:120,height:50}}});
 const view=inspectWorkspace(s);
 assert.ok(view.issues.includes('out-of-view'));
 const actions=recoverWorkspace(view,s);
 assert.deepEqual(actions,['geometry-fit']);
 assert.ok(boxesOverlap(s.canvas.viewBox.baseVal,s.geometry.getBBox()));
 assert.equal(s.canvas.viewBox.baseVal.x<500,true);
 const check=fittedViewBox({x:800,y:850,width:30,height:40});
 assert.ok(boxesOverlap(check,{x:800,y:850,width:30,height:40}));
});
test('loaded document never leaves mascot or drag overlay blocking imported SVG',()=>{
 const s=scene();s.mascot.hidden=false;s.overlay.hidden=false;
 const health=inspectWorkspace(s);
 assert.ok(health.issues.includes('mascot-visible'));
 assert.ok(health.issues.includes('overlay-visible'));
 const attempts=recoverWorkspace(health,s);
 assert.ok(attempts.includes('mascot-hidden'));assert.ok(attempts.includes('overlay-hidden'));
 assert.equal(s.mascot.hidden,true);assert.equal(s.overlay.hidden,true);
 assert.deepEqual(s.mascot.props.display,['none','important']);
});
test('empty rendered SVG is reported distinctly from a legitimately empty imported page',()=>{
 const s=scene({geometry:{children:0}});
 assert.ok(inspectWorkspace(s).issues.includes('empty-svg'));
 const emptyPdf=inspectWorkspace({...s,documentPaths:0,documentLoaded:true});
 assert.equal(emptyPdf.issues.includes('empty-svg'),false);
});
test('a valid horizontal line with zero-height getBBox is not mistaken for broken geometry',()=>{
 const s=scene({geometry:{bbox:{x:1,y:3,width:15,height:0}}});
 assert.equal(inspectWorkspace(s).issues.includes('invalid-geometry-bounds'),false);
});
test('report serializes CSS and geometry state for investigation without exposing source contents',()=>{
 const s=scene({geometry:{bbox:{x:2000,y:2000,width:50,height:50}}});
 const health=inspectWorkspace(s),text=safeWorkspaceReport(health,{
   version:'0.2.0-alpha.32',source:'client.eps',errors:['TypeError: fail']});
 assert.match(text,/"viewBox"/);assert.match(text,/"geometryBox"/);
 assert.match(text,/client\.eps/);assert.match(text,/TypeError/);
});
test('UI checks workspace after opening and can switch to unstyled real path geometry',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 assert.match(app,/function workspaceScan\(\{attemptRepair=false,manual=false\}/);
 assert.match(app,/scheduleWorkspaceCheck\(\);updateFileHistory/);
 assert.match(app,/if\(p\.artwork&&!forceWireframe\)/);
 assert.match(app,/forceWireframe=!forceWireframe/);
 assert.match(app,/render\(\);/);
 assert.match(html,/id="workspace-check"/);
 assert.match(html,/id="workspace-health-report"/);
 assert.match(html,/id="workspace-check-wireframe"/);
 assert.match(css,/#geometry \.wireframe-override/);
});

test('plain JS startup watchdog reports failure even when app ES modules never initialize',()=>{
 const source=readFileSync(new URL('../web/bootstrap-watchdog.js',import.meta.url),'utf8');
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(source,/setTimeout\(function\(\)\{/);
 assert.match(source,/dataset\.doctorReady==='true'/);
 assert.match(source,/Не удалось завершить загрузку рабочего поля/);
 assert.match(app,/document\.documentElement\.dataset\.doctorReady='true'/);
 assert.match(html,/bootstrap-watchdog\.js\?v=0\.2\.0-alpha\.37/);
});
