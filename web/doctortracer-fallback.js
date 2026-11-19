import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.61';
import {importRichSvg} from './rich-svg.js?v=0.2.0-alpha.61';

// The linked DoctorTracer 0.21.1 WASM gh-pages site owns its Worker and its GPL
// dependencies. Nothing from that distribution is copied or relicensed here.
export const DOCTORTRACER_URL='https://tohaa28.github.io/DoctorTracer/';
export const DOCTORTRACER_VERSION='0.21.1';
export const DOCTORTRACER_THRESHOLD=10;
export const DOCTORTRACER_WORKER_PATH='/DoctorTracer/worker.js';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const finite=n=>Number.isFinite(n)&&Math.abs(n)<=1e9;
const point=c=>c.slice(-2);
const fmt=x=>Number(x.toPrecision(13)).toString();
export function needsDoctorTracer(report,{threshold=DOCTORTRACER_THRESHOLD,scopeComplete=true,alreadyAttempted=false}={}){
  // A partially scanned huge EPS still has a *confirmed lower bound*.
  // Do not suppress fallback just because other batches remain unchecked.
  // Candidate acceptance is separately guarded by complete/full-scope diagnosis.
  return scopeComplete&&!alreadyAttempted&&Array.isArray(report?.issues)&&
    report.issues.length>threshold;
}
export function rasterPlan(document,{dpi=300,maxSide=2400,maxPixels=8000000,paddingMm=.5}={}){
  if(!document?.paths?.length||document.paths.some(p=>p.kind==='image'))
    throw Error('DoctorTracer: требуется исходный вектор без растровых объектов');
  if(![document.width,document.height,dpi,maxSide,maxPixels].every(x=>finite(Number(x))&&Number(x)>0))
    throw Error('DoctorTracer: некорректный размер документа или растра');
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,segments=0;
  for(const path of document.paths){
    for(const cmd of geometryCommands(path)){
      if(cmd[0]==='Z')continue;
      if(!['M','L','Q','C'].includes(cmd[0]))throw Error('DoctorTracer: неподдерживаемые команды вектора');
      segments+=Number(cmd[0]!=='M');
      for(let i=1;i<cmd.length;i+=2){
        const x=cmd[i],y=cmd[i+1];
        if(!finite(x)||!finite(y))throw Error('DoctorTracer: нечисловая координата');
        x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);
      }
    }
  }
  if(!segments||!finite(x0)||!finite(y0))throw Error('DoctorTracer: нет геометрии для растрирования');
  const padding=Math.max(paddingMm,1/dpi*25.4);
  x0=Math.max(0,x0-padding);y0=Math.max(0,y0-padding);
  x1=Math.min(document.width,x1+padding);y1=Math.min(document.height,y1+padding);
  const widthMm=x1-x0,heightMm=y1-y0;
  if(widthMm<=1e-8||heightMm<=1e-8)throw Error('DoctorTracer: вырожденная область растрирования');
  const scale=Math.min(dpi/25.4,maxSide/Math.max(widthMm,heightMm),
    Math.sqrt(maxPixels/(widthMm*heightMm)));
  const width=Math.max(1,Math.floor(widthMm*scale));
  const height=Math.max(1,Math.floor(heightMm*scale));
  if(width*height>maxPixels||Math.max(width,height)>maxSide)
    throw Error('DoctorTracer: превышено разрешение растра');
  return {x:x0,y:y0,widthMm,heightMm,width,height,dpi:scale*25.4,segments};
}
export function vectorRasterSvg(document,plan){
  const view=[plan.x,plan.y,plan.widthMm,plan.heightMm].map(fmt).join(' ');
  const stroke=fmt(Math.max(plan.widthMm/plan.width,plan.heightMm/plan.height));
  const paths=[];
  for(const path of document.paths){
    const commands=geometryCommands(path);
    const d=commands.map(c=>c[0]+c.slice(1).map(fmt).join(' ')).join(' ');
    const fragments=d.split(/(?=M)/).map(f=>f.trim()).filter(Boolean);
    // Retrace the geometry, not source paint, which for CNC EPS may be invisible.
    // Closed paths become black silhouettes; open curves use a one-pixel stroke.
    // All closed subpaths of ONE compound shape must be painted together:
    // evenodd holes would disappear if each M…Z was filled individually.
    const closed=fragments.filter(f=>f.trimEnd().endsWith('Z'));
    if(closed.length)paths.push('<path d="'+escape(closed.join(' '))+
      '" fill="#000" fill-rule="evenodd"/>');
    for(const f of fragments.filter(f=>!f.trimEnd().endsWith('Z'))){
      paths.push('<path d="'+escape(f)+'" fill="none" stroke="#000" stroke-width="'+stroke+
        '" stroke-linecap="round" stroke-linejoin="round"/>');
    }
  }
  return '<svg xmlns="http://www.w3.org/2000/svg" width="'+plan.width+
    '" height="'+plan.height+'" viewBox="'+view+
    '" preserveAspectRatio="none">'+paths.join('')+'</svg>';
}
// Direct geometry -> Canvas 2D -> RGBA, with no SVG Blob/ImageBitmap
// intermediate. Chromium can refuse to decode very large compound SVG
// (confirmed with 1975 paths from EPS in session alpha59). The actual
// DoctorTracer 0.21.1 Worker requires only tightly packed RGBA pixels.
function paintCommands(ctx,commands){
  for(const c of commands){
    switch(c[0]){
      case 'M':ctx.moveTo(c[1],c[2]);break;
      case 'L':ctx.lineTo(c[1],c[2]);break;
      case 'Q':ctx.quadraticCurveTo(c[1],c[2],c[3],c[4]);break;
      case 'C':ctx.bezierCurveTo(c[1],c[2],c[3],c[4],c[5],c[6]);break;
      case 'Z':ctx.closePath();break;
      default:throw Error('DoctorTracer: неподдерживаемый сегмент '+c[0]);
    }
  }
}
export function paintDocumentSilhouette(ctx,document,plan,{batchSize=0,signal}={}){
  if(!ctx?.beginPath||!ctx?.fill||!ctx?.stroke||!ctx?.setTransform)
    throw Error('DoctorTracer: Canvas 2D не поддерживает прямое рисование вектора');
  const sx=plan.width/plan.widthMm,sy=plan.height/plan.heightMm;
  if(!finite(sx)||!finite(sy)||sx<=0||sy<=0)
    throw Error('DoctorTracer: неверная матрица растрирования');
  ctx.clearRect(0,0,plan.width,plan.height);
  ctx.save();
  try{
    ctx.setTransform(sx,0,0,sy,-plan.x*sx,-plan.y*sy);
    ctx.fillStyle='#000000';ctx.strokeStyle='#000000';
    ctx.lineWidth=Math.max(1/sx,1/sy);
    ctx.lineJoin='round';ctx.lineCap='round';
    for(const path of document.paths){
      if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
      const contours=[],commands=geometryCommands(path);let part=[];
      for(const cmd of commands){
        if(cmd[0]==='M'&&part.length){contours.push(part);part=[];}
        part.push(cmd);
      }
      if(part.length)contours.push(part);
      const closed=contours.filter(a=>a.some(c=>c[0]==='Z'));
      // Preserve holes for compound EPS shapes by filling ALL closed
      // subpaths together using the even-odd rule.
      if(closed.length){
        ctx.beginPath();
        for(const contour of closed)paintCommands(ctx,contour);
        ctx.fill('evenodd');
      }
      for(const contour of contours){
        if(contour.some(c=>c[0]==='Z'))continue;
        ctx.beginPath();paintCommands(ctx,contour);ctx.stroke();
      }
    }
  }finally{ctx.restore();}
}

