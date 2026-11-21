import {hardenClipMasks} from './doctortracer-clip-mask.js?v=0.2.0-alpha.89';
import {exportDocument,importRichSvg,safeFragment} from './rich-svg.js?v=0.2.0-alpha.89';

export function appearanceRasterPlan(document,dpi){
  if(![300,600,1200].includes(dpi))throw Error('Выберите 300, 600 или 1200 dpi.');
  const {width:widthMm,height:heightMm}=document;
  const width=Math.max(1,Math.round(widthMm*dpi/25.4));
  const height=Math.max(1,Math.round(heightMm*dpi/25.4));
  if(Math.max(width,height)>16384||width*height>160000000)
    throw Error('Растр '+width+'×'+height+' слишком велик для браузера. Выберите меньшее dpi.');
  return {x:0,y:0,widthMm,heightMm,width,height,dpi};
}

function originalArtwork(document){
  if(!document.sourceSvg)return null;
  const unitsPerInch=document.epsImport||document.pdfImport?72:96;
  // Saved projects may retain an older sourceSvg after edits. Use the
  // original tree only when it still describes the current artwork.
  try{
    const original=importRichSvg(document.sourceSvg,{unitsPerInch});
    if(original.width!==document.width||original.height!==document.height||
      original.svgDefs!==document.svgDefs||original.paths.length!==document.paths.length||
      !original.paths.every((path,i)=>{
        const current=document.paths[i];
        return path.artwork===current.artwork&&current.offset?.every(value=>value===0);
      }))return null;
    const root=new DOMParser().parseFromString(document.sourceSvg,'image/svg+xml').documentElement;
    if(!root.hasAttribute('viewBox'))
      root.setAttribute('viewBox','0 0 '+document.width*unitsPerInch/25.4+' '+document.height*unitsPerInch/25.4);
    // Nest the original root in a millimetre coordinate space. The source
    // groups, defs, paint order and source preserveAspectRatio stay intact.
    root.setAttribute('width',String(document.width));
    root.setAttribute('height',String(document.height));
    return new XMLSerializer().serializeToString(root);
  }catch{return null;}
}

// The external wizard caps its input at 2400 px and interpolates larger PNGs.
// Rasterize directly onto that final grid to avoid a second smoothing pass.
export const DOCTORTRACER_HANDOFF_MAX_SIDE=2400;
export function doctorTracerHandoffPlan(plan){
  const side=Math.max(plan.width,plan.height);
  if(side<=DOCTORTRACER_HANDOFF_MAX_SIDE)return {...plan,requestedDpi:plan.dpi};
  const scale=DOCTORTRACER_HANDOFF_MAX_SIDE/side;
  return {...plan,width:Math.max(1,Math.round(plan.width*scale)),
    height:Math.max(1,Math.round(plan.height*scale)),dpi:plan.dpi*scale,requestedDpi:plan.dpi};
}

export function appearanceRasterSvg(document,plan,{onWarning=()=>{}}={}){
  let artwork=originalArtwork(document);
  if(!artwork){
    const root=new DOMParser().parseFromString(exportDocument(document),'image/svg+xml').documentElement;
    root.setAttribute('width',String(document.width));
    root.setAttribute('height',String(document.height));
    artwork=new XMLSerializer().serializeToString(root);
  }
  const safe=safeFragment(artwork.replace(/^\s*<\?xml[^?]*\?>/i,''),DOMParser);
  const markup=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${plan.width}" height="${plan.height}" viewBox="${plan.x} ${plan.y} ${plan.widthMm} ${plan.heightMm}" preserveAspectRatio="none"><style>
    path,rect,circle,ellipse,line,polygon,polyline,use {shape-rendering:crispEdges!important}
    image {image-rendering:pixelated!important}
    </style>${safe}</svg>`;
  // Generated filters are trusted raster-only markup, inserted AFTER the
  // untrusted SVG has passed the original allowlist validation.
  const result=hardenClipMasks(markup);
  if(result.unsupported)onWarning('Сложных обрезок без отключения сглаживания: '+result.unsupported+'.');
  return result.markup;
}

// Canvas encoders use their own DPI. Replace any pHYs chunk so the file
// records the physical scale used to produce its pixel dimensions.
async function pngWithDpi(png,dpi){
  const chunk=new Uint8Array(21);
  const data=new DataView(chunk.buffer);
  data.setUint32(0,9);
  data.setUint32(4,0x70485973); // pHYs
  const ppm=Math.round(dpi/0.0254);
  data.setUint32(8,ppm);
  data.setUint32(12,ppm);
  data.setUint8(16,1);
  let crc=0xffffffff;
  for(const byte of chunk.subarray(4,17)){
    crc^=byte;
    for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  data.setUint32(17,crc^0xffffffff);
  let offset=33; // PNG signature and IHDR
  while(offset+8<=png.size){
    const header=new DataView(await png.slice(offset,offset+8).arrayBuffer());
    const type=header.getUint32(4);
    if(type===0x49444154)break; // IDAT
    const end=offset+header.getUint32(0)+12;
    if(type===0x70485973)
      return new Blob([png.slice(0,offset),chunk,png.slice(end)],{type:'image/png'});
    offset=end;
  }
  return new Blob([png.slice(0,33),chunk,png.slice(33)],{type:'image/png'});
}

export async function rasterizeImportedAppearance(document,plan,{signal,onWarning}={}){
  signal?.throwIfAborted();
  const url=URL.createObjectURL(new Blob([appearanceRasterSvg(document,plan,{onWarning})],{type:'image/svg+xml'}));
  const canvas=globalThis.document.createElement('canvas');
  try{
    const image=new Image();
    image.src=url;
    await image.decode();
    signal?.throwIfAborted();
    canvas.width=plan.width;
    canvas.height=plan.height;
    const context=canvas.getContext('2d');
    if(!context)throw Error('Canvas 2D недоступен.');
    context.imageSmoothingEnabled=false;
    context.drawImage(image,0,0);
    const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>
      blob?resolve(blob):reject(Error('Не удалось создать PNG. Выберите меньшее dpi.'))));
    signal?.throwIfAborted();
    return pngWithDpi(png,plan.dpi);
  }finally{
    URL.revokeObjectURL(url);
    canvas.width=canvas.height=0;
  }
}
