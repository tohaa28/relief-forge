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

// Cubic control handles can change while every anchor remains identical.
// Mark the affected Bézier end anchors in AFTER as smoothing evidence.
export function changedBezierSites(before,after,indices,epsilon=1e-7){
  const result=[];
  for(const i of indices){
    const original=before.paths[i],candidate=after.paths[i];
    const a=original?.commands,b=candidate?.commands;
    if(!a||!b||a.length!==b.length)continue; // Knot reduction is annotated separately.
    const off=candidate.offset||[0,0];
    for(let j=0;j<a.length;j++){
      if(a[j][0]!=='C'||b[j][0]!=='C')continue;
      const endpointA=a[j].slice(-2),endpointB=b[j].slice(-2);
      if(Math.hypot(endpointA[0]-endpointB[0],endpointA[1]-endpointB[1])>epsilon)continue;
      const altered=[1,2,3,4].some(k=>Math.abs(a[j][k]-b[j][k])>epsilon);
      if(altered)result.push({path:i,point:[endpointB[0]+off[0],endpointB[1]+off[1]]});
    }
  }
  return result;
}
