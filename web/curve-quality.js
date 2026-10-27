import {sampleNativeParts} from './native-bezier.js?v=0.2.0-alpha.50';
import {nativeIntersections} from './native-intersections.js?v=0.2.0-alpha.50';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const commands=p=>p.artwork?p.commands:(p.points||[]).map((q,i)=>[i?'L':'M',...q]).concat(p.closed?[['Z']]:[]);
function realSegments(path){
  const out=[];let start,pen,part=-1;
  for(const c of commands(path)){
    if(c.slice(1).some(n=>!Number.isFinite(n)))throw Error('nonfinite');
    if(c[0]==='M'){pen=start=c.slice(-2);part++;continue;}
    if(!pen)throw Error('missing-move');
    const end=c[0]==='Z'?start:c.slice(-2);
    // A genuine closed cubic may have identical endpoints; its handles are
    // real geometry. Z with coincident endpoints creates no extra segment.
    const extent=Math.max(distance(pen,end),...c.slice(1).reduce((a,_,i,v)=>{
      if(i%2===0&&i+1<v.length)a.push(distance(pen,[v[i],v[i+1]]));return a;
    },[0]));
    if(c[0]!=='Z'||distance(pen,end)>1e-9)out.push({part,extent,point:pen});
    pen=end;
  }
  return out;
}
const area=p=>p.points.reduce((s,a,i)=>{const b=p.points[(i+1)%p.points.length];return s+cross(a,b);},0)/2;
// Independent postcondition, not the optimizer's own error estimate. Checks
// all subpaths together. Intersections have native cubic witnesses; numerical
// ambiguity rejects the change. Signed areas still use bounded sampling.
export function validateCurveChange(before,after,{tolerance=.01,nodeTolerance=.01}={}){
  const report={accepted:false,reason:null,samplingMm:Math.max(.0001,Math.min(.0025,tolerance/4)),beforeNodes:0,afterNodes:0};
  try{
    const a=realSegments(before),b=realSegments(after);
    report.beforeNodes=a.length;report.afterNodes=b.length;
    if(b.length>a.length){report.reason='node-increase';return report;}
    if(JSON.stringify(commands(before))===JSON.stringify(commands(after))){report.accepted=true;report.unchanged=true;return report;}
    const anchors=p=>{let part=-1;return commands(p).filter(c=>c[0]!=='Z').map(c=>{if(c[0]==='M')part++;return {part,point:c.slice(-2)};});};
    const sourceAnchors=anchors(before);

    const oldShort=a.filter(s=>s.extent<=nodeTolerance);
    if(b.some(s=>s.extent<=nodeTolerance&&!oldShort.some(o=>o.part===s.part&&distance(o.point,s.point)<=tolerance+nodeTolerance))){report.reason='new-short-segment';return report;}
    const src=sampleNativeParts(before,report.samplingMm),dst=sampleNativeParts(after,report.samplingMm);
    if(src.length!==dst.length||src.some((p,i)=>p.closed!==dst[i].closed)){report.reason='closure-or-subpath-change';return report;}
    for(let i=0;i<src.length;i++){
      if(!src[i].closed)continue;
      const x=area(src[i]),y=area(dst[i]);
      if(Math.abs(x)>1e-9&&(Math.abs(y)<1e-9||Math.sign(x)!==Math.sign(y))){report.reason='collapsed-or-reversed-ring';return report;}
    }
    const old=nativeIntersections([before]),next=nativeIntersections([after]);
    report.beforeIntersections=old.length;report.afterIntersections=next.length;
    if(next.some(n=>!old.some(o=>o.parts===n.parts&&o.overlap===n.overlap&&distance(o.point,n.point)<=2*tolerance+report.samplingMm))){report.reason='new-intersection';return report;}
    if(anchors(after).some(p=>!sourceAnchors.some(q=>q.part===p.part&&distance(q.point,p.point)<=1e-9))){report.reason='new-or-moved-anchor';return report;}
    report.accepted=true;return report;
  }catch(error){report.reason=String(error.message);return report;}
}

// Preserve inter-object checks, but do not combine thousands of native
// anchors into one 20,000-sample contour. The large-document fallback checks
// each changed path and every potentially contacting object pair. Any budget
// exhaustion is a rejection, never an unverified acceptance.
export function validateDocumentCurveChange(before,after,options={}){
  const combine=paths=>({
    kind:'vector',artwork:'<path/>',offset:[0,0],
    commands:paths.filter(p=>p.kind!=='image').flatMap(p=>commands(p).map(c=>
      [c[0],...c.slice(1).map((v,i)=>v+(p.offset?.[i%2]||0))]))
  });
  const all=validateCurveChange(combine(before.paths),combine(after.paths),options);
  if(all.accepted||!/(too complex|слишком сложна|quality-budget|quality-intersections-limit|native-topology-curve-budget|native-topology-issue-budget|native-verification-budget)/i.test(all.reason||''))return all;
  if(before.paths.length!==after.paths.length)
    return {...all,reason:'scoped-validation-requires-stable-object-mapping'};
  const changed=[];
  for(let i=0;i<before.paths.length;i++){
    if(JSON.stringify(commands(before.paths[i]))!==JSON.stringify(commands(after.paths[i]))||
       JSON.stringify(before.paths[i].offset||[0,0])!==JSON.stringify(after.paths[i].offset||[0,0]))
      changed.push(i);
  }
  if(!changed.length)return {...all,accepted:true,reason:null,scoped:true,checkedPairs:0};
  const t=Math.max(.0001,Number(options.tolerance)||.01);
  const bounds=p=>{
    const values=commands(p).flatMap(c=>c.slice(1)),off=p.offset||[0,0];
    if(!values.length)return null;
    const xx=values.filter((_,i)=>i%2===0).map(x=>x+off[0]),
      yy=values.filter((_,i)=>i%2===1).map(y=>y+off[1]);
    return [Math.min(...xx),Math.min(...yy),Math.max(...xx),Math.max(...yy)];
  };
  const boxes=before.paths.map((p,i)=>{
    const a=bounds(p),b=bounds(after.paths[i]);if(!a)return b;if(!b)return a;
    return [Math.min(a[0],b[0]),Math.min(a[1],b[1]),
      Math.max(a[2],b[2]),Math.max(a[3],b[3])];
  });
  const proximity=(a,b)=>a&&b&&a[0]<=b[2]+t&&b[0]<=a[2]+t&&
    a[1]<=b[3]+t&&b[1]<=a[3]+t;
  let checkedPairs=0;
  for(const i of changed){
    const self=validateCurveChange(before.paths[i],after.paths[i],options);
    if(!self.accepted)return {...self,scoped:true,failedPath:i};
  }
  const seen=new Set();
  for(const i of changed)for(let j=0;j<before.paths.length;j++){
    if(i===j||!proximity(boxes[i],boxes[j]))continue;
    const key=Math.min(i,j)+':'+Math.max(i,j);
    if(seen.has(key))continue;seen.add(key);
    if(++checkedPairs>25000)return {...all,reason:'scoped-pair-budget',scoped:true};
    const pair=validateCurveChange(combine([before.paths[i],before.paths[j]]),
      combine([after.paths[i],after.paths[j]]),options);
    if(!pair.accepted)return {...pair,scoped:true,failedPair:[i,j]};
  }
  return {...all,accepted:true,reason:null,scoped:true,checkedPairs,checkedPaths:changed.length};
}
