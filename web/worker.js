let engine;
self.onmessage=async ({data})=>{
  const {id,input}=data;
  try{
    if(!engine){
      const response=await fetch(new URL('engine.wasm',import.meta.url));
      if(!response.ok)throw Error(`engine.wasm: HTTP ${response.status}. Сначала выполните сборку Rust/WASM.`);
      const {instance}=await WebAssembly.instantiate(await response.arrayBuffer(),{});engine=instance.exports;
    }
    if(!input){self.postMessage({id,ready:true});return;}
    const ptr=engine.input_alloc(input.length);
    new Float64Array(engine.memory.buffer,ptr,input.length).set(input);
    const code=engine.run(ptr,input.length);
    const output=JSON.parse(new TextDecoder().decode(new Uint8Array(engine.memory.buffer,engine.result_ptr(),engine.result_len())));
    if(code)throw Error(output.error);
    self.postMessage({id,output});
  }catch(e){self.postMessage({id,error:e.message});}
};
