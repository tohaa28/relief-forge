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
 const u=[a[1][0]-a[0][0],a[1][1]-a[0][1]],v=[b[1][0]-b[0][0],b[1][1]-b[0][1]],w=[b[0][0]-a[0][0],b[0][1]-a[0][1]],cross=(x,y)=>x[0]*y[1]-x[1]*y[0],den=cross(u,v);
 if(den){const t=cross(w,v)/den,s=cross(w,u)/den;if(t>=0&&t<=1&&s>=0&&s<=1)candidates.push([t,s]);}
 return candidates.map(([t,s])=>{const pa=mix(...a,t),pb=mix(...b,s);return {distance:distance(pa,pb),a:pa,b:pb,t,s};}).sort((x,y)=>x.distance-y.distance)[0];
}
export function curveDistance(a,b,{threshold=.1,epsilon=1e-5,budget={remaining:20000}}={}){
 if(![a,b].every(p=>p.length>=2&&p.length<=4&&p.every(v=>v.length===2&&v.every(Number.isFinite))))throw Error('Invalid Bézier controls');
 if(!(threshold>0&&epsilon>0))throw Error('Invalid distance tolerance');
 if(a.length===2&&b.length===2){const result=lineNearest(a,b);return {...result,lower:result.distance,complete:true};}
 let best={distance:Infinity},lower=Infinity,unresolved=false;
 const update=(t,s)=>{const pa=evaluate(a,t),pb=evaluate(b,s),d=distance(pa,pb);if(d<best.distance)best={distance:d,a:pa,b:pb,t,s};};
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
  const finish=closed=>{local.forEach((s,i)=>Object.assign(s,{ordinal:i,count:local.length,closed}));segments.push(...local);local=[];};
  for(const c of commands||[]){
   const type=c[0],point=c.slice(-2);
   if(type==='M'){finish(false);part++;pen=start=point;continue;}
   if(!pen||!['L','Q','C','Z'].includes(type)){skipped++;continue;}
   const target=type==='Z'?start:point;
   if(type!=='Z'||distance(pen,target)>1e-12){const controls=[pen];for(let j=1;j<c.length;j+=2)controls.push(c.slice(j,j+2));if(type==='Z')controls.push(target);
    if(controls.every(v=>v.length===2&&v.every(Number.isFinite))){const world=controls.map(v=>[v[0]+shift[0],v[1]+shift[1]]);local.push({controls:world,box:box(world),path,part});}else skipped++;
   }
   pen=target;if(type==='Z')finish(true);
  }
  finish(false);
 });
 return {segments,skipped};
}
export function findCurveClearances(document,{threshold=.1,maxWork=2000000,maxMarkers=3000}={}){
 if(!Number.isFinite(threshold)||threshold<=0||threshold>1000)throw Error('Расстояние должно быть больше 0 и не больше 1000 мм');
 const {segments,skipped}=clearanceSegments(document),sorted=segments.sort((a,b)=>a.box[0]-b.box[0]),budget={remaining:maxWork},markers=[];
 let complete=skipped===0,comparisons=0,uncertain=0;
 outer:for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length;j++){
  const a=sorted[i],b=sorted[j];if(b.box[0]-a.box[2]>=threshold)break;
  if(--budget.remaining<0){complete=false;break outer;}
  if(a.path===b.path&&a.part===b.part&&(Math.abs(a.ordinal-b.ordinal)===1||a.closed&&Math.abs(a.ordinal-b.ordinal)===a.count-1))continue;
  if(gap(a.box,b.box)>=threshold)continue;
  comparisons++;
  const result=curveDistance(a.controls,b.controls,{threshold,epsilon:Math.min(1e-5,threshold*1e-4),budget});
  if(!result.complete){complete=false;uncertain++;}
  if(result.distance<threshold){markers.push({point:mix(result.a,result.b),distance:result.distance,lower:result.lower,path:a.path,other:b.path,a:result.a,b:result.b});if(markers.length>=maxMarkers){complete=false;break outer;}}
 }
 return {markers,complete,uncertain,skipped,comparisons,work:maxWork-budget.remaining,threshold,segments:segments.length};
}
