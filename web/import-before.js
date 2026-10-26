// Immutable first-import baseline. A preview may be rebuilt, discarded,
// applied or saved, but DO always means the bytes decoded at import time.
// Diagnostic points are captured from the *first* original geometry scan.
export function beginImportBefore(document){
  if(!Array.isArray(document?.paths))throw Error('Исходный документ отсутствует');
  return {document:structuredClone(document),issues:null,complete:false,pending:true};
}
export function captureImportBefore(state,issues,complete){
  if(!state?.pending||!Array.isArray(issues))return state;
  return {...state,issues:structuredClone(issues),complete:complete===true,pending:false};
}
export function importedComparison(state,afterDoc,afterIssues=[]){
  if(!state||!Array.isArray(state.issues))return null;
  return {
    beforeDoc:structuredClone(state.document),
    beforeIssues:structuredClone(state.issues),
    beforeDiagnosticComplete:state.complete,
    afterDoc:structuredClone(afterDoc),
    afterIssues:structuredClone(afterIssues)
  };
}
