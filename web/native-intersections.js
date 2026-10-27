let paper=null,loading=null;
export function prepareNativeIntersections(){
 if(paper)return Promise.resolve();
 if(loading)return loading;
 let timer;
 const moduleReady=import('./vendor/paper-core.mjs?v=0.2.0-alpha.50').then(m=>{paper=m.default;});
 loading=Promise.race([moduleReady,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Не удалось загрузить модуль геометрии за 20 секунд. Проверьте соединение и повторите.')),20000);})]).finally(()=>{clearTimeout(timer);loading=null;});
 return loading;
}
// Node tests and dedicated Workers need the synchronous geometry API ready.
// The page itself loads the kernel only when vector processing actually starts.
if(typeof document==='undefined')await prepareNativeIntersections();
import {nativeParts,evaluateBezier,pointDistance,cubicControls} from './native-bezier.js?v=0.2.0-alpha.50';
const controls=loc=>cubicControls(loc.path.data.controls[loc.curve.index]);
export function nativeIntersections(paths,{maxCurves=30000,maxIssues=10000,allowPartial=false}={}){
 if(!paper)throw Error('native-kernel-not-ready');
 const scope=new paper.PaperScope();scope.setup([1,1]);
 try{
  const compound=new scope.CompoundPath({insert:false});let part=0,curves=0;
  paths.forEach((source,owner)=>nativeParts(source).forEach(p=>{
   curves+=p.segments.length;if(curves>maxCurves)throw Error('native-topology-curve-budget');
   // Set segments directly: the SVG path parser's closePath tolerance may
   // otherwise join distinct nearby source anchors before diagnosis.
   const path=new scope.Path({insert:false});path.add(new scope.Segment(p.start));
   p.segments.forEach((s,i)=>{
    const c=cubicControls(s.controls),a=c[0],b=c[3];
    path.lastSegment.handleOut=new scope.Point(c[1][0]-a[0],c[1][1]-a[1]);
    const handleIn=new scope.Point(c[2][0]-b[0],c[2][1]-b[1]);
    const roundoff=32*Number.EPSILON*Math.max(1,...b.map(Math.abs),...p.start.map(Math.abs));
    if(p.closed&&i===p.segments.length-1&&pointDistance(b,p.start)<=roundoff)path.firstSegment.handleIn=handleIn;
    else path.add(new scope.Segment(b,handleIn));
   });
   path.closed=p.closed;
   if(path.curves.length!==p.segments.length)throw Error('native-topology-source-mapping');
   path.data={part:part++,owner,controls:p.segments.map(s=>s.controls)};compound.addChild(path);
  }));
  const found=[];found.complete=true;found.unresolved=0;
  for(const loc of compound.getIntersections(null)){
   const other=loc.intersection;if(!other)continue;
   const a=evaluateBezier(controls(loc),loc.time),b=evaluateBezier(controls(other),other.time);
   // A numerical kernel location must have witnesses on both native curves.
   if(pointDistance(a,b)>2e-8){if(!allowPartial)throw Error('native-topology-unresolved-contact');found.complete=false;found.unresolved++;continue;}
   const x=loc.path.data,y=other.path.data;
   found.push({parts:[x.part,y.part].sort((a,b)=>a-b).join(':'),point:[(a[0]+b[0])/2,(a[1]+b[1])/2],path:x.owner,other:y.owner,kind:x.owner===y.owner?'self_intersection':'intersection',overlap:loc.hasOverlap(),crossing:loc.isCrossing()});
   if(found.length>=maxIssues){if(!allowPartial)throw Error('native-topology-issue-budget');found.complete=false;break;}
  }
  return found;
 }finally{scope.project?.remove();}
}
