// EPSF-3.0 geometry-only export for legacy ArtCAM-style path import.
// Exported paths have NO ink, fill or line-width operators. Therefore a
// conventional EPS/PDF preview is blank by design: the consuming vector
// editor must read PostScript path commands (as legacy ArtCAM does for
// unpainted CorelDRAW outlines). Do not invent a CorelDRAW Creator header.
// The editor's visible SVG outlines remain display-only and are NOT exported.
const PT_PER_MM=72/25.4;
const fmt=n=>{
  if(!Number.isFinite(n)||Math.abs(n)>1e9)throw Error('EPS: недопустимая координата');
  const fixed=(Object.is(n,-0)?0:n).toFixed(7);
  return fixed.replace(/\.?0+$/,'')||'0';
};
const pt=v=>fmt(v*PT_PER_MM);
export function geometryCommands(path){
  if(path.kind==='image')throw Error('EPS: растровые изображения нельзя экспортировать как контуры. Удалите их или используйте SVG.');
  if(path.artwork){
    if(!Array.isArray(path.commands))throw Error('EPS: вектор не имеет команд');
    const off=path.offset||[0,0];
    return path.commands.map(c=>{
      if(c[0]==='Z')return ['Z'];
      if(!['M','L','C','Q'].includes(c[0]))throw Error('EPS: неизвестный тип сегмента');
      const transformed=[c[0]];
      for(let i=1;i<c.length;i+=2)transformed.push(c[i]+off[0],c[i+1]+off[1]);
      return transformed;
    });
  }
  const pts=path.points||[];
  if(!pts.length)return [];
  return [...pts.map((q,i)=>[i?'L':'M',...q]),...(path.closed?[['Z']]:[])];
}
function appendPath(out,commands,h){
  let pos=null,start=null;
  for(const c of commands){
    const op=c[0];
    if(op==='M'){
      pos=[c[1],c[2]];start=pos;
      out.push(pt(pos[0])+' '+pt(h-pos[1])+' m');
    }else if(op==='L'){
      if(!pos)throw Error('EPS: линия без начальной точки');
      pos=[c[1],c[2]];
      out.push(pt(pos[0])+' '+pt(h-pos[1])+' L');
    }else if(op==='C'){
      if(!pos)throw Error('EPS: кривая без начальной точки');
      out.push([c[1],h-c[2],c[3],h-c[4],c[5],h-c[6]].map(pt).join(' ')+' C');
      pos=[c[5],c[6]];
    }else if(op==='Q'){
      if(!pos)throw Error('EPS: кривая без начальной точки');
      const end=[c[3],c[4]],q=[c[1],c[2]];
      const first=[pos[0]+2*(q[0]-pos[0])/3,pos[1]+2*(q[1]-pos[1])/3];
      const second=[end[0]+2*(q[0]-end[0])/3,end[1]+2*(q[1]-end[1])/3];
      out.push([first[0],h-first[1],second[0],h-second[1],end[0],h-end[1]].map(pt).join(' ')+' C');
      pos=end;
    }else if(op==='Z'){
      if(!start)throw Error('EPS: замыкание без начальной точки');
      out.push('@c');pos=start;
    }else throw Error('EPS: неподдерживаемая команда '+op);
  }
}
export function exportEps(doc){
  const w=Number(doc.width),h=Number(doc.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w>1e6||h>1e6)throw Error('EPS: неверный размер документа');
  if(!Array.isArray(doc.paths))throw Error('EPS: отсутствует список контуров');
  if(doc.paths.some(p=>p.kind==='image'))throw Error('EPS: в документе есть растровые объекты. Экспорт контуров остановлен, чтобы не потерять содержимое.');
  if(doc.paths.some(p=>p.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(p.artwork)))
    throw Error('EPS: есть обтравка, маска или растровое оформление. Экспортируйте SVG — EPS контуров не сохранит это оформление.');
  const wpt=w*PT_PER_MM,hpt=h*PT_PER_MM;
  const out=[
    '%!PS-Adobe-3.0 EPSF-3.0',
    '%%Creator: Relief Forge',
    '%%Title: Relief Forge vector paths',
    '%%RF-OutlinePaths: 1',
    '%%BoundingBox: 0 0 '+Math.ceil(wpt)+' '+Math.ceil(hpt),
    '%%HiResBoundingBox: 0 0 '+fmt(wpt)+' '+fmt(hpt),
    '%%LanguageLevel: 2',
    '%%Pages: 1',
    '%%EndComments',
    '%%BeginProlog',
    '/ld{load def}bind def',
    '/m/moveto ld',
    '/L/lineto ld',
    '/C/curveto ld',
    '/@c/closepath ld',
    '/N/newpath ld',
    '%%EndProlog',
    '%%Page: 1 1',
    '%%BeginPageSetup',
    '%%EndPageSetup'
  ];
  let exported=0;
  for(const path of doc.paths){
    const commands=geometryCommands(path);
    if(!commands.length)continue;
    appendPath(out,commands,h);exported++;
  }
  if(!exported)throw Error('EPS: нет векторных контуров для экспорта');
  // Corel-style unpainted contour termination; do not put any paint command
  // between these paths and N. This preserves path coordinates for ArtCAM.
  out.push('N','%%PageTrailer','%%Trailer','%%EOF','');
  return out.join('\n');
}


