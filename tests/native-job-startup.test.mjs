import test from 'node:test';
import assert from 'node:assert/strict';
import {runNativeJob,cancelNativeJobs} from '../web/native-jobs.js';
test('native Worker startup cannot wait forever for missing imports',async()=>{
 const saved=globalThis.Worker;let terminated=false;
 globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 try{await assert.rejects(runNativeJob({}, {startupTimeoutMs:15}),/модуль геометрии/);assert.equal(terminated,true);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});
test('readiness ends the startup deadline without imposing it on actual geometry work',async()=>{
 const saved=globalThis.Worker;
 globalThis.Worker=class{postMessage(){setTimeout(()=>this.onmessage({data:{ready:true}}),0);setTimeout(()=>this.onmessage({data:{output:42}}),35);}terminate(){}};
 try{assert.equal(await runNativeJob({}, {startupTimeoutMs:15}),42);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});
test('Cancel terminates a loading Worker and rejects its pending job',async()=>{
 const saved=globalThis.Worker;let terminated=false;
 globalThis.Worker=class{postMessage(){}terminate(){terminated=true;}};
 try{const result=runNativeJob({});cancelNativeJobs();await assert.rejects(result,/отменён/);assert.equal(terminated,true);}finally{cancelNativeJobs();globalThis.Worker=saved;}
});
