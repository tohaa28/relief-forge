import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');

test('information panel is hidden by default and can be reopened without losing tools',()=>{
  assert.match(html,/<main id="main-layout" class="left-collapsed">/);
  assert.match(html,/<aside class="left" id="info-panel" hidden>/);
  assert.match(html,/<button id="toggle-info"[^>]*aria-controls="info-panel" aria-expanded="false"/);
  assert.match(css,/main\.left-collapsed\{grid-template-columns:/);
  assert.match(css,/#info-panel\[hidden\]\{display:none\}/);
  assert.match(app,/\$\('toggle-info'\)\.onclick=/);
  assert.match(app,/panel\.hidden=!expanded/);
  for(const id of ['width','height','paths','fonts','heal-copy','import-report']){
    assert.match(html,new RegExp('id="'+id+'"'));
  }
});
test('document creation tools are in a closed-by-default native disclosure',()=>{
  assert.match(html,/<details id="creation-tools" class="creation-tools"><summary>Создание документа<\/summary>/);
  assert.doesNotMatch(html,/<details id="creation-tools"[^>]*\bopen\b/);
  const menu=html.slice(html.indexOf('id="creation-tools"'),html.indexOf('</details>'));
  for(const id of ['new','line','rect','circle','demo'])assert.ok(menu.includes('id="'+id+'"'),id);
  assert.ok(!menu.includes('id="select"'),'Selection tool stays outside hidden group');
});
