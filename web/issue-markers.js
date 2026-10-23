import {issueColors,issueLabels} from './vector-points.js';

// SVG uses xMidYMid meet: the limiting viewport dimension determines the
// actual scale. Width alone makes markers shrink on tall/letterboxed sheets.
export function screenUnitsPerPixel(view,width,height){
  if(![view?.width,view?.height,width,height].every(n=>Number.isFinite(n)&&n>0))return 1;
  return Math.max(view.width/width,view.height/height);
}

// Use a spatially stratified subset instead of issues.slice(0,1000).
// Rust issue order follows contour order; on large imported logos the first
// thousand can all belong to lettering at the bottom of the drawing.
export function selectIssueMarkerIndices(issues,limit=1000,bounds=null){
  const valid=[];
  issues.forEach((v,index)=>{
    if(Array.isArray(v?.point)&&v.point.length===2&&v.point.every(Number.isFinite))
      valid.push(index);
  });
  if(valid.length<=limit)return valid;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  if(bounds&&[bounds.x,bounds.y,bounds.width,bounds.height].every(Number.isFinite)&&bounds.width>0&&bounds.height>0){
    minX=bounds.x;minY=bounds.y;maxX=minX+bounds.width;maxY=minY+bounds.height;
  }else{
    for(const i of valid){const [x,y]=issues[i].point;
      minX=Math.min(minX,x);minY=Math.min(minY,y);
      maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  }
  const xSpan=Math.max(1e-12,maxX-minX),ySpan=Math.max(1e-12,maxY-minY),cells=new Map(),size=32;
  for(const index of valid){
    const [x,y]=issues[index].point,
      cx=Math.max(0,Math.min(size-1,Math.floor((x-minX)/xSpan*size))),
      cy=Math.max(0,Math.min(size-1,Math.floor((y-minY)/ySpan*size)));
    const key=cy*size+cx;
    if(!cells.has(key))cells.set(key,[]);
    cells.get(key).push(index);
  }
  // A deterministic multi-round distribution guarantees that every occupied
  // cell receives a marker before a dense cell can consume a second one.
  let active=[...cells].sort((a,b)=>a[0]-b[0]).map(([key,indices])=>({key,indices,pos:0}));
  const chosen=[];
  while(active.length&&chosen.length<limit){
    const next=[];
    for(const cell of active){
      if(chosen.length>=limit)break;
      chosen.push(cell.indices[cell.pos++]);
      if(cell.pos<cell.indices.length)next.push(cell);
    }
    active=next;
  }
  return chosen;
}
// A malformed/misregistered worker issue must not be drawn at a coordinate
// unrelated to either source contour. This conservative bounds check doesn't
// claim point-to-segment precision or validate cross-batch interactions.
export function issueWithinContourBounds(issue,contours,tolerance=0.01){
  if(!Array.isArray(issue?.point)||issue.point.length!==2||!issue.point.every(Number.isFinite))return false;
  const margin=Math.max(1e-6,Math.abs(tolerance)*2);
  for(const idx of [issue.path,issue.other]){
    const contour=contours?.[idx];
    if(!contour||!Array.isArray(contour.points)||!contour.points.length)continue;
    let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
    for(const p of contour.points){xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0]);ymin=Math.min(ymin,p[1]);ymax=Math.max(ymax,p[1]);}
    const [x,y]=issue.point;
    if(x>=xmin-margin&&x<=xmax+margin&&y>=ymin-margin&&y<=ymax+margin)return true;
  }
  return false;
}

export function renderIssueMarkers(parent,issues,unitsPerPixel,bounds=null){
  const unit=Number.isFinite(unitsPerPixel)&&unitsPerPixel>0?unitsPerPixel:1;
  const create=(tag,attrs,container)=>{
    const node=parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    container.appendChild(node);return node;
  };
  let count=0;
  const subset=selectIssueMarkerIndices(issues,1000,bounds);
  subset.forEach(index=>{
    const issue=issues[index];
    if(!Array.isArray(issue.point)||issue.point.length!==2||!issue.point.every(Number.isFinite))return;
    const [x,y]=issue.point,color=issueColors[issue.kind]||'#64748b';
    const label=(index+1)+'. '+(issueLabels[issue.kind]||'Проблема')+
      ' · X '+x.toFixed(3)+' · Y '+y.toFixed(3)+' мм';
    const group=create('g',{'data-issue':index,class:'problem-marker',role:'button',tabindex:0,'aria-label':label},parent);
    create('title',{},group).textContent=label+' — нажмите, чтобы приблизить';
    create('circle',{cx:x,cy:y,r:8*unit,class:'issue-halo'},group);
    create('circle',{cx:x,cy:y,r:7*unit,class:'issue-ring',stroke:color},group);
    create('circle',{cx:x,cy:y,r:2.5*unit,class:'problem issue-core',style:'fill:'+color},group);
    // Numbers clutter the entire engraving when hundreds of markers overlap.
    // Use titles/accessible labels and display on-canvas numbers only for small sets.
    if(subset.length<=60)create('text',{x:x+10*unit,y:y-9*unit,'font-size':12*unit,fill:color,class:'issue-number'},group).textContent=index+1;
    count++;
  });
  return count;
}
