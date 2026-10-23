import {validateCurveChange,validateDocumentCurveChange} from './curve-quality.js';
// Always resolve vector paths from the document, never a stale map callback.
export function selectedVectorIndices(document,selected,selectionOnly=true){
  const selection=new Set(selected||[]);
  return document.paths.map((_,i)=>i).filter(i=>
    document.paths[i].kind!=='image'&&(!selectionOnly||!selection.size||selection.has(i)));
}
// Conservative vector-path optimization. Simplifies geometry without turning
// Bézier curves into polylines. Every accepted merge is checked in both
// directions against fine adaptive samples, with a safety margin below the
// requested tolerance (mm). Topological intersections are NOT guaranteed;
// corners, open/closed state and independent subpaths remain distinct.
const P=(x,y)=>[x,y],add=(a,b)=>P(a[0]+b[0],a[1]+b[1]),sub=(a,b)=>P(a[0]-b[0],a[1]-b[1]),mul=(a,t)=>P(a[0]*t,a[1]*t);
const norm=a=>Math.hypot(...a),dist=(a,b)=>norm(sub(a,b)),lerp=(a,b,t)=>add(mul(a,1-t),mul(b,t));
function cubicAt(s,t){
  const u=1-t;
  return add(add(mul(s.p0,u*u*u),mul(s.p1,3*u*u*t)),add(mul(s.p2,3*u*t*t),mul(s.p3,t*t*t)));
}
function flatness(s){
  const a=s.p0,b=s.p3,v=sub(b,a),d=Math.max(norm(v),1e-12);
  return Math.max(Math.abs(v[0]*(s.p1[1]-a[1])-v[1]*(s.p1[0]-a[0]))/d,
    Math.abs(v[0]*(s.p2[1]-a[1])-v[1]*(s.p2[0]-a[0]))/d);
}
function split(s){
  const a=lerp(s.p0,s.p1,.5),b=lerp(s.p1,s.p2,.5),c=lerp(s.p2,s.p3,.5),d=lerp(a,b,.5),e=lerp(b,c,.5),m=lerp(d,e,.5);
  return [{p0:s.p0,p1:a,p2:d,p3:m},{p0:m,p1:e,p2:c,p3:s.p3}];
}
function sample(s,tol){
  const out=[s.p0],floor=Math.max(.0000002,tol/8);
  const recur=(seg,depth)=>{
    if(depth>=15||flatness(seg)<=floor){out.push(seg.p3);return;}
    const [a,b]=split(seg);recur(a,depth+1);recur(b,depth+1);
  };recur(s,0);return out;
}
function squaredDistanceToSegment(p,a,b){
  const v=sub(b,a),d=v[0]*v[0]+v[1]*v[1];
  const t=d?Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/d)):0;
  const q=add(a,mul(v,t));
  return (p[0]-q[0])**2+(p[1]-q[1])**2;
}
function maxDeviation(a,b){
  let max=0;
  for(const p of a){
    let min=Infinity;
    for(let i=1;i<b.length;i++)min=Math.min(min,squaredDistanceToSegment(p,b[i-1],b[i]));
    max=Math.max(max,min);
  }
  return Math.sqrt(max);
}
function unit(v){const d=norm(v);return d>1e-12?mul(v,1/d):null;}
function fitPair(segments,tolerance){
  const first=segments[0],last=segments.at(-1),start=first.p0,end=last.p3;
  const t0=unit(sub(first.p1,start))||unit(sub(first.p3,start));
  const t1=unit(sub(end,last.p2))||unit(sub(end,last.p0));
  if(!t0||!t1)return null;
  const samples=[first.p0];
  for(const s of segments)samples.push(...sample(s,tolerance).slice(1));
  let total=0;const lengths=[0];
  for(let i=1;i<samples.length;i++){total+=dist(samples[i],samples[i-1]);lengths.push(total);}
  if(total<1e-12)return null;
  let aa=0,ab=0,bb=0,ar=0,br=0;
  for(let i=1;i<samples.length-1;i++){
    const t=lengths[i]/total,u=1-t;
    const a=mul(t0,3*u*u*t),b=mul(t1,-3*u*t*t);
    const rhs=sub(samples[i],add(mul(start,u*u*u+3*u*u*t),mul(end,3*u*t*t+t*t*t)));
    aa+=a[0]*a[0]+a[1]*a[1];ab+=a[0]*b[0]+a[1]*b[1];
    bb+=b[0]*b[0]+b[1]*b[1];ar+=a[0]*rhs[0]+a[1]*rhs[1];br+=b[0]*rhs[0]+b[1]*rhs[1];
  }
  const determinant=aa*bb-ab*ab;
  if(determinant<=1e-13)return null;
  const alpha=(ar*bb-br*ab)/determinant,beta=(aa*br-ab*ar)/determinant;
  if(!Number.isFinite(alpha+beta)||alpha<0||beta<0||alpha>total*3||beta>total*3)return null;
  const candidate={p0:start,p1:add(start,mul(t0,alpha)),p2:sub(end,mul(t1,beta)),p3:end};
  // Sample-to-sample directional distance is not a formal analytic bound.
  // Oversample relative to user tolerance and require an extra safety margin.
  const approximation=sample(candidate,tolerance);
  const error=Math.max(maxDeviation(samples,approximation),maxDeviation(approximation,samples));
  if(error>tolerance*.55+1e-9)return null;
  return {candidate,error};
}
function makeSegments(commands,offset){
  const paths=[];let current=null,pen=null;
  for(const c of commands){
    const type=c[0];
    if(type==='M'){
      current={start:add(c.slice(1),offset),segments:[],closed:false};paths.push(current);pen=current.start;
    }else if(type==='L'||type==='C'||type==='Q'){
      if(!current||!pen)throw Error('Оптимизация: отсутствует начальная точка');
      const shift=(i)=>add(c.slice(i,i+2),offset),end=shift(c.length-2);
      let p1,p2;
      if(type==='L'){p1=lerp(pen,end,1/3);p2=lerp(pen,end,2/3);}
      else if(type==='C'){p1=shift(1);p2=shift(3);}
      else{const q=shift(1);p1=add(pen,mul(sub(q,pen),2/3));p2=add(end,mul(sub(q,end),2/3));}
      current.segments.push({p0:pen,p1,p2,p3:end,original:type});pen=end;
    }else if(type==='Z'){
      if(!current)throw Error('Оптимизация: некорректное замыкание');
      current.closed=true;pen=current.start;
    }else throw Error('Оптимизация: неизвестная команда');
  }
  return paths;
}
function pointLineDistance(p,a,b){
  const v=sub(b,a),length=norm(v);
  return length<1e-12?dist(p,a):Math.abs(v[0]*(p[1]-a[1])-v[1]*(p[0]-a[0]))/length;
}
function exactStraight(segments){
  const a=segments[0].p0,b=segments.at(-1).p3,span=sub(b,a),d=span[0]**2+span[1]**2;
  if(d<1e-15)return false;
  const projection=p=>((p[0]-a[0])*span[0]+(p[1]-a[1])*span[1])/d;
  let previous=-1e-10;
  for(const seg of segments){
    for(const q of [seg.p0,seg.p1,seg.p2,seg.p3]){
      if(pointLineDistance(q,a,b)>1e-8)return false;
      const t=projection(q);if(t<previous-1e-10||t>1+1e-10)return false;previous=t;
    }
  }
  return true;
}
function optimizeSegments(segs,tol){
  const optimized=[],out=[];
  let removed=0,maxError=0;
  for(let i=0;i<segs.length;){
    let best={count:1,seg:segs[i],error:0,straight:false};
    let length=1;
    for(let end=i+1;end<segs.length&&length<10;end++){
      // A positional tolerance alone can round a small intentional corner.
      // Never fit across a discontinuity in the incoming/outgoing tangents.
      const left=segs[end-1],right=segs[end];
      const incoming=unit(sub(left.p3,left.p2))||unit(sub(left.p3,left.p0));
      const outgoing=unit(sub(right.p1,right.p0))||unit(sub(right.p3,right.p0));
      if(!incoming||!outgoing||incoming[0]*outgoing[0]+incoming[1]*outgoing[1]<.90)break;
      const group=segs.slice(i,end+1);length=group.length;
      if(exactStraight(group)){
        best={count:group.length,seg:{p0:group[0].p0,p3:group.at(-1).p3},error:0,straight:true};continue;
      }
      const fit=fitPair(group,tol);
      if(fit)best={count:group.length,seg:fit.candidate,error:fit.error,straight:false};
      else break;
    }
    const {seg,count,error,straight}=best;
    if(straight||seg.original==='L'){
      out.push(['L',...seg.p3]);
    }else out.push(['C',...seg.p1,...seg.p2,...seg.p3]);
    removed+=count-1;maxError=Math.max(maxError,error);i+=count;
  }
  return {out,removed,maxError};
}

