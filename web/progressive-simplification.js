import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.95';
import {evaluateBezier,nativeParts,pointDistance,sampleNativeParts} from './native-bezier.js?v=0.2.0-alpha.95';
import {validateCurveChange,validateDocumentCurveChange} from './curve-quality.js?v=0.2.0-alpha.95';

const compareCandidates=(a,b)=>Number(Boolean(b.spike))-Number(Boolean(a.spike))||a.distance-b.distance||a.error-b.error||a.order-b.order;

class CandidateQueue{
  sequence=0;
  values=[];
  push(value){
    let i=this.values.length;
    const heap=this.values;
    value.order=this.sequence++;
    heap.push(value);
    while(i>0){
      const parent=Math.floor((i-1)/2);
      if(compareCandidates(heap[parent],value)<=0)break;
      heap[i]=heap[parent];i=parent;
    }
    heap[i]=value;
  }
  pop(){
    const heap=this.values,first=heap[0],last=heap.pop();
    if(!heap.length)return first;
    let i=0;
    while(2*i+1<heap.length){
      let child=2*i+1;
      if(child+1<heap.length&&compareCandidates(heap[child+1],heap[child])<0)child++;
      if(compareCandidates(heap[child],last)>=0)break;
      heap[i]=heap[child];i=child;
    }
    heap[i]=last;
    return first;
  }
}

const length=controls=>controls.slice(1).reduce((sum,p,i)=>sum+pointDistance(controls[i],p),0);

function join(left,right){
  const a=left[0],b=right.at(-1);
  const l=length(left),r=length(right),span=l+r;
  if(!span||pointDistance(a,b)<=1e-10)return null;
  const split=Math.max(.02,Math.min(.98,l/span));
  const original=t=>t<split?evaluateBezier(left,t/split):evaluateBezier(right,(t-split)/(1-split));
  let controls=[a,b];
  if(left.length>2||right.length>2){
    // Interpolate the old pair at thirds with fixed endpoints.
    const p=original(1/3),q=original(2/3);
    const u=p.map((x,i)=>(27*x-8*a[i]-b[i])/6);
    const v=q.map((x,i)=>(27*x-a[i]-8*b[i])/6);
    const c=u.map((x,i)=>(2*x-v[i])/3),d=v.map((x,i)=>(2*x-u[i])/3);
    if(pointDistance(c,a)<=span*1.5&&pointDistance(d,b)<=span*1.5)controls=[a,c,d,b];
  }
  let error=pointDistance(original(split),evaluateBezier(controls,split));
  for(let i=1;i<8;i++)error=Math.max(error,pointDistance(original(i/8),evaluateBezier(controls,i/8)));
  return {controls,error};
}

