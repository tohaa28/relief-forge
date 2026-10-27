import {mergeOverlappingObjects} from './overlap-merge.js';
import {refineNativeDiagnostics} from './native-diagnostic-refinement.js';
self.onmessage=({data})=>{
 try{
  const output=data.action==='union'?mergeOverlappingObjects(data.document,data.options):refineNativeDiagnostics(data.document,data.issues,data.indices,data.tolerance);
  self.postMessage({output});
 }catch(error){self.postMessage({error:error.message});}
};
