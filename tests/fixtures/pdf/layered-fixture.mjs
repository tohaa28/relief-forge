// Source-owned PDF regression geometry; no private document bytes.
export function layeredPdf({pages=1,layerName='Тест & <слой> "A"',image=false}={}){
 const objects=[],add=body=>(objects.push(body),objects.length),put=(i,body)=>{objects[i-1]=body;};
 const catalog=add(''),tree=add(''),layer=add('');
 const name=Buffer.from(layerName,'utf16le').swap16().toString('hex');
 put(layer,'<< /Type /OCG /Name <feff'+name+'> >>');
 const font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
 const raster=image?add('<< /Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /ASCIIHexDecode /Length 25 >>\nstream\nFF000000FF000000FFFFFFFF>\nendstream'):null;
 const pageIds=[];
 for(let i=0;i<pages;i++){
  const ops='/OC /Artwork BDC\n0.1 0.2 0.3 rg 10 10 m 20 60 60 60 70 10 c 10 10 l f\nBT /F1 9 Tf 75 50 Td (PDF test) Tj ET\n'+(image?'q 20 0 0 20 90 15 cm /Im1 Do Q\n':'')+'EMC\n';
  const stream=add('<< /Length '+Buffer.byteLength(ops)+' >>\nstream\n'+ops+'endstream');
  pageIds.push(add('<< /Type /Page /Parent '+tree+' 0 R /MediaBox [0 0 144 72] /Resources << /Properties << /Artwork '+layer+' 0 R >> /Font << /F1 '+font+' 0 R >> '+(image?'/XObject << /Im1 '+raster+' 0 R >> ':'')+'>> /Contents '+stream+' 0 R >>'));
 }
 put(tree,'<< /Type /Pages /Kids ['+pageIds.map(i=>i+' 0 R').join(' ')+'] /Count '+pages+' >>');
 put(catalog,'<< /Type /Catalog /Pages '+tree+' 0 R /OCProperties << /OCGs ['+layer+' 0 R] /D << /Order ['+layer+' 0 R] /ON ['+layer+' 0 R] >> >> >>');
 let source='%PDF-1.4\n',positions=[0];objects.forEach((body,i)=>{positions.push(Buffer.byteLength(source));source+=(i+1)+' 0 obj\n'+body+'\nendobj\n';});
 const xref=Buffer.byteLength(source);source+='xref\n0 '+positions.length+'\n0000000000 65535 f \n';
 for(const p of positions.slice(1))source+=String(p).padStart(10,'0')+' 00000 n \n';
 return Buffer.from(source+'trailer\n<< /Size '+positions.length+' /Root '+catalog+' 0 R >>\nstartxref\n'+xref+'\n%%EOF\n');
}
