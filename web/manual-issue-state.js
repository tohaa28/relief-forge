// Manual node editing must display diagnostics for the geometry being edited,
// never the original DO snapshot if AFTER was applied to the document.
export function issuesForManualEditor(preview,stage,currentIssues=[],currentComplete=false){
  if(stage==='after'&&preview?.afterDiagnosed&&Array.isArray(preview.comparisonData?.afterIssues)){
    return {issues:structuredClone(preview.comparisonData.afterIssues),
      complete:preview.afterDiagnosticComplete===true,verified:true};
  }
  if(stage==='after'&&preview?.hasGeometryChange)
    return {issues:[],complete:false,verified:false};
  return {issues:structuredClone(currentIssues),complete:currentComplete===true,verified:true};
}

// A completed rescan is authoritative, including when it proves zero defects.
// If any diagnostic worker/batch failed, preserve old witnesses until they can
// be checked; never infer that a failed scan "fixed" a node.
export function resolveManualIssues(previous=[],scanned=[],{failed=false}={}){
  if(!failed)return scanned;
  const key=issue=>JSON.stringify([issue.kind,issue.path,issue.other,
    issue.point,issue.nodePoints]);
  const seen=new Set(scanned.map(key)),result=[...scanned];
  for(const issue of previous){
    const k=key(issue);
    if(!seen.has(k)){seen.add(k);result.push(issue);}
  }
  return result;
}

export function retainsIssuesDuringManualChange(mode,action){
  return mode==='nodes'&&(action.startsWith('curve-node')||
    action==='move-nodes'||action==='undo'||action==='redo');
}
