import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDeferredCurveEditor} from '../web/deferred-curve-editor.js';
function path(count=7545){
  const commands=[['M',0,0]],points=[[0,0]];
  for(let i=1;i<=count;i++){
    const y=Math.sin(i*.035),x=i*.012;
    commands.push(['C',x-.008,Math.sin((i-.67)*.035),
      x-.004,Math.sin((i-.33)*.035),x,y]);
    points.push([x,y]);
  }
  return {kind:'vector',offset:[0,0],closed:false,artwork:'<path/>',commands,points};
}
test('local zoom renderer reads only viewport-intersecting C curves, never full 7545',()=>{
 const original=path(),json=JSON.stringify(original),editor=createDeferredCurveEditor(original);
 const focus=editor.nodePosition(3750),visible=editor.visibleSegmentSVG(focus,.08,{limit:600});
 assert.ok(visible.length>0&&visible.length<100,
   'small zoom viewport must not materialize most Beziers: '+visible.length);
 assert.ok(visible.every(s=>s.d.startsWith('M')&&s.d.includes('C')));
 assert.ok(visible.every(s=>s.d.length<250));
 assert.equal(JSON.stringify(original),json);
 const focused=visible.find(s=>s.index===3750)||visible[0];
 editor.moveAnchor(3750,[focus[0]+.01,focus[1]+.01]);
 const updated=editor.visibleSegmentSVG(focus,.08);
 assert.ok(updated.some(s=>s.index===focused.index),'neighbor indexing after edit');
 assert.equal(JSON.stringify(original),json);
});
test('deep zoom caps native segment painting at 600 and source stays immutable',()=>{
 const original=path(),editor=createDeferredCurveEditor(original);
 const visible=editor.visibleSegmentSVG([45,0],100,{limit:600});
 assert.equal(visible.length,600);
 assert.equal(editor.finish().commands.length,7546);
 assert.deepEqual(editor.finish().commands,original.commands);
});
test('zoom path updates are frame coalesced; global vector DOM is hidden ONLY in deep local editor',()=>{
 const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert.match(app,/function scheduleManualZoomRefresh\(\)/);
 assert.match(app,/if\(!curveEditing\(\)\|\|manualZoomFrame\)return/);
 assert.match(app,/requestAnimationFrame\(\(\)=>\{/);
 assert.match(app,/rescaleLocalEditorGlyphs\(unit\)/);
 assert.match(app,/visibleSegmentSVG\(center,Math\.hypot\(view\.width,view\.height\)/);
 assert.match(app,/document\.body\.classList\.add\('manual-local-zoom'\)/);
 assert.match(app,/drag\.livePath=el\('path',\{d:'',class:'manual-live-patch'\},\$\('manual-patches'\)\)/);
 assert.match(css,/\.manual-local-zoom #geometry\{display:none!important\}/);
 assert.match(html,/id="manual-local-geometry"/);
 assert.match(app,/manual-local-hit/);
 assert.match(css,/#manual-local-geometry \.manual-local-hit\{/);
});
