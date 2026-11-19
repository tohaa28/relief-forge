import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.59';
import {importRichSvg} from './rich-svg.js?v=0.2.0-alpha.59';

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
// Draw exact imported M/L/Q/C/Z command buffers directly on Canvas 2D.
// A single giant intermediary SVG was rejected by Chromium's bitmap decoder
// on 1975-path, 22k-node customer EPS. Path2D does not decode any image.
function drawNativeCommands(target,commands){
  for(const c of commands){
    if(c[0]==='M')target.moveTo(c[1],c[2]);
    else if(c[0]==='L')target.lineTo(c[1],c[2]);
    else if(c[0]==='Q')target.quadraticCurveTo(c[1],c[2],c[3],c[4]);
    else if(c[0]==='C')target.bezierCurveTo(...c.slice(1));
    else if(c[0]==='Z')target.closePath();
    else throw Error('DoctorTracer: неподдерживаемый сегмент '+c[0]);
  }
}
// Group all closed subpaths within each original object under even-odd
// filling, preserving negative counters; open contours remain 1px strokes.
// Do not merge separate objects before drawing: their black silhouettes are
// an OR/unification in the alpha buffer rather than cancelling each other.
export function makeRasterPaths(commands,Path=globalThis.Path2D){
  if(typeof Path!=='function')throw Error('DoctorTracer: в браузере нет Path2D');
  const closed=new Path(),open=new Path();
  let part=[],closedParts=0,openParts=0;
  const flush=(isClosed)=>{
    if(!part.length)return;
    if(part.some(c=>c[0]!=='M'&&c[0]!=='Z')){
      drawNativeCommands(isClosed?closed:open,part);
      if(isClosed)closedParts++;else openParts++;
    }
    part=[];
  };
  for(const c of commands){
    if(c[0]==='M'){flush(false);part=[c];}
    else if(c[0]==='Z'){part.push(c);flush(true);}
    else if(part.length)part.push(c);
    else throw Error('DoctorTracer: кривая без точки M');
  }
  flush(false);
  return {closed,open,closedParts,openParts};
}
export async function rasterizeDocument(document,plan,{
  canvasFactory=()=>globalThis.document.createElement('canvas'),
  pathFactory=globalThis.Path2D,
  yieldUi=()=>new Promise(resolve=>setTimeout(resolve,0)),
  signal=null,onProgress=()=>{},batchSize=48
}={}){
  if(!Number.isInteger(plan.width)||!Number.isInteger(plan.height)||
    plan.width<1||plan.height<1||plan.width*plan.height>8000000)
    throw Error('DoctorTracer: неверный размер растровой поверхности');
  const canvas=canvasFactory();canvas.width=plan.width;canvas.height=plan.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('DoctorTracer: Canvas 2D недоступен');
  const sx=plan.width/plan.widthMm,sy=plan.height/plan.heightMm;
  ctx.clearRect(0,0,plan.width,plan.height);
  // Pixel frame has no SVG resources, fonts, CSS, external references or
  // browser image-decoder limits. Coordinates stay in real document mm.
  ctx.setTransform(sx,0,0,sy,-plan.x*sx,-plan.y*sy);
  ctx.fillStyle='#000000';ctx.strokeStyle='#000000';
  ctx.lineWidth=Math.max(1/sx,1/sy);
  ctx.lineJoin='round';ctx.lineCap='round';
  let closed=0,open=0;
  const total=document.paths.length;
  for(let i=0;i<total;i++){
    if(signal?.aborted)throw Error('DoctorTracer: растрирование отменено');
    const c=geometryCommands(document.paths[i]);
    const built=makeRasterPaths(c,pathFactory);
    if(built.closedParts){ctx.fill(built.closed,'evenodd');closed+=built.closedParts;}
    if(built.openParts){ctx.stroke(built.open);open+=built.openParts;}
    if((i+1)%batchSize===0||i===total-1){
      onProgress({processed:i+1,total,closed,open});
      if(i<total-1)await yieldUi();
    }
  }
  if(!closed&&!open)throw Error('DoctorTracer: нет линий или заливок для трассировки');
  if(signal?.aborted)throw Error('DoctorTracer: растрирование отменено');
  const pixels=ctx.getImageData(0,0,plan.width,plan.height).data;
  const rgba=new Uint8Array(pixels);
  if(!rgba.some((v,i)=>i%4===3&&v>0))
    throw Error('DoctorTracer: растр пуст; исходные кривые сохранены');
  return {pixels:rgba,width:plan.width,height:plan.height,plan,
    backend:'Canvas 2D native M/L/Q/C',closed,open};
}
export function doctorTracerWorkerUrl(pageUrl){
  const page=new URL(pageUrl);
  if(page.protocol!=='https:'||page.hostname!=='tohaa28.github.io')
    throw Error('DoctorTracer Worker доступен только на общем origin GitHub Pages. '+DOCTORTRACER_URL);
  const worker=new URL(DOCTORTRACER_WORKER_PATH,page.origin);
  worker.searchParams.set('v',DOCTORTRACER_VERSION); // avoid stale 0.16.0 Worker cache
  return worker.href;
}
export function traceWithDoctorTracer(raster,{pageUrl=globalThis.location?.href,
  workerFactory=(url,options)=>new Worker(url,options),signal,timeoutMs=120000,progress=()=>{}}={}){
  const url=doctorTracerWorkerUrl(pageUrl);
  if(signal?.aborted)return Promise.reject(Error('DoctorTracer: операция отменена'));
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
