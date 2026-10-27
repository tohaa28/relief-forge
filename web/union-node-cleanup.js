import './vendor/clipper.js?v=0.2.0-alpha.49';

// Conservative post-Union cleanup. Only replace a subchain when every
// removed original vertex stays within a bounded distance of its replacement
// chord. Then verify the global silhouette and hole topology with Clipper.
// Units are integer Clipper coordinates: no additional rounding is introduced.
const C=globalThis.ClipperLib;
const delta=(a,b)=>Math.hypot(b.X-a.X,b.Y-a.Y);
const key=p=>p.X+':'+p.Y;
function distToChord(p,a,b){
  const dx=b.X-a.X,dy=b.Y-a.Y,den=dx*dx+dy*dy;
  if(!den)return Infinity;
  const u=((p.X-a.X)*dx+(p.Y-a.Y)*dy)/den;
  if(u<0||u>1)return Infinity; // preserve reversing or sharp terminal corners
  return Math.abs(dx*(p.Y-a.Y)-dy*(p.X-a.X))/Math.sqrt(den);
}
const orientedArea=r=>r.reduce((acc,p,i)=>{
  const q=r[(i+1)%r.length];return acc+p.X*q.Y-q.X*p.Y;
},0)/2;
const ringLength=r=>r.reduce((n,p,i)=>n+delta(p,r[(i+1)%r.length]),0);

function beginRing(original){
  const nodes=[];
  let coincident=0;
  for(const point of original){
    if(nodes.length&&key(nodes.at(-1).p)===key(point)){coincident++;continue;}
    nodes.push({p:{X:point.X,Y:point.Y},omitted:[]});
  }
  if(nodes.length>1&&key(nodes[0].p)===key(nodes.at(-1).p)){nodes.pop();coincident++;}
  return {nodes,coincident};
}
function removePass(nodes,mode,deviation,shortLimit){
  const n=nodes.length;
  if(n<=3)return {nodes,removed:0};
  const remove=new Set();
  for(let i=0;i<n;i++){
    if(remove.has((i+n-1)%n)||remove.has((i+1)%n))continue;
    const prev=nodes[(i+n-1)%n],cur=nodes[i],next=nodes[(i+1)%n];
    const a=prev.p,b=cur.p,c=next.p;
    if(key(a)===key(c))continue;
    const omitted=[...prev.omitted,b,...cur.omitted];
    if(omitted.length>16000)continue; // cap pathological long chains
    const maxDistance=Math.max(...omitted.map(p=>distToChord(p,a,c)));
    if(mode==='collinear'&&maxDistance>1e-7)continue;
    if(mode==='short'&&(
      Math.min(delta(a,b),delta(b,c))>shortLimit||maxDistance>deviation
    ))continue;
    if(n-remove.size<=3)break;
    remove.add(i);
  }
  if(!remove.size)return {nodes,removed:0};
  // Avoid removing both seam vertices in a single pass.
  if(remove.has(0)&&remove.has(n-1))remove.delete(n-1);
  if(n-remove.size<3)return {nodes,removed:0};
  const out=nodes.filter((node,i)=>!remove.has(i));
  for(let i=0;i<n;i++){
    if(!remove.has(i))continue;
    let prev=(i+n-1)%n;
    while(remove.has(prev))prev=(prev+n-1)%n;
    const owner=nodes[prev];
    owner.omitted.push(nodes[i].p,...nodes[i].omitted);
  }
  return {nodes:out,removed:remove.size};
}

