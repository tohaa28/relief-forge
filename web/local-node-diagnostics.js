import {nativeParts,controlsBounds,pointDistance,evaluateBezier} from './native-bezier.js?v=0.2.0-alpha.53';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.53';

// One local region around the operator's last edit; all coordinates are mm.
// A 28-pixel radius remains small on screen and is capped at 2 mm in artwork.
export function manualCheckRadius(view,canvasWidth,canvasHeight,tolerance=.01){
  const px=Math.max(view?.width/Math.max(1,canvasWidth)||0,view?.height/Math.max(1,canvasHeight)||0);
  return Math.max(tolerance*4,Math.min(2,px*28));
}
export const insideLocal=(point,center,radius)=>
  !!point&&pointDistance(point,center)<=radius+1e-10;
const nearBox=(bounds,center,radius)=>
  bounds[0]<=center[0]+radius&&bounds[2]>=center[0]-radius&&
  bounds[1]<=center[1]+radius&&bounds[3]>=center[1]-radius;

export function mergeLocalIssues(previous,local,center,radius,{complete=true,changedPath=-1,changedClosed=false}={}){
  if(!complete)return previous;
  const keep=previous.filter(issue=>
    !(insideLocal(issue.point,center,radius)||
      (changedClosed&&issue.kind==='open'&&issue.path===changedPath)));
  const seen=new Set(),out=[];
  for(const issue of [...keep,...local]){
    const key=[issue.kind,issue.path,issue.other,
      ...(issue.nodePoints?.flat()||issue.point||[]).map(x=>Math.round(x*1e8))].join(':');
    if(!seen.has(key)){seen.add(key);out.push(issue);}
  }
  return out;
}

export function diagnoseLocalNodes(document,center,radius,tolerance=.01,{maxSegments=256}={}){
  if(!Array.isArray(center)||center.length!==2||center.some(x=>!Number.isFinite(x))||
     !Number.isFinite(radius)||radius<=0||!Number.isFinite(tolerance)||tolerance<=0)
    throw Error('Некорректная область локальной проверки');
  const segments=[],anchors=[],openIssues=[],issues=[];
  let truncated=false,segmentsVisited=0;
  for(let owner=0;owner<(document.paths||[]).length;owner++){
    const path=document.paths[owner];
    if(path.kind==='image')continue;
    for(const [partIndex,part] of nativeParts(path).entries()){
      const n=part.segments.length;
      if(!n)continue;
      const begin=part.start;
      if(!part.closed&&insideLocal(begin,center,radius))
        openIssues.push({kind:'open',path:owner,other:owner,point:[...begin],nativeWitness:true});
      let along=0;
      part.segments.forEach((s,ordinal)=>{
        const first=s.controls[0],last=s.controls.at(-1);
        const distance=s.controls.slice(1).reduce((sum,p,i)=>sum+pointDistance(s.controls[i],p),0);
        if(insideLocal(first,center,radius+tolerance))
          anchors.push({owner,partIndex,ordinal,point:first,along,closed:part.closed,total:n});
        if(ordinal===n-1&&insideLocal(last,center,radius+tolerance))
          anchors.push({owner,partIndex,ordinal:n,point:last,along:along+distance,closed:part.closed,total:n});
        if(nearBox(controlsBounds(s.controls),center,radius+tolerance)){
          segmentsVisited++;
          if(segments.length<maxSegments)segments.push({owner,partIndex,ordinal,controls:s.controls});
          else truncated=true;
        }
        along+=distance;
      });
    }
  }
  if(truncated)return {issues:[],complete:false,segments:segmentsVisited,reason:'local-segment-budget'};
  issues.push(...openIssues);
  const within=point=>insideLocal(point,center,radius);
  for(const s of segments){
    if(s.controls.every(p=>pointDistance(p,s.controls[0])<=tolerance)){
      const point=evaluateBezier(s.controls,.5);
      if(within(point))issues.push({kind:'short',path:s.owner,other:s.owner,point,nativeWitness:true});
    }
  }
  for(let a=0;a<anchors.length;a++)for(let b=a+1;b<anchors.length;b++){
    const x=anchors[a],y=anchors[b],distanceMm=pointDistance(x.point,y.point);
    if(distanceMm>tolerance||!within(x.point)&&!within(y.point))continue;
    if(x.owner===y.owner&&x.partIndex===y.partIndex){
      if(Math.abs(x.ordinal-y.ordinal)<=1)continue;
      if(x.closed&&Math.abs(x.ordinal-y.ordinal)>=x.total-1)continue;
      // Nearby vertices on one continuous branch are not separate branches.
      if(Math.abs(x.along-y.along)<=tolerance)continue;
    }else if(distanceMm>1e-8)continue; // Separate contours: use clearance.
    const roundoff=Math.min(1e-8,8*Number.EPSILON*Math.max(1,...x.point.map(Math.abs),...y.point.map(Math.abs)));
    issues.push({kind:distanceMm<=roundoff?'coincident':'near_node',
      path:x.owner,other:y.owner,point:[...x.point],
      nodePoints:[[...x.point],[...y.point]],distanceMm,nativeWitness:true});
  }
  // Paper.js receives only in-radius native segments, not the whole document.
  // Each segment is used as an independent query primitive; adjacency in the
  // source is excluded explicitly so ordinary connected vertices are not defects.
  const fragments=segments.map(s=>{
    const p=s.controls;
    return {kind:'vector',artwork:'<path/>',offset:[0,0],
      commands:[['M',...p[0]],[(p.length===2?'L':p.length===3?'Q':'C'),...p.slice(1).flat()]]};
  });
  const contacts=fragments.length>1?nativeIntersections(fragments,{maxCurves:maxSegments,allowPartial:true}):[];
  let complete=contacts.complete!==false;
  for(const contact of contacts){
    const a=segments[contact.path],b=segments[contact.other];
    if(!a||!b||!insideLocal(contact.point,center,radius))continue;
    if(a.owner===b.owner&&a.partIndex===b.partIndex&&
       Math.abs(a.ordinal-b.ordinal)<=1&&!contact.overlap)continue;
    if(!contact.crossing&&!contact.overlap)continue;
    const kind=contact.overlap?'overlap':a.owner===b.owner?'self_intersection':'intersection';
    issues.push({kind,path:a.owner,other:b.owner,point:contact.point,nativeWitness:true});
  }
  return {issues,complete,segments:segmentsVisited,reason:complete?'ok':'unresolved-native-contact'};
}
