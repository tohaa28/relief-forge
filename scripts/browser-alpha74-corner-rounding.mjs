import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {verifyEpsOutputGeometry,geometryCommands} from '../web/eps-export.js';

const port='8106',server=spawn(process.execPath,['scripts/serve.mjs'],{
  env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const errors=[];
  const ui=await browser.newPage({viewport:{width:1440,height:980}});
  ui.on('pageerror',e=>errors.push(e.message));
  await ui.goto(process.env.ALPHA74_URL||'http://localhost:'+port);
  await ui.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const ready=()=>ui.waitForFunction(()=>document.querySelector('#busy').hidden&&
    !document.querySelector('#settings-pending').textContent.includes('Выполняется'),null,{timeout:120000});
  const project=async()=>{
    await ui.locator('#settings-pending').click(); // Leave an input before using document shortcuts.
    const event=ui.waitForEvent('download');await ui.keyboard.press('Control+Shift+s');
    return JSON.parse(readFileSync(await (await event).path(),'utf8'));
  };
  const apply=async()=>{await ui.locator('#apply-changes').click();await ready();};
  const open=async(svg,name)=>{
    await ui.locator('#file').setInputFiles({name,mimeType:'image/svg+xml',buffer:Buffer.from(svg)});
    await ui.waitForFunction(()=>document.querySelector('#busy').hidden&&
      document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),null,{timeout:120000});
  };
  await open('<svg xmlns="http://www.w3.org/2000/svg" width="30mm" height="30mm" viewBox="0 0 30 30"><path fill="none" stroke="#123456" d="M5 5 L20 5 L20 20"/></svg>','sharp-corner.svg');
  await ui.locator('#smoothing-amount').fill('0');await apply();
  const zero=await project(),initial=geometryCommands(zero.paths[0]);
  assert.equal(initial.filter(c=>c[0]==='C').length,0);
  await ui.locator('#smoothing-amount').fill('0.5');
  assert.deepEqual(geometryCommands((await project()).paths[0]),initial);
  await apply();const result=await project(),actual=geometryCommands(result.paths[0]);
  assert.equal(actual.filter(c=>c[0]==='C').length,1,'sharp L-L corner is rounded');
  assert.deepEqual(actual[0],initial[0]);assert.deepEqual(actual.at(-1),initial.at(-1));
  assert.match(await ui.locator('#optimization-result').textContent(),/Скруглено острых углов: 1/);
  const event=ui.waitForEvent('download');await ui.locator('#export-eps').click();
  await ui.locator('input[name="eps-color-mode"][value="outline"]').check();await ui.locator('#eps-color-confirm').click();
  if(await ui.locator('#eps-save-warning').isVisible())await ui.locator('#eps-save-anyway').click();
  verifyEpsOutputGeometry(result,{content:readFileSync(await (await event).path(),'utf8'),source:'outline'});
  await ui.keyboard.press('Control+z');await ui.waitForTimeout(220);await ready();
  assert.deepEqual(geometryCommands((await project()).paths[0]),initial);
  await ui.keyboard.press('Control+y');await ui.waitForTimeout(220);await ready();
  assert.deepEqual(geometryCommands((await project()).paths[0]),actual);
  await ui.locator('#smoothing-amount').fill('0');await apply();
  const copies=Array.from({length:151},(_,i)=>'<path fill="none" stroke="#123456" d="M'+(i%15*3)+' '+(Math.floor(i/15)*3)+' h2 v2"/>').join('');
  await open('<svg xmlns="http://www.w3.org/2000/svg" width="50mm" height="40mm" viewBox="0 0 50 40">'+copies+'</svg>','sharp-large.svg');
  await ui.locator('#smoothing-amount').fill('0.1');await apply();
  assert.equal((await project()).paths.reduce((n,p)=>n+geometryCommands(p).filter(c=>c[0]==='C').length,0),151);
  assert.deepEqual(errors,[]);console.log('PASS alpha74: sharp corners, staged/off, real C, free endpoints, EPS exact, Undo/Redo, large151 corners.');
}finally{await browser?.close();server.kill();}
