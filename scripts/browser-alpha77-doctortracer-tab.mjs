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
  if(!real){
    await page.route('**/doctortracer-fallback.js*',async route=>{
      const response=await route.fetch();
      await route.fulfill({response,body:(await response.text()).replace(
        "https://tohaa28.github.io/DoctorTracer/","http://localhost:"+port+"/DoctorTracer/")});
    });
    await page.route('**/DoctorTracer/',route=>{
      requests++;
      return route.fulfill({contentType:'text/html',body:`<!doctype html>
        <input id="file" type="file"><button id="vector" disabled>Вектор</button>
        <button id="trace" disabled>Трассировать</button><input id="detail" type="number" value="2">
        <script>
        const file=document.querySelector('#file'),vector=document.querySelector('#vector'),trace=document.querySelector('#trace');
        let svg='';
        file.onchange=async()=>{
          const image=await createImageBitmap(file.files[0]);
          const canvas=document.createElement('canvas');
          canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
          const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          if(!pixels.some((value,i)=>i%4===3&&value>128))throw new Error('Silhouette was empty');
          const {width,height}=canvas;
          const sample=(x,y)=>Array.from(ctx.getImageData(Math.floor(width*x),Math.floor(height*y),1,1).data);
          window.importedPixels=[sample(.3,.5),sample(.5,.5),sample(.05,.05)];

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
  await page.goto(published||(real?'https://tohaa28.github.io/relief-forge/':'http://localhost:'+port));
  await page.waitForFunction(()=>document.querySelector('#engine').textContent.includes('готов'));
  const input={name:'tracer-tab.svg',mimeType:'image/svg+xml',buffer:Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><g opacity=".6"><path fill="#ff0000" d="M2 2H7V8H2Z"/><path fill="#0000ff" d="M4 2H8V8H4Z"/></g></svg>')};
  const settled=()=>page.waitForFunction(()=>document.querySelector('#busy').hidden&&document.querySelector('#status').textContent.startsWith('ПОСЛЕ:'));
  await page.locator('#file').setInputFiles(input);
  await settled();
  if(!real)assert.equal(requests,0);
  await page.locator('#doctortracer-enabled').check();
  await page.locator('#apply-changes').click();
  const tracer=page.frameLocator('#doctortracer-frame');
  await page.waitForFunction(()=>document.querySelector('#doctortracer-stage').textContent.includes('Настройте параметры'));
  assert.equal(await page.locator('main').isHidden(),true);
  assert.equal(await page.locator('#doctortracer-return').isDisabled(),true);
  if(real){
    await tracer.getByText('Импортированный макет.png',{exact:true}).first().waitFor();
    for(const label of ['Базовый','Чистые Края','Оставить Прозрачность','Высокое Качество','Два Цвета'])
      await tracer.getByText(label,{exact:true}).click();
  }else{
    await tracer.locator('#trace').waitFor();
    const samples=await tracer.locator('#trace').evaluate(()=>window.importedPixels);
    assert.deepEqual(samples,[[255,0,0,153],[0,0,255,153],[0,0,0,0]],
      'original colors and group opacity must survive PNG handoff, including overlapped shapes');
    await tracer.locator('#detail').fill('3');
    await tracer.locator('#trace').click();
  }
  await page.locator('#doctortracer-return').click({timeout:120000});
  await settled();
  assert.match(await page.locator('#doctortracer-status').textContent(),/после трассировки осталось|геометрия заметно отличается|новый вектор принят/);
  assert.ok(await page.locator('main').isVisible());
  await page.locator('#file').setInputFiles(input);
  await page.waitForFunction(()=>document.querySelector('#doctortracer-stage').textContent.includes('Настройте параметры'));
  await page.locator('#doctortracer-cancel').click();
  await settled();
  assert.match(await page.locator('#doctortracer-status').textContent(),/отменена/);
  assert.ok(await page.locator('#doctortracer-tab').isHidden());
  assert.deepEqual(errors,[]);
  console.log('PASS DoctorTracer wizard: PNG input, settings, SVG return, host validation and cancel');
}finally{
  await browser?.close();
  server.kill();
}
