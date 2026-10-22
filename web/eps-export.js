// EPSF-3.0 outline-only export. It emits real PostScript paths and strokes;
// UI diagnostic markers are deliberately excluded from production files.
// Imported curves stay as cubic/quadratic Bezier geometry, never flatten here.
const P=72/25.4;
const fmt=n=>{
  if(!Number.isFinite(n)||Math.abs(n)>1e9)throw Error('EPS: недопустимая координата');
  const fixed=(Object.is(n,-0)?0:n).toFixed(7);
  return fixed.replace(/\.?0+$/,'')||'0';
};
const pt=v=>fmt(v*P);
export function geometryCommands(path){
  if(path.kind==='image')throw Error('EPS: растровые изображения нельзя экспортировать как контуры. Удалите их или используйте SVG.');
  if(path.artwork){
    if(!Array.isArray(path.commands))throw Error('EPS: вектор не имеет команд');
    const off=path.offset||[0,0];
    return path.commands.map(c=>{
      if(c[0]==='Z')return ['Z'];
      if(!['M','L','C','Q'].includes(c[0]))throw Error('EPS: неизвестный тип сегмента');
      const transformed=[c[0]];
      for(let i=1;i<c.length;i+=2){transformed.push(c[i]+off[0],c[i+1]+off[1]);}
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
    if(op==='M'){pos=[c[1],c[2]];start=pos;out.push(pt(pos[0])+' '+pt(h-pos[1])+' moveto');}
    else if(op==='L'){if(!pos)throw Error('EPS: линия без начальной точки');pos=[c[1],c[2]];out.push(pt(pos[0])+' '+pt(h-pos[1])+' lineto');}
    else if(op==='C'){
      if(!pos)throw Error('EPS: кривая без начальной точки');
      out.push([c[1],h-c[2],c[3],h-c[4],c[5],h-c[6]].map(pt).join(' ')+' curveto');
      pos=[c[5],c[6]];
    }else if(op==='Q'){
      if(!pos)throw Error('EPS: кривая без начальной точки');
      const end=[c[3],c[4]],q=[c[1],c[2]];
      const first=[pos[0]+2*(q[0]-pos[0])/3,pos[1]+2*(q[1]-pos[1])/3];
      const second=[end[0]+2*(q[0]-end[0])/3,end[1]+2*(q[1]-end[1])/3];
      out.push([first[0],h-first[1],second[0],h-second[1],end[0],h-end[1]].map(pt).join(' ')+' curveto');
      pos=end;
    }else if(op==='Z'){
      if(!start)throw Error('EPS: замыкание без начала');
      out.push('closepath');pos=start;
    }else throw Error('EPS: неподдерживаемая команда '+op);
  }
}
export function exportEps(doc,{strokePt=0.25}={}){
  const w=Number(doc.width),h=Number(doc.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0||w>1e6||h>1e6)throw Error('EPS: неверный размер документа');
  if(!Number.isFinite(strokePt)||strokePt<=0||strokePt>20)throw Error('EPS: неверная толщина обводки');
  if(doc.paths.some(p=>p.kind==='image'))throw Error('EPS: в документе есть растровые объекты. Экспорт контуров остановлен, чтобы не потерять содержимое.');
  if(doc.paths.some(p=>p.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(p.artwork)))
    throw Error('EPS: есть обтравка, маска или растровое оформление. Экспортируйте SVG — EPS контуров не сохранит это оформление.');
  const widthPt=w*P,heightPt=h*P;
  const out=[
    '%!PS-Adobe-3.0 EPSF-3.0','%%Creator: Relief Forge',
    '%%Title: Relief Forge repaired vector outlines',
    '%%BoundingBox: 0 0 '+Math.ceil(widthPt)+' '+Math.ceil(heightPt),
    '%%HiResBoundingBox: 0 0 '+fmt(widthPt)+' '+fmt(heightPt),
    '%%LanguageLevel: 2','%%Pages: 1','%%EndComments',
    '%%Page: 1 1','gsave',
    '0 setgray',fmt(strokePt)+' setlinewidth','1 setlinecap','1 setlinejoin'
  ];
  for(const p of doc.paths){
    const cmds=geometryCommands(p);
    if(!cmds.length)continue;
    out.push('newpath');appendPath(out,cmds,h);out.push('stroke');
  }
  out.push('grestore','showpage','%%PageTrailer','%%Trailer','%%EOF','');
  return out.join('\n');
}
