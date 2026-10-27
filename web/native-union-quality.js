import './vendor/clipper.js?v=0.2.0-alpha.50';
import {sampleNativeParts,pointDistance} from './native-bezier.js?v=0.2.0-alpha.50';
const C=globalThis.ClipperLib,SCALE=1000000,SAMPLE=.0005;
function union(rings,rule=C.PolyFillType.pftNonZero){
 const clip=new C.Clipper(C.Clipper.ioStrictlySimple),tree=new C.PolyTree();
 if(rings.length&&!clip.AddPaths(rings,C.PolyType.ptSubject,true))throw Error('native-union-reference-input');
 if(rings.length&&!clip.Execute(C.ClipType.ctUnion,tree,rule,rule))throw Error('native-union-reference-failed');
 return tree;
}
function shape(path){
 let perimeter=0;
 const rings=sampleNativeParts(path,SAMPLE).map(p=>{
  if(!p.closed)throw Error('native-union-open-source');
  perimeter+=p.points.reduce((n,a,i)=>n+pointDistance(a,p.points[(i+1)%p.points.length]),0);
  return p.points.map(p=>{if(p.some(v=>!Number.isFinite(v)||Math.abs(v*SCALE)>1e12))throw Error('native-union-coordinate-range');return {X:Math.round(p[0]*SCALE),Y:Math.round(p[1]*SCALE)};});
 });
 return {rings:C.Clipper.PolyTreeToPaths(union(rings,path.paint?.fillRule==='evenodd'?C.PolyFillType.pftEvenOdd:C.PolyFillType.pftNonZero)),perimeter};
}
const holes=tree=>{let n=0;const visit=p=>{for(const c of p.Childs()){n+=Number(c.IsHole());visit(c);}};visit(tree);return n;};
// Clipper is an independent, verification-only silhouette reference. Its
// sampled polygons are never stored in the editor or passed to EPS export.
export function verifyNativeUnionSilhouette(inputs,output){
 const a=inputs.map(shape),b=shape(output),reference=union(a.flatMap(s=>s.rings)),candidate=union(b.rings),clip=new C.Clipper(),xor=new C.Paths();
 clip.AddPaths(C.Clipper.PolyTreeToPaths(reference),C.PolyType.ptSubject,true);
 clip.AddPaths(C.Clipper.PolyTreeToPaths(candidate),C.PolyType.ptClip,true);
 if(!clip.Execute(C.ClipType.ctXor,xor,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero))throw Error('native-union-xor-failed');
 const xorMm2=xor.reduce((n,p)=>n+Math.abs(C.Clipper.Area(p)),0)/(SCALE*SCALE),budgetMm2=(a.reduce((n,s)=>n+s.perimeter,0)+b.perimeter)*(SAMPLE*2+2/SCALE);
 if(holes(reference)!==holes(candidate)||xorMm2>budgetMm2)throw Error('Union: независимая проверка силуэта или отверстий не пройдена');
 return {xorMm2,budgetMm2,holes:holes(candidate),samplingMm:SAMPLE};
}
