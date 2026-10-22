import {issueColors,issueLabels} from './vector-points.js';

// SVG uses xMidYMid meet: the limiting viewport dimension determines the
// actual scale. Width alone makes markers shrink on tall/letterboxed sheets.
export function screenUnitsPerPixel(view,width,height){
  if(![view?.width,view?.height,width,height].every(n=>Number.isFinite(n)&&n>0))return 1;
  return Math.max(view.width/width,view.height/height);
}

export function renderIssueMarkers(parent,issues,unitsPerPixel){
  const unit=Number.isFinite(unitsPerPixel)&&unitsPerPixel>0?unitsPerPixel:1;
  const create=(tag,attrs,container)=>{
    const node=parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg',tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    container.appendChild(node);return node;
  };
  let count=0;
  issues.slice(0,1000).forEach((issue,index)=>{
    if(!Array.isArray(issue.point)||issue.point.length!==2||!issue.point.every(Number.isFinite))return;
    const [x,y]=issue.point,color=issueColors[issue.kind]||'#64748b';
    const label=(index+1)+'. '+(issueLabels[issue.kind]||'Проблема')+
      ' · X '+x.toFixed(3)+' · Y '+y.toFixed(3)+' мм';
    const group=create('g',{'data-issue':index,class:'problem-marker',role:'button',tabindex:0,'aria-label':label},parent);
    create('title',{},group).textContent=label+' — нажмите, чтобы приблизить';
    create('circle',{cx:x,cy:y,r:8*unit,class:'issue-halo'},group);
    create('circle',{cx:x,cy:y,r:7*unit,class:'issue-ring',stroke:color},group);
    create('circle',{cx:x,cy:y,r:2.5*unit,class:'problem issue-core',style:'fill:'+color},group);
    create('text',{x:x+10*unit,y:y-9*unit,'font-size':12*unit,fill:color,class:'issue-number'},group).textContent=index+1;
    count++;
  });
  return count;
}
