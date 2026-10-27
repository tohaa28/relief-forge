import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {realNodeCount} from '../web/preview-node-budget.js';
import {verifyNativeUnionProof} from '../web/native-union-proof.js';
import {verifyEpsOutputGeometry} from '../web/eps-export.js';
const port='8088',server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.NATIVE_UNION_URL||'http://localhost:'+port);
 await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
 await page.evaluate(()=>{document.querySelector('#smoothing-amount').value='0';document.querySelector('#optimization-tolerance').value='.00001';document.querySelector('#merge-overlaps').checked=true;});
 const svg='<svg xmlns="http://www.w3.org/2000/svg" width="20mm" height="20mm" viewBox="0 0 20 20"><path fill="#234567" d="M0 2H6V4H0Z"/><path fill="#234567" d="M2 0H4V6H2Z"/></svg>';
 await page.locator('#file').setInputFiles({name:'native-cuts.svg',mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
 await page.waitForFunction(()=>document.querySelector('#auto-status').textContent.includes('Предварительный'));
 await page.waitForFunction(()=>document.querySelector('#busy').hidden);
 assert.match(await page.locator('#optimization-result').innerText(),/8 → 12/);
 const displayed=await page.locator('#geometry').innerHTML(),eps=[];
 for(const mode of ['outline','original']){
  const pending=page.waitForEvent('download');await page.locator('#export-eps').click();
  await page.locator('input[name="eps-color-mode"][value="'+mode+'"]').check();await page.locator('#eps-color-confirm').click();
  if(await page.locator('#eps-save-warning').isVisible())await page.locator('#eps-save-anyway').click();
  const download=await pending;eps.push({content:readFileSync(await download.path(),'utf8'),source:mode==='outline'?'outline':'repainted-rgb'});
  assert.equal(await page.locator('#geometry').innerHTML(),displayed,'Save must serialize the same rendered AFTER');
 }
 assert.equal(await page.locator('#apply-changes').isEnabled(),false,'Save already commits the exact approved snapshot with Undo');
 const pending=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');
 const download=await pending,project=JSON.parse(readFileSync(await download.path(),'utf8'));
 assert.equal(realNodeCount(project),12);assert.equal(project.paths.length,1);
 assert.equal(verifyNativeUnionProof(project.paths[0]),true);
 assert.equal(project.paths[0].nativeUnionProof.newJunctions,4);
 for(const prepared of eps)assert.equal(verifyEpsOutputGeometry(project,prepared).realNodes,12);
 await page.keyboard.press('Control+z');
 await page.waitForTimeout(250);
 await page.waitForFunction(()=>document.querySelector('#busy').hidden);
 // Project history provides an exact original, independent of preview markers.
 assert.ok(project.history.past.some(p=>realNodeCount(p)===8));
 const restoredEvent=page.waitForEvent('download');await page.keyboard.press('Control+Shift+s');
 const restored=JSON.parse(readFileSync(await (await restoredEvent).path(),'utf8'));
 assert.equal(realNodeCount(restored),8);
 assert.deepEqual(errors,[]);
 console.log('PASS native Union Worker: 8 original anchors -> 12 with exactly 4 necessary cuts; source proof, both EPS=displayed AFTER, Apply/project/Undo, no JS errors');
}finally{await browser?.close();server.kill();}
