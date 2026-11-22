import {exportDocument,importRichSvg,safeFragment} from './rich-svg.js?v=0.2.0-alpha.90';

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

// Chromium antialiases clip paths even with crispEdges. Opaque alpha masks
// let the same vector geometry use the ordinary, unsmoothed fill renderer.
function hardClipArtwork(artwork){
  if(!artwork.includes('clip-path'))return artwork;
  const ns='http://www.w3.org/2000/svg';
  const wrapper=new DOMParser().parseFromString(
    `<svg xmlns="${ns}" xmlns:xlink="http://www.w3.org/1999/xlink">${artwork}</svg>`,'image/svg+xml').documentElement;
  const root=wrapper.firstElementChild;
  const nodes=[root,...root.querySelectorAll('*')];
  const ids=new Map();
  for(const node of nodes)if(node.id&&!ids.has(node.id))ids.set(node.id,node);
  const definitions=root.ownerDocument.createElementNS(ns,'defs');
  const masks=new Map();
  const make=tag=>root.ownerDocument.createElementNS(ns,tag);
  const property=(node,name)=>node.style.getPropertyValue(name)||node.getAttribute(name);
  const set=(node,name,value)=>node.style.setProperty(name,value,'important');
  const shapes=new Set(['path','rect','circle','ellipse','line','polygon','polyline']);
  let sequence=0;

  function clipShape(source,rule,visited){
    if(visited.has(source))return null;
    const tag=source.localName;
    rule=property(source,'clip-rule')||rule;
    if(tag==='use'){
      const href=source.getAttribute('href')||source.getAttribute('xlink:href')||'';
      const referenced=ids.get(href.slice(1));
      if(!referenced)return null;
      const child=clipShape(referenced,rule,new Set([...visited,source]));
      if(!child)return null;
      const target=source.cloneNode(false),id=nextId();
      child.id=id;
      definitions.append(child);
      target.removeAttribute('id');
      target.removeAttribute('xlink:href');
      target.setAttribute('href','#'+id);
      for(const [name,value] of Object.entries({opacity:'1',mask:'none',filter:'none'}))set(target,name,value);
      return applyClip(source,target)?target:null;
    }
    if(tag!=='g'&&!shapes.has(tag))return null;
    const target=source.cloneNode(false);
    target.removeAttribute('id');
    for(const name of ['fill','opacity','fill-opacity','stroke','mask','filter','clip-path'])target.removeAttribute(name);
    for(const [name,value] of Object.entries({fill:'#fff',opacity:'1','fill-opacity':'1',stroke:'none',mask:'none',filter:'none','clip-path':'none','fill-rule':rule||'nonzero','shape-rendering':'crispEdges'}))
      set(target,name,value);
    for(const node of source.children){
      const child=clipShape(node,rule,visited);
      if(!child)return null;
      target.append(child);
    }
    return applyClip(source,target)?target:null;
  }

  function nextId(){
    let id;
    do{id='du-raster-clip-'+(++sequence);}while(ids.has(id));
    return id;
  }

  function clipMask(value){
    const id=value?.match(/^url\(\s*['"]?#([\w.:-]+)['"]?\s*\)$/)?.[1];
    if(!id)return null;
    if(masks.has(id))return masks.get(id);
    const clip=ids.get(id);
    if(clip?.localName!=='clipPath')return null;
    masks.set(id,null); // Reject cycles rather than recursively expanding them.
    const mask=make('mask');
    mask.id=nextId();
    mask.setAttribute('mask-type','alpha');
    mask.setAttribute('maskContentUnits',clip.getAttribute('clipPathUnits')||'userSpaceOnUse');
    for(const [name,value] of Object.entries({x:'-100%',y:'-100%',width:'300%',height:'300%'}))mask.setAttribute(name,value);
    const group=make('g');
    if(clip.hasAttribute('transform'))group.setAttribute('transform',clip.getAttribute('transform'));
    if(clip.style.transform)group.style.transform=clip.style.transform;
    for(const node of clip.children){
      const geometry=clipShape(node,property(clip,'clip-rule'),new Set());
      if(!geometry)return null;
      group.append(geometry);
    }
    if(!applyClip(clip,group))return null;
    mask.append(group);
    definitions.append(mask);
    masks.set(id,mask.id);
    return mask.id;
  }

  function applyClip(source,target,existingMask){
    const value=property(source,'clip-path');
    if(!value||value==='none')return true;
    const id=clipMask(value);
    if(!id)return false;
    set(target,'clip-path','none');
    const mask='url(#'+id+')';
    set(target,'mask',existingMask?existingMask+', '+mask:mask);
    if(existingMask)set(target,'mask-composite','intersect');
    return true;
  }

  for(const node of nodes){
    if(node.closest('clipPath'))continue;
    const mask=property(node,'mask');
    applyClip(node,node,mask&&mask!=='none'?mask:null);
  }
  if(definitions.childElementCount)root.prepend(definitions);
  return new XMLSerializer().serializeToString(root);
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
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${plan.width}" height="${plan.height}" viewBox="${plan.x} ${plan.y} ${plan.widthMm} ${plan.heightMm}" preserveAspectRatio="none"><style>
    path,rect,circle,ellipse,line,polygon,polyline,use {shape-rendering:crispEdges!important}
    image {image-rendering:pixelated!important}
    </style>${hardClipArtwork(safe)}</svg>`;
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

export async function rasterizeImportedAppearance(document,plan,{signal,maxSide=Infinity}={}){
  signal?.throwIfAborted();
  const url=URL.createObjectURL(new Blob([appearanceRasterSvg(document,plan)],{type:'image/svg+xml'}));
  const canvas=globalThis.document.createElement('canvas');
  let output=canvas;
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
    const scale=Math.min(1,maxSide/Math.max(plan.width,plan.height));
    if(scale<1){
      output=globalThis.document.createElement('canvas');
      output.width=Math.max(1,Math.round(plan.width*scale));
      output.height=Math.max(1,Math.round(plan.height*scale));
      const scaled=output.getContext('2d');
      if(!scaled)throw Error('Canvas 2D недоступен.');
      scaled.imageSmoothingEnabled=false;
      scaled.drawImage(canvas,0,0,output.width,output.height);
      canvas.width=canvas.height=0;
    }
    const png=await new Promise((resolve,reject)=>output.toBlob(blob=>
      blob?resolve(blob):reject(Error('Не удалось создать PNG. Выберите меньшее dpi.'))));
    signal?.throwIfAborted();
    return pngWithDpi(png,plan.dpi*scale);
  }finally{
    URL.revokeObjectURL(url);
    canvas.width=canvas.height=0;
    output.width=output.height=0;
  }
}