// Painted EPS. Exact original PostScript can be returned when geometry and
// styles are unchanged; edited paths are rebuilt with their imported solid
// fill/stroke RGB values. CMYK profiles cannot be reconstructed from SVG and
// are never silently claimed as preserved after edits.
import {paintFromArtwork,rgbFromPaint,intactOriginalEps,originalEpsBytes} from './eps-paint.js';
export function exportColoredEps(doc,{Parser=globalThis.DOMParser}={}){
  if(intactOriginalEps(doc))return {content:originalEpsBytes(doc),source:'exact-original'};
  const w=Number(doc.width),h=Number(doc.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w>1e6||h>1e6)
    throw Error('EPS с исходной окраской: неверный размер документа');
  if(!Array.isArray(doc.paths)||!doc.paths.length)throw Error('Нет объектов для экспорта');
  if(doc.paths.some(p=>p.kind==='image'))throw Error('EPS с цветом: после изменения документа растровые изображения пока нельзя сохранить без потерь. Сохраните исходный EPS или SVG.');
  if(doc.paths.some(p=>p.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\(|stroke="url\()/i.test(p.artwork)))
    throw Error('EPS с цветом: сложные заливки, маски и растровые элементы не поддерживаются после редактирования. Сохраните SVG.');
  const wpt=w*PT_PER_MM,hpt=h*PT_PER_MM;
  const out=['%!PS-Adobe-3.0 EPSF-3.0','%%Creator: Doktor Uzelkov',
    '%%Title: Edited vector artwork with RGB paint',
    '%%BoundingBox: 0 0 '+Math.ceil(wpt)+' '+Math.ceil(hpt),
    '%%HiResBoundingBox: 0 0 '+fmt(wpt)+' '+fmt(hpt),
    '%%LanguageLevel: 2','%%Pages: 1','%%EndComments',
    '/m {moveto} bind def','/L {lineto} bind def',
    '/C {curveto} bind def','/@c {closepath} bind def',
    '%%Page: 1 1'];
  let exported=0;
  for(const path of doc.paths){
    const geometry=geometryCommands(path);
    if(!geometry.length)continue;
    const paint=path.paint||(path.artwork?paintFromArtwork(path.artwork,{Parser}):{fill:'none',stroke:'#000000',strokeWidthMm:0.1,opacity:1});
    if(paint?.unsupported)throw Error(paint.unsupported);
    if(paint.opacity!==undefined&&paint.opacity!==1)
      throw Error('EPS с цветом: прозрачность не может быть сохранена без изменения вида');
    const fill=rgbFromPaint(paint.fill||'none'),stroke=rgbFromPaint(paint.stroke||'none');
    const strokeWidth=Number(paint.strokeWidthMm??0.1);
    if(!Number.isFinite(strokeWidth)||strokeWidth<0||strokeWidth>10000)
      throw Error('EPS с цветом: некорректная толщина линии');
    out.push('newpath');
    appendPath(out,geometry,h);
    const setColor=color=>color.map(fmt).join(' ')+' setrgbcolor';
    if(fill){
      out.push('gsave',setColor(fill),paint.fillRule==='evenodd'?'eofill':'fill','grestore');
    }
    if(stroke&&strokeWidth>0){
      out.push('gsave',setColor(stroke),pt(strokeWidth)+' setlinewidth','stroke','grestore');
    }
    // Keep unpainted geometry too, if that's the original SVG appearance.
    if(!fill&&!stroke)out.push('newpath');
    exported++;
  }
  if(!exported)throw Error('Нет векторных кривых для EPS');
  out.push('newpath','showpage','%%Trailer','%%EOF','');
  return {content:out.join('\n'),source:'repainted-rgb'};
}
