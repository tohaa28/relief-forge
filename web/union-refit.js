import {validateDocumentCurveChange} from './curve-quality.js?v=0.2.0-alpha.50';
import {optimizeVectorPath} from './curve-optimizer.js?v=0.2.0-alpha.50';
import {verifyNativeUnionProof} from './native-union-proof.js?v=0.2.0-alpha.50';

// Refit actual Boolean Union AFTER Clipper removes overlaps.
// Previous flow optimized source C curves then replaced them with many L
// vertices in polygon union. Only final C/L/M command endpoints are editable.
export function refitBooleanUnion(document,tolerance,{maxPasses=4}={}){
  if(!Number.isFinite(tolerance)||tolerance<.00001||tolerance>2)
    throw Error('Неверный допуск итоговой оптимизации');
  const result=structuredClone(document),report={
    originalNodes:0,finalNodes:0,removed:0,refitPaths:0,cubicSegments:0,
    maxDeviationEstimate:0,passes:0,skipped:0,rejected:0,details:[]
  };
  result.paths=result.paths.map((original,index)=>{
    if(!original.unionFlattened)return original;
    const starting=original.commands?.filter(c=>['M','L','C','Q'].includes(c[0])).length||0;
    report.originalNodes+=starting;
    let current=original,passes=0,errorSum=0;
    try{
      for(let i=0;i<maxPasses;i++){
        const next=optimizeVectorPath(current,tolerance/maxPasses);
        if(next.quality?.accepted===false)report.rejected++;
        if(!next.removed)break;
        // Later passes may not silently exceed tolerance by accumulation.
        passes++;errorSum+=next.maxError;
        current=next.path;
      }
    }catch(error){
      report.skipped++;
      report.details.push({path:index,before:starting,after:starting,passes:0,
        skipped:String(error.message)});
      current=original;passes=0;errorSum=0;
    }
    const final=current.commands?.filter(c=>['M','L','C','Q'].includes(c[0])).length||starting;
    report.finalNodes+=final;
    report.removed+=Math.max(0,starting-final);
    report.passes+=passes;
    report.maxDeviationEstimate=Math.max(report.maxDeviationEstimate,errorSum);
    report.cubicSegments+=(current.commands||[]).filter(c=>c[0]==='C').length;
    report.refitPaths++;
    // Stamp avoids re-polygonization on next preview of unchanged result.
    // Any subsequent node manipulation changes its command geometry.
    current.unionFlattened=true;
    current.unionStamp=JSON.stringify({commands:current.commands,offset:current.offset||[0,0]});
    report.details.push({path:index,before:starting,after:final,passes,
      cubics:(current.commands||[]).filter(c=>c[0]==='C').length,
      maxDeviationEstimate:errorSum});
    return current;
  });
  if(report.removed){
    report.quality=validateDocumentCurveChange(document,result,{tolerance});
    if(!report.quality.accepted){
      report.rejected++;report.finalNodes=report.originalNodes;report.removed=0;
      report.maxDeviationEstimate=0;report.passes=0;
      report.details.push({rollback:true,reason:report.quality.reason});
      return {document:structuredClone(document),stats:report};
    }
  }
  return {document:result,stats:report};
}
export function isUnchangedUnion(path){
  if(path.nativeUnionProof)return verifyNativeUnionProof(path);
  return Boolean(path.unionFlattened&&path.unionStamp&&
    path.unionStamp===JSON.stringify({commands:path.commands,offset:path.offset||[0,0]}));
}