// Tangent smoothing at already-smooth cubic joins. This is actual geometry
// modification, not merely hiding markers. Guard both sides with the same
// adaptive geometric check as the optimizer. Sharp corners are untouched.
function smoothSegments(segs,tolerance,closed=false){
  const copy=segs.map(s=>({...s,p0:[...s.p0],p1:[...s.p1],p2:[...s.p2],p3:[...s.p3]}));
  let changed=0,maxError=0;
  if(!(tolerance>0))return {segments:copy,changed,maxError};
  const joins=copy.length>1?copy.length-1+Number(closed):0;
  for(let i=0;i<joins;i++){
    const a=copy[i],b=copy[(i+1)%copy.length],join=a.p3;
    if(dist(join,b.p0)>1e-8||a.original==='L'||b.original==='L')continue;
    const va=sub(join,a.p2),vb=sub(b.p1,join),la=norm(va),lb=norm(vb);
    if(la<1e-8||lb<1e-8)continue;
    const ua=mul(va,1/la),ub=mul(vb,1/lb),dot=ua[0]*ub[0]+ua[1]*ub[1];
    // Preserve intentional corners and sharp cusp shapes.
    if(dot<.90||dot>.9999999)continue;
    const target=unit(add(ua,ub));if(!target)continue;
    const strength=.32,oldA={...a,p2:[...a.p2]},oldB={...b,p1:[...b.p1]};
    a.p2=lerp(a.p2,sub(join,mul(target,la)),strength);
    b.p1=lerp(b.p1,add(join,mul(target,lb)),strength);
    const forward=[...sample(oldA,tolerance),...sample(oldB,tolerance).slice(1)];
    const after=[...sample(a,tolerance),...sample(b,tolerance).slice(1)];
    const deviation=Math.max(maxDeviation(forward,after),maxDeviation(after,forward));
    if(!Number.isFinite(deviation)||deviation>tolerance*.55){
      a.p2=oldA.p2;b.p1=oldB.p1;continue;
    }
    changed++;maxError=Math.max(maxError,deviation);
  }
  return {segments:copy,changed,maxError};
}
function serializeSegments(paths){
  const combined=[];
  for(const path of paths){
    combined.push(['M',...path.start]);
    for(const s of path.segments){
      if(s.original==='L')combined.push(['L',...s.p3]);
      else combined.push(['C',...s.p1,...s.p2,...s.p3]);
    }
    if(path.closed)combined.push(['Z']);
  }
  return combined;
}
export function smoothVectorPath(path,tolerance=.01,nodeTolerance=.01){
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>2)throw Error('Допуск сглаживания: от 0 до 2 мм');
  if(path.kind==='image')throw Error('Растр не является вектором');
  if(path.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(path.artwork))throw Error('Сглаживание масок и обтравки не поддерживается');
  const cmds=path.artwork?path.commands:(path.points||[]).map((p,i)=>[i?'L':'M',...p]).concat(path.closed?[['Z']]:[]);
  const paths=makeSegments(cmds,path.offset||[0,0]);
  let changed=0,maxError=0;
  const converted=paths.map(p=>{
    const result=smoothSegments(p.segments,tolerance,p.closed);
    changed+=result.changed;maxError=Math.max(maxError,result.maxError);
    return {...p,segments:result.segments};
  });
  if(!changed)return {path:structuredClone(path),changed:0,maxError:0};
  const commands=serializeSegments(converted);
  const d=commands.map(c=>c.join(' ')).join(' ');
  const candidate={...structuredClone(path),kind:'vector',commands,offset:[0,0],
    points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
    artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'};
  const quality=validateCurveChange(path,candidate,{tolerance,nodeTolerance});
  if(!quality.accepted)return {path:structuredClone(path),changed:0,maxError:0,quality};
  return {path:candidate,changed,maxError,quality};
}
export function smoothAndOptimizePaths(doc,indices,smoothTolerance,optimizeTolerance,nodeTolerance=.01){
  if(!Number.isFinite(smoothTolerance)||smoothTolerance<0||smoothTolerance>2)throw Error('Неверный допуск сглаживания');
  const selection=new Set(indices),source=structuredClone(doc);
  let smoothed=0,smoothingError=0,smoothingRejected=0;
  source.paths=source.paths.map((p,i)=>{
    if(!selection.has(i))return p;
    const result=smoothVectorPath(p,smoothTolerance,nodeTolerance);
    smoothingRejected+=Number(result.quality?.accepted===false);smoothed+=result.changed;smoothingError=Math.max(smoothingError,result.maxError);
    return result.path;
  });
  const optimized=optimizePaths(source,indices,optimizeTolerance,nodeTolerance);
  const quality=validateDocumentCurveChange(doc,optimized.document,{tolerance:smoothTolerance+optimizeTolerance,nodeTolerance});
  if(!quality.accepted)return {document:structuredClone(doc),stats:{...optimized.stats,
    original:optimized.stats.original,result:optimized.stats.original,removed:0,maxError:0,
    smoothed:0,smoothingError:0,smoothTolerance,smoothingRejected,
    rejected:optimized.stats.rejected+1,estimateCombinedError:0,quality}};
  // Estimate separate changes conservatively rather than presenting their
  // individual numeric estimates as a certified total Hausdorff distance.
  return {document:optimized.document,stats:{
    ...optimized.stats,smoothed,smoothingError,smoothTolerance,smoothingRejected,quality,
    estimateCombinedError:smoothingError+optimized.stats.maxError
  }};
}

