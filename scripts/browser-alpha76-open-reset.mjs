import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {geometryCommands} from '../web/eps-export.js';
const port='8110',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((r,j)=>{server.stdout.once('data',r);server.once('error',j);});let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:980}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.ALPHA76_URL||'http://localhost:'+port);await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 const file={name:'open-reset.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40mm" height="22mm" viewBox="0 0 40 22"><path fill="none" stroke="black" d="M5 10 C10 2 15 2 20 10 C25 18 30 18 35 10"/></svg>')};
 const ready=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),null,{timeout:120000});
 const project=async()=>{await page.locator('#settings-pending').click();const e=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');return JSON.parse(readFileSync(await(await e).path(),'utf8'));};
 const empty=async()=>{
  assert.equal(await page.locator('#geometry [data-path]').count(),0);assert.equal(await page.locator('#markers').locator('*').count(),0);
  for(const id of ['manual-glyphs','manual-patches','manual-local-geometry'])assert.equal(await page.locator('#'+id).locator('*').count(),0);
  assert.equal(await page.locator('#workspace-file').isHidden(),true);assert.equal(await page.locator('#mascot-welcome').isVisible(),true);
  assert.equal(await page.locator('#count').textContent(),'0');assert.equal(await page.locator('#optimization-result').textContent(),'');
  const view=(await page.locator('#canvas').getAttribute('viewBox')).split(/\s+/).map(Number);
  [-21,-21,342,242].forEach((v,i)=>assert.ok(Math.abs(v-view[i])<1e-10));
  assert.equal(await page.locator('body').evaluate(b=>b.classList.contains('curve-editing')),false);
 };
 await page.locator('#file').setInputFiles(file);await ready();const source=await project();
 await page.locator('#zoom-in').click();await page.waitForTimeout(40);
 const event=page.waitForEvent('filechooser');await page.locator('#open').click();const chooser=await event;
 await empty();await chooser.setFiles([]);await page.waitForTimeout(220);await empty();
 await page.keyboard.press('Control+z');await page.waitForTimeout(250);await ready();
 assert.deepEqual(geometryCommands((await project()).paths[0]),geometryCommands(source.paths[0]),'Undo restores the document cleared by Open');
 // The keyboard shortcut uses the same reset-before-picker path and can reopen the same filename.
 const shortcut=page.waitForEvent('filechooser');await page.keyboard.press('Control+o');const picked=await shortcut;await empty();await picked.setFiles(file);await ready();
 assert.equal(await page.locator('#workspace-filename').textContent(),file.name);
 await page.locator('#curve-edit').click();
 const anchor=page.locator('#geometry .curve-node, #manual-glyphs .curve-node').first(),b=await anchor.boundingBox();assert.ok(b);
 await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+12,b.y+b.height/2+5);await page.mouse.up();
 assert.ok(await page.locator('#manual-patches .manual-staged-segment').count());
 const fromEditor=page.waitForEvent('filechooser');await page.locator('#open').click();const editorPicker=await fromEditor;await empty();await editorPicker.setFiles([]);
 await page.keyboard.press('Control+z');await page.waitForTimeout(250);
 await page.waitForFunction(()=>document.querySelector('#busy').hidden);
 const restored=await project();assert.notDeepEqual(geometryCommands(restored.paths[0]),geometryCommands(source.paths[0]),'Open commits local edits into its Undo snapshot');
 const invalidEvent=page.waitForEvent('filechooser');await page.locator('#open').click();const invalid=await invalidEvent;await empty();
 await invalid.setFiles({name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg>')});
 await page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent!=='Рабочая область очищена. Выберите файл.',null,{timeout:120000});
 await empty();assert.deepEqual(errors,[]);
 console.log('PASS alpha76 Open: clears before picker, resets camera/comparison/glyphs, cancel stays blank, Undo restores original and staged editor edits, Ctrl+O/same filename and invalid import.');
}finally{await browser?.close();server.kill();}
