import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const ref='f85879a287f9283836e68a2473d1b929339b9041';
const root=await mkdtemp(join(tmpdir(),'doctortracer-real-'));
let server,browser;
try{
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'inherit'});
 git('init','-q');git('fetch','--depth=1','https://github.com/tohaa28/DoctorTracer.git',ref);git('checkout','--detach','FETCH_HEAD');
 execFileSync(process.execPath,['tests/crisp_handoff.mjs'],{cwd:root,stdio:'inherit'});
 execFileSync(process.execPath,['tests/native_raster.mjs'],{cwd:root,stdio:'inherit'});
 execFileSync(process.execPath,['tests/png_dpi_metadata.mjs'],{cwd:root,stdio:'inherit'});
 execFileSync(process.execPath,['tests/pixel_grid_trace.mjs'],{cwd:root,stdio:'inherit'});
 const web=join(root,'web');
 const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'};
 server=createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/relief-forge/'){res.writeHead(200,{'Content-Type':'text/html'});res.end('<iframe id="tracer" src="/DoctorTracer/" style="width:1200px;height:850px"></iframe>');return;}
   if(!url.pathname.startsWith('/DoctorTracer/')){res.writeHead(404);res.end();return;}
   const path=resolve(web,decodeURIComponent(url.pathname.slice('/DoctorTracer/'.length))||'index.html');
   if(!path.startsWith(web+sep))throw Error('invalid path');
   const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
  }catch{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch();
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  window.inputStages=[];
  window.hashBytes=bytes=>{let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return h>>>0;};
  window.rgbaClasses=rgba=>{
   const set=new Set();
   for(let i=0;i<rgba.length;i+=4){
    const a=rgba[i+3];set.add(a?[rgba[i],rgba[i+1],rgba[i+2],a].join(','):'0,0,0,0');
    if(set.size>32)return ['>32 classes'];
   }
   return [...set].sort();
  };
  const post=Worker.prototype.postMessage;
  Worker.prototype.postMessage=function(message,...other){
   if(message?.pixels instanceof ArrayBuffer){
    window.inputStages.push({stage:message.operation||'trace',width:message.width,height:message.height,classes:window.rgbaClasses(new Uint8Array(message.pixels)),hash:window.hashBytes(new Uint8Array(message.pixels))});
   }
   return post.call(this,message,...other);
  };
 });
 const expected=['0,0,0,0','0,0,255,255','0,255,0,153','255,0,0,255'].sort();
 await page.goto(origin+'/relief-forge/');
 const frame=page.frameLocator('#tracer');
 async function load(target,filename){
  await target.locator('#file').evaluate((input,filename)=>{
   const width=3001,height=181,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
   const ctx=canvas.getContext('2d'),image=ctx.createImageData(width,height);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const p=(y*width+x)*4,edge=x+y*3;
    image.data.set(edge<800?[255,0,0,255]:edge<1600?[0,0,255,255]:edge<2400?[0,255,0,153]:[0,0,0,0],p);
   }
   ctx.putImageData(image,0,0);
   return new Promise(resolve=>canvas.toBlob(async blob=>{
    window.originalPngHash=window.hashBytes(new Uint8Array(await blob.arrayBuffer()));
    const dt=new DataTransfer();dt.items.add(new File([blob],filename,{type:'image/png'}));
    input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();
   }));
  },filename);
  await target.locator('#filename').filter({hasText:filename}).waitFor({timeout:60000});
  return target.locator('#preview').evaluate(async img=>{
   await img.decode();
   const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
   const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(img,0,0);
   const rgba=ctx.getImageData(0,0,c.width,c.height).data;
   return {width:c.width,height:c.height,classes:window.rgbaClasses(rgba),hash:window.hashBytes(rgba),samePng:window.originalPngHash===window.hashBytes(new Uint8Array(await (await fetch(img.src)).arrayBuffer())),rendering:getComputedStyle(img).imageRendering,stages:window.inputStages};
  });
 }
 const embedded=await load(frame,'embedded-crisp.png');
 assert.equal(embedded.width,3001);assert.equal(embedded.height,181);assert.equal(embedded.samePng,true);assert.deepEqual(embedded.classes,expected);
 assert.ok(['pixelated','crisp-edges'].includes(embedded.rendering),JSON.stringify(embedded));
 const analysis=embedded.stages.find(s=>s.stage==='analyze');assert.equal(analysis.width,3001);assert.equal(analysis.height,181);assert.equal(analysis.hash,embedded.hash);assert.deepEqual(analysis.classes,expected);
 await frame.getByText('Базовый',{exact:true}).click();
 await frame.getByText('Чистые Края',{exact:true}).click();
 await frame.getByText('Оставить Прозрачность',{exact:true}).click();
 await frame.getByText('Высокое Качество',{exact:true}).click();
 await frame.getByText('Два Цвета',{exact:true}).click();
 const child=page.frames().find(f=>f.url().includes('/DoctorTracer/'));
 await child.waitForFunction(()=>window.inputStages.some(s=>s.stage==='trace'),{},{timeout:120000});
 const stages=await child.evaluate(()=>window.inputStages);
 const palette=stages.find(s=>s.stage==='palette'),trace=stages.find(s=>s.stage==='trace');
 assert.equal(palette.width,3001);assert.equal(palette.height,181);assert.equal(palette.hash,embedded.hash);assert.deepEqual(palette.classes,expected);
 assert.equal(trace.width,3001);assert.equal(trace.height,181);assert.equal(trace.hash,embedded.hash);assert.deepEqual(trace.classes,expected);
 await child.waitForFunction(()=>!document.querySelector('#vector').disabled,{},{timeout:120000});
 assert.equal(await child.locator('#preview').evaluate(img=>img.classList.contains('crisp-bitmap')),false);
 await child.locator('#bitmap').click();
 assert.equal(await child.locator('#preview').evaluate(img=>img.classList.contains('crisp-bitmap')),true);
 // Standalone also preserves raster resolution; ordinary photo preview stays auto.
 await page.goto(origin+'/DoctorTracer/');
 const standalone=await load(page,'standalone.png');
 assert.equal(standalone.rendering,'auto');
 assert.deepEqual(standalone.classes,expected);assert.equal(standalone.width,3001);assert.equal(standalone.height,181);assert.equal(standalone.samePng,true);
 await page.locator('#file').evaluate(input=>{const c=document.createElement('canvas');c.width=4097;c.height=1;return new Promise(resolve=>c.toBlob(blob=>{const dt=new DataTransfer();dt.items.add(new File([blob],'oversized.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));resolve();}));});
 await page.locator('#status').filter({hasText:'Автоматическое уменьшение запрещено'}).waitFor();
 assert.equal(await page.locator('#next').isDisabled(),true);
 assert.deepEqual(errors,[]);
 console.log('PASS real native raster: byte-identical PNG; full-size equal RGBA hashes through analyze, palette and trace; reject oversized',JSON.stringify({embedded,stages,standalone}));
}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));await rm(root,{recursive:true,force:true});}