const vector=(a,b)=>[b[0]-a[0],b[1]-a[1]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const unit=v=>{
  const n=Math.hypot(...v);
  return n>1e-10?v.map(x=>x/n):null;
};
function tangent(controls,end){
  if(!controls)return null;
  const anchor=end?controls.at(-1):controls[0];
  const points=end?controls.slice(0,-1).reverse():controls.slice(1);
  for(const point of points){
    const direction=unit(end?vector(point,anchor):vector(anchor,point));
    if(direction)return direction;
  }
  return null;
}

function spikeBridge(segments,previous,next){
  const a=segments[0][0],b=segments.at(-1).at(-1);
  const base=pointDistance(a,b),axis=unit(vector(a,b));
  if(!axis)return null;
  const start=tangent(previous,true),end=tangent(next,false);
  // A defect is an out-and-back excursion attached to a continuing edge.
  // The neighboring directions exclude the ordinary tip of a V or corner.
  if(!start||!end||dot(start,axis)<.55||dot(end,axis)<.55||dot(start,end)<.35)return null;
  const points=segments.slice(0,-1).map(segment=>segment.at(-1));
  const depth=points.reduce((max,p)=>Math.max(max,pointDistance(a,p),pointDistance(b,p)),0);
  if(base>depth*.16)return null;
  const outward=unit(vector(a,points[0])),inward=unit(vector(points.at(-1),b));
  if(!outward||!inward||dot(outward,inward)>-.82||
     Math.abs(dot(outward,axis))>.85||Math.abs(dot(inward,axis))>.85)return null;
  // Internal nodes of a bent tip must still cluster around the excursion.
  if(points.some(point=>pointDistance(a,point)<depth*.55))return null;
  if(dot(start,axis)>.998&&dot(end,axis)>.998)return {controls:[a,b],distance:base};
  const c=a.map((v,i)=>v+start[i]*base/3);
  const d=b.map((v,i)=>v-end[i]*base/3);
  return {controls:[a,c,d,b],distance:base};
}

const capacity=part=>Math.max(0,part.segments.length-(part.closed?3:1));

function contourState(part,queue){
  const edges=part.segments.map(segment=>segment.controls);
  const count=edges.length+(part.closed?0:1);
  const nodes=Array.from({length:count},(_,i)=>({previous:i-1,next:i+1,
    outgoing:edges[i],active:true,revision:0,spikeRevision:0}));
  nodes.at(-1).next=part.closed?0:-1;
  if(part.closed)nodes[0].previous=count-1;
  const limit=capacity(part);
  const state={removed:0,spikes:0,remove,commands};
  let first=0;
  for(let i=0;i<count;i++){enqueue(i);enqueueSpike(i);}
  return state;

  function enqueue(index){
    const node=nodes[index];
    if(!limit||!node||index===0||!node.active||node.next<0)return;
    node.revision++;
    const left=nodes[node.previous].outgoing,right=node.outgoing;
    const fit=join(left,right);
    if(!fit)return;
    const distance=Math.min(pointDistance(left[0],left.at(-1)),pointDistance(right[0],right.at(-1)));
    queue.push({state,index,revision:node.revision,distance,...fit});
  }

  function enqueueSpike(leftIndex){
    const left=nodes[leftIndex];
    if(!left?.active||left.previous<0||!left.outgoing)return;
    left.spikeRevision++;
    const segments=[left.outgoing],spike=[];
    let rightIndex=left.next;
    for(let i=0;i<3&&rightIndex>=0&&rightIndex!==leftIndex;i++){
      const right=nodes[rightIndex];
      if(!right.outgoing||spike.length+1>limit-state.removed)break;
      spike.push(rightIndex);
      segments.push(right.outgoing);
      rightIndex=right.next;
      if(rightIndex<0||rightIndex===leftIndex)break;
      const fit=spikeBridge(segments,nodes[left.previous].outgoing,nodes[rightIndex].outgoing);
      if(fit)queue.push({state,spike:[...spike],leftIndex,rightIndex,
        revision:left.spikeRevision,error:0,...fit});
    }
  }

  function remove(candidate){
    const removed=candidate.spike||[candidate.index];
    if(state.removed+removed.length>limit)return 0;
    const node=nodes[removed[0]];
    const leftIndex=node.previous,rightIndex=nodes[removed.at(-1)].next;
    const left=nodes[leftIndex],right=nodes[rightIndex];
    if(removed.some(index=>!nodes[index].active))return 0;
    if(candidate.spike){
      if(leftIndex!==candidate.leftIndex||rightIndex!==candidate.rightIndex||
         left.spikeRevision!==candidate.revision)return 0;
    }else if(node.revision!==candidate.revision)return 0;
    left.outgoing=candidate.controls;
    left.next=rightIndex;
    right.previous=leftIndex;
    for(const index of removed)nodes[index].active=false;
    if(!nodes[first].active)first=rightIndex;
    state.removed+=removed.length;
    state.spikes+=Number(Boolean(candidate.spike));
    if(state.removed<limit){
      enqueue(leftIndex);
      enqueue(rightIndex);
      enqueueSpike(rightIndex);
      let i=leftIndex;
      for(let n=0;n<5&&i>=0;n++){
        enqueueSpike(i);
        i=nodes[i].previous;
      }
    }
    return removed.length;
  }

  function commands(){
    const out=[['M',...nodes[first].outgoing[0]]];
    for(let i=first;i>=0;){
      const {next,outgoing}=nodes[i];
      if(!outgoing)break;
      if(next!==first||outgoing.length!==2)out.push(
        [({2:'L',3:'Q',4:'C'})[outgoing.length],...outgoing.slice(1).flat()]);
      if(next===first)break;
      i=next;
    }
    if(part.closed)out.push(['Z']);
    return out;
  }
}

function simplifyContours(entries,budget,spikesOnly){
  const queue=new CandidateQueue();
  const contours=entries.map(({parts})=>parts.map(part=>capacity(part)?contourState(part,queue):null));
  while(budget>0&&queue.values.length){
    const candidate=queue.pop();
    if(spikesOnly&&!candidate.spike)break;
    budget-=candidate.state.remove(candidate);
  }
  return contours;
}

function nesting(path){
  const rings=sampleNativeParts(path,.025).filter(part=>part.closed);
  return rings.map(({points},i)=>rings.map(({points:ring},j)=>{
    if(i===j)return false;
    const [x,y]=points[0];
    let inside=false;
    for(let k=0,k0=ring.length-1;k<ring.length;k0=k++){
      const [a,b]=ring[k0],[c,d]=ring[k];
      if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)inside=!inside;
    }
    return inside;
  }));
}