export function optimizeVectorPath(path,tolerance=.01,nodeTolerance=.01){
  if(!Number.isFinite(tolerance)||tolerance<.00001||tolerance>2)throw Error('Допуск оптимизации должен быть от 0.00001 до 2 мм');
  if(path.kind==='image')throw Error('Растровый объект невозможно оптимизировать как кривую');
  if(path.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(path.artwork))throw Error('Оптимизация: маски, обтравка и растровое оформление пока не поддерживаются без потери свойств');
  const cmds=path.artwork?path.commands:(path.points||[]).map((p,i)=>[i?'L':'M',...p]).concat(path.closed?[['Z']]:[]);
  if(!Array.isArray(cmds)||cmds.length>30000)throw Error('Слишком сложная кривая для оптимизации');
  const offset=path.offset||[0,0],paths=makeSegments(cmds,offset);
  let removed=0,maxError=0;const combined=[];
  for(const p of paths){
    const o=optimizeSegments(p.segments,tolerance);
    removed+=o.removed;maxError=Math.max(maxError,o.maxError);
    combined.push(['M',...p.start],...o.out);
    if(p.closed)combined.push(['Z']);
  }
  if(!removed)return {path:structuredClone(path),removed:0,before:paths.reduce((n,p)=>n+p.segments.length,0),after:paths.reduce((n,p)=>n+p.segments.length,0),maxError:0};
  // Keep paths as cubic Bézier, never flatten them. All transforms are
  // already baked into absolute world-mm commands. Display paint is a
  // neutral editor-only outline, EPS export stays paintless.
  const pts=combined.filter(c=>c[0]!=='Z').map(c=>c.slice(-2));
  const d=combined.map(c=>c.join(' ')).join(' ');
  const out={kind:'vector',paint:path.paint?structuredClone(path.paint):undefined,commands:combined,offset:[0,0],closed:combined.at(-1)?.[0]==='Z',
    points:pts,artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'};
  const quality=validateCurveChange(path,out,{tolerance,nodeTolerance});
  if(!quality.accepted){const count=paths.reduce((n,p)=>n+p.segments.length,0);return {path:structuredClone(path),removed:0,before:count,after:count,maxError:0,quality};}
  return {path:out,removed,quality,before:paths.reduce((n,p)=>n+p.segments.length,0),
    after:paths.reduce((n,p)=>n+p.segments.length,0)-removed,maxError};
}
export function optimizePaths(source,indices,tolerance,nodeTolerance=.01){
  if(!Array.isArray(source?.paths))throw Error('Нет векторов для оптимизации');
  const set=new Set(indices);
  let original=0,result=0,removed=0,maxError=0,rejected=0;const paths=source.paths.map((path,i)=>{
    if(!set.has(i))return structuredClone(path);
    const r=optimizeVectorPath(path,tolerance,nodeTolerance);
    rejected+=Number(r.quality?.accepted===false);original+=r.before;result+=r.after;removed+=r.removed;maxError=Math.max(maxError,r.maxError);
    return r.path;
  });
  return {document:{...structuredClone(source),paths},stats:{original,result,removed,maxError,tolerance,rejected}};
}