function cleanOneRing(original,devUnits,shortUnits){
  const init=beginRing(original);
  let nodes=init.nodes,coincident=init.coincident,collinear=0,short=0;
  if(nodes.length<3)return {points:original,coincident:0,collinear:0,short:0};
  // A few bounded rounds avoid quadratic deletion on large logos.
  for(let pass=0;pass<12;pass++){
    const straight=removePass(nodes,'collinear',devUnits,shortUnits);
    nodes=straight.nodes;collinear+=straight.removed;
    const tiny=removePass(nodes,'short',devUnits,shortUnits);
    nodes=tiny.nodes;short+=tiny.removed;
    if(!straight.removed&&!tiny.removed)break;
  }
  const points=nodes.map(n=>n.p);
  if(points.length<3||Math.sign(orientedArea(points))!==Math.sign(orientedArea(original)))
    return {points:original,coincident:0,collinear:0,short:0};
  return {points,coincident,collinear,short};
}
function topology(polys){
  const clip=new C.Clipper(C.Clipper.ioStrictlySimple);
  clip.AddPaths(polys,C.PolyType.ptSubject,true);
  const tree=new C.PolyTree();
  if(!clip.Execute(C.ClipType.ctUnion,tree,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftEvenOdd))
    throw Error('Невозможно проверить топологию очищенного контура');
  const counts={outer:0,holes:0};
  function visit(node){
    for(const child of node.Childs()){
      if(child.Contour().length>=3)counts[child.IsHole()?'holes':'outer']++;
      visit(child);
    }
  }
  visit(tree);
  return counts;
}
function symmetricDifferenceArea(before,after){
  const c=new C.Clipper();
  c.AddPaths(before,C.PolyType.ptSubject,true);
  c.AddPaths(after,C.PolyType.ptClip,true);
  const out=new C.Paths();
  if(!c.Execute(C.ClipType.ctXor,out,C.PolyFillType.pftEvenOdd,C.PolyFillType.pftEvenOdd))
    throw Error('Не удалось сравнить исходную и очищенную геометрию');
  return out.reduce((n,p)=>n+Math.abs(C.Clipper.Area(p)),0);
}
function shortEdges(contours,limit){
  return contours.reduce((sum,c)=>sum+c.points.filter((p,i)=>
    delta(p,c.points[(i+1)%c.points.length])<limit).length,0);
}

export function cleanUnionContours(contours,{scale,tolerance=.01,cleanupTolerance=tolerance}={}){
  if(!Number.isFinite(scale)||scale<=0)throw Error('Недопустимый масштаб Union');
  const maxDeviationMm=Math.max(.0002,Math.min(.003,cleanupTolerance*.15));
  const minSegmentMm=Math.max(.002,Math.min(.05,cleanupTolerance*1.5));
  const dev=maxDeviationMm*scale,short=minSegmentMm*scale;
  const countBefore=contours.reduce((n,c)=>n+c.points.length,0);
  const originals=contours.map(c=>c.points);
  const perimeters=originals.reduce((n,p)=>n+ringLength(p),0);
  const prepared=contours.map(c=>cleanOneRing(c.points,dev,short));
  const proposal=contours.map((c,i)=>({...c,points:prepared[i].points}));
  const changed=prepared.some((r,i)=>r.points.length!==originals[i].length);
  const unchanged=()=>({
    contours:contours.map(c=>({...c,points:c.points.map(p=>({...p}))})),
    stats:{before:countBefore,after:countBefore,coincident:0,collinear:0,short:0,
      shortEdgesRemaining:shortEdges(contours,short),reverted:false,
      maxDeviationMm,minSegmentMm}
  });
  if(!changed)return unchanged();
  // Catch accidental bridges, hole collapse, self-intersections and rounding
  // anomalies. If any invariant fails, restore the exact pre-cleanup Union.
  try{
    const a=topology(originals),b=topology(proposal.map(c=>c.points));
    if(a.outer!==b.outer||a.holes!==b.holes)
      throw Error('Изменено количество внешних контуров или отверстий');
    const area=symmetricDifferenceArea(originals,proposal.map(c=>c.points));
    if(area>perimeters*dev*1.3+2)
      throw Error('Превышено допустимое отклонение заливки');
  }catch{
    const result=unchanged();
    result.stats.reverted=true;
    return result;
  }
  const aggregate=key=>prepared.reduce((n,p)=>n+p[key],0);
  const after=proposal.reduce((n,c)=>n+c.points.length,0);
  return {contours:proposal,stats:{before:countBefore,after,
    coincident:aggregate('coincident'),collinear:aggregate('collinear'),
    short:aggregate('short'),shortEdgesRemaining:shortEdges(proposal,short),
    reverted:false,maxDeviationMm,minSegmentMm}};
}
