import {pruneCoveredRetraces} from './covered-retraces.js?v=0.2.0-alpha.48';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const end=c=>c.slice(-2);

// Conservative native-command repair. Never flatten C/Q into sampled lines,
// split intersections, weld different contours, or remove a looping curve
// merely because its endpoints are close. The control hull must also fit
// inside the tolerance ball before a whole tiny segment can be removed.
export function repairVectorPoints(source,indices,tolerance){
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
      for(const c of original.slice(1)){
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
      if(gap>0&&gap<=tolerance&&canClose){
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
    if(r.removedContours){document.paths[i]=r.path;stats.removedRetraces+=r.removedContours;stats.removedRetracedNodes+=r.removedNodes;}
  }
  return {document,stats};
}
