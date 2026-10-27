export async function downloadBinary(url,{fetcher=fetch,onProgress=()=>{},idleTimeoutMs=45000,maxBytes=64000000,label='движка'}={}){
 const controller=new AbortController();let timer,stalled=false,loaded=0;
 const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>{stalled=true;controller.abort();},idleTimeoutMs);};
 reset();
 try{
  const response=await fetcher(url,{signal:controller.signal});
  if(!response.ok)throw Error('Не удалось загрузить '+label+': HTTP '+response.status);
  reset();
  // fetch decompresses the body. A compressed Content-Length is NOT the
  // decoded byte total; never show a fabricated >100% download percentage.
  const total=response.headers.get('content-encoding')?0:Number(response.headers.get('content-length'))||0;
  const chunks=[];let lastNotice=0;
  const accept=value=>{loaded+=value.byteLength;if(loaded>maxBytes)throw Error('Слишком большой файл движка');chunks.push(value);reset();const now=Date.now();if(now-lastNotice>=100){onProgress({loaded,total});lastNotice=now;}};
  if(response.body?.getReader){const reader=response.body.getReader();while(true){const {done,value}=await reader.read();if(done)break;accept(value);}}
  else accept(new Uint8Array(await response.arrayBuffer()));
  const bytes=new Uint8Array(loaded);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  if(bytes.length<8||bytes[0]!==0||bytes[1]!==97||bytes[2]!==115||bytes[3]!==109)throw Error('Сервер вернул некорректный WASM-файл движка');
  onProgress({loaded,total,done:true});return bytes;
 }catch(error){controller.abort();if(stalled)throw Error('Загрузка '+label+' остановилась: нет данных '+Math.round(idleTimeoutMs/1000)+' секунд. Проверьте соединение и повторите открытие файла.');throw error;}
 finally{clearTimeout(timer);}
}
