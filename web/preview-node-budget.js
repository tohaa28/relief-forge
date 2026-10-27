import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.50';
import {verifyNativeUnionProof} from './native-union-proof.js?v=0.2.0-alpha.50';
// Bound final editable nodes by the original document. Valid Union may need
// more intersection anchors than the intermediate optimized curves.
export function realNodeCount(document){
 if(!Array.isArray(document?.paths))throw Error('Нет документа для контроля узлов');
 return document.paths.reduce((n,path)=>{
  if(path.kind==='image')return n;
  if(path.artwork){if(!Array.isArray(path.commands))throw Error('Некорректные команды вектора');
    return n+path.commands.filter(c=>['M','L','C','Q'].includes(c[0])).length;}
  return n+(path.points?.length||0);
 },0);
}
export function protectPreviewNodeBudget(source,preUnion,postRefit){
 const before=realNodeCount(source),optimized=realNodeCount(preUnion),after=realNodeCount(postRefit);
 if(optimized>before)return {document:structuredClone(source),reason:'optimized-node-growth',before,optimized,after,final:before};
 if(after>before){
  const inputs=new Set(preUnion.paths.filter(p=>p.kind!=='image').map(p=>JSON.stringify(geometryCommands(p))));
  let junctions=0;
  const proven=postRefit.paths.every(p=>{
   if(p.kind==='image'||inputs.has(JSON.stringify(geometryCommands(p))))return true;
   if(!verifyNativeUnionProof(p,inputs))return false;
   junctions+=p.nativeUnionProof.newJunctions;return true;
  });
  if(!proven||after-before>junctions)return {document:structuredClone(preUnion),reason:'union-node-growth',before,optimized,after,final:optimized};
  return {document:postRefit,reason:null,before,optimized,after,final:after,nativeJunctions:junctions};
 }
 return {document:postRefit,reason:null,before,optimized,after,final:after};
}
export function previewBudgetMessage(report){
 if(report.reason==='union-fallback-optimized')
   return 'Булев Union отклонён: превысил лимит узлов ('+report.before+' → '+report.rejectedUnionNodes+'). Сохранены удаления точных дубликатов и выполнена безопасная оптимизация исходных кривых.';
 if(report.reason==='union-node-growth')return 'Булев результат отклонён: превышено исходное число реальных узлов ('+report.before+' → '+report.after+'). Сохранены независимые безопасные исправления до Union.';
 if(report.reason==='optimized-node-growth')return 'Предварительное исправление отменено: число узлов выросло ('+report.before+' → '+report.optimized+'). Сохранён оригинал.';
 return '';
}
