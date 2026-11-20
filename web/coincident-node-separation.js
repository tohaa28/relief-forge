import {curveNodes,moveCurveNode} from './curve-edit.js?v=0.2.0-alpha.71';
import {nativeParts,controlsBounds,pointDistance} from './native-bezier.js?v=0.2.0-alpha.71';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.71';

// Automatic surgery only, never invoked from pointermove/pointerup.
// No flattening, no added anchors, no global retracing. The exact native
// intersection kernel vetoes unsafe changes; rejected candidates are inert.
const close=(a,b,epsilon)=>pointDistance(a,b)<=epsilon;
const boundsOverlap=(a,b,epsilon=1e-9)=>a[0]<=b[2]+epsilon&&b[0]<=a[2]+epsilon&&
  a[1]<=b[3]+epsilon&&b[1]<=a[3]+epsilon;
const unionBounds=(a,b)=>[Math.min(a[0],b[0]),Math.min(a[1],b[1]),
  Math.max(a[2],b[2]),Math.max(a[3],b[3])];
const shifted=(p,d)=>[p[0]+d[0],p[1]+d[1]];
const withBounds=s=>({...s,bounds:controlsBounds(s.controls)});
function segmentsOf(path){
  const parts=nativeParts(path);
  const all=[],byPart=[];
  parts.forEach((p,part)=>{
    const rows=p.segments.map((s,ordinal)=>{
      const entry=withBounds({...s,id:all.length,part,ordinal,count:p.segments.length,
        closed:p.closed,controls:s.controls.map(q=>q.slice())});
      all.push(entry);return entry;
    });
    byPart.push(rows);
  });
  return {all,byPart,parts};
}
function incident(node,geometry){
  const rows=geometry.byPart[node.part]||[];
  return [node.ordinal?rows[node.ordinal-1]:geometry.parts[node.part]?.closed?rows.at(-1):null,
    rows[node.ordinal]||null].filter(Boolean);
}
function adjacentNodes(a,b,partCount,closed){
  if(a.part!==b.part)return false;
  const gap=Math.abs(a.ordinal-b.ordinal);
  return gap<=1||(closed&&gap===partCount-1);
}
function nextPair(path,tolerance,ignored,includeNearby){
  const nodes=curveNodes(path),epsilon=Math.max(1e-9,Math.min(1e-6,tolerance*1e-3));
  const bins=new Map(),partCounts=new Map(),closedParts=new Set();
  for(const node of nodes)partCounts.set(node.part,(partCounts.get(node.part)||0)+1);
  const raw=nativeParts(path);
  raw.forEach((p,i)=>{if(p.closed)closedParts.add(i);});
  const width=includeNearby?tolerance:epsilon;
  const lengths=raw.map(part=>part.segments.reduce((s,{controls})=>{
    const length=controls.slice(1).reduce((sum,p,i)=>sum+pointDistance(p,controls[i]),0);
    s.push(s.at(-1)+length);
    return s;
  },[0]));
  const cell=p=>[Math.floor(p[0]/width),Math.floor(p[1]/width)];
  for(const node of nodes){
    const [x,y]=cell(node.point);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const other of bins.get((x+dx)+':'+(y+dy))||[]){
        const gap=pointDistance(node.point,other.point);
        if(gap>width)continue;
        const nearby=gap>epsilon;
        if(nearby){
          if(!includeNearby||node.part!==other.part)continue;
          const arc=lengths[node.part],part=raw[node.part];
          if(!part.closed&&other.ordinal===0&&node.ordinal===part.segments.length)continue;
          const along=arc[node.ordinal]-arc[other.ordinal];
          if(Math.min(along,part.closed?arc.at(-1)-along:Infinity)<=tolerance)continue;
        }
        if(adjacentNodes(node,other,partCounts.get(node.part),closedParts.has(node.part)))continue;
        const key=Math.min(node.index,other.index)+':'+Math.max(node.index,other.index);
        if(!ignored.has(key))return {first:other,second:node,key,gap,nearby};
      }
    }
    const k=x+':'+y;if(!bins.has(k))bins.set(k,[]);bins.get(k).push(node);
  }
  return null;
}
function moveIncident(geometry,node,delta){
  const edits=new Map(),rows=geometry.byPart[node.part],outbound=rows[node.ordinal]||null;
  const inbound=node.ordinal?rows[node.ordinal-1]:
    geometry.parts[node.part]?.closed?rows.at(-1):null;
  // A single closed segment is a special curve, not a detachable junction.
  if(inbound&&outbound&&inbound.id===outbound.id)return null;
  for(const seg of [inbound,outbound]){
    if(!seg||edits.has(seg.id))continue;
    const copy={...seg,controls:seg.controls.map(q=>q.slice())};
    if(seg.id===inbound?.id){
      const end=copy.controls.length-1;
      copy.controls[end]=shifted(copy.controls[end],delta);
      if(end>1)copy.controls[end-1]=shifted(copy.controls[end-1],delta);
    }
    if(seg.id===outbound?.id){
      copy.controls[0]=shifted(copy.controls[0],delta);
      if(copy.controls.length>2)copy.controls[1]=shifted(copy.controls[1],delta);
    }
    edits.set(seg.id,withBounds(copy));
  }
  return edits;
}
function nativeSegmentPath(s){
  const p=s.controls,c=p.slice(1).flat();
  return {kind:'vector',artwork:'<path/>',offset:[0,0],
    commands:[['M',...p[0]],[p.length===4?'C':p.length===3?'Q':'L',...c]]};
}
function adjacentSegments(a,b){
  if(a.part!==b.part)return false;
  const gap=Math.abs(a.ordinal-b.ordinal);
  return gap===1||(a.closed&&gap===a.count-1);
}
function joinedAt(a,b,point,epsilon){
  for(const x of [a.controls[0],a.controls.at(-1)])
    for(const y of [b.controls[0],b.controls.at(-1)])
      if(close(x,y,epsilon)&&close(x,point,epsilon))return true;
  return false;
}
function localIssues(rows){
  const raw=nativeIntersections(rows.map(nativeSegmentPath),
    {maxCurves:128,maxIssues:1500});
  if(!raw.complete)throw Error('incomplete-local-native-intersections');
  // Include loops born inside a single changed cubic, not just pairs.
  return raw.map(issue=>({
    a:rows[issue.path],b:rows[issue.other],point:issue.point,overlap:issue.overlap
  }));
}
function candidateSafe(geometry,first,second,edits,tolerance){
  if(!edits?.size)return false;
  const moved=new Set(edits.keys()),firstIds=new Set(incident(first,geometry).map(s=>s.id)),
    secondIds=new Set(incident(second,geometry).map(s=>s.id));
  const changed=Array.from(moved).map(i=>edits.get(i));
  const swept=changed.reduce((box,s)=>unionBounds(box,
    unionBounds(geometry.all[s.id].bounds,s.bounds)),changed[0].bounds);
  const near=geometry.all.filter(s=>moved.has(s.id)||firstIds.has(s.id)||
    secondIds.has(s.id)||boundsOverlap(s.bounds,swept));
  // Bounded expensive work. In a highly dense graphic, report skipped.
  if(near.length>96)return false;
  const after=near.map(s=>edits.get(s.id)||s);
  const beforeHits=localIssues(near),afterHits=localIssues(after);
  const issues=new Map();
  const key=(a,b)=>Math.min(a.id,b.id)+':'+Math.max(a.id,b.id);
  for(const hit of beforeHits){
    const k=key(hit.a,hit.b);
    if(!issues.has(k))issues.set(k,[]);
    issues.get(k).push(hit);
  }
  for(const hit of afterHits){
    const a=hit.a,b=hit.b;
    if(!moved.has(a.id)&&!moved.has(b.id))continue;
    const contact=firstIds.has(a.id)&&secondIds.has(b.id)||
      firstIds.has(b.id)&&secondIds.has(a.id);
    if(contact)return false; // The two non-adjacent branches still touch/cross.
    const jointEpsilon=Math.max(1e-8,tolerance*1e-6);
    if(adjacentSegments(a,b)&&joinedAt(a,b,hit.point,jointEpsilon))continue;
    const previous=issues.get(key(a,b))||[];
    // Existing, unrelated crossings are not silently counted as new ones.
    if(!previous.some(x=>pointDistance(x.point,hit.point)<=Math.max(1e-7,tolerance*3)))
      return false;
  }
  return true;
}
function balancedCorrection(path,pair,tolerance,geometry,directions){
  const nodes=[pair.first,pair.second],anchors=curveNodes(path);
  const arms=nodes.map(node=>incident(node,geometry));
  const minLengths=arms.map(rows=>Math.min(...rows.map(s=>pointDistance(s.controls[0],s.controls.at(-1)))));
  if(arms.some(rows=>!rows.length)||minLengths.some(n=>n<=1e-9))return null;
  const required=tolerance-pair.gap+tolerance*.001;
  const heading=pair.gap>0?Math.atan2(pair.second.point[1]-pair.first.point[1],
    pair.second.point[0]-pair.first.point[0]):0;
  const directionAt=d=>[d[0]*Math.cos(heading)-d[1]*Math.sin(heading),
    d[0]*Math.sin(heading)+d[1]*Math.cos(heading)];
  for(const factor of [.53,.7,1]){
    const radius=required*factor;
    if(radius>tolerance||minLengths.some(n=>radius>n*.25))continue;
    for(const direction of directions){
      const vector=directionAt(direction).map(v=>v*radius);
      const moves=nodes.map((node,i)=>({node,delta:vector.map(v=>i?v:-v)}));
      const targets=moves.map(({node,delta})=>shifted(node.point,delta));
      if(pointDistance(...targets)<=tolerance)continue;
      if(moves.some(({node},i)=>anchors.some(anchor=>{
        const part=geometry.parts[node.part],count=part.segments.length+(part.closed?0:1);
        return anchor.part===node.part&&!nodes.some(n=>n.index===anchor.index)&&
          !adjacentNodes(anchor,node,count,part.closed)&&
          pointDistance(anchor.point,node.point)>tolerance&&
          pointDistance(anchor.point,targets[i])<=tolerance;
      })))continue;
      const edits=moves.map(({node,delta})=>moveIncident(geometry,node,delta));
      if(edits.some(edit=>!edit)||[...edits[0].keys()].some(id=>edits[1].has(id)))continue;
      try{
        if(candidateSafe(geometry,pair.first,pair.second,new Map(edits.flatMap(edit=>[...edit])),tolerance))
          return {moves,radius};
      }catch{continue;}
    }
  }
  return null;
}
function findCorrection(path,pair,tolerance,allowBalanced){
  const geometry=segmentsOf(path);
  const candidates=[pair.first,pair.second];
  const anchors=pair.nearby?curveNodes(path):[];
  const scales=[1.05,1.4,2,3];
  const directions=Array.from({length:16},(_,i)=>{
    const angle=2*Math.PI*i/16;return [Math.cos(angle),Math.sin(angle)];
  });
  let best=null;
  for(const scale of scales){
    const radius=pair.nearby?Math.min(tolerance,scale*(tolerance-pair.gap+tolerance*.001)):scale*tolerance;
    for(const node of candidates){
      const arms=incident(node,geometry);
      if(!arms.length)continue;
      const lengths=arms.map(s=>pointDistance(s.controls[0],s.controls.at(-1)))
        .filter(n=>n>1e-9);
      if(!lengths.length||radius>Math.min(...lengths)*0.25)continue;
      for(const direction of directions){
        const delta=direction.map(v=>v*radius);
        const other=node===pair.first?pair.second:pair.first;
        const target=shifted(node.point,delta);
        if(pointDistance(target,other.point)<=tolerance)continue;
        const part=geometry.parts[node.part],count=part.segments.length+(part.closed?0:1);
        if(anchors.some(anchor=>anchor.part===node.part&&
          !adjacentNodes(anchor,node,count,part.closed)&&
          pointDistance(anchor.point,node.point)>tolerance&&
          pointDistance(anchor.point,target)<=tolerance))continue;
        const edits=moveIncident(geometry,node,delta);
        try{
          if(!candidateSafe(geometry,pair.first,pair.second,edits,tolerance))continue;
        }catch{continue;} // Geometry ambiguity never authorizes a repair.
        const distortion=arms.reduce((sum,s)=>sum+1/Math.max(
          pointDistance(s.controls[0],s.controls.at(-1))**2,1e-9),0);
        const score=radius*radius*distortion;
        if(!best||score<best.score)best={node,delta,score};
      }
    }
    if(best)break; // Never choose a larger displacement than necessary.
  }
  if(best)return {moves:[best],radius:Math.hypot(...best.delta)};
  return allowBalanced?balancedCorrection(path,pair,tolerance,geometry,directions):null;
}
export function separateCoincidentNonadjacentNodes(source,indices,tolerance,
  {Parser=globalThis.DOMParser,maxRepairs=64,includeNearby=false}={}){
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1000)
    throw Error('Неверный допуск разведения несоседних узлов');
  const document=structuredClone(source),stats={detected:0,separated:0,skipped:0,
    movedMm:0,limited:0,separatedNearby:0,balanced:0};
  for(const index of new Set(indices)){
    const path=document.paths[index];
    if(!path||path.kind==='image'||!path.artwork&&(!path.points||path.points.length<4))continue;
    const ignored=new Set();
    try{
      for(let count=0;count<maxRepairs;count++){
        const pair=nextPair(document.paths[index],tolerance,ignored,includeNearby);
        if(!pair)break;
        stats.detected++;
        const candidate=findCorrection(document.paths[index],pair,tolerance,includeNearby);
        if(!candidate){
          ignored.add(pair.key);stats.skipped++;continue;
        }
        document.paths[index]=candidate.moves.reduce((path,{node,delta})=>
          moveCurveNode(path,node.index,shifted(node.point,delta),{Parser}),document.paths[index]);
        stats.separated++;
        if(candidate.moves.length===2)stats.balanced++;
        if(pair.nearby)stats.separatedNearby++;
        stats.movedMm=Math.max(stats.movedMm,
          candidate.radius);
        ignored.clear();
      }
      if(nextPair(document.paths[index],tolerance,ignored,includeNearby))stats.limited++;
    }catch{
      // Keep already validated changes, but never publish a partial failed move.
      stats.skipped++;
    }
  }
  return {document,stats};
}
