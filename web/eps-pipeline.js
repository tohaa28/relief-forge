export const EPS_MAX_BYTES=64*1024*1024;
export function epsProgram(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(!bytes.length||bytes.length>EPS_MAX_BYTES)throw Error('EPS должен быть непустым файлом размером до 64 МБ.');
  let program=bytes;
  if(bytes[0]===0xc5&&bytes[1]===0xd0&&bytes[2]===0xd3&&bytes[3]===0xc6){
    if(bytes.length<30)throw Error('Повреждён двоичный заголовок EPS.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),offset=view.getUint32(4,true),length=view.getUint32(8,true);
    if(offset<30||!length||offset+length>bytes.length)throw Error('Повреждён диапазон PostScript в двоичном EPS.');
    program=bytes.slice(offset,offset+length);
  }
  if(program[0]!==37||program[1]!==33)throw Error('Файл не содержит PostScript-программу EPS (%!).');
  return program;
}
export function epsMetadata(bytes){
  const text=new TextDecoder('latin1').decode(bytes);let depth=0,bbox=null,hires=null;
  for(const line of text.split(/\r\n|\n|\r/)){
    if(/^%%BeginDocument\b/.test(line)){depth++;continue;}
    if(/^%%EndDocument\b/.test(line)){depth=Math.max(0,depth-1);continue;}
    if(depth)continue;
    const m=line.match(/^%%(HiRes)?BoundingBox:\s*([^\r\n]*)/);if(!m||m[2].includes('(atend)'))continue;
    const v=m[2].trim().split(/\s+/).map(Number);
    if(v.length!==4||v.some(x=>!Number.isFinite(x))||v[2]<=v[0]||v[3]<=v[1])continue;
    if(m[1])hires=v;else bbox=v;
  }
  const box=hires||bbox;
  if(!box)throw Error('В EPS не найден корректный %%BoundingBox / %%HiResBoundingBox.');
  if(box.some(v=>Math.abs(v)>1e7))throw Error('Размеры EPS выходят за допустимый диапазон.');
  return {boundingBox:box,hires:!!hires,widthPt:box[2]-box[0],heightPt:box[3]-box[1]};
}
export function ghostscriptArgs(appendPage=false){
  const args=['-dSAFER','-dBATCH','-dNOPAUSE','-dEPSCrop','-dAutoRotatePages=/None','-sDEVICE=pdfwrite','-dCompatibilityLevel=1.7','-dNoOutputFonts','-dDownsampleColorImages=false','-dDownsampleGrayImages=false','-dDownsampleMonoImages=false','-sColorConversionStrategy=LeaveColorUnchanged','-sFONTPATH=/fonts','-sOutputFile=/output.pdf','-f','/input.eps'];
  if(appendPage)args.push('-c','showpage');return args;
}
export function pdfToSvg(bytes,mupdf){
  const document=mupdf.Document.openDocument(new Uint8Array(bytes),'application/pdf');
  let page,buffer,writer,device;
  try{
    const count=document.countPages();if(count===0)return null;
    if(count!==1)throw Error(`EPS создал ${count} страниц; нужен одностраничный EPS.`);
    page=document.loadPage(0);const bounds=page.getBounds();
    buffer=new mupdf.Buffer();writer=new mupdf.DocumentWriter(buffer,'svg','text=path,no-reuse-images');device=writer.beginPage(bounds);
    page.run(device,mupdf.Matrix.identity);device.close();writer.endPage();writer.close();
    return {svg:buffer.asString(),widthPt:bounds[2]-bounds[0],heightPt:bounds[3]-bounds[1]};
  }finally{device?.destroy();writer?.destroy();buffer?.destroy();page?.destroy();document.destroy();}
}
export async function interpretEps(input,{runGhostscript,mupdf,fonts=[],progress=()=>{}}){
  const program=epsProgram(input),metadata=epsMetadata(program);let logs=[];
  for(let attempt=0;attempt<2;attempt++){
    progress(25+attempt*15,attempt?'Завершение EPS без showpage…':'Интерпретация PostScript…');
    const result=await runGhostscript(program,ghostscriptArgs(!!attempt),fonts);logs.push(...result.logs);
    progress(65,'Извлечение векторов, шрифтов и изображений…');
    const rendered=pdfToSvg(result.pdf,mupdf);
    if(rendered){
      const warnings=logs.filter(s=>/substitut|not found|cannot find|can.t find|warning|recover/i.test(s));
      // A valid EPS without showpage may leave a white fallback page in pdfwrite.
      if(attempt===0&&!/<(?:path|image|use)\b/.test(rendered.svg)&&!/\bshowpage\b/.test(new TextDecoder('latin1').decode(program)))continue;
      if(Math.abs(rendered.widthPt-metadata.widthPt)>.05||Math.abs(rendered.heightPt-metadata.heightPt)>.05)throw Error('Интерпретатор изменил физический размер EPS; импорт отменён.');
      return {...rendered,metadata,warnings:[...new Set(warnings)],logs};
    }
  }
  throw Error('EPS не создал изображение страницы.');
}
