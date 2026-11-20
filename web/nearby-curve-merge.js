import {nativeParts,pointDistance,cubicControls,controlsBounds,evaluateBezier} from './native-bezier.js?v=0.2.0-alpha.69';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.69';
import {finishDeferredCurveCommands} from './curve-edit.js?v=0.2.0-alpha.69';

// Local tolerance welding; never invoked by pointermove, manual Done, or Undo.
// A proposed change is written ONLY after exact-native topology and paint checks.
const D=pointDistance;
const shift=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const minus=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const bounds=pts=>pts.reduce((b,p)=>[
  Math.min(b[0],p[0]),Math.min(b[1],p[1]),
  Math.max(b[2],p[0]),Math.max(b[3],p[1])
],[Infinity,Infinity,-Infinity,-Infinity]);
const overlaps=(a,b,epsilon=0)=>a&&b&&a[0]<=b[2]+epsilon&&b[0]<=a[2]+epsilon&&
  a[1]<=b[3]+epsilon&&b[1]<=a[3]+epsilon;
const expand=(b,t)=>[b[0]-t,b[1]-t,b[2]+t,b[3]+t];
const cloneCommands=p=>p.artwork?structuredClone(p.commands):
  p.points.map((q,i)=>[i?'L':'M',...q]).concat(p.closed?[['Z']]:[]);
