import {nativeParts,pointDistance} from './native-bezier.js?v=0.2.0-alpha.72';

// Bound SVG anchor elements to a small cursor-centred screen neighbourhood.
// The index is computed once for a path snapshot; mousemove never traverses
// 7000+ nodes, rebuilds a compound path, or creates thousands of DOM elements.
export function buildAnchorIndex(nodes){
  const valid=nodes.filter(n=>Array.isArray(n.point)&&n.point.every(Number.isFinite));
  if(!valid.length)return {nodes:[],cell:1,buckets:new Map()};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const n of valid){
    minX=Math.min(minX,n.point[0]);minY=Math.min(minY,n.point[1]);
    maxX=Math.max(maxX,n.point[0]);maxY=Math.max(maxY,n.point[1]);
  }
  const cell=Math.max(.05,Math.sqrt(Math.max(.01,(maxX-minX)*(maxY-minY))/valid.length)*3);
  const buckets=new Map();
  for(const n of valid){
    const key=Math.floor(n.point[0]/cell)+':'+Math.floor(n.point[1]/cell);
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(n);
  }
  return {nodes:valid,cell,buckets};
}
export function nearbyAnchors(index,point,radius,{limit=240,includeIndex=null}={}){
  if(!index||!Array.isArray(point)||!Number.isFinite(radius)||radius<=0)return [];
  const cell=index.cell,minX=Math.floor((point[0]-radius)/cell),maxX=Math.floor((point[0]+radius)/cell),
    minY=Math.floor((point[1]-radius)/cell),maxY=Math.floor((point[1]+radius)/cell);
  const close=[];
  // Avoid a huge empty-cell loop for degenerate tiny drawings at extreme
  // zoom-out. Iterating occupied cells is cheaper than visiting millions of
  // sparse coordinates; neither branch creates DOM for every anchor.
  const checkBucket=bucket=>{
    for(const n of bucket){
      const d=pointDistance(n.point,point);
      if(d<=radius||n.index===includeIndex)close.push({n,d});
    }
  };
  const cells=(maxX-minX+1)*(maxY-minY+1);
  if(cells>12000){
    for(const [key,bucket] of index.buckets){
      const [x,y]=key.split(':').map(Number);
      if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY)checkBucket(bucket);
    }
  }else for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++)
    checkBucket(index.buckets.get(x+':'+y)||[]);
  close.sort((a,b)=>a.d-b.d||a.n.index-b.n.index);
  const output=close.slice(0,Math.max(1,limit)).map(v=>v.n);
  if(includeIndex!==null&&!output.some(n=>n.index===includeIndex)){
    const pinned=index.nodes.find(n=>n.index===includeIndex);
    if(pinned)output.push(pinned);
  }
  return output;
}

const segmentSVG=controls=>{
  const q=controls.slice(1).flatMap(p=>p);
  return controls.length===2?'L'+q.join(' '):
    controls.length===3?'Q'+q.join(' '):
    controls.length===4?'C'+q.join(' '):'';
};
const segmentPath=controls=>'M'+controls[0].join(' ')+segmentSVG(controls);
const shifted=(point,delta)=>[point[0]+delta[0],point[1]+delta[1]];

// Snapshot only the at-most-two native segments incident to the dragged node.
// This creates a display-only patch; the real command array and all EPS source
// metadata remain untouched until mouseup confirms the operation.
export function createLiveCurvePatch(path,node,{handle=null,type='cusp'}={}){
  if(!node||!Number.isInteger(node.part)||!Number.isInteger(node.ordinal))return null;
  const part=nativeParts(path)[node.part];
  if(!part||!part.segments.length)return null;
  const a=node.ordinal,segments=part.segments;
  const incoming=a>0?segments[a-1]:part.closed?segments.at(-1):null;
  const outgoing=segments[a]||null;
  if(!incoming&&!outgoing)return null;
  return {
    point:[...node.point],handle,type,
    incoming:incoming?.controls.map(p=>[...p])??null,
    outgoing:outgoing?.controls.map(p=>[...p])??null,
    commandIndex:node.index
  };
}
export function drawLiveCurvePatch(patch,target){
  if(!patch||!Array.isArray(target)||target.some(v=>!Number.isFinite(v)))return '';
  const delta=[target[0]-patch.point[0],target[1]-patch.point[1]];
  const a=patch.incoming?.map(p=>[...p])??null;
  const b=patch.outgoing?.map(p=>[...p])??null;
  if(patch.handle==='in'){
    if(a?.length>2)a[a.length-2]=[...target];
  }else if(patch.handle==='out'){
    if(b?.length>2)b[1]=[...target];
  }else{
    if(a){a[a.length-1]=[...target];if(a.length>2)a[a.length-2]=shifted(a[a.length-2],delta);}
    if(b){b[0]=[...target];if(b.length>2)b[1]=shifted(b[1],delta);}
  }
  // Smooth/symmetric handles in native mode re-orient the opposite tangent.
  // Use the same geometric direction and opposing length as the final commit.
  if((patch.handle==='in'||patch.handle==='out')&&patch.type!=='cusp'&&a&&b&&a.length>2&&b.length>2){
    const clicked=patch.handle==='in'?a[a.length-2]:b[1],other=patch.handle==='in'?b[1]:a[a.length-2];
    const v=[clicked[0]-patch.point[0],clicked[1]-patch.point[1]],m=Math.hypot(...v);
    if(m>1e-12){
      const oldLength=pointDistance(other,patch.point),length=patch.type==='symmetric'?m:oldLength;
      const next=[patch.point[0]-v[0]/m*length,patch.point[1]-v[1]/m*length];
      if(patch.handle==='in')b[1]=next;else a[a.length-2]=next;
    }
  }
  return [a&&segmentPath(a),b&&segmentPath(b)].filter(Boolean).join(' ');
}
