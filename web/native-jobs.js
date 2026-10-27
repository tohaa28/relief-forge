const jobs=new Map();
export function runNativeJob(data,{startupTimeoutMs=20000}={}){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./native-worker.js?v=0.2.0-alpha.50',import.meta.url),{type:'module'});
  let settled=false;
  const timer=setTimeout(()=>finish(null,'Не удалось загрузить модуль геометрии за 20 секунд. Исходный документ сохранён.'),startupTimeoutMs);
  const finish=(value,error)=>{if(settled)return;settled=true;clearTimeout(timer);jobs.delete(worker);worker.terminate();error?reject(Error(error)):resolve(value);};
  jobs.set(worker,()=>finish(null,'Расчёт отменён'));
  worker.onmessage=({data})=>{if(data.ready){clearTimeout(timer);return;}finish(data.output,data.error);};
  worker.onerror=e=>finish(null,e.message||'Ошибка нативной геометрии');
  try{worker.postMessage(data);}catch(error){finish(null,error.message);}
 });
}
export function cancelNativeJobs(){for(const cancel of [...jobs.values()])cancel();}