const last=c=>c.slice(-2);
const allControls=p=>nativeParts(p).flatMap(part=>part.segments.map(s=>s.controls));
function bboxPath(p){
  const cc=allControls(p),off=p.offset||[0,0];
  return cc.length?bounds(cc.flat().map(q=>shift(q,off))):null;
}
const isFiniteCommands=cmds=>cmds.every(c=>c.slice(1).every(x=>Number.isFinite(x)&&Math.abs(x)<=1e9));
function asPath(path,commands,Parser){
  if(!isFiniteCommands(commands))throw Error('merge-near-nonfinite');
  const value=finishDeferredCurveCommands(path,commands,{}, {Parser});
  value.nodeKinds={};return value;
}
const segs=p=>nativeParts(p).flatMap(q=>q.segments);
const supported=p=>p&&p.kind!=='image'&&Array.isArray(p.artwork?p.commands:p.points)&&
  !(p.artwork&&/(?:clip-path|mask=|filter=|fill="url\(|<image\b|<use\b)/i.test(p.artwork));

// Integral 1/2 ∮(x dy - y dx) by 3-point Gauss-Legendre.
// It is exact for L, Q and cubic Bezier polynomial coordinates.
const samples=[.1127016653792583,.5,.8872983346207417],weights=[5/18,8/18,5/18];
function areaOf(part){
  let sum=0;
  for(const seg of part.segments){
    const [p0,p1,p2,p3]=cubicControls(seg.controls);
    for(let k=0;k<3;k++){
      const t=samples[k],u=1-t,p=evaluateBezier([p0,p1,p2,p3],t);
      const d=[0,1].map(j=>3*(u*u*(p1[j]-p0[j])+
        2*u*t*(p2[j]-p1[j])+t*t*(p3[j]-p2[j])));
      sum+=(p[0]*d[1]-p[1]*d[0])*weights[k]/2;
    }
  }
  return sum;
}
function areaPreserved(before,after,tol,span,strict){
  if(!strict)return true;
  const x=nativeParts(before),y=nativeParts(after);
  if(x.length!==y.length||x.some((p,i)=>p.closed!==y[i].closed))return false;
  for(let i=0;i<x.length;i++){
    if(!x[i].closed)continue;
    const a=areaOf(x[i]),b=areaOf(y[i]);
    if(Math.abs(a)>1e-9&&Math.sign(a)!==Math.sign(b))return false;
    if(Math.abs(a-b)>Math.max(tol*tol*2,tol*Math.max(span,0)*.55))return false;
  }
  return true;
}
function segmentPath(controls){
  return {kind:'vector',artwork:'<path/>',offset:[0,0],commands:[
    ['M',...controls[0]],
    [controls.length===4?'C':controls.length===3?'Q':'L',...controls.slice(1).flat()]
  ]};
}
function localCurves(doc,index,replacement,box,maxLocal=104){
  const rows=[];
  for(let j=0;j<doc.paths.length;j++){
    const p=j===index?replacement:doc.paths[j];
    if(!supported(p))continue;
    const off=p.offset||[0,0],b=bboxPath(p);
    if(!b||!overlaps(b,box))continue;
    for(const s of segs(p)){
      const points=s.controls.map(q=>shift(q,off));
      if(overlaps(controlsBounds(points),box)){
        rows.push(points);
        if(rows.length>maxLocal)throw Error('merge-near-local-budget');
      }
    }
  }
  return rows;
}
function strictContacts(rows){
  if(rows.length<2)return [];
  const hits=nativeIntersections(rows.map(segmentPath),
    {maxCurves:116,maxIssues:400,allowPartial:false});
  if(!hits.complete||hits.unresolved)throw Error('merge-near-incomplete-intersections');
  return hits.filter(h=>h.crossing||h.overlap);
}
function contactPreserved(before,after,tol){
  return after.every(hit=>before.some(old=>
    old.crossing===hit.crossing&&old.overlap===hit.overlap&&
    D(old.point,hit.point)<=Math.max(1e-7,tol*.9)));
}
function localTopologySafe(doc,index,source,candidate,box,tol){
  const oldRows=localCurves(doc,index,source,box);
  const newRows=localCurves(doc,index,candidate,box);
  return contactPreserved(strictContacts(oldRows),strictContacts(newRows),tol);
}
const norm=p=>Math.hypot(...p);
function tinySegmentCandidates(path,tol){
  const source=cloneCommands(path),parts=nativeParts(path),found=[];
  for(const part of parts){
    if(part.closed&&part.segments.length<=3)continue;
    if(!part.closed&&part.segments.length<=2)continue;
    for(let j=1;j<part.segments.length;j++){
      const s=part.segments[j],prev=part.segments[j-1];
      if(!['L','C','Q'].includes(source[s.command]?.[0])||
        !['L','C','Q'].includes(source[prev.command]?.[0]))continue;
      const center=s.controls[0],hull=Math.max(...s.controls.map(p=>D(center,p)));
      if(hull>tol||hull<=0&&D(center,s.controls.at(-1))===0&&s.controls.length===4&&
         D(s.controls[1],center)>tol)continue;
      const end=s.controls.at(-1),change=minus(end,center);
      // A tiny hairpin with opposing tangents may encode a real pointed detail.
      const incoming=minus(center,prev.controls.at(-2)??prev.controls[0]);
      const next=part.segments[j+1];
      const outgoing=next?minus(next.controls[1]??next.controls.at(-1),end):null;
      if(outgoing&&norm(incoming)>1e-9&&norm(outgoing)>1e-9&&
         (incoming[0]*outgoing[0]+incoming[1]*outgoing[1])/
         (norm(incoming)*norm(outgoing))<-.45)continue;
      found.push({command:s.command,previous:prev.command,controls:s.controls,
        prevControls:prev.controls,hull,span:D(prev.controls[0],prev.controls.at(-1)),
        box:bounds([...prev.controls,...s.controls])});
    }
  }
  return found.sort((a,b)=>a.hull-b.hull);
}
function tryWeld(doc,index,proposal,tol,strict,Parser,stats){
  const path=doc.paths[index],commands=cloneCommands(path);
  const c=commands[proposal.command],prev=commands[proposal.previous];
  if(!c||!prev||!['L','Q','C'].includes(c[0])||!['L','Q','C'].includes(prev[0]))return false;
  const end=last(c),p0=last(prev),delta=minus(end,p0);
  if(D(end,p0)>tol)return false;
  const modified=structuredClone(commands);
  const p=modified[proposal.previous];
  p.splice(p.length-2,2,...end);
  if(p[0]==='C'){p[3]+=delta[0];p[4]+=delta[1];}
  else if(p[0]==='Q'){p[1]+=delta[0]*.5;p[2]+=delta[1]*.5;}
  modified.splice(proposal.command,1);
  let candidate;
  try{candidate=asPath(path,modified,Parser);}
  catch{stats.skipped++;return false;}
  if(!areaPreserved(path,candidate,tol,proposal.span,strict)){stats.skipped++;return false;}
  const offset=path.offset||[0,0];
  const sweep=expand(bounds([...proposal.prevControls,...proposal.controls,
    ...segs(candidate).flatMap(s=>s.controls).filter(p=>overlaps(
      [p[0],p[1],p[0],p[1]],expand(proposal.box,tol)))]).map(p=>shift(p,offset))),tol*1.5);
  try{
    if(!localTopologySafe(doc,index,path,candidate,sweep,tol)){stats.skipped++;return false;}
  }catch{stats.limited++;return false;}
  doc.paths[index]=candidate;
  stats.weldedNodes++;stats.maxMovementMm=Math.max(stats.maxMovementMm,Math.max(proposal.hull,D(end,p0)));
  return true;
}
// Preserve only simple, opaque, same-paint single paths. Different material,
// opacity, clips and transforms must NEVER be merged based on proximity.
function styleKey(p){
  if(!supported(p))return null;
  const artwork=p.artwork||'',paint=p.paint||{};
  if(/(?:opacity\s*=|mix-blend-mode|clip-path|mask\s*=|filter\s*=|transform\s*=|<image\b|<use\b)/i.test(artwork))return null;
  if(paint.opacity!=null&&paint.opacity!==1)return null;
  if(paint.fillOpacity!=null&&paint.fillOpacity!==1)return null;
  if(paint.strokeOpacity!=null&&paint.strokeOpacity!==1)return null;
  if(paint.blendMode&&paint.blendMode!=='normal')return null;
  if(artwork&&((artwork.match(/<path\b/gi)||[]).length!==1||
     (artwork.match(/\bd=(["'])[\s\S]*?\1/i)||[]).length===0))return null;
  const style=artwork.replace(/\bd=(["'])[\s\S]*?\1/i,'d=""').replace(/\s+/g,' ');
  return JSON.stringify([style,paint,p.kind]);
}
function closedEquivalence(a,b,tol){
  const pa=nativeParts(a),pb=nativeParts(b);
  if(pa.length!==1||pb.length!==1||!pa[0].closed||!pb[0].closed)return false;
  const ca=cloneCommands(a),cb=cloneCommands(b);
  if(ca.length!==cb.length||ca.length>220)return false;
  const oa=a.offset||[0,0],ob=b.offset||[0,0];
  let max=0;
  for(let i=0;i<ca.length;i++){
    if(ca[i][0]!==cb[i][0]||ca[i].length!==cb[i].length)return false;
    for(let k=1;k<ca[i].length;k+=2){
      max=Math.max(max,D(shift(ca[i].slice(k,k+2),oa),shift(cb[i].slice(k,k+2),ob)));
      if(max>tol)return false;
    }
  }
  const areaA=areaOf(pa[0]),areaB=areaOf(pb[0]);
  return Math.sign(areaA)===Math.sign(areaB)&&
    Math.abs(areaA-areaB)<=tol*tol*2+tol*.02;
}
function removeNearCopies(doc,selection,tol,stats){
  const bins=new Map(),discard=new Set();
  const cell=Math.max(1e-7,tol);
  const key=(s,x,y)=>s+'|'+x+':'+y;
  for(let i=0;i<doc.paths.length;i++){
    if(!selection.has(i)||discard.has(i))continue;
    const p=doc.paths[i],style=styleKey(p);
    if(!style||cloneCommands(p).length>220)continue;
    const parts=nativeParts(p);
    if(parts.length!==1||!parts[0].closed)continue;
    const start=shift(parts[0].start,p.offset||[0,0]),
      x=Math.floor(start[0]/cell),y=Math.floor(start[1]/cell);
    const signature=style+'#'+cloneCommands(p).length;
    const near=[];
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
      near.push(...bins.get(key(signature,x+dx,y+dy))||[]);
    if(near.length>24){stats.limited++;continue;}
    let match=false;
    for(const j of near){
      if(discard.has(j))continue;
      if(closedEquivalence(p,doc.paths[j],tol)){match=true;break;}
    }
    if(match){discard.add(i);stats.mergedCurves++;}else{
      const k=key(signature,x,y);if(!bins.has(k))bins.set(k,[]);
      bins.get(k).push(i);
    }
  }
  for(const i of Array.from(discard).sort((a,b)=>b-a))doc.paths.splice(i,1);
  return discard;
}
function openPart(p){
  const parts=nativeParts(p);
  if(parts.length!==1||parts[0].closed||parts[0].segments.length<1||
     parts[0].segments.length>100)return null;
  const seg=parts[0].segments,off=p.offset||[0,0];
  return {start:shift(seg[0].controls[0],off),
    end:shift(seg.at(-1).controls.at(-1),off),
    count:seg.length};
}
function reverseOpen(commands){
  const parts=nativeParts({kind:'vector',commands,artwork:'<path/>',offset:[0,0]});
  const segments=parts[0].segments;
  return [['M',...segments.at(-1).controls.at(-1)],
    ...segments.toReversed().map(s=>{
      const c=s.controls.toReversed();
      return [c.length===4?'C':c.length===3?'Q':'L',...c.slice(1).flat()];
    })];
}
const tangentAt=(p,side)=>{
  const parts=nativeParts(p),segments=parts[0]?.segments;
  if(!segments?.length)return null;
  const s=side==='start'?segments[0]:segments.at(-1),c=s.controls;
  return side==='start'?minus(c[1],c[0]):minus(c.at(-1),c.at(-2));
};
function connectOpen(doc,selected,tol,Parser,stats){
  // Only unfilled, untransformed strokes. Filled EPS outlines cannot be joined
  // without changing the fill rule or destroying independent islands.
  const rows=[];
  for(let i=0;i<doc.paths.length;i++){
    if(!selected.has(i))continue;
    const p=doc.paths[i],style=styleKey(p),c=cloneCommands(p);
    if(!style||!/\bfill\s*=\s*(['"])none\1/i.test(p.artwork||'')||
      c.filter(x=>x[0]==='M').length!==1)continue;
    const part=openPart(p);if(part)rows.push({index:i,style,part});
  }
  const candidates=[];
  for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){
    const x=rows[a],y=rows[b];
    if(x.style!==y.style)continue;
    for(const sideA of ['start','end'])for(const sideB of ['start','end']){
      const gap=D(x.part[sideA],y.part[sideB]);
      if(gap<=tol&&gap>1e-9)candidates.push({a:x.index,b:y.index,sideA,sideB,gap});
    }
  }
  const rank=new Map();
  for(const c of candidates)for(const k of [c.a,c.b])rank.set(k,(rank.get(k)||0)+1);
  const used=new Set(),deleted=new Set();
  for(const c of candidates.sort((a,b)=>a.gap-b.gap)){
    if(rank.get(c.a)!==1||rank.get(c.b)!==1||used.has(c.a)||used.has(c.b))continue;
    const pa=doc.paths[c.a],pb=doc.paths[c.b];
    const originalA=cloneCommands(pa),originalB=cloneCommands(pb);
    const a=c.sideA==='end'?originalA:reverseOpen(originalA);
    const b=c.sideB==='start'?originalB:reverseOpen(originalB);
    const endA=last(a.at(-1)),startB=last(b[0]),delta=minus(endA,startB);
    const va=minus(endA,a.at(-1)[0]==='C'?a.at(-1).slice(3,5):
      a.length>1?a.at(-2).slice(-2):endA);
    const vb=minus(b[1]?.[0]==='C'?b[1].slice(1,3):last(b[1]),startB);
    const dot=norm(va)*norm(vb)>1e-10?
      (va[0]*vb[0]+va[1]*vb[1])/(norm(va)*norm(vb)):1;
    if(dot<.6){stats.skipped++;continue;}
    const combined=[...a,...b.slice(1).map((x,i)=>{
      if(i!==0||x[0]!=='C')return [...x];
      return [x[0],x[1]+delta[0],x[2]+delta[1],...x.slice(3)];
    })];
    let candidate;
    try{candidate=asPath(pa,combined,Parser);}
    catch{stats.skipped++;continue;}
    try{
      const before=nativeIntersections([pa,pb],{maxCurves:220,maxIssues:400});
      const after=nativeIntersections([candidate],{maxCurves:220,maxIssues:400});
      if(!before.complete||!after.complete||
        !contactPreserved(before.filter(h=>h.crossing||h.overlap),
          after.filter(h=>h.crossing||h.overlap),tol))continue;
    }catch{stats.limited++;continue;}
    doc.paths[c.a]=candidate;deleted.add(c.b);used.add(c.a);used.add(c.b);
    stats.connectedOpen++;stats.maxMovementMm=Math.max(stats.maxMovementMm,c.gap);
  }
  for(const i of [...deleted].sort((a,b)=>b-a))doc.paths.splice(i,1);
  return deleted;
}
export function mergeNearbyGeometry(source,indices,tolerance,{
  Parser=globalThis.DOMParser,strict=true,maxWelds=600,maxPerPath=180,
  mergeCopies=true,connectOpenPaths=true
}={}){
  if(!Number.isFinite(tolerance)||tolerance<=0||tolerance>1)
    throw Error('Допуск объединения должен быть больше 0 и не превышать 1 мм');
  const document=structuredClone(source),selected=new Set(indices);
  const stats={candidates:0,weldedNodes:0,mergedCurves:0,connectedOpen:0,
    skipped:0,limited:0,maxMovementMm:0};
  let total=0;
  for(const index of selected){
    const path=document.paths[index];if(!supported(path))continue;
    const ignored=new Set();
    for(let step=0;step<maxPerPath;step++){
      const candidates=tinySegmentCandidates(document.paths[index],tolerance)
        .filter(x=>!ignored.has(x.command+':'+x.previous));
      if(!candidates.length)break;
      const selected=candidates[0];
      stats.candidates++;
      if(tryWeld(document,index,selected,tolerance,strict,Parser,stats)){
        ignored.clear();total++;
        if(total>=maxWelds){stats.limited++;break;}
      }else ignored.add(selected.command+':'+selected.previous);
    }
    if(total>=maxWelds)break;
  }
  // Cross-object changes take place only after local node surgery; do not
  // remap source indices until no more index-based edits remain.
  if(mergeCopies)removeNearCopies(document,selected,tolerance,stats);
  if(connectOpenPaths)connectOpen(document,selected,tolerance,Parser,stats);
  return {document,stats};
}
