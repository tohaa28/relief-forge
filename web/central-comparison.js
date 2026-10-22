// Construct a read-only whole-document comparison without mutating the source.
// Rust issues refer to sampled contours, which may outnumber SVG source objects.
// Keep an explicit mapping for before and an insertion index for after.
export function composeRepairedDocument(source,scope,after){
  if(!Array.isArray(source?.paths)||!Array.isArray(scope)||!Array.isArray(after))throw Error('Неверные данные сравнения');
  const indices=new Set(scope);
  const paths=[],afterIndices=[];
  let inserted=false;
  for(let i=0;i<source.paths.length;i++){
    if(indices.has(i)){
      if(!inserted){
        for(const path of after){afterIndices.push(paths.length);paths.push(structuredClone(path));}
        inserted=true;
      }
    }else paths.push(structuredClone(source.paths[i]));
  }
  if(!inserted&&scope.length)throw Error('Объекты лечения отсутствуют в документе');
  return {document:{...structuredClone(source),paths},afterIndices};
}
export function mappedComparison(source,scope,sampledScope,beforeIssues,afterIssues,after){
  const {document,afterIndices}=composeRepairedDocument(source,scope,after);
  const mapBefore=x=>({
    ...x,path:sampledScope[x.path]??-1,other:sampledScope[x.other]??-1
  });
  const mapAfter=x=>({
    ...x,path:afterIndices[x.path]??-1,other:afterIndices[x.other]??-1
  });
  return {
    beforeDoc:structuredClone(source),
    afterDoc:document,
    beforeIssues:beforeIssues.map(mapBefore),
    afterIssues:afterIssues.map(mapAfter)
  };
}
export function activeComparisonFrame(comparison,mode,document,issues){
  if(!comparison)return {document,issues,readOnly:false,stage:null};
  if(mode==='after')return {document:comparison.afterDoc,issues:comparison.afterIssues,readOnly:true,stage:'after'};
  return {document:comparison.beforeDoc,issues:comparison.beforeIssues,readOnly:true,stage:'before'};
}
export function zoomBox({x,y,width,height},factor,center=null){
  if(!Number.isFinite(factor)||factor<=0)throw Error('Неверный масштаб');
  const w=width*factor,h=height*factor;
  if(!Number.isFinite(w)||w<0.1||w>1e7||h<=0||h>1e7)return null;
  const anchor=center||[x+width/2,y+height/2];
  const [cx,cy]=anchor;
  if(!Number.isFinite(cx)||!Number.isFinite(cy))throw Error('Неверная точка масштабирования');
  return {x:cx+(x-cx)*factor,y:cy+(y-cy)*factor,width:w,height:h};
}
