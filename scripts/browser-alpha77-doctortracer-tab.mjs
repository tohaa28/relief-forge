import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port='8111';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
let browser;
try{
  await new Promise((resolve,reject)=>{
    server.stdout.once('data',resolve);
    server.once('exit',code=>reject(Error('Server exited: '+code)));
  });
  browser=await chromium.launch();
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Substitute the remote engine only. Use the real transfer, UI and validation.
  await page.route('**/doctortracer-fallback.js*',async route=>{
    const response=await route.fetch();
    const source=(await response.text()).replace("if(page.protocol!=='https:'||page.hostname!=='tohaa28.github.io')","if(false)");
    await route.fulfill({response,body:source});
  });
  let requests=0;
  await page.route('**/DoctorTracer/worker.js*',route=>{
    requests++;
    return route.fulfill({contentType:'application/javascript',body:String.raw`
      self.onmessage=({data:{width,height,pixels}})=>{
        const rgba=new Uint8Array(pixels);
        let left=width,top=height,right=0,bottom=0;
        for(let y=0;y<height;y++)for(let x=0;x<width;x++){
          if(rgba[(y*width+x)*4+3]<128)continue;
          left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
        }
        if(left>=right||top>=bottom){postMessage({error:'Empty transferred raster'});return;}
        postMessage({progress:50,stage:'Проверка передачи растра'});
        setTimeout(()=>postMessage({backend:'fixture',svg:'<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><path fill="black" d="M'+left+' '+top+'H'+right+'V'+bottom+'H'+left+'Z"/></svg>'}),1500);
      };
    `});
  });
  await page.goto('http://localhost:'+port);
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const input={name:'tracer-tab.svg',mimeType:'image/svg+xml',buffer:Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><path fill="black" d="M2 2H8V8H2Z"/></svg>')};
  const settled=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'));
  await page.locator('#file').setInputFiles(input);
  await settled();
  assert.equal(requests,0);
  await page.locator('#doctortracer-enabled').check();
  await page.locator('#apply-changes').click();
  await page.locator('#doctortracer-image').waitFor({state:'visible'});
  assert.ok(await page.locator('#doctortracer-image').evaluate(canvas=>
    canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data[3]>0));
  assert.equal(await page.locator('main').isHidden(),true);
  const transferred=()=>page.waitForFunction(()=>document.querySelector('#doctortracer-stage').textContent.includes('Проверка передачи'));
  await transferred();
  await settled();
  assert.match(await page.locator('#doctortracer-status').textContent(),/после трассировки осталось 0/);
  assert.ok(await page.locator('main').isVisible());
  await page.locator('#file').setInputFiles(input);
  await transferred();
  await page.locator('#doctortracer-cancel').click();
  await settled();
  assert.match(await page.locator('#doctortracer-status').textContent(),/отменена/);
  assert.ok(await page.locator('#doctortracer-tab').isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS DoctorTracer tab: raster preview, Worker transfer, native checks, cancel and automatic return');
}finally{
  await browser?.close();
  server.kill();
}
