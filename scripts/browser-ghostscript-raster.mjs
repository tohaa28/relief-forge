import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const port=process.env.GS_RASTER_PORT||'8118';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:port},stdio:['ignore','pipe','inherit']});
let browser;
try{
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('exit',code=>reject(Error('Server exited '+code)));});
 browser=await chromium.launch();
 const page=await browser.newPage();
 await page.goto('http://localhost:'+port+'/licenses.html');
 const results=await page.evaluate(async()=>{
  const {rasterizeGhostscript}=await import('/ghostscript-raster.js');
  const {appearanceRasterPlan,doctorTracerHandoffPlan}=await import('/doctortracer-appearance.js');
  const eps='%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 10 20 190 80\n%%HiResBoundingBox: 10 20 190 80\n%%EndComments\n10 20 translate\n0 0 1 setrgbcolor\nnewpath 5.13 5.27 moveto 170.14 6.31 lineto 100.27 48.13 lineto closepath fill\n1 0 0 setrgbcolor\ngsave newpath 10.21 9.28 moveto 120.41 9.43 lineto 55.29 52.37 lineto closepath clip newpath 0 0 175 59 rectfill grestore\n0 0 0 setrgbcolor 0.7 setlinewidth newpath 14.1 7.3 moveto 165.9 53.4 lineto stroke\nshowpage\n%%EOF\n';
  // PDF with two pages. CropBox and explicit rotated page 2. Build xref
  // offsets in bytes; all fixture objects are ASCII.
  const pdf=()=>{
   const content='0 0 1 rg 15.13 25.27 m 170.14 26.31 l 100.27 68.13 l h f\n1 0 0 rg 30 30 20 12 re f\n';
   const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /Resources <<>> /Contents 5 0 R >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 100] /CropBox [10 20 190 80] /Rotate 90 /Resources <<>> /Contents 6 0 R >>','<< /Length 0 >>\nstream\nendstream','<< /Length '+content.length+' >>\nstream\n'+content+'endstream'];
   let s='%PDF-1.4\n',offsets=[0];for(let i=0;i<objs.length;i++){offsets.push(s.length);s+=(i+1)+' 0 obj\n'+objs[i]+'\nendobj\n';}
   const xref=s.length;s+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n';for(const n of offsets.slice(1))s+=String(n).padStart(10,'0')+' 00000 n \n';
   return s+'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  };
  const results=[];
  for(const [format,input,ptW,ptH,index,dpi] of [['eps',eps,180,60,0,1200],['pdf',pdf(),60,180,1,600]]){
   const plan=doctorTracerHandoffPlan(appearanceRasterPlan({width:ptW*25.4/72,height:ptH*25.4/72},dpi));
   const native=await rasterizeGhostscript({format,bytes:new TextEncoder().encode(input),fonts:[],pageIndex:index},plan);
   const image=await createImageBitmap(native.png);
   const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
   const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,0,0);image.close();
   const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data,levels=new Set(),colors=new Set();
   for(let i=0;i<rgba.length;i+=4){levels.add(rgba[i+3]);if(rgba[i+3])colors.add([rgba[i],rgba[i+1],rgba[i+2]].join(','));if(colors.size>32)break;}
   results.push({format,size:[canvas.width,canvas.height],dpi,levels:[...levels].sort((a,b)=>a-b),colors:[...colors].sort()});
  }
  return results;
 });
 assert.deepEqual(results[0].size,[3000,1000]);assert.deepEqual(results[1].size,[500,1500]);
 for(const r of results){assert.deepEqual(r.levels,[0,255],JSON.stringify(r));assert.ok(r.colors.includes('255,0,0'));assert.ok(r.colors.includes('0,0,255'));assert.ok(r.colors.length<=3,JSON.stringify(r));}
 assert.ok(results[0].colors.includes('0,0,0'));
 console.log('PASS direct native Ghostscript PNG without antialias, EPS clip/stroke and selected rotated PDF crop',JSON.stringify(results));
}finally{await browser?.close();server.kill();}
