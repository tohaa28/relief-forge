/* Dedicated, abortable interpreter: original document -> native PNG. */
self.onmessage=async({data})=>{
 const progress=message=>self.postMessage({type:'progress',message});
 try{
  const {ghostscriptRasterArgs}=await import('./ghostscript-raster.js?v=0.2.0-alpha.94');
  const {epsProgram,epsMetadata}=await import('./eps-pipeline.js?v=0.2.0-alpha.94');
  const {pdfProgram}=await import('./pdf-pipeline.js?v=0.2.0-alpha.94');
  const {downloadBinary}=await import('./asset-download.js?v=0.2.0-alpha.94');
  const args=ghostscriptRasterArgs(data.format,data.dpi,data.pageIndex);
  const program=data.format==='eps'?epsProgram(data.bytes):pdfProgram(data.bytes);
  if(data.format==='eps')epsMetadata(program);
  progress('Загрузка Ghostscript WASM…');
  const wasmBinary=await downloadBinary(new URL('vendor/ghostscript/gs-core.wasm',self.location.href),{label:'Ghostscript',onProgress:p=>progress('Ghostscript: '+(p.loaded/1048576).toFixed(1)+' МБ')});
  importScripts(new URL('vendor/ghostscript/gs-core.js',self.location.href).href);
  const logs=[];
  const core=await createGhostscriptCore({wasmBinary,print:s=>logs.push(String(s)),printErr:s=>logs.push(String(s))});
  core.FS.mkdir('/fonts');
  for(const font of data.fonts||[]){
   const name=font.name.replace(/[^a-zA-Z0-9_.-]/g,'_');
   core.FS.writeFile('/fonts/'+name,new Uint8Array(font.bytes));
  }
  core.FS.writeFile('/input.'+data.format,program);
  progress('Ghostscript: исходный '+data.format.toUpperCase()+' → PNG, '+data.dpi+' dpi, без AA…');
  let exit=0;
  try{exit=core.callMain(args)||0;}catch(error){if(typeof error.status==='number')exit=error.status;else throw error;}
  if(exit)throw Error('Ghostscript не смог растрировать исходник.\n'+logs.slice(-15).join('\n'));
  const outputs=core.FS.readdir('/').filter(name=>/^raster-\d+\.png$/.test(name));
  if(outputs.length!==1)throw Error('Ghostscript должен вернуть одну страницу PNG, получено '+outputs.length+'.\n'+logs.slice(-6).join('\n'));
  const png=core.FS.readFile('/'+outputs[0]).slice();
  self.postMessage({type:'done',bytes:png},[png.buffer]);
 }catch(error){self.postMessage({type:'error',message:error?.message||String(error)});}
};
