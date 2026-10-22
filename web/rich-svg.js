import svgpath from './vendor/svgpath.mjs';
const NS='http://www.w3.org/2000/svg';
const tags=new Set('svg g defs path image use clipPath mask pattern linearGradient radialGradient stop rect circle ellipse line polyline polygon title desc metadata'.split(' '));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const children=e=>Array.from(e.childNodes||[]).filter(n=>n.nodeType===1);
function xml(text,Parser=globalThis.DOMParser){
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('SVG: объявления DTD запрещены');
  const d=new Parser().parseFromString(text,'image/svg+xml');
  if(d.documentElement?.localName!=='svg'||d.getElementsByTagName('parsererror').length)throw Error('Некорректный SVG');
  const visit=e=>{if(!tags.has(e.localName))throw Error('SVG: неподдерживаемый элемент '+e.localName);
    for(const a of Array.from(e.attributes||[])){
      const v=a.value;
      if(/^on/i.test(a.name)||a.name==='xml:base'||/javascript:|@import|expression\s*\(|\\/i.test(v))throw Error('SVG: небезопасный атрибут');
      if(/(?:^|:)href$/.test(a.name)&&!/^#/.test(v)&&!/^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=\s]+$/i.test(v))throw Error('SVG: внешняя ссылка запрещена');
      for(const m of v.matchAll(/url\((.*?)\)/gi))if(!/^['"]?#[\w.:-]+['"]?$/.test(m[1].trim()))throw Error('SVG: внешний ресурс запрещён');
    }children(e).forEach(visit);};visit(d.documentElement);return d;
}
function serialize(e){
  const attrs=Array.from(e.attributes||[]).map(a=>` ${a.name}="${esc(a.value)}"`).join('');
  return `<${e.nodeName}${attrs}>${Array.from(e.childNodes||[]).map(n=>n.nodeType===1?serialize(n):n.nodeType===3?esc(n.nodeValue):'').join('')}</${e.nodeName}>`;
}
const attrs=e=>Array.from(e.attributes||[]).map(a=>` ${a.name}="${esc(a.value)}"`).join('');
function commands(d,transform=''){
  const p=svgpath(d);if(p.err)throw Error('SVG path: '+p.err);
  if(transform)p.transform(transform);p.abs().unshort().unarc();let x=0,y=0;
  p.iterate((s,i,x,y)=>{if(s[0]==='H')return [['L',s[1],y]];if(s[0]==='V')return [['L',x,s[1]]];});
  const result=p.segments.map(s=>s.slice());
  if(result.some(s=>s.slice(1).some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('SVG: координаты вне диапазона');
  return result;
}
export const commandData=c=>c.map(s=>s.join(' ')).join(' ');
export function worldData(p){return p.artwork?svgpath(commandData(p.commands)).translate(...p.offset).toString():p.points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')+(p.closed?' Z':'');}
export function artworkMarkup(p){return `<g transform="translate(${p.offset.join(' ')})">${p.artwork}</g>`;}
export function safeFragment(s,Parser){xml(`<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink">${s}</svg>`,Parser);return s;}
function length(s,fallback,ppi){if(!s)return fallback;const m=s.match(/^\s*([\d.eE+-]+)\s*(mm|cm|in|pt|pc|px)?\s*$/);if(!m)throw Error('SVG: неизвестные единицы');return Number(m[1])*({mm:1,cm:10,in:25.4,pt:25.4/72,pc:25.4/6,px:25.4/ppi}[m[2]||'px']);}
export function importRichSvg(text,{unitsPerInch=96,Parser=globalThis.DOMParser}={}){
  const d=xml(text,Parser),root=d.documentElement;
  // Namespace IDs so imported definitions cannot shadow the editor's grid or controls.
  const all=[root,...Array.from(root.getElementsByTagName('*'))],ids=new Map();
  all.forEach(e=>{if(e.getAttribute('id'))ids.set(e.getAttribute('id'),'rf-import-'+ids.size);});
  for(const e of all)for(const a of Array.from(e.attributes||[])){
    let v=a.value;if(a.name==='id')v=ids.get(v);else{if(v.startsWith('#')&&ids.has(v.slice(1)))v='#'+ids.get(v.slice(1));v=v.replace(/url\(['"]?#([^)'"\s]+)['"]?\)/g,(m,id)=>ids.has(id)?`url(#${ids.get(id)})`:m);}e.setAttribute(a.name,v);
  }
  const raw=root.getAttribute('viewBox'),vb=raw?raw.trim().split(/[\s,]+/).map(Number):null;
  if(vb&&(vb.length!==4||vb.some(n=>!Number.isFinite(n))||vb[2]<=0||vb[3]<=0))throw Error('SVG: неверный viewBox');
  const width=length(root.getAttribute('width'),vb?vb[2]*25.4/unitsPerInch:300,unitsPerInch),height=length(root.getAttribute('height'),vb?vb[3]*25.4/unitsPerInch:200,unitsPerInch);
  if(!Number.isFinite(width+height)||width<=0||height<=0||width>1e6||height>1e6)throw Error('SVG: неверные размеры');
  const box=vb||[0,0,width*unitsPerInch/25.4,height*unitsPerInch/25.4],sx=width/box[2],sy=height/box[3];
  // EPS writer emits an exact matching viewBox. Other SVGs need explicit aspect handling.
  let scaleX=sx,scaleY=sy,tx=-box[0]*sx,ty=-box[1]*sy;
  const aspect=root.getAttribute('preserveAspectRatio')||'xMidYMid meet';
  if(aspect!=='none'){const s=aspect.includes('slice')?Math.max(sx,sy):Math.min(sx,sy);scaleX=scaleY=s;tx=-box[0]*s+(width-box[2]*s)*(aspect.includes('xMin')?0:aspect.includes('xMax')?1:.5);ty=-box[1]*s+(height-box[3]*s)*(aspect.includes('YMin')?0:aspect.includes('YMax')?1:.5);}
  const viewport=`matrix(${scaleX} 0 0 ${scaleY} ${tx} ${ty})`,paths=[],definitions=[];
  const rootStyle=Array.from(root.attributes).filter(a=>['fill','stroke','stroke-width','fill-rule','opacity','style','color'].includes(a.name)).map(a=>` ${a.name}="${esc(a.value)}"`).join('');
  const lookup=id=>all.find(e=>e.getAttribute('id')===id);
  function shape(e){const n=k=>Number(e.getAttribute(k)||0),tag=e.localName;
    if(tag==='path')return e.getAttribute('d')||'';
    if(tag==='line')return `M${n('x1')} ${n('y1')}L${n('x2')} ${n('y2')}`;
    if(tag==='polygon'||tag==='polyline'){const a=(e.getAttribute('points')||'').trim();return a?'M'+a+(tag==='polygon'?'Z':''):'';}
    if(tag==='rect'){const x=n('x'),y=n('y'),w=n('width'),h=n('height'),rx=Math.min(n('rx')||n('ry'),w/2),ry=Math.min(n('ry')||rx,h/2);return rx||ry?`M${x+rx} ${y}H${x+w-rx}A${rx} ${ry} 0 0 1 ${x+w} ${y+ry}V${y+h-ry}A${rx} ${ry} 0 0 1 ${x+w-rx} ${y+h}H${x+rx}A${rx} ${ry} 0 0 1 ${x} ${y+h-ry}V${y+ry}A${rx} ${ry} 0 0 1 ${x+rx} ${y}Z`:`M${x} ${y}h${w}v${h}h${-w}Z`;}
    if(tag==='circle'||tag==='ellipse'){const x=n('cx'),y=n('cy'),rx=tag==='circle'?n('r'):n('rx'),ry=tag==='circle'?rx:n('ry');return `M${x-rx} ${y}a${rx} ${ry} 0 1 0 ${2*rx} 0a${rx} ${ry} 0 1 0 ${-2*rx} 0Z`;}
    if(tag==='image')return `M${n('x')} ${n('y')}h${n('width')||1}v${n('height')||1}h${-(n('width')||1)}Z`;
    throw Error('SVG: неподдерживаемая геометрия '+tag);
  }
  function visit(e,wrappers=[],transforms=[],depth=0){
    if(depth>64)throw Error('SVG: слишком глубокая структура');const tag=e.localName;
    if(tag==='defs'){definitions.push(serialize(e));return;}
    if(['title','desc','metadata'].includes(tag))return;
    if(tag==='g'){children(e).forEach(c=>visit(c,[...wrappers,`<g${attrs(e)}>`],[...transforms,e.getAttribute('transform')||''],depth+1));return;}
    if(tag==='svg')throw Error('Вложенный SVG пока не поддерживается');
    if(tag==='use'){
      const ref=lookup((e.getAttribute('href')||e.getAttribute('xlink:href')||'').slice(1));if(!ref)throw Error('SVG use: ссылка не найдена');
      const tr=`${e.getAttribute('transform')||''} translate(${Number(e.getAttribute('x')||0)} ${Number(e.getAttribute('y')||0)})`;
      const a=Array.from(e.attributes).filter(a=>!['href','xlink:href','transform','x','y'].includes(a.name)).map(a=>` ${a.name}="${esc(a.value)}"`).join('');
      visit(ref,[...wrappers,`<g${a} transform="${esc(tr)}">`],[...transforms,tr],depth+1);return;
    }
    const c=commands(shape(e),[viewport,...transforms,e.getAttribute('transform')||''].join(' '));if(!c.length)return;
    const points=c.filter(s=>s[0]!=='Z').map(s=>s.slice(-2));
    const artwork=`<g transform="${viewport}"${rootStyle}>${wrappers.join('')}${serialize(e)}${'</g>'.repeat(wrappers.length)}</g>`;
    paths.push({points,closed:c.at(-1)?.[0]==='Z',commands:c,offset:[0,0],artwork,kind:tag==='image'?'image':'vector'});
  }
  children(root).forEach(e=>visit(e));
  if(paths.reduce((n,p)=>n+p.points.length,0)>200000)throw Error('SVG: превышен лимит 200000 узлов');
  return {format:'relief-forge',version:1,width,height,paths,svgDefs:definitions.join(''),sourceSvg:text};
}
// Adaptive subdivision is used only for diagnostics / an explicit conversion, never for storage/rendering.
export function sampledContours(p,tolerance=.01){
  if(!p.artwork)return [{points:p.points,closed:p.closed}];if(p.kind==='image')return [];
  const c=commands(worldData(p)),out=[];let path=null,prev=[0,0];let count=0;
  const add=q=>{if(++count>20000)throw Error('Кривая слишком сложна: увеличьте допуск или уменьшите выборку');path.points.push(q);};
  const subdivide=(a,b,c,d,depth=0)=>{
    const dist=q=>{const dx=d[0]-a[0],dy=d[1]-a[1],l=Math.hypot(dx,dy);return l?Math.abs(dy*q[0]-dx*q[1]+d[0]*a[1]-d[1]*a[0])/l:Math.hypot(q[0]-a[0],q[1]-a[1]);};
    if(depth>=18||Math.max(dist(b),dist(c))<=tolerance){add(d);return;}
    const mid=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2],ab=mid(a,b),bc=mid(b,c),cd=mid(c,d),abc=mid(ab,bc),bcd=mid(bc,cd),m=mid(abc,bcd);
    subdivide(a,ab,abc,m,depth+1);subdivide(m,bcd,cd,d,depth+1);
  };
  for(const s of c){const op=s[0],end=s.slice(-2);
    if(op==='M'){path={points:[end],closed:false};out.push(path);}
    else if(op==='L')add(end);
    else if(op==='C')subdivide(prev,s.slice(1,3),s.slice(3,5),end);
    else if(op==='Q'){const q=s.slice(1,3);subdivide(prev,[prev[0]+2*(q[0]-prev[0])/3,prev[1]+2*(q[1]-prev[1])/3],[end[0]+2*(q[0]-end[0])/3,end[1]+2*(q[1]-end[1])/3],end);}
    else if(op==='Z'){path.closed=true;prev=path.points[0];continue;}prev=end;
  }return out;
}
export function exportDocument(doc){return `<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="${doc.width}mm" height="${doc.height}mm" viewBox="0 0 ${doc.width} ${doc.height}">${doc.svgDefs||''}${doc.paths.map(p=>p.artwork?artworkMarkup(p):`<path d="${worldData(p)}" fill="none" stroke="#000" stroke-width="0.1"/>`).join('')}</svg>`;}
