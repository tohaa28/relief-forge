// Remove only closed, collinear retraces whose full support is already covered
// by surviving geometry in the SAME filled, unstroked compound object.
// No diagnostic tolerance or curve sampling is used to infer collinearity.
const end=c=>c.slice(-2);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function splitParts(commands){
 const parts=[];
 for(const c of commands){
  if(c[0]==='M')parts.push([]);
  if(!parts.length)return null;
  parts.at(-1).push(c);
 }
 return parts;
}
function axisFor(part){
 if(part.at(-1)?.[0]!=='Z'||part.some(c=>!['M','L','Z'].includes(c[0])))return null;
 const points=part.filter(c=>c[0]!=='Z').map(end),origin=points[0];
 if(points.length<2)return null;
 let target=origin,length=0;
 for(const p of points){const n=dist(origin,p);if(n>length){length=n;target=p;}}
 if(!Number.isFinite(length)||length<=1e-12)return null;
 const dx=(target[0]-origin[0])/length,dy=(target[1]-origin[1])/length;
 // Based on local span size, not absolute document position or user tolerance.
 const eps=Math.max(1,length)*Number.EPSILON*32;
 const on=p=>Math.abs(dx*(p[1]-origin[1])-dy*(p[0]-origin[0]))<=eps;
 const project=p=>(p[0]-origin[0])*dx+(p[1]-origin[1])*dy;
 if(!points.every(on))return null;
 const t=points.map(project);
 return {on,project,eps,lo:Math.min(...t),hi:Math.max(...t)};
}
function covered(axis,parts,budget){
 const intervals=[];
 for(const part of parts){
  let pen,start;
  for(const c of part){
   if(c[0]==='M'){pen=start=end(c);continue;}
   if(--budget.remaining<0){budget.limited=true;return false;}
   if(!pen||!['L','C','Q','Z'].includes(c[0]))return false;
   const target=c[0]==='Z'?start:end(c),hull=[pen,target];
   if(c[0]==='C'||c[0]==='Q')for(let j=1;j<c.length;j+=2)hull.push(c.slice(j,j+2));
   // A continuous collinear Bezier covers at least its endpoint interval.
   // Curved/noncollinear hulls cannot justify deleting a line.
   if(hull.every(axis.on)){
    const a=axis.project(pen),b=axis.project(target);
    if(Math.abs(a-b)>axis.eps)intervals.push([Math.min(a,b),Math.max(a,b)]);
   }
   pen=target;
  }
 }
 intervals.sort((a,b)=>a[0]-b[0]);let reach=axis.lo;
 for(const [lo,hi] of intervals){
  if(hi<reach-axis.eps)continue;
  if(lo>reach+axis.eps)return false;
  reach=Math.max(reach,hi);if(reach>=axis.hi-axis.eps)return true;
 }
 return false;
}
export function pruneCoveredRetraces(path,{maxComparisons=2000000}={}){
 if(!Number.isInteger(maxComparisons)||maxComparisons<1)throw Error('Invalid retrace work budget');
 const unchanged={path,removedContours:0,removedNodes:0,limited:false};
 const paint=path?.paint;
 if(!path?.artwork||!Array.isArray(path.commands)||path.kind==='image'||
    !paint||typeof paint.fill!=='string'||paint.fill.toLowerCase()==='none'||paint.stroke&&String(paint.stroke).toLowerCase()!=='none'||paint.unsupported||
    /(?:clip-path|mask=|filter=|<image\b|(?:fill|stroke)="url\()/i.test(path.artwork))return unchanged;
 const parts=splitParts(path.commands);if(!parts||parts.length<2)return unchanged;
 const axes=parts.map(axisFor),survivors=parts.filter((_,i)=>!axes[i]);
 // Two degenerate rings must not justify removal of each other.
 if(!survivors.length)return unchanged;
 const removed=new Set(),budget={remaining:maxComparisons,limited:false};
 axes.forEach((axis,i)=>{if(axis&&budget.remaining>=0&&covered(axis,survivors,budget))removed.add(i);});
 if(!removed.size)return {...unchanged,limited:budget.limited};
 const commands=parts.filter((_,i)=>!removed.has(i)).flat().map(c=>[...c]);
 const removedNodes=parts.reduce((n,p,i)=>n+(removed.has(i)?p.filter(c=>c[0]!=='Z').length:0),0);
 const result={...structuredClone(path),commands,points:commands.filter(c=>c[0]!=='Z').map(end),closed:commands.at(-1)?.[0]==='Z',
  artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'};
 return {path:result,removedContours:removed.size,removedNodes,limited:budget.limited};
}
