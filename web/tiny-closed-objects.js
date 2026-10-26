import {geometryCommands} from './eps-export.js';

// Remove only genuinely independent, explicitly closed shapes. Width AND
// height (not area or perimeter) must be strictly under the two thresholds.
// DO/import and diagnostic markers never enter this pure AFTER-only function.
// Curved bounds are calculated from exact Bézier derivative extrema in mm.
const finite=v=>typeof v==='number'&&Number.isFinite(v);
function extrema(p0,p1,p2,p3){
  const a=-p0+3*p1-3*p2+p3,b=2*(p0-2*p1+p2),c=p1-p0;
  if(Math.abs(a)<1e-15)return Math.abs(b)<1e-15?[]:[-c/b];
  const d=b*b-4*a*c;
  if(d<0)return [];
  const root=Math.sqrt(d);
  return [(-b+root)/(2*a),(-b-root)/(2*a)];
}
function qExtrema(p0,p1,p2){
  const d=p0-2*p1+p2;
  return Math.abs(d)<1e-15?[]:[(p0-p1)/d];
}
const bezier=(pts,t)=>{
  const n=pts.length-1;
  if(n===2){const u=1-t;return u*u*pts[0]+2*u*t*pts[1]+t*t*pts[2];}
  const u=1-t;return u*u*u*pts[0]+3*u*u*t*pts[1]+3*u*t*t*pts[2]+t*t*t*pts[3];
};
function commandBounds(commands){
  const b=[Infinity,Infinity,-Infinity,-Infinity];
  const push=([x,y])=>{
    if(!finite(x)||!finite(y))throw Error('Некорректные координаты');
    b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);
    b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);
  };
  let pos=null,first=null;
  for(const c of commands){
    const op=c[0];
    if(op==='M'){pos=first=[c[1],c[2]];push(pos);}
    else if(op==='Z'){if(!first)throw Error('Потеряна начальная точка');pos=first;}
    else{
      if(!pos)throw Error('Нет начальной точки кривой');
      const end=c.slice(-2);
      if(op==='L'){push(end);}
      else if(op==='Q'||op==='C'){
        const coords=[pos,...(op==='Q'?[[c[1],c[2]]]:[[c[1],c[2]],[c[3],c[4]]]),end];
        for(let axis=0;axis<2;axis++){
          const vals=coords.map(p=>p[axis]);
          const roots=op==='Q'?qExtrema(...vals):extrema(...vals);
          for(const t of roots)if(t>0&&t<1){
            const v=bezier(vals,t);
            if(axis===0)push([v,pos[1]]);
            else push([pos[0],v]);
          }
        }
        push(end);
      }else throw Error('Неизвестный сегмент');
      pos=end;
    }
  }
  return b.every(finite)?b:null;
}
function subpaths(commands){
  const out=[];let current=null;
  for(const c of commands){
    if(c[0]==='M'){
      if(current)out.push(current);
      current={commands:[c],closed:false};
    }else{
      if(!current)throw Error('Команды без M');
      current.commands.push(c);
      if(c[0]==='Z'){current.closed=true;out.push(current);current=null;}
    }
  }
  if(current)out.push(current);
  return out;
}
const contain=(outer,inner)=>outer[0]<=inner[0]&&outer[1]<=inner[1]&&
  outer[2]>=inner[2]&&outer[3]>=inner[3];
const nodeCount=commands=>commands.filter(c=>['M','L','Q','C'].includes(c[0])).length;
const eligibleSize=(b,width,height)=>b&&b[2]-b[0]<width&&b[3]-b[1]<height;

// Does not touch raster, open paths, nested holes, compound decorations with
// clipping/masks/gradients or paths outside the explicitly selected scope.
// If just one subpath is removed from a compound object, the remaining
// commands are kept unchanged and no new Bézier anchor is introduced.
export function removeTinyClosedObjects(document,{
  enabled=true,width=.1,height=.1,indices=null
}={}){
  if(!Array.isArray(document?.paths))throw Error('Документ без контуров');
  if(!finite(width)||!finite(height)||width<=0||height<=0||width>100||height>100)
    throw Error('Габариты удаления: от 0 до 100 мм');
  const stats={enabled,thresholdWidth:width,thresholdHeight:height,
    removedObjects:0,removedSubpaths:0,removedNodes:0,protectedNested:0,skipped:0};
  if(!enabled)return {document:structuredClone(document),stats};
  const selected=indices===null?null:new Set(indices);
  const paths=[];
  for(let i=0;i<document.paths.length;i++){
    const p=document.paths[i];
    if((selected&&!selected.has(i))||p.kind==='image'){
      paths.push(structuredClone(p));continue;
    }
    if(p.artwork&&/(?:clip-path|mask=|filter=|<image\b|url\s*\()/i.test(p.artwork)){
      stats.skipped++;paths.push(structuredClone(p));continue;
    }
    try{
      const parts=subpaths(geometryCommands(p));
      if(!parts.length){paths.push(structuredClone(p));continue;}
      for(const part of parts)part.bounds=commandBounds(part.commands);
      const small=parts.map(part=>part.closed&&part.commands.length>=3&&
        eligibleSize(part.bounds,width,height));
      const retained=parts.filter((part,j)=>{
        if(!small[j])return true;
        // A small inner contour of a larger compound path may be an
        // intentional knockout/hole; never remove it automatically.
        if(parts.some((other,k)=>k!==j&&!small[k]&&other.closed&&
             other.bounds&&contain(other.bounds,part.bounds))){
          stats.protectedNested++;return true;
        }
        stats.removedSubpaths++;
        stats.removedNodes+=nodeCount(part.commands);
        return false;
      });
      if(retained.length===parts.length){paths.push(structuredClone(p));continue;}
      if(!retained.length){stats.removedObjects++;continue;}
      const commands=retained.flatMap(part=>part.commands);
      const d=commands.map(c=>c.join(' ')).join(' ');
      paths.push({...structuredClone(p),kind:'vector',
        commands,offset:[0,0],points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
        closed:commands.at(-1)?.[0]==='Z',
        artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'});
    }catch{
      stats.skipped++;paths.push(structuredClone(p));
    }
  }
  return {document:{...structuredClone(document),paths},stats};
}
