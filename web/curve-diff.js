// Geometry-driven comparison of actual curve anchor positions, not SVG paint.
// The original and optimized path indices are aligned by optimizePaths().
import {anchors} from './vector-points.js';
export function removedCurveAnchors(before,after,indices,epsilon=1e-7){
  if(!Number.isFinite(epsilon)||epsilon<=0)throw Error('Неверная точность сравнения узлов');
  const removed=[];
  for(const i of indices){
    const source=before.paths[i],target=after.paths[i];
    if(!source||!target||source.kind==='image')continue;
    const keep=anchors(target),original=anchors(source);
    for(const point of original){
      if(!keep.some(q=>Math.hypot(point[0]-q[0],point[1]-q[1])<=epsilon))removed.push({path:i,point});
    }
  }
  return removed;
}
export function changedCurveIndices(before,after,indices){
  return indices.filter(i=>{
    const old=before.paths[i],next=after.paths[i];
    if(!old||!next)return false;
    const oldGeom=old.commands||old.points, newGeom=next.commands||next.points;
    return JSON.stringify(oldGeom)!==JSON.stringify(newGeom);
  });
}
