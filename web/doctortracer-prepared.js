// In-memory black silhouette prepared BEFORE vector diagnostics / repair.
// It is never stored in history, downloads, localStorage or EPS. Only the
// 8-bit alpha channel is retained; all reconstructed RGB values are zero.
import {rasterPlan,rasterizeDocumentAlpha,validateDoctorTracerRgba,
  DOCTORTRACER_WORKER_MAX_SIDE,DOCTORTRACER_WORKER_MAX_PIXELS} from './doctortracer-fallback.js?v=0.2.0-alpha.97';
export const PREPARED_RASTER_DPI=600;
export const PREPARED_RASTER_MAX_SIDE=9000;
export const PREPARED_RASTER_MAX_PIXELS=36000000;
export const WORKER_RASTER_MAX_SIDE=DOCTORTRACER_WORKER_MAX_SIDE;
export const WORKER_RASTER_MAX_PIXELS=DOCTORTRACER_WORKER_MAX_PIXELS;

export function preparedRasterPlan(document){
  return rasterPlan(document,{dpi:PREPARED_RASTER_DPI,
    maxSide:PREPARED_RASTER_MAX_SIDE,maxPixels:PREPARED_RASTER_MAX_PIXELS});
}
export function boundedWorkerRasterPlan(plan){
  if(!Number.isSafeInteger(plan?.width)||!Number.isSafeInteger(plan?.height)||
    plan.width<1||plan.height<1)
    throw Error('DoctorTracer: некорректный исходный план 600 dpi');
  const scale=Math.min(1,WORKER_RASTER_MAX_SIDE/Math.max(plan.width,plan.height),
    Math.sqrt(WORKER_RASTER_MAX_PIXELS/(plan.width*plan.height)));
  const width=Math.max(1,Math.floor(plan.width*scale)),
    height=Math.max(1,Math.floor(plan.height*scale));
  return {...plan,width,height,dpi:plan.dpi*Math.min(width/plan.width,height/plan.height)};
}
// Area-weighted alpha-only box resampling for the first Worker attempt.
// Never re-render open 1px strokes at smaller DPI; never threshold alpha.
export function workerRasterFromPreparedMask(prepared,plan=boundedWorkerRasterPlan(prepared.plan)){
  if(!prepared?.plan||!(prepared.alpha instanceof Uint8Array)||
    prepared.alpha.byteLength!==prepared.plan.width*prepared.plan.height||
    !Number.isSafeInteger(plan?.width)||!Number.isSafeInteger(plan?.height)||
    plan.width<1||plan.height<1||
    plan.width>prepared.plan.width||plan.height>prepared.plan.height||
    plan.width>WORKER_RASTER_MAX_SIDE||plan.height>WORKER_RASTER_MAX_SIDE||
    plan.width*plan.height>WORKER_RASTER_MAX_PIXELS||
    !['x','y','widthMm','heightMm'].every(k=>
      Number.isFinite(prepared.plan[k])&&Number.isFinite(plan[k])&&
      Math.abs(prepared.plan[k]-plan[k])<1e-7))
    throw Error('DoctorTracer: несовместимые размеры сохранённой маски');
  const sw=prepared.plan.width,sh=prepared.plan.height;
  const width=plan.width,height=plan.height,pixels=new Uint8Array(width*height*4);
  if(width===sw&&height===sh){
    for(let i=0;i<prepared.alpha.length;i++)pixels[4*i+3]=prepared.alpha[i];
  }else{
    const dx=sw/width,dy=sh/height,area=dx*dy;
    for(let y=0;y<height;y++){
      const ya=y*dy,yb=(y+1)*dy;
      for(let x=0;x<width;x++){
        const xa=x*dx,xb=(x+1)*dx;
        let sum=0;
        for(let iy=Math.floor(ya);iy<Math.min(sh,Math.ceil(yb));iy++){
          const wy=Math.max(0,Math.min(iy+1,yb)-Math.max(iy,ya));
          if(!wy)continue;
          for(let ix=Math.floor(xa);ix<Math.min(sw,Math.ceil(xb));ix++){
            const wx=Math.max(0,Math.min(ix+1,xb)-Math.max(ix,xa));
            if(wx)sum+=prepared.alpha[iy*sw+ix]*wx*wy;
          }
        }
        pixels[(y*width+x)*4+3]=Math.round(sum/area);
      }
    }
  }
  const raster={width,height,pixels,mask:'black-transparent-rgba8',
    backend:'cached-600dpi-alpha'};
  validateDoctorTracerRgba(raster);
  return raster;
}
export function createDoctorTracerMaskCache({rasterize=rasterizeDocumentAlpha,planFor=preparedRasterPlan}={}){
  let generation=0,entry=null;
  return {
    get generation(){return generation;},
    invalidate(){generation++;entry=null;return generation;},
    get(token){return entry?.generation===token?entry:null;},
    async prepare(source,{signal,yieldUi,onProgress}={}){
      const ticket=generation;
      const plan=planFor(source);
      const raster=await rasterize(source,plan,{signal,yieldUi,onProgress});
      if(signal?.aborted||ticket!==generation)return null;
      if(!(raster?.alpha instanceof Uint8Array)||
        raster.alpha.byteLength!==plan.width*plan.height||
        raster.width!==plan.width||raster.height!==plan.height)
        throw Error('DoctorTracer: неверная заранее подготовленная альфа-маска');
      entry={source,generation:ticket,plan,alpha:raster.alpha,
        mask:'black-transparent-rgba8',
        backend:raster.backend||'canvas2d-alpha'};
      return entry;
    }
  };
}
