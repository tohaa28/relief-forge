import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.49';
import {paintFromArtwork} from './eps-paint.js?v=0.2.0-alpha.49';

// CNC micro-detail filter. Use analytic Bézier extrema, NOT sampled preview
// or a polygonal bounding box. The two width/height tests are independent:
// a long thin engraving must never disappear just because its height is tiny.
const EPS=1e-13;
function roots(a,b,c){
  if(Math.abs(a)<EPS)return Math.abs(b)<EPS?[]:[-c/b];
  const d=b*b-4*a*c;
  if(d<-EPS)return [];
  const q=Math.sqrt(Math.max(0,d));
  return [(-b-q)/(2*a),(-b+q)/(2*a)];
}
function extrema(values){
  if(values.length===2)return [];
  const [p0,...v]=values;
  if(values.length===3){
    const [p1,p2]=v,a=p0-2*p1+p2;
    return Math.abs(a)<EPS?[]:[(p0-p1)/a];
  }
  const [p1,p2,p3]=v;
  const a=-p0+3*p1-3*p2+p3,b=3*p0-6*p1+3*p2,c=3*(p1-p0);
  return roots(3*a,2*b,c);
}
function evalBezier(p,t){
  if(p.length===2)return p[0]+(p[1]-p[0])*t;
  const u=1-t;
  return p.length===3?u*u*p[0]+2*u*t*p[1]+t*t*p[2]:
    u*u*u*p[0]+3*u*u*t*p[1]+3*u*t*t*p[2]+t*t*t*p[3];
}
export function closedSubpathBounds(commands){
  if(!commands?.length||commands[0][0]!=='M'||commands.at(-1)?.[0]!=='Z')return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,previous=null,start=null;
  const add=(x,y)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y))throw Error('Нечисловые координаты CNC');
    x0=Math.min(x0,x);x1=Math.max(x1,x);
    y0=Math.min(y0,y);y1=Math.max(y1,y);
  };
  try{
    for(const c of commands){
      if(c[0]==='M'){
        if(start)return null;
        previous=[c[1],c[2]];start=previous;add(...previous);
      }else if(['L','Q','C'].includes(c[0])){
        if(!previous)return null;
        const end=[c.at(-2),c.at(-1)];
        const points=[previous];
        if(c[0]==='Q')points.push([c[1],c[2]]);
        if(c[0]==='C')points.push([c[1],c[2]],[c[3],c[4]]);
        points.push(end);
        for(let axis=0;axis<2;axis++){
          const values=points.map(p=>p[axis]);
          for(const t of [0,1,...extrema(values)]){
            if(t>0&&t<1||t===0||t===1){
              const val=evalBezier(values,t);
              if(axis===0)add(val,previous[1]);else add(previous[0],val);
            }
          }
        }
        previous=end;
      }else if(c[0]==='Z'){
        if(!start)return null;
        add(...start);
      }else return null;
    }
    return {minX:x0,minY:y0,maxX:x1,maxY:y1,width:x1-x0,height:y1-y0};
  }catch{return null;}
}
export function splitNativeSubpaths(commands){
  const pieces=[];let piece=null;
  for(const c of commands){
    if(c[0]==='M'){
      if(piece?.length)pieces.push({commands:piece,closed:false});
      piece=[c];
    }else if(c[0]==='Z'){
      if(!piece)return null;
      piece.push(c);pieces.push({commands:piece,closed:true});piece=null;
    }else if(['L','Q','C'].includes(c[0])&&piece)piece.push(c);
    else return null; // refuse ambiguous data, never silently discard geometry
  }
  if(piece?.length)pieces.push({commands:piece,closed:false});
  return pieces;
}
function escapeAttr(v){return String(v).replace(/[&"<>]/g,ch=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[ch]));}
function rebuildArtwork(commands,paint){
  const d=commands.map(c=>c.join(' ')).join(' ');
  const fill=paint?.fill??'none',stroke=paint?.stroke??'#34465b';
  const w=paint?.strokeWidthMm??.07,rule=paint?.fillRule??'nonzero';
  return '<path d="'+escapeAttr(d)+'" fill="'+escapeAttr(fill)+'" stroke="'+escapeAttr(stroke)+
    '" stroke-width="'+escapeAttr(w)+'" fill-rule="'+escapeAttr(rule)+'"/>';
}
function paintFor(path){
  if(path.artwork){
    // Even when a top-level paint record exists, a multi-element/masked SVG
    // may have distinct styles per child. Never flatten those into one style.
    if(/clip-path|mask=|filter=|<image\b|url\s*\(|opacity\s*=|stroke-dasharray|mix-blend-mode/i.test(path.artwork))return null;
    if((path.artwork.match(/<(?:path|line|polyline|polygon|circle|ellipse|rect)\b/gi)||[]).length!==1)return null;
  }
  if(path.paint)return path.paint;
  if(!path.artwork)return {fill:'none',stroke:'#34465b',strokeWidthMm:.07,fillRule:'nonzero',opacity:1};
  try{return paintFromArtwork(path.artwork);}catch{return null;}
}
export function removeTinyClosedSubpaths(document,{enabled=true,width=.1,height=.1}={}){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
    width>100||height>100)throw Error('Габариты удаления должны быть больше 0 и не больше 100 мм');
  const copy=structuredClone(document);
  const stats={enabled,width,height,removedSubpaths:0,removedObjects:0,removedNodes:0,
    retainedOpen:0,retainedLarge:0,skippedUnsafe:0,checkedClosed:0};
  if(!enabled)return {document:copy,stats};
  const paths=[];
  for(const path of copy.paths){
    if(path.kind==='image'){paths.push(path);continue;}
    let pieces;
    try{pieces=splitNativeSubpaths(geometryCommands(path));}catch{pieces=null;}
    if(!pieces){stats.skippedUnsafe++;paths.push(path);continue;}
    const eligible=pieces.filter(piece=>piece.closed&&closedSubpathBounds(piece.commands));
    if(!eligible.length){stats.retainedOpen+=pieces.length;paths.push(path);continue;}
    const keep=[];
    for(const piece of pieces){
      if(!piece.closed){stats.retainedOpen++;keep.push(piece);continue;}
      const bounds=closedSubpathBounds(piece.commands);
      if(!bounds){stats.skippedUnsafe++;keep.push(piece);continue;}
      stats.checkedClosed++;
      // Keep on-threshold parts despite IEEE-754 rounding during subtraction.
      const gx=Math.max(1e-12,width*1e-11),gy=Math.max(1e-12,height*1e-11);
      if(bounds.width<width-gx&&bounds.height<height-gy){
        stats.removedSubpaths++;
        stats.removedNodes+=piece.commands.filter(c=>['M','L','C','Q'].includes(c[0])).length;
      }else{stats.retainedLarge++;keep.push(piece);}
    }
    if(keep.length===pieces.length){paths.push(path);continue;}
    if(!keep.length){stats.removedObjects++;continue;}
    const paint=paintFor(path);
    if(!paint||paint.unsupported||Number(paint.opacity??1)!==1){
      // We cannot regenerate an exactly styled compound element safely.
      stats.skippedUnsafe++;stats.removedSubpaths-=pieces.length-keep.length;
      stats.removedNodes-=pieces.filter(piece=>!keep.includes(piece))
        .reduce((n,p)=>n+p.commands.filter(c=>['M','L','C','Q'].includes(c[0])).length,0);
      paths.push(path);continue;
    }
    const commands=keep.flatMap(p=>p.commands);
    const next={...path,kind:'vector',commands,offset:[0,0],
      points:commands.filter(c=>['M','L','Q','C'].includes(c[0])).map(c=>c.slice(-2)),
      closed:keep.every(p=>p.closed),paint,
      artwork:rebuildArtwork(commands,paint)};
    delete next.unionStamp;delete next.unionFlattened;
    delete next.nativeUnionProof;delete next.nativeUnionQuality;
    paths.push(next);
  }
  copy.paths=paths;
  return {document:copy,stats};
}
