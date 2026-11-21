import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const port=process.env.CRISP_TEST_PORT||'8112';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Server exited '+code)));});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.goto('http://localhost:'+port+'/licenses.html');
 const results=await page.evaluate(async()=>{
  const {hardenClipMasks}=await import('/doctortracer-clip-mask.js');
  const {appearanceRasterPlan,doctorTracerHandoffPlan,rasterizeImportedAppearance}=await import('/doctortracer-appearance.js');
  const {importRichSvg}=await import('/rich-svg.js');
  const examples=[
   ['userSpace','<clipPath id="c"><path d="M1.123 1.17L8.9 2.06L2.47 9.19Z"/></clipPath>','<rect width="10" height="10" fill="red" clip-path="url(#c)"/>'],
   ['bbox','<clipPath id="c" clipPathUnits="objectBoundingBox"><path d="M.1123 .117L.89 .206L.247 .919Z"/></clipPath>','<rect x="1" y="1" width="8" height="8" fill="red" clip-path="url(#c)"/>'],
   ['transform','<clipPath id="c" transform="translate(1 .5)"><path d="M1.123 1.17L8 2.06L2.47 8Z"/></clipPath>','<g transform="translate(.3 .4)" style="clip-path:url(#c)"><rect width="9" height="9" fill="red"/></g>'],
   ['hole','<clipPath id="c" clip-rule="evenodd"><path d="M1.12 1.17L8.9 2.06L2.47 9.19Z M2.5 3L5 3L3 5Z"/></clipPath>','<rect width="10" height="10" fill="red" clip-path="url(#c)"/>']
  ];
  const out=[];
  const pixels=async blob=>{
   const bitmap=await createImageBitmap(blob),canvas=document.createElement('canvas');
   canvas.width=bitmap.width;canvas.height=bitmap.height;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(bitmap,0,0);
   const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   bitmap.close();return {width:canvas.width,height:canvas.height,data};
  };
  for(const [name,defs,body] of examples){
   const svg='<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><defs>'+defs+'</defs><g opacity=".6">'+body+'</g></svg>';
   const source=importRichSvg(svg),before=JSON.stringify(source);
   const plan=appearanceRasterPlan(source,600),warnings=[];
   const png=await rasterizeImportedAppearance(source,plan,{onWarning:v=>warnings.push(v)});
   const {data,width,height}=await pixels(png);
   const levels=[...new Set(data.filter((v,i)=>i%4===3))].sort((a,b)=>a-b);
   const painted=data.filter((v,i)=>i%4===3&&v===153).length;
   const colorCorrect=data.every((v,i)=>i%4!==0||data[i+3]===0||v===255&&data[i+1]===0&&data[i+2]===0);
   out.push({name,levels,width,height,painted,colorCorrect,warnings,unchanged:before===JSON.stringify(source)});
  }
  const large=importRichSvg('<svg xmlns="http://www.w3.org/2000/svg" width="67mm" height="10mm" viewBox="0 0 210 297"><g opacity=".6"><path fill="red" d="M10 10L200 45L70 290Z"/></g></svg>');
  const plan=doctorTracerHandoffPlan(appearanceRasterPlan(large,1200));
  const png=await rasterizeImportedAppearance(large,plan),image=await pixels(png);
  const header=new DataView(await png.slice(0,54).arrayBuffer());
  out.push({name:'native',width:image.width,height:image.height,dpi:header.getUint32(41)*.0254,expectedDpi:plan.dpi,levels:[...new Set(image.data.filter((v,i)=>i%4===3))].sort((a,b)=>a-b)});
  const unsupported=hardenClipMasks('<svg xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c"><path d="M0 0L10 0L0 10Z"/></clipPath></defs><path stroke="red" d="M0 0L0 10" clip-path="url(#c)"/></svg>');
  out.push({name:'unsupported',converted:unsupported.converted,unsupported:unsupported.unsupported,retained:unsupported.markup.includes('clip-path="url(#c)"')});
  return out;
 });
 for(const result of results.slice(0,4)){
  assert.deepEqual(result.levels,[0,153],result.name);
  assert.equal(result.width,236);assert.equal(result.height,236);
  assert.ok(result.painted>1000);assert.ok(result.colorCorrect);assert.ok(result.unchanged);
  assert.deepEqual(result.warnings,[]);
 }
 const native=results[4];assert.equal(native.width,Math.round(67*1200/25.4));assert.equal(native.height,Math.round(10*1200/25.4));assert.equal(native.expectedDpi,1200);assert.ok(Math.abs(native.dpi-1200)<.02);assert.deepEqual(native.levels,[0,153]);
 assert.deepEqual(results[5],{name:'unsupported',converted:0,unsupported:1,retained:true});
 console.log('PASS crisp clip masks and original resolution raster',JSON.stringify(results));
}finally{await browser?.close();server.kill();}
