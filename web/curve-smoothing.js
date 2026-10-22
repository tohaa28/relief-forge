// True cubic Bézier smoothing. Works on real C control handles (NOT on a
// sampled polyline). Retains knots, endpoints, open/closed path topology and
// independent subpaths. Corners sharper than 65° are left untouched.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const mul=(a,t)=>[a[0]*t,a[1]*t];
const norm=a=>Math.hypot(a[0],a[1]);
const clamp=(a,b,t)=>Math.max(a,Math.min(b,t));
const unit=a=>{const n=norm(a);return n>1e-12?mul(a,1/n):null};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const distance=(a,b)=>norm(sub(a,b));
export function smoothVectorPath(path,amount){
  if(!Number.isFinite(amount)||amount<0||amount>2)throw Error('Размер сглаживания от 0 до 2 мм');
  if(path.kind==='image')return {path:structuredClone(path),joints:0,maxHandleShift:0};
  if(path.artwork&&/(?:clip-path|mask=|filter=|<image\b|fill="url\()/i.test(path.artwork))
    throw Error('Сглаживание масок, растровых изображений и обтравок не поддерживается без потери оформления');
  const original=path.artwork?path.commands:(path.points||[]).map((p,i)=>[i?'L':'M',...p]).concat(path.closed?[['Z']]:[]);
  if(!Array.isArray(original)||!amount||original.length<3)return {path:structuredClone(path),joints:0,maxHandleShift:0};
  const offset=path.offset||[0,0],commands=original.map(cmd=>cmd[0]==='Z'?['Z']:[cmd[0],...cmd.slice(1).map((n,i)=>n+offset[i%2])]);
  let joints=0,maxHandleShift=0;
  for(let i=2;i<commands.length;i++){
    const left=commands[i-1],right=commands[i];
    if(left[0]!=='C'||right[0]!=='C')continue;
    // Previous cubic ends at the vertex, next cubic starts there.
    const p=[left[5],left[6]],back=[left[3],left[4]],forward=[right[1],right[2]];
    const lenBack=distance(p,back),lenForward=distance(forward,p);
    const u=unit(sub(p,back)),v=unit(sub(forward,p));
    if(!u||!v||lenBack<1e-7||lenForward<1e-7)continue;
    const cosine=clamp(-1,1,dot(u,v));
    if(cosine<Math.cos(65*Math.PI/180))continue; // preserve intentional corners
    const tangent=unit(add(u,v));if(!tangent)continue;
    const wantedBack=sub(p,mul(tangent,lenBack));
    const wantedForward=add(p,mul(tangent,lenForward));
    // Both handle moves are independently bounded by the requested mm.
    // Since endpoints and all other controls are unchanged, Bernstein's
    // convex hull bounds the displacement of each cubic to <= handle shift.
    const cap=(from,to)=>{
      const delta=sub(to,from),d=norm(delta);return d>amount?add(from,mul(delta,amount/d)):to;
    };
    const newBack=cap(back,wantedBack),newForward=cap(forward,wantedForward);
    const d1=distance(newBack,back),d2=distance(newForward,forward);
    if(Math.max(d1,d2)<1e-10)continue;
    left[3]=newBack[0];left[4]=newBack[1];
    right[1]=newForward[0];right[2]=newForward[1];
    joints++;maxHandleShift=Math.max(maxHandleShift,d1,d2);
  }
  if(!joints)return {path:structuredClone(path),joints:0,maxHandleShift:0};
  // Materialize changed geometry as a self-contained path for SVG renderer
  // and EPS; never retain the original artwork markup after smoothing.
  const pts=commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2));
  const d=commands.map(c=>c.join(' ')).join(' ');
  const out={...structuredClone(path),kind:'vector',points:pts,closed:commands.at(-1)?.[0]==='Z',
    commands,offset:[0,0],artwork:'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.07"/>'};
  return {path:out,joints,maxHandleShift};
}
export function smoothPaths(source,indices,amount){
  const selected=new Set(indices);
  let joints=0,maxHandleShift=0;
  const paths=source.paths.map((p,i)=>{
    if(!selected.has(i))return structuredClone(p);
    const r=smoothVectorPath(p,amount);
    joints+=r.joints;maxHandleShift=Math.max(maxHandleShift,r.maxHandleShift);
    return r.path;
  });
  return {document:{...structuredClone(source),paths},stats:{joints,maxHandleShift,amount}};
}
export function visibleGeometryChange(source,result,scope){
  return scope.some(i=>JSON.stringify(source.paths[i]?.commands||source.paths[i]?.points)!==
    JSON.stringify(result.paths[i]?.commands||result.paths[i]?.points));
}
