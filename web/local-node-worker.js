import {diagnoseLocalNodes} from './local-node-diagnostics.js?v=0.2.0-alpha.53';
self.onmessage=({data})=>{
  try{
    const result=diagnoseLocalNodes(data.document,data.center,data.radius,data.tolerance);
    self.postMessage({id:data.id,result});
  }catch(error){
    self.postMessage({id:data.id,error:String(error?.message||error)});
  }
};
