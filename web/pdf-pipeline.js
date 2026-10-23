/** Decode a PDF using the same bundled MuPDF WASM engine as EPS.
 * Render only the selected page to SVG, preserving curves, glyph outlines,
 * page scale, and embedded raster elements. No remote service or rasterization
 * of the full page is involved. */
export const PDF_MAX_BYTES=64*1024*1024;
export const PDF_MAX_PAGES=500;
export function pdfProgram(input){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(!bytes.byteLength||bytes.byteLength>PDF_MAX_BYTES)
    throw Error('PDF должен быть непустым файлом размером до 64 МБ.');
  // The PDF spec allows some leading bytes; still require a real PDF header
  // before passing untrusted bytes to WASM.
  const limit=Math.min(bytes.length-4,1024);
  let found=false;
  for(let i=0;i<=limit;i++){
    if(bytes[i]===37&&bytes[i+1]===80&&bytes[i+2]===68&&bytes[i+3]===70&&bytes[i+4]===45){
      found=true;break;
    }
  }
  if(!found)throw Error('Файл не содержит корректный заголовок %PDF-.');
  return bytes;
}
function checkedBounds(bounds){
  if(!Array.isArray(bounds)||bounds.length!==4||
    bounds.some(x=>!Number.isFinite(x))||
    bounds[2]<=bounds[0]||bounds[3]<=bounds[1]||
    Math.max(bounds[2]-bounds[0],bounds[3]-bounds[1])>1e6)
    throw Error('PDF содержит некорректный размер страницы.');
  return bounds;
}
function withPdf(bytes,mupdf,visit){
  const document=mupdf.Document.openDocument(pdfProgram(bytes),'application/pdf');
  try{return visit(document);}
  finally{document.destroy();}
}
export function pdfPages(bytes,mupdf){
  return withPdf(bytes,mupdf,document=>{
    const count=document.countPages();
    if(!Number.isInteger(count)||count<1||count>PDF_MAX_PAGES)
      throw Error('PDF должен содержать от 1 до '+PDF_MAX_PAGES+' страниц.');
    const pages=[];
    for(let i=0;i<count;i++){
      const page=document.loadPage(i);
      try{
        const bounds=checkedBounds(page.getBounds());
        pages.push({index:i,number:i+1,
          widthPt:bounds[2]-bounds[0],heightPt:bounds[3]-bounds[1]});
      }finally{page.destroy();}
    }
    return pages;
  });
}
export function pdfPageToSvg(bytes,mupdf,pageIndex){
  if(!Number.isInteger(pageIndex)||pageIndex<0)throw Error('Неверный номер страницы PDF.');
  return withPdf(bytes,mupdf,document=>{
    const count=document.countPages();
    if(pageIndex>=count)throw Error('Запрошенная страница отсутствует в PDF.');
    const page=document.loadPage(pageIndex);
    let buffer,writer,device;
    try{
      const bounds=checkedBounds(page.getBounds());
      buffer=new mupdf.Buffer();
      writer=new mupdf.DocumentWriter(buffer,'svg','text=path,no-reuse-images');
      device=writer.beginPage(bounds);
      page.run(device,mupdf.Matrix.identity);
      device.close();device=null;
      writer.endPage();writer.close();
      return {
        svg:buffer.asString(),
        widthPt:bounds[2]-bounds[0],heightPt:bounds[3]-bounds[1],
        metadata:{pageIndex,pageNumber:pageIndex+1,pageCount:count,
          widthPt:bounds[2]-bounds[0],heightPt:bounds[3]-bounds[1]},
        warnings:[],logs:['PDF page '+(pageIndex+1)+'/'+count+' converted to editable SVG vectors.']
      };
    }finally{device?.destroy();writer?.destroy();buffer?.destroy();page.destroy();}
  });
}
