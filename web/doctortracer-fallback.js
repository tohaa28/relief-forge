import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.89';
import {importRichSvg} from './rich-svg.js?v=0.2.0-alpha.89';

// The linked DoctorTracer 0.21.1 WASM gh-pages site owns its Worker and its GPL
// dependencies. Nothing from that distribution is copied or relicensed here.
export const DOCTORTRACER_URL='https://tohaa28.github.io/DoctorTracer/';
export const DOCTORTRACER_VERSION='0.21.1';
export const DOCTORTRACER_THRESHOLD=10;
export const DOCTORTRACER_WORKER_PATH='/DoctorTracer/worker.js';
export const DOCTORTRACER_WORKER_MAX_SIDE=5000;
export const DOCTORTRACER_WORKER_MAX_PIXELS=12000000;
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
  // Physical width of a pixel in the ORIGINAL full-resolution mask.
  // Scaling the retry resolution must not make open vector strokes thicker.
  const strokeWidthMm=Math.max(widthMm/width,heightMm/height);
  return {x:x0,y:y0,widthMm,heightMm,width,height,dpi:scale*25.4,
    segments,strokeWidthMm};
}
export function vectorRasterSvg(document,plan){
  const view=[plan.x,plan.y,plan.widthMm,plan.heightMm].map(fmt).join(' ');
  const stroke=fmt(plan.strokeWidthMm??
    Math.max(plan.widthMm/plan.width,plan.heightMm/plan.height));
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
    // No source paint survives into the trace bitmap: one solid black ink,
    // transparency is the ONLY representation of uncovered pixels / holes.
    ctx.globalAlpha=1;
    ctx.globalCompositeOperation='source-over';
    ctx.fillStyle='#000000';ctx.strokeStyle='#000000';
    ctx.lineWidth=plan.strokeWidthMm??Math.max(1/sx,1/sy);
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
  const context=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  if(!context)throw Error('DoctorTracer: Canvas 2D недоступен');
  if(context.getContextAttributes?.()?.alpha===false)
    throw Error('DoctorTracer: Canvas не поддерживает прозрачный фон');
  if(bitmap){
    const svg=vectorRasterSvg(document,plan);
    const blob=new Blob([svg],{type:'image/svg+xml'});
    const image=await bitmap(blob);
    try{context.clearRect(0,0,plan.width,plan.height);
      context.drawImage(image,0,0,plan.width,plan.height);}
    finally{image.close?.();}
  }else paintDocumentSilhouette(context,document,plan,{signal});
  if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
  // Canvas coverage / antialiasing is kept in the alpha channel verbatim.
  // Even if the browser or test bitmap produces colored fringe RGB values,
  // DoctorTracer receives BLACK only, with a truly transparent background.
  const pixels=blackTransparentRgba8(new Uint8Array(
    context.getImageData(0,0,plan.width,plan.height).data));
  return {pixels,width:plan.width,height:plan.height,plan,
    mask:'black-transparent-rgba8',backend:bitmap?'svg-image':'canvas2d-direct'};
}

// Canonical single-ink trace mask. Do not threshold or flatten antialiasing:
// intermediate alpha (1..254) preserves sub-pixel edge coverage.
export function blackTransparentRgba8(pixels){
  if(!(pixels instanceof Uint8Array)||pixels.byteLength%4!==0)
    throw Error('DoctorTracer: для чёрной прозрачной маски требуется RGBA8');
  for(let i=0;i<pixels.byteLength;i+=4){
    pixels[i]=0;pixels[i+1]=0;pixels[i+2]=0;
  }
  return pixels;
}

// Area-preserving downsample from the ORIGINAL alpha mask. Repainting source
// vectors at smaller sizes with a new one-pixel-wide stroke changes the actual
// geometry: at 45% resolution an open curve becomes 2.22 times wider in mm.
// Use alpha-weighted box coverage instead; do not threshold or flatten.
export function downsampleBlackTransparentRgba8(source,width,height){
  const sw=source?.width,sh=source?.height,rgba=source?.pixels;
  if(!Number.isSafeInteger(sw)||!Number.isSafeInteger(sh)||
    !Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<1||height<1||width>sw||height>sh||
    !(rgba instanceof Uint8Array)||rgba.byteLength!==sw*sh*4)
    throw Error('DoctorTracer: неверный размер опорной альфа-маски');
  const result=new Uint8Array(width*height*4);
  const dx=sw/width,dy=sh/height,area=dx*dy;
  for(let y=0;y<height;y++){
    const ya=y*dy,yb=(y+1)*dy;
    for(let x=0;x<width;x++){
      const xa=x*dx,xb=(x+1)*dx;
      let covered=0;
      for(let sy=Math.floor(ya);sy<Math.min(sh,Math.ceil(yb));sy++){
        const wy=Math.max(0,Math.min(sy+1,yb)-Math.max(sy,ya));
        if(!wy)continue;
        for(let sx=Math.floor(xa);sx<Math.min(sw,Math.ceil(xb));sx++){
          const wx=Math.max(0,Math.min(sx+1,xb)-Math.max(sx,xa));
          if(wx)covered+=rgba[(sy*sw+sx)*4+3]*wy*wx;
        }
      }
      result[(y*width+x)*4+3]=Math.round(covered/area);
    }
  }
  return {width,height,pixels:result,mask:'black-transparent-rgba8',
    backend:'original-alpha-box-downsample'};
}