// Optional bitmap remains injectable for regression of the old failure,
// but production always takes the direct vector Canvas route. This avoids
// both the >11MB SVG data URI and createImageBitmap('image/svg+xml') failures.
export async function rasterizeDocument(document,plan,{bitmap=null,
  canvasFactory=()=>globalThis.document.createElement('canvas'),signal}={}){
  if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
  const canvas=canvasFactory();canvas.width=plan.width;canvas.height=plan.height;
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw Error('DoctorTracer: Canvas 2D недоступен');
  if(bitmap){
    const svg=vectorRasterSvg(document,plan);
    const blob=new Blob([svg],{type:'image/svg+xml'});
    const image=await bitmap(blob);
    try{context.clearRect(0,0,plan.width,plan.height);
      context.drawImage(image,0,0,plan.width,plan.height);}
    finally{image.close?.();}
  }else paintDocumentSilhouette(context,document,plan,{signal});
  if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
  const pixels=new Uint8Array(context.getImageData(0,0,plan.width,plan.height).data);
  return {pixels,width:plan.width,height:plan.height,plan,backend:bitmap?'svg-image':'canvas2d-direct'};
}

export function doctorTracerWorkerUrl(pageUrl){
  const page=new URL(pageUrl);
  if(page.protocol!=='https:'||page.hostname!=='tohaa28.github.io')
    throw Error('DoctorTracer Worker доступен только на общем origin GitHub Pages. '+DOCTORTRACER_URL);
  const worker=new URL(DOCTORTRACER_WORKER_PATH,page.origin);
  worker.searchParams.set('v',DOCTORTRACER_VERSION); // avoid stale 0.16.0 Worker cache
  return worker.href;
}
export function validateDoctorTracerRgba(raster){
  const {width,height,pixels}=raster||{};
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<1||height<1||width>2400||height>2400||
    width*height>8000000||!(pixels instanceof Uint8Array)||
    pixels.byteLength!==width*height*4)
    throw Error('DoctorTracer: неверный формат RGBA (ожидается Uint8Array width×height×4)');
  let opaque=0,transparent=0;
  for(let i=3;i<pixels.length;i+=4){
    if(pixels[i]>=128)opaque++;
    else transparent++;
  }
  if(!opaque)throw Error('DoctorTracer: растр не содержит непрозрачных векторных элементов');
  return {width,height,bytes:pixels.byteLength,opaque,transparent,format:'RGBA8'};
}
export function traceWithDoctorTracer(raster,{pageUrl=globalThis.location?.href,
  workerFactory=(url,options)=>new Worker(url,options),signal,timeoutMs=120000,progress=()=>{}}={}){
  const url=doctorTracerWorkerUrl(pageUrl);
  if(signal?.aborted)return Promise.reject(Error('DoctorTracer: операция отменена'));
  // Validate that the RGBA buffer matches the actual 0.21.1 Worker contract
  // before transferring ownership; malformed data must not reach Rust WASM.
  validateDoctorTracerRgba(raster);
  return new Promise((resolve,reject)=>{
    let worker,settled=false,timer;
    const cleanup=()=>{
      clearTimeout(timer);signal?.removeEventListener('abort',onAbort);
      worker?.terminate();
    };
    const finish=(error,result)=>{
      if(settled)return;settled=true;cleanup();
      if(error)reject(error);else resolve(result);
    };
    const onAbort=()=>finish(Error('DoctorTracer: операция отменена'));
    try{
      worker=workerFactory(url,{type:'module'});
      worker.onmessage=({data})=>{
        if(typeof data.progress==='number'){progress(data.progress,data.stage);return;}
        if(data.error){finish(Error('DoctorTracer: '+data.error));return;}
        if(typeof data.svg!=='string'||!data.svg.includes('<path'))
          {finish(Error('DoctorTracer: не получены векторные кривые'));return;}
        finish(null,{svg:data.svg,paths:data.paths,geometry:data.geometry,backend:data.backend});
      };
      worker.onerror=e=>finish(Error('DoctorTracer Worker: '+(e.message||'ошибка загрузки')));
      signal?.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>finish(Error('DoctorTracer: превышено время трассировки')),timeoutMs);
      worker.postMessage({pixels:raster.pixels.buffer,width:raster.width,height:raster.height,
        category:'hard',colors:2,detail:2,speckle:0,polygon:false,gpu:false},
        [raster.pixels.buffer]);
    }catch(error){finish(error);}
  });
}
export function remapDoctorTracerSvg(source,svg,plan,{Parser=globalThis.DOMParser}={}){
  const traced=importRichSvg(svg,{unitsPerInch:96,Parser});
  if(!traced.paths.length||traced.paths.some(p=>p.kind==='image'))
    throw Error('DoctorTracer: нет подходящих векторных объектов');
  const sx=plan.widthMm/traced.width,sy=plan.heightMm/traced.height;
  if(!finite(sx)||!finite(sy)||sx<=0||sy<=0)throw Error('DoctorTracer: нарушено соответствие координат');
  const paths=traced.paths.map(p=>{
    const commands=p.commands.map(c=>{
      if(c[0]==='Z')return ['Z'];
      const out=[c[0]];
      for(let i=1;i<c.length;i+=2)out.push(c[i]*sx+plan.x,c[i+1]*sy+plan.y);
      return out;
    });
    return {...p,commands,offset:[0,0],points:commands.filter(c=>c[0]!=='Z').map(point),
      artwork:'<g transform="matrix('+[sx,0,0,sy,plan.x,plan.y].map(fmt).join(' ')+
        ')">'+p.artwork+'</g>'};
  });
  if(paths.some(p=>p.commands.some(c=>c.slice(1).some(v=>!finite(v)))))
    throw Error('DoctorTracer: нечисловые узлы результата');
  const result=structuredClone(source);
  delete result.epsImport;delete result.pdfImport;delete result.sourceSvg;
  result.paths=paths;
  result.svgDefs=traced.svgDefs;
  result.doctorTracer={engine:'DoctorTracer Web '+DOCTORTRACER_VERSION,source:'raster-of-imported-vector',
    pixels:[plan.width,plan.height],bboxMm:[plan.x,plan.y,plan.widthMm,plan.heightMm],
    effectiveDpi:plan.dpi,approximation:true};
  return result;
}
export function maskSimilarity(before,after,{cutoff=128}={}){
  if(before.width!==after.width||before.height!==after.height)
    throw Error('DoctorTracer: размер контрольной маски изменился');
  let both=0,either=0,a=0,b=0;
  for(let i=3;i<before.pixels.length;i+=4){
    const x=before.pixels[i]>=cutoff,y=after.pixels[i]>=cutoff;
    both+=Number(x&&y);either+=Number(x||y);a+=Number(x);b+=Number(y);
  }
  return {iou:either?both/either:0,areaRatio:a?b/a:0,sourcePixels:a,resultPixels:b};
}
export function acceptRetracing(beforeIssues,afterReport,similarity,{minIou=.95}={}){
  return Number.isInteger(beforeIssues)&&beforeIssues>DOCTORTRACER_THRESHOLD&&
    afterReport?.complete===true&&afterReport.fullScope===true&&
    Array.isArray(afterReport.issues)&&afterReport.issues.length<beforeIssues&&
    similarity?.iou>=minIou&&similarity.areaRatio>=.95&&similarity.areaRatio<=1.05;
}


