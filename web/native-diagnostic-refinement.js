import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.51';
import {nativeParts,evaluateBezier,pointDistance} from './native-bezier.js?v=0.2.0-alpha.51';
// The Rust polyline engine remains useful for its other diagnostic classes.
// Crossings/overlaps are replaced by witnessed native-curve locations across
// the selected document, eliminating invented sampling-chord intersections.
export function refineNativeDiagnostics(document,issues,indices=null,tolerance=.01){
 if(!Number.isFinite(tolerance)||tolerance<=0)throw Error('invalid-native-diagnostic-tolerance');
 const scope=indices||document.paths.map((_,i)=>i),paths=scope.map(i=>document.paths[i]);
 const native=nativeIntersections(paths,{allowPartial:true});
 const result=issues.filter(i=>!['intersection','self_intersection','overlap','coincident','short'].includes(i.kind));
 const cells=new Map();let partId=0,work=0;
 paths.forEach((path,owner)=>nativeParts(path).forEach(part=>{
  const points=part.segments.map(s=>s.controls[0]);
  if(!part.closed&&part.segments.length)points.push(part.segments.at(-1).controls.at(-1));
  const id=partId++,n=points.length;
  const push=i=>{if(result.length<10000)result.push({...i,nativeWitness:true});else native.complete=false;};
  // The control polygon bounds the arc length from above. A short run
  // along the contour is not a second branch, even with intervening anchors.
  const forward=[0],reverse=[0];
  const lengths=part.segments.map(({controls})=>controls.slice(1).reduce(
    (sum,p,i)=>sum+pointDistance(controls[i],p),0));
  for(let i=0;i<lengths.length;i++){
   forward.push(forward.at(-1)+lengths[i]);reverse.push(reverse.at(-1)+lengths[lengths.length-1-i]);
  }
  const lengthError=4*Number.EPSILON*(lengths.length+1)*forward.at(-1);
  part.segments.forEach((s,segment)=>{
   if(s.controls.every(p=>pointDistance(p,s.controls[0])<=tolerance))push({kind:'short',path:scope[owner],other:scope[owner],segment,point:evaluateBezier(s.controls,.5),nodePoints:[s.controls[0],s.controls.at(-1)]});
  });
  points.forEach((point,index)=>{
   if(work>=2000000){native.complete=false;return;}
   const x=Math.floor(point[0]/tolerance),y=Math.floor(point[1]/tolerance);
   for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of cells.get((x+dx)+':'+(y+dy))||[]){
    if(++work>2000000){native.complete=false;return;}
    const samePart=other.part===id, delta=index-other.index;
    if(samePart&&(delta===1||part.closed&&delta===n-1))continue;
    const distanceMm=pointDistance(other.point,point);
    if(distanceMm>tolerance)continue;
    // A repair tolerance is not the definition of coincident coordinates.
    // Bound numerical equality by coordinate roundoff and a hard mm cap.
    const roundoff=Math.min(1e-8,8*Number.EPSILON*Math.max(1,Math.abs(point[0]),Math.abs(point[1]),Math.abs(other.point[0]),Math.abs(other.point[1])));
    const coincident=distanceMm<=roundoff;
    if(!coincident){
     // Separate contours are checked by curve clearance, not anchor spacing.
     if(!samePart)continue;
     const along=forward[index]-forward[other.index];
     const seam=part.closed?forward[other.index]+reverse[lengths.length-index]:Infinity;
     if(Math.min(along,seam)+lengthError<=tolerance)continue;
    }
    push({kind:coincident?'coincident':'near_node',path:scope[owner],other:scope[other.owner],
     segment:index,otherSegment:other.index,point:[...point],nodePoints:[[...point],[...other.point]],distanceMm});
   }
   const key=x+':'+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push({point,index,part:id,owner});
  });
 }));
 const seen=new Set();
 for(const i of native){
  if(!i.crossing&&!i.overlap)continue;
  const kind=i.overlap?'overlap':i.kind,path=scope[i.path],other=scope[i.other],key=[kind,Math.min(path,other),Math.max(path,other),...i.point.map(v=>Math.round(v*1e8))].join(':');
  if(seen.has(key))continue;seen.add(key);
  if(result.length>=10000){native.complete=false;break;}
  result.push({kind,path,other,point:i.point,segment:0,otherSegment:0,nativeWitness:true});
 }
 return {issues:result,complete:native.complete,unresolved:native.unresolved,nativeLocations:native.length};
}
