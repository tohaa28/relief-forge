// Rust/WASM repair workflow helpers. All four steps are existing deterministic
// kernel actions. None is applied to the source before visual approval.
export const AUTO_STEPS=Object.freeze([
  {action:2,name:'Убрать соседние совпадающие узлы'},
  {action:1,name:'Убрать дубликаты'},
  {action:3,name:'Соединить однозначные близкие концы'},
  {action:4,name:'Замкнуть близкие концы'}
]);
export function basicPaths(paths){
  return paths.map(p=>({points:p.points.map(a=>[...a]),closed:Boolean(p.closed)}));
}
export function packedInput(paths,tolerance,action=0,parameter=1){
  if(!Number.isFinite(tolerance)||tolerance<1e-9||tolerance>1000)throw Error('Неверный допуск лечения');
  if(paths.reduce((n,p)=>n+p.points.length,0)>2000)throw Error('Превышен лимит 2000 расчётных узлов. Выберите меньше объектов или увеличьте допуск.');
  const input=[tolerance,action,parameter,paths.length];
  for(const p of paths){
    if(!Array.isArray(p.points)||p.points.some(q=>q.length!==2||q.some(v=>!Number.isFinite(v))))throw Error('Некорректные координаты');
    input.push(+p.closed,p.points.length,...p.points.flat());
  }
  return input;
}
export function isChanged(before,after){
  return JSON.stringify(basicPaths(before))!==JSON.stringify(basicPaths(after));
}
export function issueTotals(issues){
  const map={};for(const issue of issues){map[issue.kind]=(map[issue.kind]||0)+1;}return map;
}
// Focus a comparable local square on the first reported defect. The two panes
// share identical coordinates, so a changed contour is visibly comparable.
export function comparisonBox(before,after,issue,tolerance=0.01){
  const pts=[...before,...after].flatMap(p=>p.points);
  if(!pts.length)return {x:0,y:0,width:10,height:10};
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs),minY=Math.min(...ys),maxX=Math.max(...xs),maxY=Math.max(...ys);
  const extent=Math.max(maxX-minX,maxY-minY,0.1),span=Math.max(extent/5,tolerance*30,0.3);
  const [cx,cy]=issue?.point||[(minX+maxX)/2,(minY+maxY)/2];
  return {x:cx-span/2,y:cy-span/2,width:span,height:span};
}
export function proposedIssueLocations(beforeIssues,afterIssues,tolerance=0.01){
  const matched=[];
  for(const issue of beforeIssues){
    const unresolved=afterIssues.some(x=>x.kind===issue.kind&&Math.hypot(x.point[0]-issue.point[0],x.point[1]-issue.point[1])<=Math.max(tolerance,1e-5));
    matched.push({...issue,resolved:!unresolved});
  }
  return matched;
}
