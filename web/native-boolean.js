import paper from './vendor/paper-core.mjs?v=0.2.0-alpha.49';
import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.49';
import {nativeParts,cubicValues,cubicControls,bezierPart,evaluateBezier,pointDistance,createNativeIndex} from './native-bezier.js?v=0.2.0-alpha.49';
import {commandsFromNativeRings} from './native-union-proof.js?v=0.2.0-alpha.49';
import {verifyNativeUnionSilhouette} from './native-union-quality.js?v=0.2.0-alpha.49';
const EPS=2e-8;
const curveEnds=p=>[p[0],p.at(-1)];
function parameters(controls,point){
 if(controls.length===2){const a=controls[0],b=controls[1],dx=b[0]-a[0],dy=b[1]-a[1],n=dx*dx+dy*dy;if(!n)return pointDistance(a,point)<=EPS?[0,1]:[];const t=((point[0]-a[0])*dx+(point[1]-a[1])*dy)/n;return t>=-1e-12&&t<=1+1e-12&&pointDistance(evaluateBezier(controls,t),point)<=EPS?[Math.max(0,Math.min(1,t))]:[];}
 const values=cubicValues(controls),times=[];
 if(pointDistance(point,controls[0])<=EPS)times.push(0);
 if(pointDistance(point,controls.at(-1))<=EPS)times.push(1);
 for(const axis of [0,1]){const roots=[];paper.Curve.solveCubic(values,axis,point[axis],roots,0,1);for(const t of roots)if(pointDistance(evaluateBezier(controls,t),point)<=EPS&&!times.some(x=>Math.abs(x-t)<1e-10))times.push(t);}
 return times;
}
function straight(p){const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);return len>0&&p.every(q=>Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))/len<=1e-10&&((q[0]-a[0])*dx+(q[1]-a[1])*dy)>=-1e-10&&((q[0]-b[0])*dx+(q[1]-b[1])*dy)<=1e-10);}
function matchPiece(values,index){
 const output=Array.from({length:4},(_,i)=>values.slice(i*2,i*2+2)),a=output[0],b=output.at(-1);
 for(const source of index(a))for(const from of parameters(source.controls,a))for(const to of parameters(source.controls,b)){
  if(Math.abs(to-from)<1e-13)continue;
  const controls=bezierPart(source.controls,from,to),cubic=cubicControls(controls);
  if(cubic.every((p,i)=>pointDistance(p,output[i])<=EPS)||straight(controls)&&straight(output))return {source:source.id,from,to,controls};
 }
 // The kernel may join collinear source lines into one boundary edge. Cover
 // that edge with exact native intervals, without adding their internal nodes.
 if(straight(output)){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,spans=[];
  for(const s of index.all){
   if(s.controls.length!==2)continue;
   const [u,v]=s.controls,t=q=>((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length;
   if([u,v].some(q=>Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))/Math.sqrt(length)>EPS))continue;
   const tu=t(u),tv=t(v),lo=Math.max(0,Math.min(tu,tv)),hi=Math.min(1,Math.max(tu,tv));
   if(hi-lo>1e-12)spans.push({source:s.id,from:(lo-tu)/(tv-tu),to:(hi-tu)/(tv-tu),lo,hi});
  }
  spans.sort((a,b)=>a.lo-b.lo||b.hi-a.hi);let covered=0;const used=[];
  for(const p of spans){if(p.lo>covered+1e-10)break;if(p.hi>covered){used.push(p);covered=p.hi;}if(covered>=1-1e-10)return {source:null,spans:used.map(({source,from,to})=>({source,from:Math.max(0,Math.min(1,from)),to:Math.max(0,Math.min(1,to))})),controls:[evaluateBezier(index.all[used[0].source].controls,Math.max(0,Math.min(1,used[0].from))),evaluateBezier(index.all[used.at(-1).source].controls,Math.max(0,Math.min(1,used.at(-1).to)))]};}
 }
 const error=Error('Union: выходной сегмент не является исходной кривой Безье');error.details={values,candidates:index(a).map(s=>({id:s.id,controls:s.controls,from:parameters(s.controls,a),to:parameters(s.controls,b)}))};throw error;
}
function coalesce(ring,sources){
 const out=[];
 for(const p of ring){const prev=out.at(-1);if(prev&&p.source!==null&&prev.source===p.source&&Math.abs(prev.to-p.from)<1e-10){prev.to=p.to;prev.controls=bezierPart(sources[prev.source].controls,prev.from,prev.to);}else out.push(p);}
 while(out.length>1){const first=out[0],last=out.at(-1);if(first.source===null||first.source!==last.source||Math.abs(last.to-first.from)>=1e-10)break;first.from=last.from;first.controls=bezierPart(sources[first.source].controls,first.from,first.to);out.pop();}
 return out;
}
export function nativeUnionPaths(paths){
 const scope=new paper.PaperScope();scope.setup([1,1]);
 try{
  const sources=paths.flatMap((p,owner)=>nativeParts(p).flatMap(part=>part.segments.map(s=>({...s,owner}))));sources.forEach((s,id)=>s.id=id);
  if(!sources.length)throw Error('Union: нет исходных кривых');
  const items=paths.map(p=>new scope.CompoundPath({pathData:geometryCommands(p).map(c=>c.join(' ')).join(' '),fillRule:p.paint?.fillRule||'nonzero',insert:false}));
  const output=items[0].unite(items.slice(1),{insert:false}),parts=output.children||[output],index=createNativeIndex(sources,EPS);index.all=sources;
  const rings=parts.filter(p=>!p.isEmpty()).map(p=>{if(!p.closed)throw Error('Union: незамкнутая граница');return coalesce(p.curves.map(c=>matchPiece(c.values,index)),sources);});
  const originalAnchors=createNativeIndex(sources.map(s=>({...s,controls:curveEnds(s.controls)})),EPS);
  let newJunctions=0;
  for(const ring of rings)for(let i=0;i<ring.length;i++){
   const p=ring[i],prev=ring[(i+ring.length-1)%ring.length],a=p.controls[0],b=prev.controls.at(-1);
   if(pointDistance(a,b)>EPS)throw Error('Union: разрыв между исходными сегментами');
   const inherited=originalAnchors(a).some(s=>curveEnds(s.controls).some(q=>pointDistance(q,a)<=EPS));
   if(!inherited){
    if(prev.source===p.source&&Math.abs(prev.to-p.from)<1e-9)throw Error('Union: лишний узел внутри исходной кривой');
    // Both reconstructed endpoints are actual source-curve points; no sampled
    // coordinate is allowed to create a Boolean junction.
    if(pointDistance(prev.controls.at(-1),p.controls[0])>EPS)throw Error('Union: неподтверждённое пересечение');
    newJunctions++;
   }
  }
  const commands=commandsFromNativeRings(rings),quality=verifyNativeUnionSilhouette(paths,{artwork:'<path/>',commands,offset:[0,0],paint:{fillRule:'evenodd'}});
  return {commands,proof:{kind:'native-bezier-union-v1',input:paths.map(geometryCommands),rings:rings.map(r=>r.map(p=>p.spans?{spans:p.spans}:{source:p.source,from:p.from,to:p.to})),newJunctions},quality,holes:quality.holes,sourceCurves:sources.length,curves:rings.reduce((n,r)=>n+r.length,0)};
 }finally{scope.project?.remove();}
}
