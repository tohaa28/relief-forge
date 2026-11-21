import {splitBezier} from './native-bezier.js?v=0.2.0-alpha.84';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.84';
import {pruneCoveredRetraces} from './covered-retraces.js?v=0.2.0-alpha.84';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const end=c=>c.slice(-2);

function rejoinSubdividedCubics(start,left,right,tolerance){
  if(left?.[0]!=='C'||right?.[0]!=='C')return null;
  const a=[start,left.slice(1,3),left.slice(3,5),end(left)];
  const b=[end(left),right.slice(1,3),right.slice(3,5),end(right)];
  const span=controls=>Math.max(...controls.map(p=>distance(controls[0],p)));
  if(Math.min(span(a),span(b))>tolerance)return null;
  const l=distance(a[2],a[3]),r=distance(b[0],b[1]),t=l/(l+r);
  if(!(t>1e-6&&t<1-1e-6))return null;
  const controls=[start,start.map((v,i)=>v+(a[1][i]-v)/t),
    b[3].map((v,i)=>v+(b[2][i]-v)/(1-t)),b[3]];
  const split=splitBezier(controls,t);
  const allowance=64*Number.EPSILON*Math.max(1,...a.flat().map(Math.abs),...b.flat().map(Math.abs));
  if(!split.every((side,i)=>side.every((p,j)=>distance(p,[a,b][i][j])<=allowance)))return null;
  return ['C',...controls.slice(1).flat()];
}

function canWeldWithoutNewContacts(before,after,tolerance){
  const asPath=commands=>({artwork:'<path/>',commands});
  try{
    const options={maxCurves:720,maxIssues:300};
    const previous=nativeIntersections([asPath(before)],options);
    const next=nativeIntersections([asPath(after)],options);
    return next.every(hit=>previous.some(old=>old.crossing===hit.crossing&&
      old.overlap===hit.overlap&&distance(old.point,hit.point)<=tolerance));
  }catch{return false;}
}

// Conservative native-command repair. Never flatten C/Q into sampled lines,
// split intersections, weld different contours, or remove a looping curve
// merely because its endpoints are close. The control hull must also fit
// inside the tolerance ball before a whole tiny segment can be removed.
export function repairVectorPoints(source,indices,tolerance,{weldOpen=false}={}){
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1000)throw Error('Неверный допуск исправления точек');
  const document=structuredClone(source),selection=new Set(indices);
  const stats={removedNodes:0,closedGaps:0,maxDeviation:0,skipped:0,removedRetraces:0,removedRetracedNodes:0};
  for(const i of selection){
    const path=document.paths[i];
    if(!path||path.kind==='image')continue;
    // These properties cannot yet be reconstructed from geometry alone.
    if(path.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(path.artwork)){
      stats.skipped++;continue;
    }
    const commands=path.artwork?path.commands:
      path.points.map((p,j)=>[j?'L':'M',...p]).concat(path.closed?[['Z']]:[]);
    const parts=[];let part;
    for(const c of commands){
      if(c[0]==='M'){part=[];parts.push(part);}
      if(!part)throw Error('Исправление точек: отсутствует начальная точка');
      part.push([...c]);
    }
    const repaired=[];let changed=false;
    for(const original of parts){
      const first=end(original[0]),closed=original.at(-1)[0]==='Z';
      const out=[[...original[0]]];let pen=first,removed=0,error=0;
      for(let k=1;k<original.length;k++){
        let c=original[k];
        const joined=distance(pen,end(original[k-1]))===0?
          rejoinSubdividedCubics(pen,c,original[k+1],tolerance):null;
        if(joined){c=joined;k++;removed++;}
        if(c[0]==='Z')continue;
        if(!['L','C','Q'].includes(c[0]))throw Error('Исправление точек: неизвестная команда');
        const hull=[];for(let n=1;n<c.length;n+=2)hull.push(c.slice(n,n+2));
        const extent=Math.max(...hull.map(q=>distance(pen,q)));
        if(extent<=tolerance){removed++;error=Math.max(error,extent);continue;}
        out.push([...c]);pen=end(c);
      }
      // Do not turn an entire tiny object into an empty/point-only contour.
      if(out.length===1){repaired.push(...original);continue;}
      const last=out.at(-1),gap=distance(end(last),first);
      let close=closed;
      const canClose=out.length>2||last[0]==='C'||last[0]==='Q';
      if(weldOpen&&!closed&&gap>0&&gap<=tolerance*2&&canClose){
        const midpoint=first.map((v,k)=>v+(end(last)[k]-v)/2);
        const start=['M',...midpoint],finish=[...last.slice(0,-2),...midpoint];
        const candidate=[start,...out.slice(1,-1),finish,['Z']];
        if(canWeldWithoutNewContacts(out,candidate,tolerance)){
          out[0]=start;out[out.length-1]=finish;
          close=true;stats.closedGaps++;error=Math.max(error,gap/2);changed=true;
        }
      }else if(gap>0&&gap<=tolerance&&canClose){
        last.splice(last.length-2,2,...first);
        close=true;stats.closedGaps++;error=Math.max(error,gap);changed=true;
      }else if(!closed&&gap===0&&canClose){
        close=true;stats.closedGaps++;changed=true;
      }
      if(close)out.push(['Z']);
      if(removed){stats.removedNodes+=removed;changed=true;}
      stats.maxDeviation=Math.max(stats.maxDeviation,error);
      repaired.push(...out);
    }
    if(!path.artwork&&path.closed&&path.points.length>2&&distance(path.points[0],path.points.at(-1))===0){
      changed=true;stats.removedNodes++;
    }
    if(!changed)continue;
    if(path.artwork){
      // Keep the same local command coordinate system and translation.
      path.commands=repaired;
      path.points=repaired.filter(c=>c[0]!=='Z').map(end);
      path.closed=repaired.at(-1)?.[0]==='Z';
      const local=repaired.map(c=>c.join(' ')).join(' ');
      path.artwork='<path d="'+local+'" fill="none" stroke="#34465b" stroke-width="0.07"/>';
    }else{
      path.points=repaired.filter(c=>c[0]!=='Z').map(end);
      path.closed=repaired.at(-1)?.[0]==='Z';
      // Native polylines store closure implicitly, without a repeated anchor.
      if(path.closed&&path.points.length>2&&distance(path.points[0],path.points.at(-1))===0)path.points.pop();
    }
  }
  for(const i of selection){
    const r=pruneCoveredRetraces(document.paths[i]);
    if(r.limited)stats.skipped++;
    if(r.removedNodes){document.paths[i]=r.path;stats.removedRetraces+=r.removedContours;stats.removedRetracedNodes+=r.removedNodes;}
  }
  return {document,stats};
}
