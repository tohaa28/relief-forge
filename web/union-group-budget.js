import {refitBooleanUnion} from './union-refit.js?v=0.2.0-alpha.49';
import {realNodeCount} from './preview-node-budget.js?v=0.2.0-alpha.49';
import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.49';
import {verifyNativeUnionProof} from './native-union-proof.js?v=0.2.0-alpha.49';

// A separate, fail-closed commit gate for every independent Boolean group.
// A rejected group keeps its native curves and never rolls back other groups.
// Original input-node budget is document-wide; local growth is bounded too.
export function assessUnionGroup(sourcePaths,candidate,{tolerance=.02,remainingNodes=0,
   globalLimit=Infinity,currentNodes=0}={}){
  const sourceNodes=realNodeCount({paths:sourcePaths});
  if(!candidate?.commands?.length)return {accepted:false,reason:'empty-union',sourceNodes};
  let path=candidate,refit=null;
  try{
    if(candidate.unionFlattened){
      const transformed=refitBooleanUnion({paths:[candidate]},tolerance);
      path=transformed.document.paths[0];refit=transformed.stats;
      if(refit.quality?.accepted===false||refit.skipped)
        return {accepted:false,reason:'refit-not-verified',sourceNodes,refit};
    }
    const candidateNodes=realNodeCount({paths:[path]});
    const after=currentNodes-sourceNodes+candidateNodes;
    if(path.nativeUnionProof){
      const inputs=new Set(sourcePaths.map(p=>JSON.stringify(geometryCommands(p))));
      if(!verifyNativeUnionProof(path,inputs))return {accepted:false,reason:'invalid-native-provenance',sourceNodes,candidateNodes};
      const cuts=path.nativeUnionProof.newJunctions;
      if(candidateNodes>sourceNodes+cuts||after>globalLimit+cuts)return {accepted:false,reason:'unnecessary-native-nodes',sourceNodes,candidateNodes};
      return {accepted:true,path,sourceNodes,candidateNodes,after,refit,nativeCuts:cuts};
    }
    // Real crossings may need new anchors, but not thousands of sampled
    // polygon vertices. Keeping the entire document <= source node count
    // prevents a valid group from inflating the exported overall result.
    const localAllowance=Math.max(4,Math.min(32,Math.ceil(sourceNodes*.12)));
    if(candidateNodes>sourceNodes+localAllowance)
      return {accepted:false,reason:'group-node-inflation',
        sourceNodes,candidateNodes,refit};
    if(after>globalLimit)
      return {accepted:false,reason:'global-node-budget',
        sourceNodes,candidateNodes,refit};
    return {accepted:true,path,sourceNodes,candidateNodes,after,refit};
  }catch(error){
    return {accepted:false,reason:'union-group-error',
      detail:String(error?.message||error),sourceNodes,remainingNodes};
  }
}