// When DoctorTracer 0.21.1 returns >200,000 nodes, preserve the RichSVG
// safety ceiling. Retry tracing the ORIGINAL input at bounded lower pixel
// resolutions. Final acceptance still uses the original-size raster mask.
export function isDoctorTracerNodeBudgetError(error){
  return String(error?.message||error)==='SVG: превышен лимит 200000 узлов';
}
export function scaledDoctorTracerPlan(plan,scale){
  if(!Number.isFinite(scale)||scale<=0||scale>=1)
    throw Error('DoctorTracer: неверный масштаб повторной трассировки');
  const width=Math.max(1,Math.floor(plan.width*scale));
  const height=Math.max(1,Math.floor(plan.height*scale));
  if(width===plan.width&&height===plan.height)
    throw Error('DoctorTracer: повторная трассировка не снижает разрешение');
  return {...plan,width,height,dpi:plan.dpi*Math.min(width/plan.width,height/plan.height)};
}
export async function traceDocumentWithNodeBudget(source,plan,{
  firstRaster,scales=[1,.70,.45],signal,rasterize=rasterizeDocument,
  trace=traceWithDoctorTracer,remap=remapDoctorTracerSvg,traceOptions={},
  onAttempt=()=>{},onRetry=()=>{}
}={}){
  if(!Array.isArray(scales)||!scales.length||scales.length>4||
    scales[0]!==1||scales.some((s,i)=>!Number.isFinite(s)||s<=0||
      (i>0&&s>=scales[i-1])))
    throw Error('DoctorTracer: некорректный план ограничения узлов');
  for(let i=0;i<scales.length;i++){
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    const current=i===0?plan:scaledDoctorTracerPlan(plan,scales[i]);
    const raster=i===0&&firstRaster?firstRaster:
      await rasterize(source,current,{signal});
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    onAttempt({attempt:i+1,total:scales.length,plan:current});
    const traced=await trace(raster,{...traceOptions,signal});
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    try{
      const candidate=remap(source,traced.svg,current);
      return {candidate,traced,tracePlan:current,attempts:i+1};
    }catch(error){
      if(!isDoctorTracerNodeBudgetError(error)||i===scales.length-1)throw error;
      onRetry({attempt:i+1,total:scales.length,plan:current,
        nextPlan:scaledDoctorTracerPlan(plan,scales[i+1]),reason:error.message});
    }
  }
  throw Error('DoctorTracer: не удалось получить безопасный вектор');
}