export function planProgressiveSimplification(document,indices,percent,tolerance=.01){
  return plan(document,indices,percent,tolerance,false);
}

function plan(document,indices,percent,tolerance,spikesOnly){
  const changes=[],stats={percent,removed:0,spikes:0,protected:0};
  if(!(percent>0&&percent<=100))return {changes,stats};
  const result={...document,paths:document.paths.slice()};
  const ratio=(percent/100)**2;
  const entries=[];
  for(const index of new Set(indices)){
    const path=document.paths[index];
    if(!path||path.kind==='image')continue;
    if(/<(?:use|image)\b/i.test(path.artwork||'')){stats.protected++;continue;}
    const parts=nativeParts(path),originalParts=[];
    for(const command of geometryCommands(path)){
      if(command[0]==='M')originalParts.push([]);
      originalParts.at(-1).push(command);
    }
    entries.push({index,path,parts,originalParts});
  }
  const budget=Math.floor(entries.reduce((sum,{parts})=>
    sum+parts.reduce((n,part)=>n+capacity(part),0),0)*ratio);
  if(!budget)return {changes,stats};
  const planned=simplifyContours(entries,budget,spikesOnly);
  for(const [entryIndex,entry] of entries.entries()){
    const {index,path,parts,originalParts}=entry;
    let contours=planned[entryIndex];
    let remaining=contours.reduce((n,contour)=>n+(contour?.removed||0),0);
    const initialBudget=remaining;
    if(!remaining)continue;
    const hadSpikes=contours.some(contour=>contour?.spikes);
    let accepted=false,originalNesting;
    for(let level=0;level<7;level++){
      const fallback=level===6&&!spikesOnly&&hadSpikes;
      if(level){
        if(!remaining&&!fallback)continue;
        [contours]=simplifyContours([entry],fallback?initialBudget:remaining,spikesOnly||fallback);
      }
      const removed=contours.reduce((n,contour)=>n+(contour?.removed||0),0);
      remaining=Math.floor(removed/2);
      if(!removed)continue;
      const commands=contours.flatMap((contour,i)=>contour?.removed?contour.commands():originalParts[i]);
      const candidate={...path,kind:'vector',offset:[0,0],artwork:path.artwork||'<path/>',commands};
      if(!validateCurveChange(path,candidate,{tolerance,nodeTolerance:tolerance}).accepted)continue;
      if(parts.length>1){
        try{
          originalNesting??=JSON.stringify(nesting(path));
          if(originalNesting!==JSON.stringify(nesting(candidate)))continue;
        }catch{break;}
      }
      const spikes=contours.reduce((n,contour)=>n+(contour?.spikes||0),0);
      changes.push({index,commands,removed,spikes});
      result.paths[index]=candidate;stats.removed+=removed;stats.spikes+=spikes;
      if(level)stats.protected++;
      accepted=true;
      break;
    }
    if(!accepted)
      stats.protected++;
  }
  if(changes.length>1||changes.length&&document.paths.length>1){
    const quality=validateDocumentCurveChange(document,result,{tolerance,nodeTolerance:tolerance});
    if(!quality.accepted){
      if(!spikesOnly&&stats.spikes)return plan(document,indices,percent,tolerance,true);
      return {changes:[],stats:{...stats,removed:0,spikes:0,protected:stats.protected+changes.length}};
    }
  }
  return {changes,stats};
}
