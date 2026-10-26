import {findCurveClearances} from './curve-clearance.js?v=0.2.0-alpha.42';
self.onmessage=({data})=>{try{self.postMessage({id:data.id,report:findCurveClearances(data.document,{threshold:data.threshold})});}catch(error){self.postMessage({id:data.id,error:error.message});}};
