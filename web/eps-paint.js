// Read *solid* SVG appearance without guessing unsupported color profiles.
// Imported EPS geometry is in world millimetres; preserve basic paint as data
// even when optimization later replaces original artwork markup.
const defaultPaint=()=>({fill:'#000000',stroke:'none',strokeWidthMm:0.1,opacity:1,fillRule:'nonzero'});
export function paintFromArtwork(artwork,{scale=1,Parser=globalThis.DOMParser}={}){
  if(typeof artwork!=='string'||!artwork.trim())return defaultPaint();
  if(!Parser)throw Error('Сохранение цвета: XML-парсер недоступен');
  const doc=new Parser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+artwork+'</svg>','image/svg+xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('Невозможно прочитать оформление SVG');
  let node=doc.documentElement,style=defaultPaint();
  const descend=e=>{
    let s={...style};
    const declaration={};
    for(const attr of ['fill','stroke','stroke-width','opacity','fill-opacity','stroke-opacity','fill-rule','color']){
      const val=e.getAttribute?.(attr);
      if(val!==null&&val!==undefined&&val!=='')declaration[attr]=val;
    }
    const inline=e.getAttribute?.('style');
    if(inline)for(const pair of inline.split(';')){const i=pair.indexOf(':');if(i>0)declaration[pair.slice(0,i).trim().toLowerCase()]=pair.slice(i+1).trim();}
    if(declaration.fill&&declaration.fill!=='inherit')s.fill=declaration.fill;
    if(declaration.stroke&&declaration.stroke!=='inherit')s.stroke=declaration.stroke;
    if(declaration['fill-rule'])s.fillRule=declaration['fill-rule'];
    if(declaration['stroke-width']){
      const n=Number.parseFloat(declaration['stroke-width']);
      if(!Number.isFinite(n)||n<0)throw Error('Некорректная толщина обводки');
      s.strokeWidthMm=n*scale;
    }
    for(const op of ['opacity','fill-opacity','stroke-opacity']){
      if(declaration[op]!==undefined&&Number(declaration[op])!==1)
        throw Error('EPS с исходной окраской: прозрачность не поддерживается; сохраните исходный EPS без изменений или используйте SVG.');
    }
    if(declaration['clip-path']||declaration.mask||declaration.filter)
      throw Error('EPS с цветом: маска/обтравка не поддерживается');
    if(['path','line','polyline','polygon','circle','ellipse','rect'].includes(e.localName))
      return s;
    for(const child of Array.from(e.children||e.childNodes||[])){
      if(child.nodeType!==1)continue;
      const prev=style;style=s;
      const result=descend(child);
      style=prev;
      if(result)return result;
    }
    return null;
  };
  return descend(node)||style;
}
export function rgbFromPaint(value){
  if(typeof value!=='string')throw Error('Некорректный цвет');
  const c=value.trim().toLowerCase();
  if(c==='none')return null;
  const named={black:'#000000',white:'#ffffff',red:'#ff0000',green:'#008000',
    blue:'#0000ff',yellow:'#ffff00',cyan:'#00ffff',magenta:'#ff00ff',
    gray:'#808080',grey:'#808080',silver:'#c0c0c0',navy:'#000080',
    orange:'#ffa500',teal:'#008080',purple:'#800080'};
  const v=named[c]||c;
  if(/^#[0-9a-f]{3}$/i.test(v))return [...v.slice(1)].map(h=>parseInt(h+h,16)/255);
  if(/^#[0-9a-f]{6}$/i.test(v))return [1,3,5].map(i=>parseInt(v.slice(i,i+2),16)/255);
  const m=v.match(/^rgb\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*\)$/);
  if(m)return m.slice(1).map(s=>{
    const n=parseFloat(s),x=s.endsWith('%')?n/100:n/255;
    if(!Number.isFinite(x)||x<0||x>1)throw Error('Некорректный RGB');
    return x;
  });
  throw Error('Цвет '+value+' нельзя точно перенести в EPS. Сохраните SVG или исходный EPS без изменения геометрии.');
}
export function geometryStamp(doc){
  return JSON.stringify({width:doc.width,height:doc.height,
    paths:doc.paths.map(p=>({kind:p.kind,closed:p.closed,points:p.points,commands:p.commands,
      offset:p.offset,paint:p.paint,artwork:p.artwork}))});
}
export function intactOriginalEps(doc){
  return Boolean(doc.epsImport?.originalBase64&&doc.epsImport?.originalGeometryStamp&&
    doc.epsImport.originalGeometryStamp===geometryStamp(doc));
}
export function originalEpsBytes(doc){
  if(!intactOriginalEps(doc))throw Error('Исходный EPS изменён');
  const bin=atob(doc.epsImport.originalBase64);
  const out=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
  return out;
}
