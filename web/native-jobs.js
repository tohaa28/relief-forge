const jobs=new Map();
export function runNativeJob(data){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./native-worker.js?v=0.2.0-alpha.48',import.meta.url),{type:'module'});
  const finish=(value,error)=>{jobs.delete(worker);worker.terminate();error?reject(Error(error)):resolve(value);};
  jobs.set(worker,()=>finish(null,'Расчёт отменён'));
  worker.onmessage=({data})=>finish(data.output,data.error);
  worker.onerror=e=>finish(null,e.message||'Ошибка нативной геометрии');
  worker.postMessage(data);
 });
}
export function cancelNativeJobs(){for(const cancel of [...jobs.values()])cancel();}
