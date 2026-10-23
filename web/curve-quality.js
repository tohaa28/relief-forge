import {sampledContours} from './rich-svg.js';
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
function intersections(parts){
  const edges=[],found=[];
  parts.forEach((p,part)=>{
    const n=p.points.length-Number(!p.closed);
    for(let i=0;i<n;i++){
      const a=p.points[i],b=p.points[(i+1)%p.points.length];
      edges.push({a,b,part,i,n,closed:p.closed,minX:Math.min(a[0],b[0]),maxX:Math.max(a[0],b[0]),minY:Math.min(a[1],b[1]),maxY:Math.max(a[1],b[1])});
    }
  });
  edges.sort((a,b)=>a.minX-b.minX);let work=0;
  for(let i=0;i<edges.length;i++)for(let j=i+1;j<edges.length&&edges[j].minX<=edges[i].maxX;j++){
    if(++work>2000000)throw Error('quality-budget');
    const a=edges[i],b=edges[j];
    if(a.maxY<b.minY||b.maxY<a.minY)continue;
    if(a.part===b.part&&(Math.abs(a.i-b.i)===1||(a.closed&&Math.abs(a.i-b.i)===a.n-1)))continue;
    const r=sub(a.b,a.a),s=sub(b.b,b.a),q=sub(b.a,a.a),den=cross(r,s);
    if(Math.abs(den)<1e-14){
      const rr=r[0]*r[0]+r[1]*r[1];
      if(rr>1e-20&&Math.abs(cross(q,r))<1e-12){
        const t0=(q[0]*r[0]+q[1]*r[1])/rr,q1=sub(b.b,a.a),t1=(q1[0]*r[0]+q1[1]*r[1])/rr;
        const lo=Math.max(0,Math.min(t0,t1)),hi=Math.min(1,Math.max(t0,t1));
        if((hi-lo)*Math.sqrt(rr)>1e-8)found.push({parts:[a.part,b.part].sort((a,b)=>a-b).join(':'),point:[a.a[0]+(lo+hi)/2*r[0],a.a[1]+(lo+hi)/2*r[1]]});
      }
      continue;
    }
    const t=cross(q,s)/den,u=cross(q,r)/den;
    if(t>=0&&t<=1&&u>=0&&u<=1){
      found.push({parts:[a.part,b.part].sort((a,b)=>a-b).join(':'),point:[a.a[0]+t*r[0],a.a[1]+t*r[1]]});
      if(found.length>10000)throw Error('quality-intersections-limit');
    }
  }
  return found;
}
const area=p=>p.points.reduce((s,a,i)=>{const b=p.points[(i+1)%p.points.length];return s+cross(a,b);},0)/2;
// Independent postcondition, not the optimizer's own error estimate. Checks
// all subpaths together. Numeric sampled intersections are not an analytic
// proof for sub-resolution contacts; never label this a full certification.
export function validateCurveChange(before,after,{tolerance=.01,nodeTolerance=.01}={}){
  const report={accepted:false,reason:null,samplingMm:Math.max(.0001,Math.min(.0025,tolerance/4)),beforeNodes:0,afterNodes:0};
  try{
    const a=realSegments(before),b=realSegments(after);
    report.beforeNodes=a.length;report.afterNodes=b.length;
    if(b.length>a.length){report.reason='node-increase';return report;}
    const oldShort=a.filter(s=>s.extent<=nodeTolerance);
    if(b.some(s=>s.extent<=nodeTolerance&&!oldShort.some(o=>o.part===s.part&&distance(o.point,s.point)<=tolerance+nodeTolerance))){report.reason='new-short-segment';return report;}
    const src=sampledContours(before,report.samplingMm),dst=sampledContours(after,report.samplingMm);
    if(src.length!==dst.length||src.some((p,i)=>p.closed!==dst[i].closed)){report.reason='closure-or-subpath-change';return report;}
    for(let i=0;i<src.length;i++){
      if(!src[i].closed)continue;
      const x=area(src[i]),y=area(dst[i]);
      if(Math.abs(x)>1e-9&&(Math.abs(y)<1e-9||Math.sign(x)!==Math.sign(y))){report.reason='collapsed-or-reversed-ring';return report;}
    }
    const old=intersections(src),next=intersections(dst);
    report.beforeIntersections=old.length;report.afterIntersections=next.length;
    if(next.some(n=>!old.some(o=>o.parts===n.parts&&distance(o.point,n.point)<=2*tolerance+report.samplingMm))){report.reason='new-intersection';return report;}
    report.accepted=true;return report;
  }catch(error){report.reason=String(error.message);return report;}
}

// Compare relationships across separate objects too, before intentional Union.
export function validateDocumentCurveChange(before,after,options){
  const combine=doc=>{
    const list=doc.paths.filter(p=>p.kind!=='image').flatMap(p=>commands(p).map(c=>
      [c[0],...c.slice(1).map((v,i)=>v+(p.offset?.[i%2]||0))]));
    return {kind:'vector',artwork:'<path/>',commands:list,offset:[0,0]};
  };
  return validateCurveChange(combine(before),combine(after),options);
}
