import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const base=new URL('../web/',import.meta.url);
const html=readFileSync(new URL('index.html',base),'utf8');
const css=readFileSync(new URL('style.css',base),'utf8');
const mascot=readFileSync(new URL('approved/mascot-approved.png',base));
const sprite=readFileSync(new URL('doctor-icons.svg',base),'utf8');

test('mascot occurs only in the workspace welcome state, never header/logo',()=>{
  const header=html.split('</header>')[0];
  const welcome=html.match(/<div id="mascot-welcome"[\s\S]*?<\/div><\/div>/)?.[0]||'';
  assert.ok(header.includes('class="brand-appmark"'));
  assert.ok(!header.includes('brand-mascot'));
  assert.ok(!header.includes('doctor-mascot.svg'),'mascot must not be in header');
  assert.equal((html.match(/approved\/mascot-approved\.png/g)||[]).length,1);
  assert.match(welcome,/class="workspace-mascot"/);
  assert.deepEqual([...mascot.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  assert.match(css,/\.mascot-welcome\s*\{[^}]*top:50%;left:50%;transform:translate\(-50%,-50%\)/);
  assert.match(css,/\.mascot-welcome\[hidden\]\{display:none\}/);
});

test('tool buttons use one shared sizing system; SVG artworks themselves stay external',()=>{
  assert.match(css,/--du-control-height:40px/);
  assert.match(css,/--du-icon-size:20px/);
  assert.match(css,/\.tool-icon,header \.tool-icon,#curve-node-tools \.tool-icon/);
  assert.match(css,/button kbd\{display:inline-flex/);
  assert.match(css,/button:focus-visible/);
  assert.match(css,/\.node-context button\{width:100%;min-height:36px;display:flex/);
  const ids=new Set([...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(m=>m[1]));
  for(const name of html.matchAll(/<use href="doctor-icons\.svg#([^"]+)"/g))
    assert.ok(ids.has(name[1]),'Missing icon symbol '+name[1]);
  assert.ok(ids.size>=33);
});

test('CSS does not flatten or modify workspace artwork geometry',()=>{
  assert.ok(html.includes('<svg id="canvas"'));
  assert.match(css,/#canvas\{display:block;height:100%;width:100%\}/);
  assert.match(css,/\.workspace\{position:relative/);
  assert.match(css,/\.mascot-welcome \.workspace-mascot\{[^}]*object-fit:contain/);
  assert.doesNotMatch(css,/(?:filter|clip-path):[^;]*\.workspace-mascot/);
});
