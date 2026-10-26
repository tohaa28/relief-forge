import {geometryCommands} from './eps-export.js';
import {sampledContours} from './rich-svg.js';
import {filledPathsOverlap,unionFilledPaths,findUnionEquivalentSource} from './polygon-union.js?v=0.2.0-alpha.42';
import {isUnchangedUnion} from './union-refit.js';
import {deduplicateExactVectors} from './exact-native-dedup.js';
// Clipper performs true area union for *closed filled* Bézier polygons,
// including holes. Unfilled strokes retain their original cubic path data.
// No paint-mode conversion or joining unlike-colored artwork.
const EPS=1e-8;
const cross=(a,b,c,d)=>(b[0]-a[0])*(d[1]-c[1])-(b[1]-a[1])*(d[0]-c[0]);
const eq=(a,b)=>Math.abs(a[0]-b[0])<EPS&&Math.abs(a[1]-b[1])<EPS;
function intersection(a,b,c,d){
  const x=cross(a,b,a,c),y=cross(a,b,a,d),z=cross(c,d,c,a),w=cross(c,d,c,b);
  if(x*y<0&&z*w<0)return true;
  return Math.abs(x)<EPS&&onSegment(c,a,b)||Math.abs(y)<EPS&&onSegment(d,a,b)||
    Math.abs(z)<EPS&&onSegment(a,c,d)||Math.abs(w)<EPS&&onSegment(b,c,d);
}
const onSegment=(p,a,b)=>p[0]>=Math.min(a[0],b[0])-EPS&&p[0]<=Math.max(a[0],b[0])+EPS&&
  p[1]>=Math.min(a[1],b[1])-EPS&&p[1]<=Math.max(a[1],b[1])+EPS;
