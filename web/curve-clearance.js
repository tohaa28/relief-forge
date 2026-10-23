// Native L/Q/C distance bounds. Never modifies or flattens the document.
// Bézier convex-hull boxes bound the distance from below; evaluated points
// bound it from above. de Casteljau subdivision narrows the interval.
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const mix=(a,b,t=.5)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
function box(p){return [Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];}
const gap=(a,b)=>Math.hypot(Math.max(0,a[0]-b[2],b[0]-a[2]),Math.max(0,a[1]-b[3],b[1]-a[3]));
function evaluate(p,t){let q=p;while(q.length>1)q=q.slice(1).map((v,i)=>mix(q[i],v,t));return q[0];}
function split(p){let q=p,left=[p[0]],right=[p.at(-1)];while(q.length>1){q=q.slice(1).map((v,i)=>mix(q[i],v));left.push(q[0]);right.unshift(q.at(-1));}return [left,right];}
const chordError=p=>Math.max(...p.map((v,i)=>distance(v,mix(p[0],p.at(-1),i/(p.length-1)))));
function lineNearest(a,b){
 const project=(p,x,y)=>{const dx=y[0]-x[0],dy=y[1]-x[1],n=dx*dx+dy*dy;return n?Math.max(0,Math.min(1,((p[0]-x[0])*dx+(p[1]-x[1])*dy)/n)):0;};
 const candidates=[[0,project(a[0],...b)],[1,project(a[1],...b)],[project(b[0],...a),0],[project(b[1],...a),1]];
 // Flat minima (parallel overlapping spans) need an interior witness, not a
 // contour join merely selected by endpoint enumeration order.
 const ax=a[1][0]-a[0][0],ay=a[1][1]-a[0][1],an=ax*ax+ay*ay;
 if(an){const raw=b.map(p=>((p[0]-a[0][0])*ax+(p[1]-a[0][1])*ay)/an),lo=Math.max(0,Math.min(...raw)),hi=Math.min(1,Math.max(...raw));if(lo<=hi){const t=(lo+hi)/2;candidates.push([t,project(mix(...a,t),...b)]);}}
 const u=[a[1][0]-a[0][0],a[1][1]-a[0][1]],v=[b[1][0]-b[0][0],b[1][1]-b[0][1]],w=[b[0][0]-a[0][0],b[0][1]-a[0][1]],cross=(x,y)=>x[0]*y[1]-x[1]*y[0],den=cross(u,v);
 if(den){const t=cross(w,v)/den,s=cross(w,u)/den;if(t>=0&&t<=1&&s>=0&&s<=1)candidates.push([t,s]);}
 return candidates.map(([t,s])=>{const pa=mix(...a,t),pb=mix(...b,s);return {distance:distance(pa,pb),a:pa,b:pb,t,s};}).sort((x,y)=>x.distance-y.distance||(Math.min(y.t,1-y.t)+Math.min(y.s,1-y.s))-(Math.min(x.t,1-x.t)+Math.min(x.s,1-x.s)))[0];
}
export function curveDistance(a,b,{threshold=.1,epsilon=1e-5,budget={remaining:20000}}={}){
 if(![a,b].every(p=>p.length>=2&&p.length<=4&&p.every(v=>v.length===2&&v.every(Number.isFinite))))throw Error('Invalid Bézier controls');
 if(!(threshold>0&&epsilon>0))throw Error('Invalid distance tolerance');
 if(a.length===2&&b.length===2){const result=lineNearest(a,b);return {...result,lower:result.distance,complete:true};}
 let best={distance:Infinity},lower=Infinity,unresolved=false;
 const update=(t,s)=>{const pa=evaluate(a,t),pb=evaluate(b,s),d=distance(pa,pb);if(d<best.distance||d===best.distance&&Math.min(t,1-t)+Math.min(s,1-s)>Math.min(best.t,1-best.t)+Math.min(best.s,1-best.s))best={distance:d,a:pa,b:pb,t,s};};
 for(const t of [0,.5,1])for(const s of [0,.5,1])update(t,s);
 const stack=[{a,b,ta:0,tb:1,sa:0,sb:1,depth:0}];
 while(stack.length){
  if(--budget.remaining<0){unresolved=true;break;}
  const n=stack.pop(),ba=box(n.a),bb=box(n.b);
  const seed=lineNearest([n.a[0],n.a.at(-1)],[n.b[0],n.b.at(-1)]);
  const lo=Math.max(gap(ba,bb),seed.distance-chordError(n.a)-chordError(n.b));
  if(lo>=Math.min(threshold,best.distance))continue;
  // Chord solution is only a parameter seed: evaluate the REAL curves.
  update(n.ta+(n.tb-n.ta)*seed.t,n.sa+(n.sb-n.sa)*seed.s);
  if(best.distance-lo<=epsilon||n.depth>=48){lower=Math.min(lower,lo);if(n.depth>=48&&best.distance-lo>epsilon)unresolved=true;continue;}
  const da=Math.hypot(ba[2]-ba[0],ba[3]-ba[1]),db=Math.hypot(bb[2]-bb[0],bb[3]-bb[1]);
  if(da>=db){const [l,r]=split(n.a),m=(n.ta+n.tb)/2;stack.push({...n,a:r,ta:m,depth:n.depth+1},{...n,a:l,tb:m,depth:n.depth+1});}
  else{const [l,r]=split(n.b),m=(n.sa+n.sb)/2;stack.push({...n,b:r,sa:m,depth:n.depth+1},{...n,b:l,sb:m,depth:n.depth+1});}
 }
 // A witnessed distance below threshold is always real, even on budget expiry.
 const bound=unresolved?0:Math.min(best.distance,lower,threshold);
 return {...best,lower:bound,complete:!unresolved&&!(best.distance>=threshold&&bound<threshold)};
}
export function clearanceSegments(document){
 const segments=[];let skipped=0;
 document.paths.forEach((p,path)=>{
  if(p.kind==='image')return;
  const commands=p.artwork?p.commands:(p.points||[]).map((v,i)=>[i?'L':'M',...v]).concat(p.closed?[['Z']]:[]),shift=p.artwork?(p.offset||[0,0]):[0,0];
  let pen,start,part=-1,local=[];
  const finish=closed=>{
   // Some EPS paths close by an exact endpoint return, without a Z command.
   // Exact equality only: a merely small real gap must remain measurable.
   if(local.length>1&&distance(local[0].controls[0],local.at(-1).controls.at(-1))===0)closed=true;
   local.forEach((s,i)=>{
    const before=local[i-1]||(closed?local.at(-1):null),after=local[i+1]||(closed?local[0]:null),id=segments.length+i;
    Object.assign(s,{ordinal:i,count:local.length,closed,id,before:before?.controls,after:after?.controls,
     neighbors:[id,...(before?[segments.length+(i+local.length-1)%local.length]:[]),...(after?[segments.length+(i+1)%local.length]:[])]});
   });segments.push(...local);local=[];
  };
  for(const c of commands||[]){
   const type=c[0],point=c.slice(-2);
   if(type==='M'){finish(false);part++;pen=start=point;continue;}
   if(!pen||!['L','Q','C','Z'].includes(type)){skipped++;continue;}
   const target=type==='Z'?start:point;
   if(type!=='Z'||distance(pen,target)>1e-12){const controls=[pen];for(let j=1;j<c.length;j+=2)controls.push(c.slice(j,j+2));if(type==='Z')controls.push(target);
    if(controls.every(v=>v.length===2&&v.every(Number.isFinite))){const world=controls.map(v=>[v[0]+shift[0],v[1]+shift[1]]);if(world.some(v=>distance(v,world[0])>0))local.push({controls:world,box:box(world),path,part});}else skipped++;
   }
   pen=target;if(type==='Z')finish(true);
  }
  finish(false);
 });
 return {segments,skipped};
}
function isContourMinimum(segment,t,point,other){
 // At an interior segment minimum the native distance solver already checked
 // both parameter directions. At a node also check the incident continuation.
 const controls=t===0?[segment.controls,segment.before?.toReversed()]:t===1?[segment.controls.toReversed(),segment.after]:[];
 const slack=Number.EPSILON*128*Math.max(1,...point.map(Math.abs),...other.map(Math.abs));
 for(const p of controls){
  if(!p)continue;
  const target=p.slice(1).find(v=>distance(v,p[0])>slack);if(!target)continue;
  const dx=target[0]-p[0][0],dy=target[1]-p[0][1],len=Math.hypot(dx,dy);
  if(((point[0]-other[0])*dx+(point[1]-other[1])*dy)/len < -slack)return false;
 }
 return true;
}
const pairKey=(a,b)=>a<b?a+':'+b:b+':'+a;
const markerOnly=({segment,otherSegment,...marker})=>marker;
function sharedNodes(a,b){return [a.controls[0],a.controls.at(-1)].filter(p=>[b.controls[0],b.controls.at(-1)].some(q=>distance(p,q)===0));}
function minimumZones(candidates,budget,threshold){
 const remaining=new Map(candidates.map(c=>[pairKey(c.segment.id,c.otherSegment.id),c])),zones=[];let complete=true;
 const fallback=()=>({markers:candidates.map(markerOnly),complete:false});
 if(budget.remaining<=0&&candidates.length)return fallback();
 for(const [key,first] of remaining){
  remaining.delete(key);const queue=[first],group=[];
  while(queue.length){
   const c=queue.pop();group.push(c);
   for(const a of c.segment.neighbors)for(const b of c.otherSegment.neighbors){
    if(--budget.remaining<0)return fallback();
    const k=pairKey(a,b),next=remaining.get(k);if(!next)continue;
    const na=next.segment.id===a?next.segment:next.otherSegment,nb=next.segment.id===b?next.segment:next.otherSegment;
    const ja=c.segment.id===na.id?null:sharedNodes(c.segment,na),jb=c.otherSegment.id===nb.id?null:sharedNodes(c.otherSegment,nb);
    let connected=false;
    if(ja&&jb)connected=ja.some(p=>jb.some(q=>distance(p,q)<threshold));
    else if(ja||jb){
     const joints=ja||jb,controls=ja?c.otherSegment.controls:c.segment.controls;
     for(const p of joints){const r=curveDistance(controls,[p,p],{threshold,budget});complete=complete&&r.complete;if(r.distance<threshold){connected=true;break;}}
    }
    if(connected){remaining.delete(k);queue.push(next);}
   }
  }
  const minimum=group.reduce((n,c)=>Math.min(n,c.distance),Infinity),closest=group.filter(c=>c.distance===minimum),center=group.reduce((sum,c)=>[sum[0]+c.point[0]/group.length,sum[1]+c.point[1]/group.length],[0,0]);
  const best=closest.reduce((a,b)=>distance(a.point,center)<=distance(b.point,center)?a:b),{segment,otherSegment,...marker}=best;
  zones.push(marker);
 }
 return {markers:zones,complete};
}
export function findCurveClearances(document,{threshold=.1,maxWork=2000000,maxMarkers=3000}={}){
 if(!Number.isFinite(threshold)||threshold<=0||threshold>1000)throw Error('Расстояние должно быть больше 0 и не больше 1000 мм');
 const {segments,skipped}=clearanceSegments(document),sorted=segments.sort((a,b)=>a.box[0]-b.box[0]),budget={remaining:maxWork},candidates=[];
 let complete=skipped===0,comparisons=0,uncertain=0,rejectedContinuations=0;
 outer:for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
  const a=sorted[i],b=sorted[j];if(b.box[0]-a.box[2]>=threshold)break;
  if(--budget.remaining<0){complete=false;break outer;}
  if(a.path===b.path&&a.part===b.part&&(Math.abs(a.ordinal-b.ordinal)===1||a.closed&&Math.abs(a.ordinal-b.ordinal)===a.count-1))continue;
  if(gap(a.box,b.box)>=threshold)continue;
  comparisons++;
  const result=curveDistance(a.controls,b.controls,{threshold,epsilon:Math.min(1e-5,threshold*1e-4),budget});
  if(!result.complete){complete=false;uncertain++;}
  if(result.distance<threshold){
   if(!isContourMinimum(a,result.t,result.a,result.b)||!isContourMinimum(b,result.s,result.b,result.a)){rejectedContinuations++;continue;}
   candidates.push({point:mix(result.a,result.b),distance:result.distance,lower:result.lower,path:a.path,other:b.path,a:result.a,b:result.b,segment:a,otherSegment:b});
   if(candidates.length>=50000){complete=false;break outer;}
  }
 }
 const zones=minimumZones(candidates,budget,threshold);complete=complete&&zones.complete&&zones.markers.length<=maxMarkers;
 return {markers:zones.markers.slice(0,maxMarkers),complete,uncertain,skipped,comparisons,rejectedContinuations,candidateMinima:candidates.length,work:maxWork-budget.remaining,threshold,segments:segments.length};
}
