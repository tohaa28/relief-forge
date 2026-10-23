import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('zoom buttons use complete centered vector signs rather than truncated raster crops',()=>{
 for(const [id,d] of [['zoom-in','M5 12h14 M12 5v14'],['zoom-out','M5 12h14']]){
  const tag=html.match(new RegExp('<button id="'+id+'"[\\s\\S]*?</button>'))?.[0];
  assert.ok(tag,'zoom button '+id);assert.match(tag,/aria-label="[^"]+"/);
  assert.match(tag,/viewBox="0 0 24 24"/);assert.ok(tag.includes('d="'+d+'"'));
  assert.doesNotMatch(tag,/<img|zoom_plus\.png|zoom_minus\.png/);
 }
 assert.match(css,/#zoom-in,#zoom-out\{width:42px;min-width:42px/);
});

test('information button retains icon when disclosure label changes',()=>{
 assert.match(html,/id="toggle-info"[^>]*><svg class="tool-icon"[^>]*>/);
 assert.match(html,/id="toggle-info-label"/);
 assert.match(app,/\$\('toggle-info-label'\)\.textContent=/);
 assert.doesNotMatch(app,/\$\('toggle-info'\)\.textContent=/);
});
test('file caption is safe, bounded, and bound to confirmed document state',()=>{
 assert.match(html,/id="workspace-file" class="workspace-file"[^>]* hidden/);
 assert.match(html,/id="workspace-filename"/);
 assert.match(css,/\.workspace-file\[hidden\]\{display:none!important\}/);
 assert.match(css,/#workspace-filename\{[^}]*text-overflow:ellipsis/);
 assert.match(app,/const name=basename\(doc\.sourceFileName\|\|doc\.epsImport\?\.name\|\|doc\.pdfImport\?\.name\|\|'\'\)/);
 assert.match(app,/\$\('workspace-filename'\)\.textContent=name/);
 assert.match(app,/function render\(\)\{\s*syncWorkspaceFileLabel\(\)/);
 assert.match(app,/doc=\{format:'relief-forge',version:1,width:300,height:200,paths:\[\]\}/);
});
test('narrow controls can wrap rather than paint over SVG icons',()=>{
 assert.match(css,/\.point-controls\{flex-wrap:wrap/);
 assert.match(css,/\.point-controls button\{flex:1 1 100%/);
 assert.match(css,/button>\.tool-icon,button>\.tool-icon\.approved-icon\{flex-shrink:0;overflow:hidden\}/);
});