// The DoctorTracer 0.21.1 Worker returns its segmentation preview RGBA.
// Compare the foreground label alpha with the exact input alpha BEFORE SVG
// fitting to isolate segmentation errors from later vector/paint problems.
// Store only aggregate counts; the source and Worker bitmaps stay private.
export function compareSegmentedAlpha(sourceBits,segmentRgba){
  if(!(sourceBits instanceof Uint8Array)||
    !(segmentRgba instanceof Uint8Array)||
    segmentRgba.byteLength!==sourceBits.byteLength*4)
    throw Error('DoctorTracer: неверная длина сегментированной маски');
  let both=0,either=0,source=0,result=0;
  for(let i=0;i<sourceBits.byteLength;i++){
    const a=sourceBits[i]!==0,b=segmentRgba[4*i+3]>=128;
    source+=Number(a);result+=Number(b);
    both+=Number(a&&b);either+=Number(a||b);
  }
  return {iou:either?both/either:0,areaRatio:source?result/source:0,
    sourcePixels:source,segmentedPixels:result};
}

// Generate the full 600dpi canvas at IMPORT time, without allocating or
// caching its 4-byte-per-pixel RGBA. Read strips and retain ALPHA only.
// Black is the only ink and transparency is not composited on white.
export async function rasterizeDocumentAlpha(document,plan,{
  canvasFactory=()=>globalThis.document.createElement('canvas'),signal,
  yieldUi=()=>Promise.resolve(),onProgress=()=>{}
}={}){
  if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
  const canvas=canvasFactory();
  canvas.width=plan.width;canvas.height=plan.height;
  const context=canvas.getContext('2d',{alpha:true,willReadFrequently:true});
  if(!context)throw Error('DoctorTracer: Canvas 2D недоступен');
  if(context.getContextAttributes?.()?.alpha===false)
    throw Error('DoctorTracer: Canvas не поддерживает прозрачный фон');
  try{
    paintDocumentSilhouette(context,document,plan,{signal});
    const alpha=new Uint8Array(plan.width*plan.height);
    // Bound temporary getImageData allocation to <=1 MB RGBA per strip.
    const rows=Math.max(1,Math.floor(262144/plan.width));
    let opaque=0;
    for(let y=0;y<plan.height;y+=rows){
      if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
      const h=Math.min(rows,plan.height-y);
      const rgba=context.getImageData(0,y,plan.width,h).data;
      for(let p=0;p<plan.width*h;p++){
        const a=rgba[4*p+3];
        alpha[y*plan.width+p]=a;
        if(a>=128)opaque++;
      }
      onProgress((y+h)/plan.height);
      if(y+h<plan.height)await yieldUi();
    }
    if(!opaque)
      throw Error('DoctorTracer: растр не содержит непрозрачных векторных элементов');
    return {alpha,width:plan.width,height:plan.height,
      mask:'black-transparent-rgba8',backend:'canvas2d-direct-alpha',
      opaque,bytes:alpha.byteLength};
  }finally{
    // Release GPU/Canvas memory after retaining the 1-byte/pixel cache.
    canvas.width=0;canvas.height=0;
  }
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
    width<1||height<1||
    width>DOCTORTRACER_WORKER_MAX_SIDE||height>DOCTORTRACER_WORKER_MAX_SIDE||
    width*height>DOCTORTRACER_WORKER_MAX_PIXELS||
    !(pixels instanceof Uint8Array)||
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
  // Enforce the black/transparent mask AT the Worker boundary, including
  // injected non-Canvas rasters. Convert non-packed views before transfer.
  const pixels=blackTransparentRgba8(
    raster.pixels.byteOffset===0 &&
    raster.pixels.byteLength===raster.pixels.buffer.byteLength &&
    raster.pixels.buffer instanceof ArrayBuffer ?
      raster.pixels : new Uint8Array(raster.pixels));
  // ArrayBuffer ownership transfers to Worker; retain only one byte per
  // pixel (binary alpha) to audit its returned segmentation independently.
  const sourceBits=new Uint8Array(raster.width*raster.height);
  for(let i=0;i<sourceBits.length;i++)sourceBits[i]=
    pixels[4*i+3]>=128?1:0;
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
        let segmentation=null;
        if(data.segments instanceof ArrayBuffer &&
          data.segments.byteLength===sourceBits.byteLength*4)
          segmentation=compareSegmentedAlpha(sourceBits,new Uint8Array(data.segments));
        finish(null,{svg:data.svg,paths:data.paths,geometry:data.geometry,
          backend:data.backend,inkCount:data.colors,segmentation,
          paletteCount:Array.isArray(data.metrics?.palette)?
            data.metrics.palette.length:null});
      };
      worker.onerror=e=>finish(Error('DoctorTracer Worker: '+(e.message||'ошибка загрузки')));
      signal?.addEventListener('abort',onAbort,{once:true});
      timer=setTimeout(()=>finish(Error('DoctorTracer: превышено время трассировки')),timeoutMs);
      // DoctorTracer 0.21.1 uses label 255 as transparent/background,
      // independently from its ink palette. For a black-alpha silhouette,
      // exactly ONE printable ink is present. Asking for two may make both
      // cluster centroids black and produce duplicate/expanded geometry.
      worker.postMessage({pixels:pixels.buffer,width:raster.width,height:raster.height,
        category:'hard',colors:1,palette:[[0,0,0]],
        detail:2,speckle:0,polygon:false,gpu:false},
        [pixels.buffer]);
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
  const count=before.width*before.height;
  const alphaAt=mask=>{
    if(mask.alpha instanceof Uint8Array&&mask.alpha.byteLength===count)
      return i=>mask.alpha[i];
    if(mask.pixels instanceof Uint8Array&&mask.pixels.byteLength===count*4)
      return i=>mask.pixels[4*i+3];
    throw Error('DoctorTracer: контрольная маска должна быть alpha8 или RGBA8');
  };
  const originalAlpha=alphaAt(before),candidateAlpha=alphaAt(after);
  let both=0,either=0,a=0,b=0;
  for(let i=0;i<count;i++){
    const x=originalAlpha(i)>=cutoff,y=candidateAlpha(i)>=cutoff;
    both+=Number(x&&y);either+=Number(x||y);a+=Number(x);b+=Number(y);
  }
  return {iou:either?both/either:0,areaRatio:a?b/a:0,sourcePixels:a,resultPixels:b};
}
export function acceptRetracing(beforeIssues,afterReport,similarity,{minIou=.95,threshold=DOCTORTRACER_THRESHOLD}={}){
  return Number.isInteger(beforeIssues)&&beforeIssues>threshold&&
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
  firstRaster,referenceRaster,scales=[1,.70,.45],signal,
  rasterize=rasterizeDocument,
  trace=traceWithDoctorTracer,remap=remapDoctorTracerSvg,traceOptions={},
  onAttempt=()=>{},onTraced=()=>{},onRetry=()=>{}
}={}){
  if(!Array.isArray(scales)||!scales.length||scales.length>4||
    scales[0]!==1||scales.some((s,i)=>!Number.isFinite(s)||s<=0||
      (i>0&&s>=scales[i-1])))
    throw Error('DoctorTracer: некорректный план ограничения узлов');
  if(referenceRaster){
    if(referenceRaster.width!==plan.width||
      referenceRaster.height!==plan.height||
      !(referenceRaster.pixels instanceof Uint8Array)||
      referenceRaster.pixels.byteLength!==plan.width*plan.height*4)
      throw Error('DoctorTracer: опорная маска не соответствует исходному плану');
    if(firstRaster&&referenceRaster.pixels.buffer===firstRaster.pixels.buffer)
      throw Error('DoctorTracer: опорная маска должна быть независима от Worker буфера');
  }
  for(let i=0;i<scales.length;i++){
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    const current=i===0?plan:scaledDoctorTracerPlan(plan,scales[i]);
    const raster=i===0&&firstRaster?firstRaster:
      i>0&&referenceRaster?
        downsampleBlackTransparentRgba8(referenceRaster,current.width,current.height):
        await rasterize(source,current,{signal});
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    onAttempt({attempt:i+1,total:scales.length,plan:current,
      rasterBackend:raster.backend??null});
    const traced=await trace(raster,{...traceOptions,signal});
    if(signal?.aborted)throw Error('DoctorTracer: операция отменена');
    // Keep a compact diagnostic of EACH returned trace, even if the next
    // RichSVG parse rejects >200k nodes. Never persist the SVG or pixel data.
    onTraced({attempt:i+1,total:scales.length,plan:current,
      paths:Number.isInteger(traced.paths)?traced.paths:null,
      paletteCount:traced.paletteCount,backend:traced.backend,
      segmentation:traced.segmentation??null});
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
