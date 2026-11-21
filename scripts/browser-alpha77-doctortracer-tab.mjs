import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const port=process.env.TRACER_TEST_PORT||'8111';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
const published=process.env.TRACER_HOST_URL;
const real=Boolean(published||process.env.TRACER_REAL);
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
  if(real&&!published){
    await page.route('https://tohaa28.github.io/relief-forge/**', async route=>{
      const url=new URL(route.request().url());
      const local='http://localhost:'+port+url.pathname.slice('/relief-forge'.length)+url.search;
      await route.fulfill({response:await route.fetch({url:local})});
    });
  }
  let requests=0;
  let finishDecoration;
  if(!real){
    const decoration=new Promise(resolve=>{finishDecoration=resolve;});
    await page.route('**/DoctorTracer/decoration.svg',async route=>{
      await decoration;
      await route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});
    });
    await page.route('**/doctortracer-fallback.js*',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace(
        "https://tohaa28.github.io/DoctorTracer/","http://localhost:"+port+"/DoctorTracer/")});
    });
    await page.route('**/DoctorTracer/',route=>{
      requests++;
      return route.fulfill({contentType:'text/html',body:`<!doctype html>
        <img src="decoration.svg" alt=""><input id="file" type="file"><button id="vector" disabled>Вектор</button>
        <button id="trace" disabled>Трассировать</button><input id="detail" type="number" value="2">
        <script>
        const file=document.querySelector('#file'),vector=document.querySelector('#vector'),trace=document.querySelector('#trace');
        let svg='';
        file.onchange=async()=>{
          const png=file.files[0];
          const header=new DataView(await png.slice(0,54).arrayBuffer());
          window.rasterDpi=Math.round(header.getUint32(41)*0.0254);
          const image=await createImageBitmap(png);
          const canvas=document.createElement('canvas');
          canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          if(!pixels.some((value,i)=>i%4===3&&value>128))throw new Error('Silhouette was empty');
          const {width,height}=canvas;
          const sample=(x,y)=>Array.from(ctx.getImageData(Math.floor(width*x),Math.floor(height*y),1,1).data);
          window.importedPixels=[sample(.3,.5),sample(.5,.5),sample(.05,.05)];
          window.rasterSize=[width,height];
          window.edgeAlphas=[...new Set(pixels.filter((_value,i)=>i%4===3))].sort((a,b)=>a-b);

          trace.disabled=false;
          trace.onclick=()=>{
            const inset=Number(document.querySelector('#detail').value);
            svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'"><path fill="black" d="M'+inset+' '+inset+'H'+(width-inset)+'V'+(height-inset)+'H'+inset+'Z"/></svg>';
            vector.disabled=false;
          };
        };
        document.addEventListener('keydown',event=>{
          if(!event.ctrlKey||event.key!=='s'||!svg)return;
          if(document.querySelector('#format'))return;
          document.body.insertAdjacentHTML('beforeend','<select id="format"><option>pdf</option><option>svg</option></select><button id="download">Сохранить</button>');
          document.querySelector('#download').onclick=()=>{
            if(document.querySelector('#format').value!=='svg')throw new Error('Expected SVG export');
            const a=document.createElement('a');
            a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
            a.download='result.svg';a.click();
          };
        });
        </script>`});
    });
  }
  await page.goto(published||(real?'https://tohaa28.github.io/relief-forge/':'http://localhost:'+port),
    {waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const input={name:'tracer-tab.svg',mimeType:'image/svg+xml',buffer:Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><g opacity=".6"><path fill="#ff0000" d="M2.13 2.11H7V8H2.13L1.17 6.42Z"/><path fill="#0000ff" d="M4 2H8V8H4Z"/></g></svg>')};
  const settled=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'));
  await page.locator('#file').setInputFiles(input);
  await settled();
  const send=page.locator('#doctortracer-send');
  const dpi=page.locator('#doctortracer-dpi');
  const verifyRaster=async (value,alpha=153)=>{
    const ready=tracer.locator('#trace');
    await ready.waitFor();
    assert.deepEqual(await ready.evaluate(()=>[window.rasterDpi,window.rasterSize,window.edgeAlphas]),
      [value,Array(2).fill(Math.round(10*value/25.4)),[0,alpha]]);
  };
  const before=page.locator('#compare-before');
  const after=page.locator('#compare-after');
  const geometry=()=>page.locator('#geometry path.comparison-path').evaluateAll(
    paths=>paths.map(path=>path.getAttribute('d')));
  await before.click();
  assert.ok(await send.isDisabled());
  assert.ok(await dpi.isDisabled());
  const original=await geometry();
  assert.equal(original.length,2);
  await after.click();
  assert.ok(await send.isEnabled());
  assert.equal(await dpi.inputValue(),"600");
  if(!real)assert.equal(requests,0);
  await send.click();
  const tracer=page.frameLocator('#doctortracer-frame');
  await page.waitForFunction(()=>document.querySelector('#doctortracer-stage').textContent.includes('Настройте параметры'));
  finishDecoration?.();
  assert.equal(await page.locator('main').isHidden(),true);
  assert.ok(await page.locator('header').isHidden());
  assert.ok(await page.locator('footer').isHidden());
  assert.ok((await page.locator('.tracer-heading').boundingBox()).height<=32);
  assert.ok((await page.locator('#doctortracer-frame').boundingBox()).height>=
    (await page.locator('body').boundingBox()).height-32);
  assert.equal(await page.locator('#doctortracer-return').isDisabled(),true);
  if(real){
    await tracer.getByText('Импортированный макет.png',{exact:true}).first().waitFor();
    for(const label of ['Базовый','Чистые Края','Оставить Прозрачность','Высокое Качество','Два Цвета'])
      await tracer.getByText(label,{exact:true}).click();
  }else{
    await verifyRaster(600);
    const samples=await tracer.locator('#trace').evaluate(()=>window.importedPixels);
    assert.deepEqual(samples,[[255,0,0,153],[0,0,255,153],[0,0,0,0]],
      'original colors and group opacity must survive PNG handoff, including overlapped shapes');
    await tracer.locator('#detail').fill('3');
    await tracer.locator('#trace').click();
  }
  await page.locator('#doctortracer-return').click({timeout:120000});
  await settled();
  assert.ok(await page.locator('main').isVisible());
  assert.match(await page.locator('#workspace-filename').textContent(),/DoctorTracer\.svg/);
  await before.click();
  const traced=await geometry();
  assert.notDeepEqual(traced,original);
  if(!real)assert.equal(traced.length,1);
  await after.click();
  for(const resolution of real?[1200]:[1200,300]){
    await dpi.selectOption(String(resolution));
    await send.click();
    await page.waitForFunction(()=>document.querySelector('#doctortracer-stage').textContent.includes('Настройте параметры'));
    if(!real)await verifyRaster(resolution,255);
    await page.locator('#doctortracer-cancel').click();
    await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('отменена'));
  }
  await before.click();
  assert.deepEqual(await geometry(),traced);
  await page.keyboard.press('Control+z');
  await settled();
  await before.click();
  assert.deepEqual(await geometry(),original);
  await page.keyboard.press('Control+y');
  await settled();
  await before.click();
  assert.deepEqual(await geometry(),traced);
  assert.ok(await page.locator('#doctortracer-tab').isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS DoctorTracer wizard: PNG input, settings, SVG as new BEFORE, regular processing, cancel and Undo/Redo');
}finally{
  await browser?.close();
  server.kill();
}
