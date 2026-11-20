import {nativeParts,pointDistance,lerpPoint,evaluateBezier,splitBezier,bezierPart,cubicControls,controlsBounds,sampleNativeParts} from './native-bezier.js?v=0.2.0-alpha.69';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.69';
import {finishDeferredCurveCommands} from './curve-edit.js?v=0.2.0-alpha.69';

// Bounded, exact-native surgery. Never called in pointermove or after manual Done.
// Failure to prove a candidate safe means no change, not an approximate repair.
const dist=pointDistance;
const bbox=pts=>pts.reduce((b,p)=>[
  Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])
],[Infinity,Infinity,-Infinity,-Infinity]);
const intersect=(a,b,e=0)=>a&&b&&a[0]<=b[2]+e&&b[0]<=a[2]+e&&a[1]<=b[3]+e&&b[1]<=a[3]+e;
const vectorCommands=p=>p.artwork?structuredClone(p.commands):
  p.points.map((q,i)=>[i?'L':'M',...q]).concat(p.closed?[['Z']]:[]);
const partSegments=p=>nativeParts(p).map(part=>part.segments);
const segmentCount=p=>partSegments(p).reduce((n,s)=>n+s.length,0);
const translate=(p,q)=>[p[0]+q[0],p[1]+q[1]];
const worldPath=p=>{
  const delta=p.offset||[0,0];
  return {kind:'vector',artwork:'<path/>',offset:[0,0],
    commands:vectorCommands(p).map(c=>[c[0],...c.slice(1).map((v,i)=>v+delta[i%2])])};
};
const worldBounds=p=>bbox(vectorCommands(p).flatMap(c=>{
  const d=p.offset||[0,0],pts=[];
  for(let j=1;j<c.length;j+=2)pts.push([c[j]+d[0],c[j+1]+d[1]]);
  return pts;
}));
const area=points=>points.reduce((sum,p,i)=>{
  const q=points[(i+1)%points.length];return sum+p[0]*q[1]-p[1]*q[0];
},0)/2;
function filled(path){
  if(!path.artwork)return Boolean(path.closed);
  return !/\bfill\s*=\s*(['"])none\1/i.test(path.artwork);
}
function areaSafe(before,after,tolerance,strict){
  if(!strict)return true;
  const a=nativeParts(before),b=nativeParts(after);
  if(a.length!==b.length||a.some((part,i)=>part.closed!==b[i].closed))return false;
  if(!a.some(p=>p.closed)&&!filled(before))return true;
  const first=sampleNativeParts(before,.004,{maxPoints:80000});
  const second=sampleNativeParts(after,.004,{maxPoints:80000});
  if(first.length!==second.length)return false;
  for(let i=0;i<first.length;i++){
    if(!a[i].closed&&!filled(before))continue;
    const ar=area(first[i].points),br=area(second[i].points);
    const bb=bbox(first[i].points),scale=Math.max(1e-7,(bb[2]-bb[0])*(bb[3]-bb[1]));
    if(Math.sign(ar)!==Math.sign(br)&&Math.abs(ar)>tolerance*tolerance)return false;
    if(Math.abs(ar-br)>Math.max(tolerance*tolerance*.5,scale*.003))return false;
  }
  return true;
}
function intersections(path){
  if(segmentCount(path)>720)throw Error('self-intersection-curve-budget');
  const hits=nativeIntersections([path],{maxCurves:720,maxIssues:300});
  if(!hits.complete)throw Error('self-intersection-incomplete');
  return hits;
}
const relevant=hit=>hit.kind==='self_intersection'&&hit.crossing&&!hit.overlap&&
  hit.parts?.split(':')[0]===hit.parts?.split(':')[1]&&
  hit.segments?.length===2&&hit.times?.every(Number.isFinite);
const contactKey=h=>h.kind+':'+h.parts+':'+h.path+':'+h.other;
function noNewContacts(before,after,tolerance){
  return after.every(n=>before.some(o=>contactKey(o)===contactKey(n)&&
    dist(o.point,n.point)<=Math.max(1e-6,tolerance*3)));
}
function crossObjectSafe(doc,index,before,after,tolerance){
  // Conservative full-object broadphase. Dense pages are deferred to manual mode.
  const old=worldPath(before),next=worldPath(after);
  const box=bbox([...vectorCommands(old),...vectorCommands(next)].flatMap(c=>{
    const pts=[];for(let i=1;i<c.length;i+=2)pts.push([c[i],c[i+1]]);
    return pts;
  }));
  let checked=0;
  for(let j=0;j<doc.paths.length;j++){
    if(j===index||doc.paths[j].kind==='image')continue;
    if(!intersect(box,worldBounds(doc.paths[j]),tolerance))continue;
    if(++checked>24) return false;
    const other=worldPath(doc.paths[j]);
    const oldHits=nativeIntersections([old,other],{maxCurves:900,maxIssues:300});
    const newHits=nativeIntersections([next,other],{maxCurves:900,maxIssues:300});
    if(!oldHits.complete||!newHits.complete||!noNewContacts(oldHits,newHits,tolerance))return false;
  }
  return true;
}
function checkedCandidate(doc,index,before,oldHits,candidate,tolerance,preserve){
  if(!candidate||candidate.kind==='image'||candidate.commands?.some(c=>c.slice(1).some(v=>!Number.isFinite(v))))return false;
  const afterHits=intersections(candidate);
  const count=hits=>hits.filter(relevant).length;
  if(count(afterHits)>=count(oldHits)||!noNewContacts(oldHits,afterHits,tolerance))return false;
  if(!areaSafe(before,candidate,tolerance,preserve))return false;
  if(!crossObjectSafe(doc,index,before,candidate,tolerance))return false;
  return true;
}
function handleCandidates(path,hit,parts,tolerance,{Parser}){
  const part=Number(hit.parts.split(':')[0]),segs=parts[part]?.segments||[];
  const ids=[...new Set(hit.segments)];
  const out=[],base=vectorCommands(path);
  for(const ordinal of ids){
    const segment=segs[ordinal],c=segment?.controls;
    if(!c||c.length!==4)continue;
    const line=t=>lerpPoint(c[0],c[3],t),extent=Math.hypot(...[
      Math.max(...c.map(p=>p[0]))-Math.min(...c.map(p=>p[0])),
      Math.max(...c.map(p=>p[1]))-Math.min(...c.map(p=>p[1]))
    ]);
    const maxShift=Math.min(2.5,Math.max(tolerance*6,extent*.40));
    for(const weight of [.10,.20,.35,.50,.70,1]){
      const q1=lerpPoint(c[1],line(1/3),weight),q2=lerpPoint(c[2],line(2/3),weight);
      const changed=Math.max(dist(c[1],q1),dist(c[2],q2));
      if(changed>maxShift||changed<1e-9)continue;
      const commands=structuredClone(base),command=commands[segment.command];
      if(command?.[0]!=='C')continue;
      command.splice(1,4,...q1,...q2);
      try{
        const candidate=finishDeferredCurveCommands(path,commands,path.nodeKinds||{},{Parser});
        out.push({candidate,score:changed*changed,method:'handles',movedMm:changed});
      }catch{/* Unserializable artwork cannot be changed safely. */}
    }
  }
  return out;
}
const asCommand=c=>[c.length===4?'C':c.length===3?'Q':'L',...c.slice(1).flat()];
const tangent=(p,t)=>{
  const c=cubicControls(p),u=1-t;
  return [0,1].map(j=>3*(u*u*(c[1][j]-c[0][j])+2*u*t*(c[2][j]-c[1][j])+t*t*(c[3][j]-c[2][j])));
};
const unit=p=>{const l=Math.hypot(...p);return l>1e-10?p.map(v=>v/l):null;};
function loopCandidates(path,hit,parts,tolerance,{Parser,size,preserve}){
  if(preserve&&(filled(path)||nativeParts(path).some(p=>p.closed)))return [];
  const part=Number(hit.parts.split(':')[0]),segs=parts[part]?.segments||[];
  if(parts[part]?.closed)return [];
  let [i,j]=hit.segments,[t1,t2]=hit.times;
  if(i>j||i===j&&t1>t2){[i,j]=[j,i];[t1,t2]=[t2,t1];}
  const a=segs[i],b=segs[j];
  if(!a||!b||a.command===undefined||b.command===undefined||a.command>b.command||t1<0||t2>1)return [];
  const affected=segs.slice(i,j+1);
  const loopPoints=[];
  for(let n=i;n<=j;n++){
    const s=segs[n],lo=n===i?t1:0,hi=n===j?t2:1;
    for(let k=0;k<=10;k++)loopPoints.push(evaluateBezier(s.controls,lo+(hi-lo)*k/10));
  }
  const envelope=bbox(loopPoints),loopDiameter=Math.hypot(envelope[2]-envelope[0],envelope[3]-envelope[1]);
  const maxSize=size==='micro'?.1:size==='small'?.5:Infinity;
  if(loopDiameter>maxSize||loopDiameter<1e-9)return [];
  const commands=vectorCommands(path),candidates=[];
  for(const window of [.04,.10,.18]){
    const leftT=Math.max(0,t1-window),rightT=Math.min(1,t2+window);
    if(i===j&&rightT<=leftT+1e-5)continue;
    const start=evaluateBezier(a.controls,leftT),end=evaluateBezier(b.controls,rightT);
    const va=unit(tangent(a.controls,leftT)),vb=unit(tangent(b.controls,rightT));
    const chord=dist(start,end);
    if(!va||!vb||chord<1e-9)continue;
    for(const factor of [.20,.34]){
      const h=chord*factor,p1=translate(start,va.map(x=>x*h)),p2=translate(end,vb.map(x=>-x*h));
      const bridge=['C',...p1,...p2,...end];
      const edit=[...commands.slice(0,a.command)];
      if(leftT>1e-8)edit.push(asCommand(bezierPart(a.controls,0,leftT)));
      edit.push(bridge);
      if(rightT<1-1e-8)edit.push(asCommand(bezierPart(b.controls,rightT,1)));
      edit.push(...commands.slice(b.command+1));
      if(edit.length>=commands.length+4)continue;
      try{
        const candidate=finishDeferredCurveCommands(path,edit,path.nodeKinds||{},{Parser});
        // True local deviation bound for the removed arc, including a loop.
        const kept=Array.from({length:23},(_,n)=>evaluateBezier(cubicControls([start,p1,p2,end]),n/22));
        let deviation=0;
        for(const s of affected){
          const lo=s===a?leftT:0,hi=s===b?rightT:1;
          for(let n=0;n<=14;n++){
            const p=evaluateBezier(s.controls,lo+(hi-lo)*n/14);
            deviation=Math.max(deviation,Math.min(...kept.map(q=>dist(p,q))));
          }
        }
        if(deviation>Math.max(tolerance*6,loopDiameter*.38))continue;
        candidates.push({candidate,score:deviation*deviation+chord*chord*.00001,
          method:'loops',movedMm:deviation});
      }catch{/* Unsupported artwork is never rewritten without its paint. */}
    }
  }
  return candidates;
}
export function repairSelfIntersections(source,indices,tolerance,{
  mode='hybrid',size='all',preserve=true,Parser=globalThis.DOMParser,
  maxRepairs=24,maxPaths=300
}={}){
  if(!(tolerance>0&&Number.isFinite(tolerance)&&tolerance<=1000))throw Error('Неверный допуск самопересечений');
  if(!['hybrid','handles','loops'].includes(mode)||!['micro','small','all'].includes(size))
    throw Error('Неверный режим исправления самопересечений');
  const document=structuredClone(source),stats={
    detected:0,correctedHandles:0,removedLoops:0,skipped:0,limited:0,maxDeviationMm:0
  };
  let checked=0,completed=0;
  for(const index of new Set(indices)){
    if(++checked>maxPaths){stats.limited++;break;}
    let path=document.paths[index];
    if(!path||path.kind==='image')continue;
    let ignored=new Set();
    try{
      const parts=nativeParts(path);
      if(parts.reduce((n,p)=>n+p.segments.length,0)>720){stats.limited++;continue;}
      if(!parts.some(p=>p.segments.length>2||p.segments.some(s=>s.controls.length===4)))continue;
      for(let attempts=0;attempts<maxRepairs;attempts++){
        const oldHits=intersections(path);
        const hit=oldHits.filter(relevant).find(h=>{
          const key=h.parts+':'+h.segments.join(':')+':'+h.point.map(v=>v.toFixed(5)).join(':');
          return !ignored.has(key);
        });
        if(!hit)break;
        const key=hit.parts+':'+hit.segments.join(':')+':'+hit.point.map(v=>v.toFixed(5)).join(':');
        stats.detected++;
        const geometry=nativeParts(path);
        let accepted=null;
        const check=items=>{
          for(const item of items.sort((a,b)=>a.score-b.score)){
            try{
              if(checkedCandidate(document,index,path,oldHits,item.candidate,tolerance,preserve))return item;
            }catch{/* Exact kernel uncertainty is a veto. */}
          }
          return null;
        };
        if(mode!=='loops')accepted=check(handleCandidates(path,hit,geometry,tolerance,{Parser}));
        if(!accepted&&mode!=='handles')
          accepted=check(loopCandidates(path,hit,geometry,tolerance,{Parser,size,preserve}));
        if(!accepted){ignored.add(key);stats.skipped++;continue;}
        document.paths[index]=path=accepted.candidate;
        if(accepted.method==='handles')stats.correctedHandles++;
        else stats.removedLoops++;
        stats.maxDeviationMm=Math.max(stats.maxDeviationMm,accepted.movedMm);
        ignored=new Set();
        if(++completed>=maxRepairs){stats.limited++;break;}
      }
    }catch{stats.skipped++;} // No ambiguous candidate may replace source.
  }
  return {document,stats};
}
