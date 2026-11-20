import {nativeParts,controlsBounds,pointDistance,evaluateBezier} from './native-bezier.js?v=0.2.0-alpha.72';

// A manual edit never starts the full-document Rust/Union/optimizer pipeline.
// Re-evaluate only the native Bézier witnesses near the pointer, preserving
// untouched warnings elsewhere. Unsupported classes are NEVER marked healed
// merely because this focused pass cannot certify them.
const LOCAL_KINDS=new Set(['open','short','coincident','near_node']);
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const near=(a,b,r)=>pointDistance(a,b)<=r;
const roundoff=(a,b)=>Math.min(1e-8,8*Number.EPSILON*Math.max(1,...a.map(Math.abs),...b.map(Math.abs)));
const key=i=>[i.kind,i.path,i.other,...i.point.map(n=>Math.round(n*1e8))].join(':');

export function localNodeRadius(unitsPerPixel,tolerance=.01,pixels=36){
  // One screen-sized neighbourhood, not an entire imported EPS contour.
  return Math.max(1e-5,unitsPerPixel*pixels,3*tolerance);
}

export function diagnoseLocalNodeArea(document,previous=[],{
  path,point,radius,tolerance=.01,maxAnchors=5000
}={}){
  if(!Number.isInteger(path)||path<0||path>=document.paths.length||
     !finitePoint(point)||!Number.isFinite(radius)||radius<=0||
     !Number.isFinite(tolerance)||tolerance<=0)
    return {issues:previous,verified:false,reason:'invalid-local-focus'};
  const relevant=new Set([path]);
  for(const old of previous){
    if(near(old.point,point,radius)&&(old.path===path||old.other===path)){
      if(Number.isInteger(old.path))relevant.add(old.path);
      if(Number.isInteger(old.other))relevant.add(old.other);
    }
  }
  // An affected problem may involve one opposing contour. Do not pull the
  // whole drawing into the local task on a large/complex document.
  if(relevant.size>4)return {issues:previous,verified:false,reason:'too-many-neighbouring-objects'};
  const found=[],anchors=[],margin=radius+tolerance;
  let examined=0;
  try{
    let globalPart=0;
    for(const owner of relevant){
      const vector=document.paths[owner];
      if(!vector||vector.kind==='image')continue;
      for(const part of nativeParts(vector)){
        const partId=globalPart++;
        if(!part.segments.length)continue;
        const lengths=part.segments.map(s=>s.controls.slice(1).reduce(
          (sum,p,i)=>sum+pointDistance(s.controls[i],p),0));
        const prefix=[0];
        for(const len of lengths)prefix.push(prefix.at(-1)+len);
        const total=prefix.at(-1);
        const vertices=part.segments.map(s=>s.controls[0]);
        if(!part.closed)vertices.push(part.segments.at(-1).controls.at(-1));
        if(!part.closed&&near(part.start,point,margin))
          found.push({kind:'open',path:owner,other:owner,
            point:[...part.start],a:0,b:vertices.length-1,nativeWitness:true});
        for(const [index,segment] of part.segments.entries()){
          const box=controlsBounds(segment.controls);
          if(box[0]>point[0]+margin||box[2]<point[0]-margin||
             box[1]>point[1]+margin||box[3]<point[1]-margin)continue;
          examined++;
          if(segment.controls.every(p=>pointDistance(p,segment.controls[0])<=tolerance)){
            const midpoint=evaluateBezier(segment.controls,.5);
            if(near(midpoint,point,radius))
              found.push({kind:'short',path:owner,other:owner,
                point:midpoint,segment:index,nativeWitness:true});
          }
        }
        vertices.forEach((p,index)=>{
          if(near(p,point,margin))
            anchors.push({p,owner,part:partId,index,n:vertices.length,
              closed:part.closed,along:prefix[index],length:total});
        });
      }
    }
  }catch(error){
    return {issues:previous,verified:false,reason:'native-local-geometry: '+error.message};
  }
  if(anchors.length>maxAnchors)
    return {issues:previous,verified:false,reason:'dense-local-region'};
  // Spatial buckets; complexity depends on nodes near the pointer, not on
  // the total document node count or number of Bézier subdivisions elsewhere.
  const cells=new Map();let comparisons=0;
  for(const a of anchors){
    const x=Math.floor(a.p[0]/tolerance),y=Math.floor(a.p[1]/tolerance);
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
      for(const b of cells.get((x+dx)+':'+(y+dy))||[]){
        if(++comparisons>150000)
          return {issues:previous,verified:false,reason:'dense-pair-budget'};
        const d=pointDistance(a.p,b.p);
        if(d>tolerance)continue;
        const samePart=a.part===b.part,delta=Math.abs(a.index-b.index);
        if(samePart&&(delta===1||a.closed&&delta===a.n-1))continue;
        const coincident=d<=roundoff(a.p,b.p);
        if(!coincident){
          if(!samePart)continue;
          const along=Math.abs(a.along-b.along);
          if(Math.min(along,a.closed?a.length-along:Infinity)<=tolerance)continue;
        }
        if(!near(a.p,point,radius)&&!near(b.p,point,radius))continue;
        found.push({kind:coincident?'coincident':'near_node',
          path:a.owner,other:b.owner,point:[...a.p],
          nodePoints:[[...a.p],[...b.p]],distanceMm:d,nativeWitness:true});
      }
    }
    const k=x+':'+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(a);
  }
  const preserved=previous.filter(i=>
    !LOCAL_KINDS.has(i.kind)||!near(i.point,point,radius)||
    !relevant.has(i.path)||!relevant.has(i.other));
  const unique=new Map();
  for(const item of [...preserved,...found])unique.set(key(item),item);
  return {issues:[...unique.values()],verified:true,
    examined,anchors:anchors.length,comparisons,localCount:found.length,
    radius,scope:[...relevant],partial:true};
}
