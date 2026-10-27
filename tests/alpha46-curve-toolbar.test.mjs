import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/style.css',import.meta.url),'utf8');
test('workspace diagnostics icon is alone in a square rightmost toolbar control',()=>{
 const nav=html.match(/<nav>([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav);
 const button=nav.match(/<button id="workspace-check"[^>]*>([\s\S]*?)<\/button>/);
 assert.ok(button,'field check remains a normal button');
 assert.match(button[0],/aria-label="Проверка поля"/);
 assert.doesNotMatch(button[1],/Проверка поля|<kbd>/);
 assert.equal(nav.indexOf('id="workspace-check"')>nav.indexOf('id="curve-edit"'),true);
 assert.match(css,/nav #workspace-check\.workspace-check-icon\{/);
 assert.match(css,/margin-left:auto/);
 assert.match(css,/aspect-ratio:1\/1/);
});
test('manual repairs are in visible second editing toolbar row, with all keyboard actions intact',()=>{
 const main=html.indexOf('<main id="main-layout"'),tool=html.indexOf('id="curve-node-tools"'),
       menu=html.indexOf('id="manual-repairs"');
 assert.ok(menu>tool&&menu<main,'manual actions must be inside editor toolbar, not right sidebar');
 assert.equal((html.match(/id="manual-repairs"/g)||[]).length,1);
 for(const i of [1,2,3,4,5,6,7,8])
   assert.equal((html.match(new RegExp('data-action="'+i+'"','g'))||[]).length,1);
 assert.match(html,/>Редактирование кривой<kbd>E<\/kbd>/);
 assert.doesNotMatch(html,/>Узлы кривой<kbd>E<\/kbd>/);
 assert.match(app,/document\.querySelectorAll\('\[data-action\]'\)/);
 assert.match(css,/#curve-node-tools \.curve-repairs-dropdown/);
});
test('different 32px-target cursor SVGs have a central + and X, NOT minus or font glyph',()=>{
 assert.match(app,/const plusCursor=nodeCursor\('add'\),minusCursor=nodeCursor\('remove'\)/);
 assert.match(app,/M12 12L20 20 M20 12L12 20/);
 assert.match(app,/M16 11V21 M11 16H21/);
 assert.match(app, /\) 16 16, crosshair/);
 assert.doesNotMatch(app, /nodeCursor\('−'\)/);
 assert.match(app,/nodeTool==='add'\?plusCursor:nodeTool==='remove'\?minusCursor/);
});
test('default AFTER appears only after processing while explicit DO survives background recalculation',()=>{
 assert.match(app,/if\(!comparisonSelectionExplicit\)compareStage='after'/);
 assert.match(app,/comparisonSelectionExplicit=true;compareStage='before'/);
 assert.match(app,/comparisonSelectionExplicit=true;compareStage='after'/);
 assert.match(app,/importedBefore=beginImportBefore\(doc\);comparisonSelectionExplicit=false;compareStage='before'/);
 assert.match(app,/captureImportBefore\(importedBefore,issues/);
 assert.match(app,/prepareEpsOutput\(chosen\.document\)/);
});
