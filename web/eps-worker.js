/* EPS worker: persist the expensive Ghostscript WASM binary and MuPDF module
 * across independent imports. Never share Ghostscript filesystem state between
 * documents: create a fresh core for each conversion. */
const send=(percent,message)=>self.postMessage({type:'progress',percent,message});
let enginesPromise=null;
async function loadEngines(){
  if(enginesPromise)return enginesPromise;
  enginesPromise=(async()=>{
    send(3,'Загрузка Ghostscript и MuPDF (только при первом сложном EPS)…');
    const response=await fetch(new URL('vendor/ghostscript/gs-core.wasm',self.location.href));
    if(!response.ok)throw Error('Не удалось загрузить Ghostscript WASM: '+response.status);
    const wasmBinary=new Uint8Array(await response.arrayBuffer());
    importScripts(new URL('vendor/ghostscript/gs-core.js',self.location.href).href);
    send(15,'Подготовка векторного импортера…');
    const mupdf=await import('./vendor/mupdf/mupdf.js');
    return {wasmBinary,mupdf};
  })().catch(error=>{enginesPromise=null;throw error;});
  return enginesPromise;
}
self.onmessage=async({data})=>{
  const started=Date.now();
  try{
    const pipeline=await import('./eps-pipeline.js?v=0.2.0-alpha.28');
    // Path-only files never load heavyweight interpreters at all.
    const direct=pipeline.recoverOutlineOnlyEps(new Uint8Array(data.bytes));
    if(direct){
      send(85,'EPS-контуры восстановлены без запуска тяжёлого движка…');
      self.postMessage({type:'done',result:direct,durationMs:Date.now()-started,fastPath:true});
      return;
    }
    const warm=Boolean(enginesPromise);
    if(warm)send(12,'Используем подготовленные EPS-движки…');
    const {wasmBinary,mupdf}=await loadEngines();
    const runGhostscript=async(program,args,fonts)=>{
      const logs=[];
      const core=await createGhostscriptCore({wasmBinary,print:s=>logs.push(String(s)),printErr:s=>logs.push(String(s))});
      core.FS.mkdir('/fonts');core.FS.writeFile('/input.eps',program);
      for(const font of fonts){
        const name=font.name.replace(/[^a-zA-Z0-9_.-]/g,'_');
        core.FS.writeFile('/fonts/'+name,new Uint8Array(font.bytes));
      }
      let exit=0;
      try{exit=core.callMain(args)||0;}
      catch(error){if(typeof error.status==='number')exit=error.status;else throw error;}
      if(exit)throw Error('Ghostscript не смог прочитать EPS.\n'+logs.slice(-18).join('\n'));
      let pdf;
      try{pdf=core.FS.readFile('/output.pdf').slice();}
      catch{throw Error('EPS не создал векторный результат.\n'+logs.slice(-10).join('\n'));}
      return {pdf,logs};
    };
    const result=await pipeline.interpretEps(new Uint8Array(data.bytes),{
      runGhostscript,mupdf,fonts:data.fonts||[],progress:send
    });
    send(85,'Подготовка редактируемых объектов…');
    self.postMessage({type:'done',result,durationMs:Date.now()-started,fastPath:false,warm});
  }catch(error){self.postMessage({type:'error',message:error?.message||String(error)});}
};
