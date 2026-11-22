import {controlsBounds,nativeParts} from './native-bezier.js?v=0.2.0-alpha.97';
import {refineNativeDiagnostics} from './native-diagnostic-refinement.js?v=0.2.0-alpha.97';

const kinds=new Set(['open','short','coincident','near_node','intersection','self_intersection','overlap']);
const span=(path,index)=>{
  const box=[Infinity,Infinity,-Infinity,-Infinity];
  let segments=0;
  for(const part of nativeParts(path))for(const segment of part.segments){
    const b=controlsBounds(segment.controls);
    for(let i=0;i<4;i++)box[i]=i<2?Math.min(box[i],b[i]):Math.max(box[i],b[i]);
    segments++;
  }
  return {index,box,segments};
};
const intersects=(a,b,t)=>a[0]<=b[2]+t&&b[0]<=a[2]+t&&a[1]<=b[3]+t&&b[1]<=a[3]+t;
const key=issue=>JSON.stringify([issue.kind,Math.min(issue.path,issue.other),
  Math.max(issue.path,issue.other),...issue.point.map(n=>Math.round(n*1e7))]);

// A bounded native pass. Previous witnesses outside its verified scope survive.
export function checkEditedDefects(document,previous,editedIndices,tolerance){
  const edited=new Set(editedIndices);
  const rows=document.paths.flatMap((path,index)=>path.kind==='image'?[]:[span(path,index)]);
  const changed=rows.filter(row=>edited.has(row.index));
  const neighbors=rows.filter(row=>!edited.has(row.index)&&row.segments&&
    changed.some(other=>other.segments&&intersects(row.box,other.box,tolerance)));
  const cap=8000;
  const editedSize=changed.reduce((n,row)=>n+row.segments,0);
  if(editedSize>cap)return {issues:previous,complete:false,checked:0};
  const full=editedSize+neighbors.reduce((n,row)=>n+row.segments,0)<=cap;
  const scope=(full?[...changed,...neighbors]:changed).map(row=>row.index);
  const scoped=new Set(scope);
  const report=refineNativeDiagnostics(document,[],scope,tolerance);
  const touches=issue=>kinds.has(issue.kind)&&(edited.has(issue.path)||edited.has(issue.other));
  const verified=issue=>touches(issue)&&(full||(scoped.has(issue.path)&&scoped.has(issue.other)));
  const issues=previous.filter(issue=>!(report.complete&&verified(issue)));
  const seen=new Set(issues.map(key));
  for(const issue of report.issues){
    if(!touches(issue)||seen.has(key(issue)))continue;
    seen.add(key(issue));issues.push(issue);
  }
  return {issues,complete:full&&report.complete,checked:scope.length};
}
