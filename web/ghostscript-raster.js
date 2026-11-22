// Direct Ghostscript PNG rendering. Never decode/re-encode or filter its output.
import {geometryStamp} from './eps-paint.js?v=0.2.0-alpha.95';
import {doctorTracerHandoffPlan} from './doctortracer-appearance.js?v=0.2.0-alpha.95';
export function captureRasterSource(document,bytes,format,fonts=[]){
 if(!['eps','pdf'].includes(format))throw Error('Неверный формат исходника.');
 return {format,bytes,fonts:fonts.slice(),stamp:geometryStamp(document),sourceSvg:document.sourceSvg||'',
  name:document.epsImport?.name||document.pdfImport?.name,
  pageIndex:format==='pdf'?document.pdfImport.pageIndex:0};
}
export function requireRasterSource(document,entry){
 if(document.epsImport?.outlineRecovery)throw Error('Исходный EPS содержит непечатаемые контуры. Ghostscript не может растрировать их как видимое изображение без изменения исходника.');
 const format=document.pdfImport?'pdf':document.epsImport?'eps':null;
 if(!format)return null;
 if(!entry||entry.format!==format||entry.name!==(document.epsImport?.name||document.pdfImport?.name)||
  entry.stamp!==geometryStamp(document)||entry.sourceSvg!==(document.sourceSvg||'')||
  (format==='pdf'&&entry.pageIndex!==document.pdfImport.pageIndex))
  throw Error('Исходные байты EPS/PDF недоступны или геометрия изменена. Откройте исходный файл повторно для прямого растрирования Ghostscript.');
 return entry;
}
export function ghostscriptRasterArgs(format,dpi,pageIndex=0){
 if(![300,600,1200].includes(dpi))throw Error('Недопустимое DPI.');
 if(!['eps','pdf'].includes(format)||!Number.isInteger(pageIndex)||pageIndex<0||pageIndex>=500)throw Error('Недопустимый формат или страница.');
 const page=String(pageIndex+1);
 return ['-dSAFER','-dBATCH','-dNOPAUSE','-sDEVICE=png16malpha','-r'+dpi,
  '-dGraphicsAlphaBits=1','-dTextAlphaBits=1','-dInterpolateControl=0','-dDownScaleFactor=1',
  '-dAutoRotatePages=/None','-sFONTPATH=/fonts',
  ...(format==='eps'?['-dEPSCrop']:['-dUseCropBox','-dFirstPage='+page,'-dLastPage='+page]),
  '-sOutputFile=/raster-%d.png','-f','/input.'+format];
}
// Validate native PNG metadata; never modify even one byte of the PNG.
export function ghostscriptPngInfo(bytes,plan){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(bytes.length<45||v.getUint32(0)!==0x89504e47||v.getUint32(4)!==0x0d0a1a0a||
    v.getUint32(8)!==13||v.getUint32(12)!==0x49484452||v.getUint8(24)!==8||v.getUint8(25)!==6)
  throw Error('Ghostscript не вернул PNG RGBA8.');
 const width=v.getUint32(16),height=v.getUint32(20);
 let dpiX=0,dpiY=0;
 for(let i=8;i+12<=bytes.length;){
  const len=v.getUint32(i),type=v.getUint32(i+4);
  if(i+12+len>bytes.length)throw Error('Повреждён PNG Ghostscript.');
  if(type===0x70485973&&len===9&&v.getUint8(i+16)===1){dpiX=v.getUint32(i+8)*.0254;dpiY=v.getUint32(i+12)*.0254;break;}
  if(type===0x49444154)break;
  i+=12+len;
 }
 if(Math.abs(dpiX-plan.dpi)>.02||Math.abs(dpiY-plan.dpi)>.02)throw Error('Ghostscript изменил DPI или не записал разрешение PNG.');
 // Different page-device rounding may produce one edge pixel. Use the
 // actual native grid at the same DPI, never interpolate or trim pixels.
 if(Math.abs(width-plan.width)>1||Math.abs(height-plan.height)>1)
  throw Error('Ghostscript изменил размер страницы: ожидалось '+plan.width+'×'+plan.height+', получено '+width+'×'+height+'. Передача отменена.');
 return doctorTracerHandoffPlan({...plan,width,height});
}
export async function rasterizeGhostscript(entry,plan,{signal,onProgress=()=>{}}={}){
 signal?.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('ghostscript-raster-worker.js?v=0.2.0-alpha.95',import.meta.url));
  let settled=false;
  const finish=(error,result)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);worker.terminate();
   error?reject(error):resolve(result);
  };
  const abort=()=>finish(Error('Растрирование отменено.'));
  const timer=setTimeout(()=>finish(Error('Ghostscript не завершил растрирование за 180 секунд. Исходник сохранён.')),180000);
  signal?.addEventListener('abort',abort,{once:true});
  worker.onerror=e=>finish(Error('Ghostscript Worker: '+e.message));
  worker.onmessage=({data})=>{
   if(data.type==='progress'){onProgress(data.message);return;}
   if(data.type==='error'){finish(Error(data.message));return;}
   if(data.type==='done')try{
    const bytes=new Uint8Array(data.bytes),nativePlan=ghostscriptPngInfo(bytes,plan);
    finish(null,{png:new Blob([bytes],{type:'image/png'}),plan:nativePlan});
   }catch(error){finish(error);}
  };
  const bytes=entry.bytes.slice();
  worker.postMessage({format:entry.format,bytes,fonts:entry.fonts||[],dpi:plan.dpi,pageIndex:entry.pageIndex},[bytes.buffer]);
 });
}
