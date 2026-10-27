import './vendor/clipper.js?v=0.2.0-alpha.50';
import {sampledContours} from './rich-svg.js?v=0.2.0-alpha.50';
import {cleanUnionContours} from './union-node-cleanup.js?v=0.2.0-alpha.50';
const C=globalThis.ClipperLib;
if(!C?.Clipper)throw Error('Clipper 6.4.2.2 is not available');

const square=ring=>{
  let a=0;
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];a+=p.X*q.Y-q.X*p.Y;
  }
  return Math.abs(a)/2;
};
const flattenTolerance=tolerance=>Math.max(.0002,Math.min(.005,tolerance*.05));
const toScale=tolerance=>Math.min(200000,Math.max(10000,
  Math.round(10/flattenTolerance(tolerance))));
const polyTree=(paths,fill=C.PolyFillType.pftNonZero)=>{
  const worker=new C.Clipper(C.Clipper.ioStrictlySimple);
  if(!worker.AddPaths(paths,C.PolyType.ptSubject,true))return null;
  const result=new C.PolyTree();
  if(!worker.Execute(C.ClipType.ctUnion,result,fill,fill))return null;
  return result;
};
function treeContours(tree){
  const out=[];
  function visit(node){
    for(const child of node.Childs()){
      const ring=child.Contour();
      if(ring.length>=3)out.push({points:ring,hole:child.IsHole()});
      visit(child);
    }
  }
  visit(tree);
  return out;
}
function ringsFromPath(path,tolerance,scale){
  const sampled=sampledContours(path,flattenTolerance(tolerance));
  const out=[];
  let points=0;
  for(const part of sampled){
    if(!part.closed)throw Error('Объединение требует замкнутых контуров');
    const quantized=[];
    for(const vertex of part.points){
      if(!Array.isArray(vertex)||!Number.isFinite(vertex[0])||!Number.isFinite(vertex[1]))
        throw Error('Объединение: неверная точка кривой');
      const X=Math.round(vertex[0]*scale),Y=Math.round(vertex[1]*scale);
      if(Math.max(Math.abs(X),Math.abs(Y))>1e12)throw Error('Координаты слишком велики для точного объединения');
      if(!quantized.length||X!==quantized.at(-1).X||Y!==quantized.at(-1).Y)
        quantized.push({X,Y});
      if(++points>35000)throw Error('Контур слишком сложен для булева объединения');
    }
    if(quantized.length>1&&quantized[0].X===quantized.at(-1).X&&
       quantized[0].Y===quantized.at(-1).Y)quantized.pop();
    if(quantized.length>=3&&square(quantized)>1)out.push(quantized);
  }
  return out;
}
function normalizePath(path,tolerance,scale){
  const rings=ringsFromPath(path,tolerance,scale);
  if(!rings.length)throw Error('Нечего объединять: замкнутые области пусты');
  const rule=path.paint?.fillRule==='evenodd'?C.PolyFillType.pftEvenOdd:C.PolyFillType.pftNonZero;
  const result=polyTree(rings,rule);
  if(!result)throw Error('Не удалось нормализовать заливки или отверстия');
  return treeContours(result).map(p=>p.points);
}
function runUnion(polys,fill=C.PolyFillType.pftNonZero){
  const tree=polyTree(polys,fill);
  if(!tree)throw Error('Clipper: объединение не построено');
  return treeContours(tree);
}
function positiveIntersection(normalizedA,normalizedB){
  const c=new C.Clipper();
  c.AddPaths(normalizedA,C.PolyType.ptSubject,true);
  c.AddPaths(normalizedB,C.PolyType.ptClip,true);
  const tree=new C.PolyTree();
  if(!c.Execute(C.ClipType.ctIntersection,tree,
      C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero))return false;
  return treeContours(tree).some(({points,hole})=>!hole&&square(points)>2);
}
export function unionFilledPaths(paths,{tolerance=.01,cleanupTolerance=tolerance}={}){
  if(!Array.isArray(paths)||!paths.length)throw Error('Нет объектов для булева объединения');
  const scale=toScale(tolerance);
  const normalized=paths.map(p=>normalizePath(p,tolerance,scale));
  const polys=normalized.flat();
  if(polys.reduce((n,p)=>n+p.length,0)>80000)throw Error('Слишком много точек для безопасного Union');
  const rawContours=runUnion(polys);
  if(!rawContours.length)throw Error('Объединение дало пустой контур');
  const cleanup=cleanUnionContours(rawContours,{scale,tolerance,cleanupTolerance});
  const contours=cleanup.contours;
  let commands=[],holes=0,vertices=0;
  for(const item of contours){
    const ring=item.points;
    if(ring.length<3)continue;
    const world=ring.map(p=>[p.X/scale,p.Y/scale]);
    commands.push(['M',...world[0]],...world.slice(1).map(p=>['L',...p]),['Z']);
    holes+=Number(item.hole);vertices+=ring.length;
  }
  return {commands,holes,vertices,contours:contours.length,cleanup:cleanup.stats,
    flattenToleranceMm:flattenTolerance(tolerance),
    quantizationMm:1/scale};
}
// If the complete Boolean result is already one original opaque silhouette,
// retain its exact native L/Q/C segments and handles: ZERO new Union anchors.
// Clipper is only a conservative equivalence oracle here, never the geometry
// exported for a source-dominant union.
export function findUnionEquivalentSource(paths,{tolerance=.01}={}){
  if(!Array.isArray(paths)||paths.length<2)return -1;
  try{
    const scale=toScale(tolerance);
    const normalized=paths.map(p=>normalizePath(p,tolerance,scale));
    const result=runUnion(normalized.flat()).map(p=>p.points);
    for(let i=0;i<normalized.length;i++){
      const c=new C.Clipper();
      if(!c.AddPaths(normalized[i],C.PolyType.ptSubject,true))continue;
      if(!c.AddPaths(result,C.PolyType.ptClip,true))continue;
      const xor=new C.Paths();
      if(!c.Execute(C.ClipType.ctXor,xor,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero))continue;
      if(xor.reduce((sum,ring)=>sum+square(ring),0)<=1)return i;
    }
  }catch{
    // An uncertain match cannot license replacement or dropped art.
  }
  return -1;
}
export function filledPathsOverlap(first,second,{tolerance=.01}={}){
  const scale=toScale(tolerance);
  return positiveIntersection(normalizePath(first,tolerance,scale),
    normalizePath(second,tolerance,scale));
}
export const polygonUnionEngine='Clipper 6.4.2.2';
export function createFilledOverlapTester(tolerance=.01){
  const scale=toScale(tolerance),cache=new WeakMap();
  const normalized=path=>{if(!cache.has(path))cache.set(path,normalizePath(path,tolerance,scale));return cache.get(path);};
  return (a,b)=>positiveIntersection(normalized(a),normalized(b));
}
