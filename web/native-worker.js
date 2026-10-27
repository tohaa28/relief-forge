import {mergeOverlappingObjects} from './overlap-merge.js?v=0.2.0-alpha.50';
import {refineNativeDiagnostics} from './native-diagnostic-refinement.js?v=0.2.0-alpha.50';
self.postMessage({ready:true});
self.onmessage=({data})=>{
 try{
  const output=data.action==='union'?mergeOverlappingObjects(data.document,data.options):refineNativeDiagnostics(data.document,data.issues,data.indices,data.tolerance);
  self.postMessage({output});
 }catch(error){self.postMessage({error:error.message});}
};
