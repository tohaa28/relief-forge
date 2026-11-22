import {nativeParts,bezierPart,evaluateBezier,pointDistance} from './native-bezier.js?v=0.2.0-alpha.95';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.95';
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const add=(a,b,k=1)=>[a[0]+b[0]*k,a[1]+b[1]*k];
const unit=v=>{const n=Math.hypot(...v);return n>1e-12?v.map(x=>x/n):null;};
function tangent(points,end){
  const anchor=end?points.at(-1):points[0];
  const neighbors=end?points.slice(0,-1).reverse():points.slice(1);
  for(const q of neighbors){const direction=unit(end?sub(anchor,q):sub(q,anchor));if(direction)return direction;}
  return null;
}
function command(points){return [({2:'L',3:'Q',4:'C'})[points.length],...points.slice(1).flat()];}
function trimFraction(points,atEnd,radius){
  let lo=0,hi=.25;
  const vertex=atEnd?points.at(-1):points[0];
  for(let n=0;n<24;n++){
    const t=(lo+hi)/2,piece=atEnd?bezierPart(points,1-t,1):bezierPart(points,0,t);
    if(piece.every(p=>pointDistance(p,vertex)<=radius))lo=t;else hi=t;
  }
  return lo;
}
function ringArea(part){
  const origin=part.start,ts=[.5-Math.sqrt(15)/10,.5,.5+Math.sqrt(15)/10],weights=[5/18,8/18,5/18];
  let sum=0;
  for(const segment of part.segments){
    const p=segment.controls.map(q=>sub(q,origin)),n=p.length-1,
      derivative=p.slice(1).map((q,i)=>sub(q,p[i]).map(v=>v*n));
    for(let i=0;i<3;i++){
      const a=evaluateBezier(p,ts[i]),b=evaluateBezier(derivative,ts[i]);
      sum+=weights[i]*(a[0]*b[1]-a[1]*b[0])/2;
    }
  }
  return sum;
}

