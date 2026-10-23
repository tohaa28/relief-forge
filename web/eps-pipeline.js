import {recoverUnpaintedCorelOutlines} from './corel-outline.js?v=0.2.0-alpha.38';
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
  const text=new TextDecoder('latin1').decode(bytes);
  // A DSC EPS can contain both a DOCUMENT BoundingBox and a PAGE BoundingBox.
  // CorelDRAW writes its real trimmed artwork box in the EPS header, then
  // writes a different %%BoundingBox within %%Page (often the whole A4 sheet).
  // Never let the page-local value overwrite the EPS header dimensions.
  let depth=0,inPage=false,inTrailer=false;
  let headerBox=null,headerHiRes=null,trailerBox=null,trailerHiRes=null;
  for(const line of text.split(/\r\n|\n|\r/)){
    if(/^%%BeginDocument\b/.test(line)){depth++;continue;}
    if(/^%%EndDocument\b/.test(line)){depth=Math.max(0,depth-1);continue;}
    if(depth)continue;
    if(/^%%Page:\s/.test(line)){inPage=true;inTrailer=false;continue;}
    if(/^%%Trailer\b/.test(line)){inPage=false;inTrailer=true;continue;}
    if(inPage)continue;
    const m=line.match(/^%%(HiRes)?BoundingBox:\s*([^\r\n]*)/);
    if(!m||m[2].includes('(atend)'))continue;
    const v=m[2].trim().split(/\s+/).map(Number);
    if(v.length!==4||v.some(x=>!Number.isFinite(x))||v[2]<=v[0]||v[3]<=v[1])continue;
    if(inTrailer){if(m[1])trailerHiRes=v;else trailerBox=v;}
    else if(m[1])headerHiRes??=v;
    else headerBox??=v;
  }
  const box=headerHiRes||trailerHiRes||headerBox||trailerBox;
  const hires=Boolean(headerHiRes||trailerHiRes);
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
// Fast, literal-geometry path for CorelDRAW EPS that does not paint its paths.
// Deliberately avoid loading the large Ghostscript / MuPDF engines for this case:
// it is otherwise possible to time out before the existing blank-page fallback.
// Never interpret general PostScript here; the conservative reader returns null.
export function recoverOutlineOnlyEps(input){
  const program=epsProgram(input);
  // Most EPS are not literal path-only CorelDRAW files. Check the DSC creator
  // in the small header before decoding/scanning the entire EPS. If a rare EPS
  // has a creator field outside that window, full Ghostscript fallback still
  // recovers valid unpainted artwork after blank-page detection.
  const prefix=new TextDecoder('latin1').decode(program.subarray(0,Math.min(16384,program.length)));
  if(!/^%%Creator:\s*(?:CorelDRAW|Relief Forge)\b/mi.test(prefix))return null;
  const metadata=epsMetadata(program);
  const recovered=recoverUnpaintedCorelOutlines(program,metadata);
  if(!recovered)return null;
  const outlineRecovery={source:recovered.source,count:recovered.count,previewStrokePt:recovered.previewStrokePt};
  const producer=recovered.source==='relief-forge-outline-paths'?'Relief Forge':'CorelDRAW';
  return {
    svg:recovered.svg,widthPt:metadata.widthPt,heightPt:metadata.heightPt,
    metadata,outlineRecovery,
    warnings:[`Обнаружено ${recovered.count} непечатаемых контуров ${producer}. Видимая тонкая обводка используется только для просмотра и анализа, а не для печати.`],
    logs:['CorelDRAW literal path-only EPS; original geometry recovered without rendering engines.']
  };
}
export async function interpretEps(input,{runGhostscript,mupdf,fonts=[],progress=()=>{}}){
  const direct=recoverOutlineOnlyEps(input);
  if(direct){progress(85,'Восстановлены исходные EPS-кривые без заливки…');return direct;}
  const program=epsProgram(input),metadata=epsMetadata(program);let logs=[];
  for(let attempt=0;attempt<2;attempt++){
    progress(25+attempt*15,attempt?'Завершение EPS без showpage…':'Интерпретация PostScript…');
    const result=await runGhostscript(program,ghostscriptArgs(!!attempt),fonts);logs.push(...result.logs);
    progress(65,'Извлечение векторов, шрифтов и изображений…');
    const rendered=pdfToSvg(result.pdf,mupdf);
    if(rendered){
      const warnings=logs.filter(s=>/substitut|not found|cannot find|can.t find|warning|recover/i.test(s));
      // A valid EPS without showpage may leave a white fallback page in pdfwrite.
      const hasVisibleGeometry=/<(?:path|image|use)\b/.test(rendered.svg);
      if(Math.abs(rendered.widthPt-metadata.widthPt)>.05||Math.abs(rendered.heightPt-metadata.heightPt)>.05)throw Error('Интерпретатор изменил физический размер EPS; импорт отменён.');
      // Recover empty Corel path-only EPS before trying to append a second
      // showpage. Some producers already emitted one blank PDF page and
      // appending showpage then creates an invalid two-page EPS result.
      const recovery=hasVisibleGeometry?null:recoverUnpaintedCorelOutlines(program,metadata);
      if(!hasVisibleGeometry&&!recovery){
        const hasShowpage=/\bshowpage\b/.test(new TextDecoder('latin1').decode(program));
        if(attempt===0&&!hasShowpage){
          progress(70,'Повторная проверка EPS: первая попытка дала пустую страницу…');
          continue;
        }
        throw Error('EPS был интерпретирован как пустая страница: ни одного видимого '+
          'векторного контура или изображения. Импорт остановлен, файл не заменён. '+
          'Детали Ghostscript: '+logs.slice(-3).join(' | ').slice(0,450));
      }
      if(recovery)warnings.push(`Обнаружено ${recovery.count} непечатаемых контуров ${recovery.source==='relief-forge-outline-paths'?'Relief Forge':'CorelDRAW'}. Добавлена только видимая обводка для анализа; в исходном EPS заливки и толщины не изменены.`);
      return {...rendered,svg:recovery?.svg||rendered.svg,outlineRecovery:recovery?{source:recovery.source,count:recovery.count,previewStrokePt:recovery.previewStrokePt}:null,metadata,warnings:[...new Set(warnings)],logs};
    }
  }
  throw Error('EPS не создал изображение страницы.');
}
