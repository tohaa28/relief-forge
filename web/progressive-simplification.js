import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.94';
import {evaluateBezier,nativeParts,pointDistance,sampleNativeParts} from './native-bezier.js?v=0.2.0-alpha.94';
import {validateCurveChange,validateDocumentCurveChange} from './curve-quality.js?v=0.2.0-alpha.94';

const compareCandidates=(a,b)=>a.distance-b.distance||a.error-b.error||a.order-b.order;

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

const capacity=part=>Math.max(0,part.segments.length-(part.closed?3:1));

function contourState(part,queue){
  const edges=part.segments.map(segment=>segment.controls);
  const count=edges.length+(part.closed?0:1);
  const nodes=Array.from({length:count},(_,i)=>({previous:i-1,next:i+1,
    outgoing:edges[i],active:true,revision:0}));
  nodes.at(-1).next=part.closed?0:-1;
  const limit=capacity(part);
  const state={removed:0,remove,commands};
  for(let i=1;i<count;i++)enqueue(i);
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

  function remove(candidate){
    const node=nodes[candidate.index];
    if(state.removed===limit||!node.active||node.revision!==candidate.revision)return false;
    const left=nodes[node.previous],right=nodes[node.next];
    left.outgoing=candidate.controls;
    left.next=node.next;
    right.previous=node.previous;
    node.active=false;
    state.removed++;
    if(state.removed<limit){
      enqueue(node.previous);
      enqueue(node.next);
    }
    return true;
  }

  function commands(){
    const out=[['M',...part.start]];
    for(let i=0;i>=0;){
      const {next,outgoing}=nodes[i];
      if(!outgoing)break;
      if(next!==0||outgoing.length!==2)out.push(
        [({2:'L',3:'Q',4:'C'})[outgoing.length],...outgoing.slice(1).flat()]);
      if(next===0)break;
      i=next;
    }
    if(part.closed)out.push(['Z']);
    return out;
  }
}

function simplifyContours(entries,budget){
  const queue=new CandidateQueue();
  const contours=entries.map(({parts})=>parts.map(part=>capacity(part)?contourState(part,queue):null));
  while(budget>0&&queue.values.length){
    const candidate=queue.pop();
    if(candidate.state.remove(candidate))budget--;
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
  const changes=[],stats={percent,removed:0,protected:0};
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
  const planned=simplifyContours(entries,budget);
  for(const [entryIndex,entry] of entries.entries()){
    const {index,path,parts,originalParts}=entry;
    let contours=planned[entryIndex];
    let remaining=contours.reduce((n,contour)=>n+(contour?.removed||0),0);
    if(!remaining)continue;
    let accepted=false,originalNesting;
    for(let level=0;level<6&&remaining;level++){
      if(level)[contours]=simplifyContours([entry],remaining);
      const removed=contours.reduce((n,contour)=>n+(contour?.removed||0),0);
      remaining=Math.floor(removed/2);
      if(!removed)break;
      const commands=contours.flatMap((contour,i)=>contour?.removed?contour.commands():originalParts[i]);
      const candidate={...path,kind:'vector',offset:[0,0],artwork:path.artwork||'<path/>',commands};
      if(!validateCurveChange(path,candidate,{tolerance,nodeTolerance:tolerance}).accepted)continue;
      if(parts.length>1){
        try{
          originalNesting??=JSON.stringify(nesting(path));
          if(originalNesting!==JSON.stringify(nesting(candidate)))continue;
        }catch{break;}
      }
      changes.push({index,commands,removed});
      result.paths[index]=candidate;stats.removed+=removed;
      if(level)stats.protected++;
      accepted=true;
      break;
    }
    if(!accepted)
      stats.protected++;
  }
  if(changes.length>1||changes.length&&document.paths.length>1){
    const quality=validateDocumentCurveChange(document,result,{tolerance,nodeTolerance:tolerance});
    if(!quality.accepted)return {changes:[],stats:{...stats,removed:0,protected:stats.protected+changes.length}};
  }
  return {changes,stats};
}
