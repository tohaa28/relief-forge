import {sampledContours} from './rich-svg.js';
import {planDiagnosticBatches} from './large-file-support.js';
import {packedInput} from './auto-repair.js';
import {issueWithinContourBounds} from './issue-markers.js';

// One single source of truth for diagnostic markers on the AFTER geometry.
// Handles split/overlapping batches without pretending full coverage.
// No part of this routine repairs paths or changes the approved snapshot.
export async function diagnoseAfterDocument(document,tolerance,{runBatch,progress=()=>{},yieldUi=async()=>{},cancelled=()=>false}){
  const contours=[],owners=[],failed=[];
  const paths=document.paths||[];
  for(let i=0;i<paths.length;i++){
    if(cancelled())return null;
    const p=paths[i];
    if(p.kind==='image'){failed.push(i);continue;}
    try{
      const parts=sampledContours(p,tolerance);
      if(!parts.length){failed.push(i);continue;}
      for(const part of parts){contours.push(part);owners.push(i);}
    }catch(error){failed.push(i);}
    if((i+1)%4===0||i===paths.length-1){
      progress('ПОСЛЕ: подготовка',5+25*(i+1)/paths.length,`${i+1} / ${paths.length} объектов`);
      await yieldUi();
    }
  }
  if(cancelled())return null;
  const plan=planDiagnosticBatches(contours,owners);
  let complete=!plan.partial&&!failed.length,misplaced=0;
  const issues=[];
  for(let i=0;i<plan.batches.length;i++){
    if(cancelled())return null;
    const batch=plan.batches[i];
    progress('ПОСЛЕ: поиск оставшихся дефектов',30+69*i/plan.batches.length,
      `Блок ${i+1}/${plan.batches.length}`);
    try{
      const out=await runBatch(packedInput(batch.paths,tolerance,0));
      if(!out||!Array.isArray(out.issues)){complete=false;continue;}
      complete=complete&&out.diagnosticComplete===true;
      for(const issue of out.issues){
        if(issues.length>=10000){complete=false;break;}
        if(!issueWithinContourBounds(issue,batch.paths,tolerance)){misplaced++;complete=false;continue;}
        issues.push({...issue,path:batch.scope[issue.path]??-1,other:batch.scope[issue.other]??-1});
      }
    }catch(error){complete=false;}
    await yieldUi();
  }
  progress('ПОСЛЕ: проверка завершена',100,
    `${issues.length} проблем${complete?'':' · частичная проверка'}`);
  return {issues,complete,fullScope:failed.length===0&&plan.skipped.length===0,
    failed:failed.length+plan.skipped.length,misplaced,batches:plan.batches.length,
    totalPoints:plan.totalPoints};
}