// Local proof: both discarded source tails and ALL bridge controls lie in
// radius .45*tolerance around the original vertex. Convex hull containment
// bounds their symmetric geometric deviation by 2*radius < tolerance.
// Original intervals between these balls are exact de Casteljau subcurves.
function roundedPath(source,tolerance,budget){
  const stats={detected:0,rounded:0,skipped:0,addedNodes:0,maxDeviationBound:0};
  if(source.kind==='image'||!(tolerance>0))return {path:structuredClone(source),stats};
  if(/clip-path|mask=|filter=|url\(|<image\b/i.test(source.artwork||'')){
    stats.skipped++;return {path:structuredClone(source),stats};
  }
  const parts=nativeParts(source),out=[];
  for(const part of parts){
    const segments=part.segments.map(s=>s.controls),count=segments.length;
    if(!count){out.push(['M',...part.start]);continue;}
    const heads=Array(count).fill(0),tails=Array(count).fill(1),bridges=new Map();
    const joins=count-1+Number(part.closed);
    for(let i=0;i<joins;i++){
      const j=(i+1)%count,a=segments[i],b=segments[j],vertex=a.at(-1),
        incoming=tangent(a,true),outgoing=tangent(b,false);
      if(!incoming||!outgoing||pointDistance(vertex,b[0])>1e-8)continue;
      const dot=Math.max(-1,Math.min(1,incoming[0]*outgoing[0]+incoming[1]*outgoing[1]));
      if(dot>=.90||dot<=-.999999)continue;
      stats.detected++;
      if(budget.left<=0){stats.skipped++;continue;}
      const radius=tolerance*.45,left=trimFraction(a,true,radius),right=trimFraction(b,false,radius);
      if(left<1e-9||right<1e-9){stats.skipped++;continue;}
      const before=bezierPart(a,0,1-left),after=bezierPart(b,right,1),p=before.at(-1),q=after[0],
        u=tangent(before,true),v=tangent(after,false),chord=pointDistance(p,q);
      if(!u||!v||chord<1e-10){stats.skipped++;continue;}
      const cosine=Math.max(-1,Math.min(1,u[0]*v[0]+u[1]*v[1]));
      let length=chord*(2/3)/(1+Math.sqrt((1+cosine)/2));
      let controls;
      for(let attempt=0;attempt<20;attempt++){
        controls=[p,add(p,u,length),add(q,v,-length),q];
        if(controls.every(c=>pointDistance(c,vertex)<=radius*(1+1e-10)))break;
        length*=.5;controls=null;
      }
      if(!controls||length<1e-12){stats.skipped++;continue;}
      tails[i]=1-left;heads[j]=right;bridges.set(i,controls);
      stats.rounded++;budget.left--;stats.maxDeviationBound=Math.max(stats.maxDeviationBound,2*radius);
    }
    const trimmed=segments.map((s,i)=>bezierPart(s,heads[i],tails[i]));
    out.push(['M',...trimmed[0][0]]);
    for(let i=0;i<count;i++){
      out.push(command(trimmed[i]));
      if(bridges.has(i))out.push(command(bridges.get(i)));
    }
    if(part.closed)out.push(['Z']);
  }
  if(!stats.rounded)return {path:structuredClone(source),stats};
  const candidate={...structuredClone(source),kind:'vector',commands:out,offset:[0,0],
    points:out.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),closed:out.at(-1)?.[0]==='Z',
    artwork:'<path d="'+out.map(c=>c.join(' ')).join(' ')+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'};
  for(const key of ['nodeKinds','nativeUnionProof','nativeUnionQuality','unionStamp','unionFlattened'])delete candidate[key];
  const nodes=p=>p.artwork?p.commands.filter(c=>c[0]!=='Z').length:p.points.length;
  stats.addedNodes=Math.max(0,nodes(candidate)-nodes(source));
  return {path:candidate,stats};
}

function validateTopology(before,after,tolerance){
  for(let i=0;i<before.paths.length;i++){
    const a=nativeParts(before.paths[i]),b=nativeParts(after.paths[i]);
    if(a.length!==b.length)throw Error('Изменилось число подконтуров');
    for(let j=0;j<a.length;j++){
      if(a[j].closed!==b[j].closed)throw Error('Изменилось замыкание');
      if(a[j].closed){
        const x=ringArea(a[j]),y=ringArea(b[j]);
        if(Math.abs(x)>1e-12&&(Math.abs(y)<=1e-12||Math.sign(x)!==Math.sign(y)))throw Error('Скругление схлопывает или разворачивает кольцо');
      }else if(a[j].segments.length&&b[j].segments.length&&
        (pointDistance(a[j].start,b[j].start)>1e-8||pointDistance(a[j].segments.at(-1).controls.at(-1),b[j].segments.at(-1).controls.at(-1))>1e-8))
        throw Error('Скругление перемещает свободный конец');
    }
  }
  const old=nativeIntersections(before.paths),next=nativeIntersections(after.paths);
  if(next.some(n=>!old.some(o=>o.parts===n.parts&&o.overlap===n.overlap&&
    o.crossing===n.crossing&&pointDistance(o.point,n.point)<=tolerance*2+1e-8)))
    throw Error('Скругление создаёт новое пересечение или касание');
}

export function roundBezierCorners(source,indices,tolerance,{maxCorners=4000}={}){
  if(!Number.isFinite(tolerance)||tolerance<0||tolerance>2)throw Error('Допуск скругления: от 0 до 2 мм');
  const document=structuredClone(source),stats={detected:0,rounded:0,skipped:0,addedNodes:0,maxDeviationBound:0,rejected:false};
  const budget={left:maxCorners};
  if(!tolerance)return {document,stats};
  for(const i of new Set(indices)){
    if(!document.paths[i])continue;
    const result=roundedPath(document.paths[i],tolerance,budget);document.paths[i]=result.path;
    for(const key of ['detected','rounded','skipped','addedNodes'])stats[key]+=result.stats[key];
    stats.maxDeviationBound=Math.max(stats.maxDeviationBound,result.stats.maxDeviationBound);
  }
  if(!stats.rounded)return {document,stats};
  try{validateTopology(source,document,tolerance);}
  catch(error){return {document:structuredClone(source),stats:{...stats,skipped:stats.skipped+stats.rounded,rounded:0,addedNodes:0,maxDeviationBound:0,rejected:true,reason:error.message}};}
  return {document,stats};
}
