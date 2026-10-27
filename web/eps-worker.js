/* Expensive importers stay in this Worker; keep warm state between documents. */
const send=(percent,message,detail={})=>self.postMessage({type:'progress',percent,message,...detail});
let enginesPromise=null,mupdfPromise=null,pendingPdf=null,sizesPromise=null;
const megabytes=n=>(n/1048576).toFixed(1)+' МБ';
function sizes(){
 if(!sizesPromise){let timer;sizesPromise=Promise.race([
  fetch(new URL('vendor/versions.json?v=0.2.0-alpha.50',self.location.href)).then(r=>r.ok?r.json():{}).then(x=>x.wasmBytes||{}),
  new Promise(resolve=>{timer=setTimeout(()=>resolve({}),2000);})
 ]).catch(()=>({})).finally(()=>clearTimeout(timer));}
 return sizesPromise;
}
async function loadMupdf({onDownload}={}){
 if(mupdfPromise)return mupdfPromise;
 mupdfPromise=(async()=>{
  const {downloadBinary}=await import('./asset-download.js?v=0.2.0-alpha.50');
  let expected=0;sizes().then(s=>expected=Number(s.mupdf)||0);
  const wasmBinary=await downloadBinary(new URL('vendor/mupdf/mupdf-wasm.wasm',self.location.href),{label:'MuPDF',onProgress:p=>{
   const total=expected||p.total;
   if(onDownload)onDownload({...p,total});
   else send(12+21*(total?Math.min(1,p.loaded/total):0),'Загрузка MuPDF: '+megabytes(p.loaded)+(total?' / '+megabytes(total):''),{download:{loaded:p.loaded,total}});
  }});
  // Supported upstream Emscripten Module hook: provide the already-downloaded
  // WASM instead of silently fetching the same binary again inside mupdf.js.
  const config={wasmBinary};self['$libmupdf_wasm_Module']=config;
  try{return await import('./vendor/mupdf/mupdf.js?v=0.2.0-alpha.50');}
  finally{if(self['$libmupdf_wasm_Module']===config)delete self['$libmupdf_wasm_Module'];}
 })().catch(e=>{mupdfPromise=null;throw e;});return mupdfPromise;
}
async function loadEngines(){
 if(enginesPromise)return enginesPromise;
 enginesPromise=(async()=>{
  const {downloadBinary}=await import('./asset-download.js?v=0.2.0-alpha.50');
  const warmMu=Boolean(mupdfPromise),state={ghostscript:{loaded:0,total:0},mupdf:{loaded:0,total:0}},expected={};
  let muReady=false,reporting=true;
  const report=()=>{
   if(!reporting)return;
   const gs=state.ghostscript,mu=state.mupdf,loaded=gs.loaded+mu.loaded,
    total=gs.total+(warmMu?0:mu.total),known=gs.total>0&&(warmMu||mu.total>0);
   const part=(name,p)=>name+': '+megabytes(p.loaded)+(p.total?' / '+megabytes(p.total):'');
   send(9+12*(known?Math.min(1,loaded/total):0),part('Ghostscript',gs)+' · '+(muReady?'MuPDF: готов':mu.done?'MuPDF: подготовка ('+megabytes(mu.loaded)+')':part('MuPDF',mu)),{download:{loaded,total:known?total:0}});
  };
  sizes().then(s=>{Object.assign(expected,s);for(const k of ['ghostscript','mupdf'])state[k].total=Number(s[k])||state[k].total;report();});
  report();
  const gs=downloadBinary(new URL('vendor/ghostscript/gs-core.wasm',self.location.href),{label:'Ghostscript',onProgress:p=>{state.ghostscript={...p,total:Number(expected.ghostscript)||p.total};report();}}).then(wasmBinary=>{
   importScripts(new URL('vendor/ghostscript/gs-core.js',self.location.href).href);return wasmBinary;
  });
  const mu=loadMupdf({onDownload:p=>{state.mupdf={...p,total:Number(expected.mupdf)||p.total};report();}}).then(m=>{muReady=true;report();return m;});
  const [wasmBinary,mupdf]=await Promise.all([gs,mu]).finally(()=>reporting=false);
  send(22,'Движки загружены. Подготовка векторного импортера…');return {wasmBinary,mupdf};
 })().catch(error=>{enginesPromise=null;throw error;});return enginesPromise;
}
self.onmessage=async({data})=>{
  const started=Date.now();
  try{
    if(data.kind==='pdf'||data.type==='select-pdf-page'){
      const pdf=await import('./pdf-pipeline.js?v=0.2.0-alpha.50');
      if(data.kind==='pdf'){
        pendingPdf=pdf.pdfProgram(new Uint8Array(data.bytes)).slice();
        send(12,'Загрузка движка MuPDF для PDF…');
        const mupdf=await loadMupdf();
        send(40,'Чтение страниц PDF…');
        const pages=pdf.pdfPages(pendingPdf,mupdf);
        if(pages.length>1){
          send(55,'Выбор страницы PDF…');
          self.postMessage({type:'pages',pages,count:pages.length});
          return;
        }
        send(65,'Извлечение векторной геометрии PDF…');
        const result=pdf.pdfPageToSvg(pendingPdf,mupdf,0);
        pendingPdf=null;
        self.postMessage({type:'done',result,durationMs:Date.now()-started,format:'pdf'});
        return;
      }
      if(!pendingPdf)throw Error('PDF не загружен: откройте файл повторно.');
      const mupdf=await loadMupdf();
      send(65,'Извлечение страницы '+(data.pageIndex+1)+' PDF…');
      const result=pdf.pdfPageToSvg(pendingPdf,mupdf,data.pageIndex);
      pendingPdf=null;
      self.postMessage({type:'done',result,durationMs:Date.now()-started,format:'pdf'});
      return;
    }
    const pipeline=await import('./eps-pipeline.js?v=0.2.0-alpha.50');
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
  }catch(error){pendingPdf=null;self.postMessage({type:'error',message:error?.message||String(error)});}
};
