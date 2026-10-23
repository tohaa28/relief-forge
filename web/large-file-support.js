/** Plan bounded WASM diagnostic jobs without ever inventing full verification.
 * Rust can check at most 2000 sampled nodes per run. Any split between
 * batches loses global interactions, so result is explicitly partial. */
export const MAX_DIAGNOSTIC_POINTS=2000;
export function planDiagnosticBatches(contours, mapping=[],limit=MAX_DIAGNOSTIC_POINTS){
  if(!Number.isInteger(limit)||limit<4||limit>MAX_DIAGNOSTIC_POINTS)throw Error('Неверный размер блока диагностики');
  if(!Array.isArray(contours)||!Array.isArray(mapping)||mapping.length!==contours.length)
    throw Error('Неверное сопоставление контуров');
  const batches=[],skipped=[];let batch={paths:[],scope:[],points:0},split=false;
  const flush=()=>{if(batch.paths.length)batches.push(batch);batch={paths:[],scope:[],points:0};};
  function add(part,owner){
    const n=part.points.length;
    if(batch.points+n>limit)flush();
    batch.paths.push(part);batch.scope.push(owner);batch.points+=n;
  }
  contours.forEach((part,i)=>{
    const pts=part?.points;
    if(!Array.isArray(pts)||pts.length<2||pts.some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)))){
      skipped.push(i);return;
    }
    if(pts.length<=limit){add(part,mapping[i]);return;}
    // Split a huge path at explicit adjacent vertices, retain one overlapping
    // vertex so short edges inside chunks remain detectable. The seam and
    // global topology are NOT certified.
    split=true;
    for(let start=0;start<pts.length-1;){
      const end=Math.min(pts.length,start+limit);
      add({points:pts.slice(start,end),closed:false},mapping[i]);
      if(end===pts.length)break;
      start=end-1;
    }
  });
  flush();
  const totalPoints=contours.reduce((n,p)=>n+(p?.points?.length||0),0);
  return {batches,totalPoints,partial:split||skipped.length>0||batches.length>1,
    split,skipped,covered:contours.length-skipped.length};
}
export const isSupportedDrop=file=>
  !!file&&/\.(eps|epsf|epsi|ps|svg|json)$/i.test(String(file.name||''));
export function droppedFiles(event){
  const f=event?.dataTransfer?.files;
  return f?.length?[...f].filter(isSupportedDrop):[];
}
