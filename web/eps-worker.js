/* Classic Worker: Ghostscript's official CLI build + MuPDF WebAssembly. */
const send=(percent,message)=>self.postMessage({type:'progress',percent,message});
self.onmessage=async({data})=>{
  try{
    const pipeline=await import('./eps-pipeline.js?v=0.2.0-alpha.18');
    // Unpainted CorelDRAW paths are pure vector data. Recover them before
    // downloading/initializing hundreds of MB of unrelated raster/PS engines.
    const direct=pipeline.recoverOutlineOnlyEps(new Uint8Array(data.bytes));
    if(direct){send(85,'Восстановление контуров EPS завершено…');self.postMessage({type:'done',result:direct});return;}
    send(3,'Загрузка движка EPS…');
    const response=await fetch(new URL('vendor/ghostscript/gs-core.wasm',self.location.href));if(!response.ok)throw Error('Не удалось загрузить Ghostscript WASM: '+response.status);
    const wasmBinary=new Uint8Array(await response.arrayBuffer());
    importScripts(new URL('vendor/ghostscript/gs-core.js',self.location.href).href);
    send(15,'Загрузка обработчика векторной графики…');
    const mupdf=await import('./vendor/mupdf/mupdf.js');
    const runGhostscript=async(program,args,fonts)=>{
      const logs=[];
      const core=await createGhostscriptCore({wasmBinary,print:s=>logs.push(String(s)),printErr:s=>logs.push(String(s))});
      core.FS.mkdir('/fonts');core.FS.writeFile('/input.eps',program);
      for(const font of fonts){const name=font.name.replace(/[^a-zA-Z0-9_.-]/g,'_');core.FS.writeFile('/fonts/'+name,new Uint8Array(font.bytes));}
      let exit=0;try{exit=core.callMain(args)||0;}catch(error){if(typeof error.status==='number')exit=error.status;else throw error;}
      if(exit)throw Error('Ghostscript не смог прочитать EPS.\n'+logs.slice(-18).join('\n'));
      let pdf;try{pdf=core.FS.readFile('/output.pdf').slice();}catch{throw Error('EPS не создал векторный результат.\n'+logs.slice(-10).join('\n'));}
      return {pdf,logs};
    };
    const result=await pipeline.interpretEps(new Uint8Array(data.bytes),{runGhostscript,mupdf,fonts:data.fonts,progress:send});
    send(85,'Подготовка редактируемых объектов…');self.postMessage({type:'done',result});
  }catch(error){self.postMessage({type:'error',message:error?.message||String(error)});}
};
