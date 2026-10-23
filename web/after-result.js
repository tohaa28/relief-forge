// Save the *existing* optimization result, never run a new Rust diagnostic
// at export time. The diagnosis belongs to the exact AFTER document.
export function chooseAfterSnapshot(document,preview,settings,comparison,diagnostic){
  if(preview?.result){
    const s=preview.stats||{};
    if(s.diagnosticTolerance!==settings.diagnosticTolerance||
       s.smoothingAmount!==settings.smoothingAmount||
       s.tolerance!==settings.optimizationTolerance||
       s.mergeOverlaps!==settings.mergeOverlaps||
       JSON.stringify(preview.source)!==JSON.stringify(document))
      return {valid:false,reason:'stale-preview'};
    const report=preview.comparisonData?.afterIssues;
    return {valid:true,document:preview.result,preview:preview.hasGeometryChange?preview:null,
      stage:'after',issues:preview.afterDiagnosed&&Array.isArray(report)?report:null,
      complete:preview.afterDiagnosed===true&&preview.afterDiagnosticComplete===true&&preview.afterScope==='full'};
  }
  if(comparison?.afterDoc&&JSON.stringify(comparison.afterDoc)===JSON.stringify(document)){
    return {valid:true,document,preview:null,stage:'applied-after',
      issues:Array.isArray(comparison.afterIssues)?comparison.afterIssues:null,
      complete:comparison.afterDiagnosticComplete===true&&comparison.afterScope==='full'};
  }
  return {valid:true,document,preview:null,stage:'current',
    issues:diagnostic?.current===true&&Array.isArray(diagnostic.issues)?diagnostic.issues:null,
    complete:diagnostic?.complete===true&&diagnostic?.fullScope===true};
}
export function afterSaveDecision(snapshot){
  if(!snapshot?.valid)return {action:'stop',count:null,complete:false,reason:snapshot?.reason||'invalid'};
  if(snapshot.complete&&snapshot.issues?.length===0)
    return {action:'save',count:0,complete:true};
  return {action:'warn',count:Array.isArray(snapshot.issues)?snapshot.issues.length:null,
    complete:false,reason:!snapshot.issues?'not-checked':snapshot.issues.length?'remaining-issues':'partial-scan'};
}
export function afterSaveMessage(decision,stage='after'){
  if(decision.action==='stop')return 'Результат ПОСЛЕ устарел. Пересчитайте обработку перед сохранением.';
  const name=stage==='current'?'текущая геометрия':'вылеченный и оптимизированный результат ПОСЛЕ';
  const count=decision.count;
  return (count===null?'Проверка оставшихся проблем неполная.':
    count?'В результате обнаружено '+count+' неисправленных проблем.':
      'Проверка результата неполная: межблочные ошибки не исключены.')+
    ' При продолжении будет сохранена именно '+name+', без повторного лечения и пересчёта.';
}
