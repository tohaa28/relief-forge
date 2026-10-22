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
