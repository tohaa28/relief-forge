/** Plan bounded WASM diagnostic jobs without ever inventing full verification.
 * Rust can check at most 2000 sampled nodes per run. Any split between
 * batches loses global interactions, so result is explicitly partial. */
export const MAX_DIAGNOSTIC_POINTS=2000;
export function planDiagnosticBatches(contours, mapping=[],limit=MAX_DIAGNOSTIC_POINTS){
  if(!Number.isInteger(limit)||limit<4||limit>MAX_DIAGNOSTIC_POINTS)throw Error('Неверный размер блока диагностики');
  if(!Array.isArray(contours)||!Array.isArray(mapping)||mapping.length!==contours.length)
    throw Error('Неверное сопоставление контуров');
  const batches=[],skipped=[];let batch={paths:[],scope:[],provenance:[],points:0},split=false;
  const flush=()=>{if(batch.paths.length)batches.push(batch);batch={paths:[],scope:[],provenance:[],points:0};};
  function add(part,owner,provenance){
    const n=part.points.length;
    if(batch.points+n>limit)flush();
    batch.provenance.push(provenance);batch.paths.push(part);batch.scope.push(owner);batch.points+=n;
  }
  contours.forEach((part,i)=>{
    const pts=part?.points;
    if(!Array.isArray(pts)||pts.length<2||pts.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)))){
      skipped.push(i);return;
    }
    if(pts.length<=limit){add(part,mapping[i],{contour:i,start:0,source:part,split:false});return;}
    // Split a huge path at explicit adjacent vertices, retain one overlapping
    // vertex so short edges inside chunks remain detectable. The seam and
    // global topology are NOT certified.
    split=true;
    const vertices=part.closed?[...pts,pts[0]]:pts;
    for(let start=0;start<vertices.length-1;){
      const end=Math.min(vertices.length,start+limit);
      add({points:vertices.slice(start,end),closed:false},mapping[i],
        {contour:i,start,source:part,split:true});
      if(end===vertices.length)break;
      start=end-1;
    }
  });
  flush();
  const sourcePoints=contours.reduce((n,p)=>n+(p?.points?.length||0),0);
  // Count repeated seam vertices as work too, otherwise the progress counter
  // can exceed 100% before the final overlapping window finishes.
  const totalPoints=batches.reduce((n,b)=>n+b.points,0);
  return {batches,totalPoints,sourcePoints,partial:split||skipped.length>0||batches.length>1,
    split,skipped,covered:contours.length-skipped.length};
}
export const isSupportedDrop=file=>
  !!file&&/\.(pdf|eps|epsf|epsi|ps|svg|json)$/i.test(String(file.name||''));
export function droppedFiles(event){
  const f=event?.dataTransfer?.files;
  return f?.length?[...f].filter(isSupportedDrop):[];
}

// A worker window is not a document contour. Only original topology may
// produce an open-contour issue; never close windows with an invented chord.
export function mapDiagnosticIssue(issue,batch){
  const origin=batch.provenance?.[issue.path];
  const other=batch.provenance?.[issue.other];
  if(issue.kind==='open'&&origin?.split){
    if(origin.source.closed||origin.start!==0)return null;
    return {...issue,path:batch.scope[issue.path],other:batch.scope[issue.path],
      a:0,b:origin.source.points.length-1,point:[...origin.source.points[0]],
      contour:origin.contour};
  }
  return {...issue,path:batch.scope[issue.path]??-1,other:batch.scope[issue.other]??-1,
    a:issue.a+(origin?.start||0),b:issue.b+(other?.start||0),
    contour:origin?.contour,otherContour:other?.contour};
}