function contained(q,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[1]>q[1])!==(b[1]>q[1])&&
      q[0]<(b[0]-a[0])*(q[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function sampledGeometry(path,tol){
  try{
    const parts=sampledContours(path,Math.max(.002,Math.min(.1,tol)));
    if(parts.reduce((n,p)=>n+p.points.length,0)>(filledEligible(path)?25000:850))return null;
    const points=parts.flatMap(x=>x.points);
    if(!points.length)return null;
    return {parts,bbox:{minX:Math.min(...points.map(p=>p[0])),
      maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),
      maxY:Math.max(...points.map(p=>p[1]))}};
  }catch{return null;}
}
function overlaps(a,b){
  const x=a.bbox,y=b.bbox;
  if(x.maxX<y.minX+EPS||y.maxX<x.minX+EPS||x.maxY<y.minY+EPS||y.maxY<x.minY+EPS)return false;
  for(const p of a.parts)for(const q of b.parts){
    const segs=r=>r.points.slice(1).map((v,i)=>[r.points[i],v])
      .concat(r.closed&&r.points.length>2?[[r.points.at(-1),r.points[0]]]:[]);
    for(const [u,v] of segs(p))for(const [w,z] of segs(q))
      if(intersection(u,v,w,z))return true;
    if(p.closed&&q.closed&&p.points.length>2&&q.points.length>2&&
      (contained(p.points[0],q.points)||contained(q.points[0],p.points)))return true;
  }
  return false;
}
function isSimpleColor(path){
  if(path.kind==='image'||path.paint?.unsupported||
     Number(path.paint?.opacity??1)!==1||Number(path.paint?.fillOpacity??1)!==1||
     Number(path.paint?.strokeOpacity??1)!==1)return false;
  if(path.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\(|stroke="url\()/i.test(path.artwork))return false;
  return true;
}
function filledEligible(path){
  const paint=path.paint;
  return path.kind!=='image'&&paint&&typeof paint.fill==='string'&&
    paint.fill.toLowerCase()!=='none'&&(!paint.stroke||paint.stroke.toLowerCase()==='none')&&
    !paint.unsupported&&path.closed===true&&Number(paint.opacity??1)===1&&
    Number(paint.fillOpacity??1)===1;
}
function styleKey(p){
  return JSON.stringify(p.paint||{fill:'none',stroke:'#000000',strokeWidthMm:.1});
}
function simpleRect(path){
  const commands=geometryCommands(path).filter(c=>c[0]!=='Z');
  if(commands.length!==5&&commands.length!==4)return null;
  if(commands[0][0]!=='M'||commands.slice(1).some(c=>c[0]!=='L'))return null;
  const pts=commands.map(c=>c.slice(1));
  if(pts.length===5&&eq(pts[0],pts.at(-1)))pts.pop();
  if(pts.length!==4)return null;
  const xs=[...new Set(pts.map(x=>x[0]))],ys=[...new Set(pts.map(x=>x[1]))];
  if(xs.length!==2||ys.length!==2||!commands.some(c=>c[0]==='M'))return null;
  for(let i=0;i<4;i++){
    const a=pts[i],b=pts[(i+1)%4];if(a[0]!==b[0]&&a[1]!==b[1])return null;
  }
  return {x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
}
function rectangleUnionCommands(rectangles){
  const xs=[...new Set(rectangles.flatMap(r=>[r.x0,r.x1]))].sort((a,b)=>a-b);
  const ys=[...new Set(rectangles.flatMap(r=>[r.y0,r.y1]))].sort((a,b)=>a-b);
  if(xs.length*ys.length>20000)throw Error('Слишком много областей для объединения');
  const inside=(i,j)=>{
    if(i<0||j<0||i>=xs.length-1||j>=ys.length-1)return false;
    const x=(xs[i]+xs[i+1])/2,y=(ys[j]+ys[j+1])/2;
    return rectangles.some(r=>x>r.x0&&x<r.x1&&y>r.y0&&y<r.y1);
  };
  const edges=[],put=(a,b)=>edges.push([a,b]);
  for(let j=0;j<ys.length-1;j++)for(let i=0;i<xs.length-1;i++){
    if(!inside(i,j))continue;
    if(!inside(i,j-1))put([xs[i],ys[j]],[xs[i+1],ys[j]]);
    if(!inside(i+1,j))put([xs[i+1],ys[j]],[xs[i+1],ys[j+1]]);
    if(!inside(i,j+1))put([xs[i+1],ys[j+1]],[xs[i],ys[j+1]]);
    if(!inside(i-1,j))put([xs[i],ys[j+1]],[xs[i],ys[j]]);
  }
  const k=p=>p.join(','),next=new Map();
  for(const [a,b] of edges){const key=k(a);
    if(next.has(key))throw Error('Неоднозначное соприкосновение прямоугольников');
    next.set(key,b);
  }
  const out=[],seen=new Set();
  for(const [a] of edges){
    if(seen.has(k(a)))continue;
    const start=k(a),ring=[a],local=new Set();let cur=a;
    while(true){
      const key=k(cur),target=next.get(key);
      if(!target||local.has(key))throw Error('Незамкнутая граница объединения');
      local.add(key);seen.add(key);cur=target;
      if(k(cur)===start)break;
      ring.push(cur);
      if(ring.length>edges.length)throw Error('Ошибка обхода объединения');
    }
    // Remove redundant collinear points, preserving exact rectangular steps.
    const filtered=ring.filter((p,i)=>{
      const prev=ring[(i-1+ring.length)%ring.length],next=ring[(i+1)%ring.length];
      return Math.abs(cross(prev,p,p,next))>EPS;
    });
    if(filtered.length<3)throw Error('В объединении обнаружена вырожденная область');
    out.push(['M',...filtered[0]],...filtered.slice(1).map(p=>['L',...p]),['Z']);
  }
  return out;
}
function asCompound(group){
  const same=styleKey(group[0]);
  const seen=new Set(),commands=[];let removedExact=0;
  for(const path of group){
    if(styleKey(path)!==same)throw Error('Различающиеся цвета нельзя слить без изменения вида');
    const c=geometryCommands(path),key=JSON.stringify(c);
    if(seen.has(key)){removedExact++;continue;}
    seen.add(key);commands.push(...c);
  }
  const d=commands.map(c=>c.join(' ')).join(' ');
  return {path:{kind:'vector',commands,offset:[0,0],
    points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
    closed:commands.at(-1)?.[0]==='Z',
    paint:group[0].paint?structuredClone(group[0].paint):undefined,
    artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'},
    removedExact,welded:false};
}
export function mergeOverlappingObjects(document,{tolerance=.01,cleanupTolerance=tolerance,indices=null}={}){
  if(!Array.isArray(document?.paths))throw Error('Документ не содержит векторных объектов');
  // Exact opaque native duplicates are an independent, already-valid stage.
  // A later failed or node-inflating Union must never restore these copies.
  const exact=deduplicateExactVectors(document,{indices});
  const doc=exact.document,pathCount=doc.paths.length;
  const selected=indices?new Set(exact.keptOriginalIndices.flatMap((old,i)=>
    indices.includes(old)?[i]:[])):null;
  const normalizationCandidates=new Set(doc.paths.filter((_,i)=>!selected||selected.has(i)));
  const geometry=doc.paths.map((p,i)=>isSimpleColor(p)&&(!selected||selected.has(i))?
    sampledGeometry(p,tolerance):null);
  const parent=doc.paths.map((_,i)=>i);
  function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  const join=(i,j)=>{const a=root(i),b=root(j);if(a!==b)parent[b]=a;};
  let candidatePairs=0;
  for(let i=0;i<pathCount;i++)for(let j=i+1;j<pathCount;j++){
    if(!geometry[i]||!geometry[j]||styleKey(doc.paths[i])!==styleKey(doc.paths[j]))continue;
    if(++candidatePairs>25000)throw Error('Очень много сочетаний наложенных объектов');
    if(filledEligible(doc.paths[i])&&filledEligible(doc.paths[j])){
      try{
        if(filledPathsOverlap(doc.paths[i],doc.paths[j],{tolerance}))join(i,j);
      }catch{
        // A failed polygon evaluation never licenses an unsafe merge.
      }
    }else if(overlaps(geometry[i],geometry[j]))join(i,j);
  }
  const groups=new Map();
  for(let i=0;i<pathCount;i++){const id=root(i);
    if(!groups.has(id))groups.set(id,[]);groups.get(id).push(i);}
  let mergedObjects=0,removedExact=0,weldedGroups=0,skipped=0,holes=0,flattenedVertices=0;
  const cleanupStats={coincident:0,collinear:0,short:0,shortEdgesRemaining:0,reverted:0,before:0,after:0};
  const addCleanup=stats=>{if(!stats)return;for(const k of ['coincident','collinear','short','before','after'])cleanupStats[k]+=stats[k]||0;cleanupStats.shortEdgesRemaining+=stats.shortEdgesRemaining||0;cleanupStats.reverted+=Number(stats.reverted);};
  const replacements=new Map(),drop=new Set();
  for(const ids of groups.values()){
    if(ids.length<2)continue;
    try{
      const group=ids.map(i=>doc.paths[i]);
      const allFilled=group.every(filledEligible);
      // Identical cubic geometries can be deduplicated exactly, retaining
      // every original Bézier control point without flattening.
      const identical=group.every(p=>JSON.stringify(geometryCommands(p))===
        JSON.stringify(geometryCommands(group[0])));
      let out;
      if(allFilled&&!identical){
        const dominant=findUnionEquivalentSource(group,{tolerance});
        if(dominant>=0){
          // Existing source curve already represents the whole filled area.
          // Preserve every native Bézier handle; do not polygonize it.
          out={welded:true,removedExact:0,path:structuredClone(group[dominant]),
            holes:0,vertices:0};
        }else{
        const welded=unionFilledPaths(group,{tolerance,cleanupTolerance});
        addCleanup(welded.cleanup);
        const d=welded.commands.map(c=>c.join(' ')).join(' ');
        const paint=structuredClone(group[0].paint);
        paint.fillRule='evenodd';
        out={welded:true,removedExact:0,path:{
          kind:'vector',unionFlattened:true,commands:welded.commands,offset:[0,0],
          points:welded.commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
          closed:true,paint,
          artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07" fill-rule="evenodd"/>'
        },holes:welded.holes,vertices:welded.vertices};
        }
      }else out=asCompound(group);
      replacements.set(ids[0],out.path);normalizationCandidates.add(out.path);
      for(const i of ids.slice(1))drop.add(i);
      mergedObjects+=ids.length-1;removedExact+=out.removedExact;
      if(out.welded){weldedGroups++;holes+=out.holes||0;flattenedVertices+=out.vertices||0;}
    }catch{skipped++;}
  }
  const surviving=doc.paths.map((_,i)=>i).filter(i=>!drop.has(i));
  const selectedIndices=surviving.flatMap((old,i)=>!selected||selected.has(old)?[i]:[]);
  doc.paths=doc.paths.flatMap((p,i)=>drop.has(i)?[]:[replacements.get(i)||p]);
  // CorelDRAW frequently exports an entire logo as ONE filled compound path
  // with many nested/overlapping M…Z subpaths (8048531.eps is an example).
  // Group-only merging misses these: normalize the compound itself using
  // the same winding-aware Boolean Union, preserving holes and paint.
  let normalizedObjects=0;
  for(let i=0;i<doc.paths.length;i++){
    const path=doc.paths[i];
    if(!normalizationCandidates.has(path)||!filledEligible(path)||isUnchangedUnion(path))continue;
    const parts=sampledGeometry(path,tolerance)?.parts;
    if(!parts||parts.length<2||parts.some(part=>!part.closed))continue;
    try{
      const union=unionFilledPaths([path],{tolerance,cleanupTolerance});
      addCleanup(union.cleanup);
      const paint=structuredClone(path.paint);
      paint.fillRule='evenodd';
      const commands=union.commands,d=commands.map(c=>c.join(' ')).join(' ');
      doc.paths[i]={kind:'vector',unionFlattened:true,commands,offset:[0,0],
        points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),closed:true,
        paint,artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07" fill-rule="evenodd"/>'};
      normalizedObjects++;holes+=union.holes;flattenedVertices+=union.vertices;
    }catch(error){
      skipped++;
    }
  }
  return {document:doc,safeDocument:exact.document,selectedIndices,
    stats:{before:document.paths.length,after:doc.paths.length,
    mergedObjects:mergedObjects+exact.stats.removed,
    removedExact:removedExact+exact.stats.removed,exactRemoved:exact.stats.removed,
    weldedGroups,compoundGroups:replacements.size-weldedGroups,normalizedObjects,
    skipped,holes,flattenedVertices,cleanup:cleanupStats,
    booleanEngine:'Clipper 6.4.2.2',
    unionToleranceMm:Math.max(.0002,Math.min(.005,tolerance*.05))}};
}
