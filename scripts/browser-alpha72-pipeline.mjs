import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const port='8104';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
let browser;
try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.ALPHA72_URL||'http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const downloadJson=async id=>{
    if(id==='#save')await page.locator('#creation-tools').evaluate(e=>{e.open=true;});
    const event=page.waitForEvent('download');await page.locator(id).click();
    const downloaded=await event;
    if(id==='#save')await page.locator('#creation-tools').evaluate(e=>{e.open=false;});
    return readFile(await downloaded.path(),'utf8');
  };
  const finish=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&
    document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'),null,{timeout:120000});
  const svg=paths=>'<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">'+paths+'</svg>';
  const load=async(content,name)=>{
    await page.locator('#file').setInputFiles({name,mimeType:'image/svg+xml',buffer:Buffer.from(content)});await finish();
  };
  // Three original objects, including a removable micro-object. All originals
  // must remain in the contour underlay even after the candidate loses paths.
  const original=svg('<path fill="none" stroke="black" d="M1 1 L8 1 L8 1 L8 8 L1 8 Z"/>'+
    '<path fill="none" stroke="black" d="M20 1 C22 0 24 0 26 1 L26 8 L20 8 Z"/>'+
    '<path fill="none" stroke="black" d="M35 1 L35.04 1 L35.04 1.04 L35 1.04 Z"/>');
  await load(original,'alpha72-source.svg');
  if(process.env.ALPHA72_SCREENSHOT)await page.screenshot({path:process.env.ALPHA72_SCREENSHOT});
  assert.equal(await page.locator('#geometry [data-comparison-underlay] path').count(),3);
  const beforeData=await page.locator('#geometry .comparison-ghost').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d')));
  await page.locator('#compare-prepared').click();
  assert.equal(await page.locator('#geometry .comparison-path').count(),1,'disjoint parts are one editable object before repair');
  const prepared=await page.locator('#geometry .comparison-path').getAttribute('d');
  assert.equal((prepared.match(/M/g)||[]).length,3);
  assert.ok(await page.locator('#markers circle').count()>0,'pre-repair defects are visible');
  await page.locator('#compare-before').click();
  assert.deepEqual(await page.locator('#geometry .comparison-path').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('d'))),beforeData);
  await page.locator('#compare-after').click();
  const after=await page.locator('#geometry .comparison-path').getAttribute('d');
  assert.notEqual(after,prepared,'actual repair follows diagnosis');
  assert.equal((after.match(/M/g)||[]).length,2,'CNC micro-element is removed only after diagnosis');
  const journal=(await downloadJson('#log')).trim().split('\n').map(JSON.parse);
  const diagnosed=journal.findIndex(e=>e.action==='combined-copy-diagnosed');
  const healed=journal.findIndex(e=>e.action==='autoheal-curve-preview');
  const checked=journal.findIndex(e=>e.action==='after-diagnose-cached');
  assert.ok(diagnosed>=0&&healed>diagnosed&&checked>healed);
  const untouched=JSON.parse(await downloadJson('#save'));
  assert.equal(untouched.paths.length,3,'working document is original until Apply');
  await page.locator('#apply-changes').click();
  const applied=JSON.parse(await downloadJson('#save'));
  assert.equal(applied.paths.length,1);
  assert.equal(applied.paths[0].commands.filter(c=>c[0]==='M').length,2);
  assert.equal(applied.history.past.at(-1).paths.length,3,'Undo checkpoint contains all original parts');
  assert.equal(await page.locator('#geometry .comparison-ghost').count(),3,'underlay survives Apply');
  await page.keyboard.press('Control+z');await finish();
  assert.equal(JSON.parse(await downloadJson('#save')).paths.length,3);

  // A different winding rule produced by a successful filled Union is not
  // allowed to block combining a disconnected island into the same object.
  await load(svg('<path fill="black" d="M1 1 H8 V8 H1 Z"/>'+
    '<path fill="black" d="M4 1 H12 V8 H4 Z"/>'+
    '<path fill="black" d="M20 1 H26 V8 H20 Z"/>'),'alpha72-filled.svg');
  await page.locator('#compare-prepared').click();
  assert.equal(await page.locator('#geometry .comparison-path').count(),1,'filled Union and distant island combine');

  // Exercise the separate large-document route (>150 original objects).
  const many=Array.from({length:151},(_,i)=>{
    const x=1+i%15*6,y=1+Math.floor(i/15)*6;
    return '<path fill="none" stroke="black" d="M'+x+' '+y+' l2 0 l0 2 l-2 0 Z"/>';
  }).join('');
  await load(svg(many),'alpha72-large.svg');
  await page.locator('#compare-prepared').click();
  assert.equal(await page.locator('#geometry .comparison-path').count(),1);
  assert.equal((await page.locator('#geometry .comparison-path').getAttribute('d')).match(/M/g).length,151);
  await page.locator('#compare-after').click();
  assert.equal(await page.locator('#geometry .comparison-ghost').count(),151);
  assert.deepEqual(errors,[]);
  console.log('PASS alpha72: immutable DO; Union+compound before diagnosis; highlighted defects before repair; full underlay; Apply/Undo; real filled and >150-object routes.');
}finally{await browser?.close();server.kill();}
