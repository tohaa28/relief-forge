// SVG visualization uses the real Bezier anchors, never the sampled diagnostic polyline.
export const issueColors=Object.freeze({
  open:'#1976d2',coincident:'#dd8b16',short:'#d73b4d',
  duplicate:'#8053cb',overlap:'#8053cb',
  self_intersection:'#cb2679',intersection:'#cb5924'
});
export const issueLabels=Object.freeze({
  open:'Незамкнутый контур',coincident:'Совпадающие точки',short:'Короткий сегмент',
  duplicate:'Дублирующий контур',overlap:'Наложение',
  self_intersection:'Самопересечение',intersection:'Пересечение объектов'
});
export function anchors(path){
  if(path.kind==='image')return [];
  if(!path.artwork)return path.points||[];
  // commands are already in document millimetres; final coordinate pair is
  // the anchor for M/L/Q/C, while C's intermediate pairs are control handles.
  return (path.commands||[]).filter(c=>c[0]==='M'||c[0]==='L'||c[0]==='C'||c[0]==='Q')
    .map(c=>[c.at(-2)+(path.offset?.[0]||0),c.at(-1)+(path.offset?.[1]||0)]);
}
// Every anchor is shown unless it coincides with an issue location. The issue
// marker itself is rendered above it in its own problem category color.
// This never changes or resamples the underlying paths.
export function visibleHealthyAnchors(doc,issues,tolerance){
  const tol=Math.max(1e-8,Number(tolerance)||0.01),grid=new Map(),cell=tol;
  function key(x,y){return Math.floor(x/cell)+','+Math.floor(y/cell);}
  for(const issue of issues){
    if(!Array.isArray(issue.point))continue;
    const [x,y]=issue.point;
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const k=key(x,y),a=grid.get(k)||[];a.push(issue.point);grid.set(k,a);
  }
  const result=[];
  for(const [i,p] of doc.paths.entries()){
    for(const pt of anchors(p)){
      if(!Number.isFinite(pt[0])||!Number.isFinite(pt[1]))continue;
      const gx=Math.floor(pt[0]/cell),gy=Math.floor(pt[1]/cell);
      let sick=false;
      for(let dx=-1;dx<=1&&!sick;dx++)for(let dy=-1;dy<=1&&!sick;dy++){
        const a=grid.get((gx+dx)+','+(gy+dy))||[];
        sick=a.some(q=>Math.hypot(pt[0]-q[0],pt[1]-q[1])<=tol);
      }
      if(!sick)result.push({path:i,point:pt});
    }
  }
  return result;
}
// One SVG path for any number of healthy nodes: avoids 10,000s of DOM children.
export function circlePath(pts,r){
  if(!(r>0)||!Number.isFinite(r))throw Error('Неверный радиус маркера');
  return pts.map(x=>{const [a,b]=x.point||x;return 'M '+(a-r)+' '+b+' a '+r+' '+r+' 0 1 0 '+(2*r)+' 0 a '+r+' '+r+' 0 1 0 '+(-2*r)+' 0';}).join(' ');
}
