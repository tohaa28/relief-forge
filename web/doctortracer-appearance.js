import {exportDocument,importRichSvg,safeFragment} from './rich-svg.js?v=0.2.0-alpha.88';

export function appearanceRasterPlan(document,{dpi=600,maxSide=9000,maxPixels=36000000}={}){
  const {width:widthMm,height:heightMm}=document;
  const scale=Math.min(dpi/25.4,maxSide/Math.max(widthMm,heightMm),
    Math.sqrt(maxPixels/(widthMm*heightMm)));
  return {x:0,y:0,widthMm,heightMm,width:Math.max(1,Math.floor(widthMm*scale)),
    height:Math.max(1,Math.floor(heightMm*scale)),dpi:scale*25.4};
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

export function appearanceRasterSvg(document,plan){
  let artwork=originalArtwork(document);
  if(!artwork){
    const root=new DOMParser().parseFromString(exportDocument(document),'image/svg+xml').documentElement;
    root.setAttribute('width',String(document.width));
    root.setAttribute('height',String(document.height));
    artwork=new XMLSerializer().serializeToString(root);
  }
  const safe=safeFragment(artwork.replace(/^\s*<\?xml[^?]*\?>/i,''),DOMParser);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${plan.width}" height="${plan.height}" viewBox="${plan.x} ${plan.y} ${plan.widthMm} ${plan.heightMm}" preserveAspectRatio="none">${safe}</svg>`;
}

export async function rasterizeImportedAppearance(document,plan,{
  signal,alphaOnly=false,yieldUi=()=>Promise.resolve(),onProgress=()=>{}
}={}){
  if(signal?.aborted)throw Error('Трассировка отменена.');
  const url=URL.createObjectURL(new Blob([appearanceRasterSvg(document,plan)],{type:'image/svg+xml'}));
  const canvas=globalThis.document.createElement('canvas');
  try{
    const image=new Image();
    image.src=url;
    await image.decode();
    if(signal?.aborted)throw Error('Трассировка отменена.');
    canvas.width=plan.width;canvas.height=plan.height;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context)throw Error('Canvas 2D недоступен.');
    context.drawImage(image,0,0);
    if(!alphaOnly)return {width:plan.width,height:plan.height,
      pixels:new Uint8Array(context.getImageData(0,0,plan.width,plan.height).data.buffer),
      backend:'svg-artwork-rgba'};
    const alpha=new Uint8Array(plan.width*plan.height);
    const rows=Math.max(1,Math.floor(262144/plan.width));
    for(let y=0;y<plan.height;y+=rows){
      if(signal?.aborted)throw Error('Трассировка отменена.');
      const height=Math.min(rows,plan.height-y);
      const rgba=context.getImageData(0,y,plan.width,height).data;
      for(let p=0;p<rgba.length/4;p++)alpha[y*plan.width+p]=rgba[p*4+3];
      onProgress((y+height)/plan.height);
      if(y+height<plan.height)await yieldUi();
    }
    return {width:plan.width,height:plan.height,alpha,backend:'svg-artwork-alpha'};
  }finally{
    URL.revokeObjectURL(url);
    canvas.width=canvas.height=0;
  }
}
