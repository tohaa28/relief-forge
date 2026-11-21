import {roundBezierCorners} from './corner-rounding.js?v=0.2.0-alpha.78';
import {mergeOverlappingObjects} from './overlap-merge.js?v=0.2.0-alpha.78';
import {refineNativeDiagnostics} from './native-diagnostic-refinement.js?v=0.2.0-alpha.78';
import {combineWorkingCopy} from './after-preparation.js?v=0.2.0-alpha.78';
import {nativeUnionPaths} from './native-boolean.js?v=0.2.0-alpha.78';
self.postMessage({ready:true});
self.onmessage=({data})=>{
 try{
  const output=data.action==='union'?mergeOverlappingObjects(data.document,data.options):
    data.action==='round-corners'?roundBezierCorners(data.document,data.indices,data.tolerance):
    data.action==='combine'?combineWorkingCopy(data.document,data.indices,{...data.options,unionFilled:nativeUnionPaths}):
    refineNativeDiagnostics(data.document,data.issues,data.indices,data.tolerance);
  self.postMessage({output});
 }catch(error){self.postMessage({error:error.message});}
};
