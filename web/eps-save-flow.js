/**
 * Guarded EPS save: never silently merge unverified preview geometry.
 * Candidate diagnostics must cover the full document, not selected paths.
 */
export function epsSaveCandidate(doc,preview,settings){
  if(!preview?.hasGeometryChange)return {document:doc,autoApply:false,reason:'no-pending-preview'};
  const stats=preview.stats||{};
  if(stats.diagnosticTolerance!==settings.diagnosticTolerance||
     stats.smoothingAmount!==settings.smoothingAmount||
     stats.tolerance!==settings.optimizationTolerance)
    return {document:doc,autoApply:false,reason:'stale-settings'};
  // JSON equality is intentional: SVG geometry and path metadata may change
  // without a change in path count or cached diagnostic data.
  if(JSON.stringify(preview.source)!==JSON.stringify(doc))
    return {document:doc,autoApply:false,reason:'stale-document'};
  return {document:preview.result,autoApply:true,reason:'verified-candidate'};
}

export function epsSaveDecision(report,autoApply){
  const complete=report?.complete===true&&report?.fullScope===true;
  const count=report?.issueCount;
  if(complete&&Number.isInteger(count)&&count===0)
    return {action:autoApply?'apply-and-save':'save',count:0,verified:true};
  const known=Number.isInteger(count)&&count>=0;
  return {action:'warn',count:known?count:null,verified:complete&&known,
    reason:!complete?'incomplete':!known?'unknown':count>0?'issues':'unknown'};
}

export function epsSaveWarningText(decision){
  if(decision.action!=='warn')return '';
  if(!decision.verified)
    return 'Не удалось полностью проверить все векторные узлы. Отсутствие ошибок не подтверждено. Автоматические изменения не будут применены.';
  const n=decision.count,mod100=n%100,mod10=n%10;
  const suffix=mod100>=11&&mod100<=14?'замечаний':mod10===1?'замечание':mod10>=2&&mod10<=4?'замечания':'замечаний';
  return 'В векторных контурах осталось '+decision.count+' '+suffix+
    '. Автоматические изменения не будут применены.';
}
