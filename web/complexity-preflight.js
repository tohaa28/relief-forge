// Lightweight preflight. It never changes, rejects or simplifies document geometry.
// DOS EPS has a binary preview, so inspect only its declared PostScript section.
const MAX_SCAN_BYTES=16*1024*1024;
const LARGE_SOURCE_BYTES=8*1024*1024;
const numericLine=/^(?:[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?\s+)+(m|C|L)$/;
const magic=[0xc5,0xd0,0xd3,0xc6];
export function inspectDocumentComplexity(bytes,filename=''){
  const length=bytes?.byteLength||0;
  const eps=/\.(?:eps|epsf|epsi|ps)$/i.test(filename);
  if(!eps)return {large:length>=LARGE_SOURCE_BYTES,estimated:false,bytes:length,contours:0,curves:0,lines:0,scannedBytes:0};
  let start=0,size=length;
  if(length>=30&&magic.every((v,i)=>bytes[i]===v)){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    const begin=view.getUint32(4,true),psBytes=view.getUint32(8,true);
    if(begin<30||psBytes===0||begin+psBytes>length)
      return {large:length>=LARGE_SOURCE_BYTES,estimated:false,bytes:length,contours:0,curves:0,lines:0,scannedBytes:0,invalidHeader:true};
    start=begin;size=psBytes;
  }
  const scannedBytes=Math.min(size,MAX_SCAN_BYTES);
  const ascii=new TextDecoder('latin1').decode(bytes.subarray(start,start+scannedBytes));
  let contours=0,curves=0,lines=0;
  for(const raw of ascii.split(/\r?\n/)){
    const command=numericLine.exec(raw.trim())?.[1];
    if(command==='m')contours++;
    else if(command==='C')curves++;
    else if(command==='L')lines++;
  }
  const large=contours>150||curves+lines>2500||size>MAX_SCAN_BYTES||length>=LARGE_SOURCE_BYTES;
  return {large,estimated:true,bytes:length,postscriptBytes:size,contours,curves,lines,scannedBytes,truncated:size>scannedBytes};
}
export function largeFileWarning(report){
  if(!report?.large)return '';
  const details=report.estimated&&report.contours+report.curves+report.lines>0
    ?report.contours.toLocaleString('ru-RU')+' начал контуров, '+
      (report.curves+report.lines).toLocaleString('ru-RU')+' сегментов'
    :report.totalPoints
      ?report.totalPoints.toLocaleString('ru-RU')+' расчётных точек'
      :'сложный или объёмный документ';
  return 'Большой векторный файл: '+details+
    '. Обработка будет замедлена. Программа последовательно пройдёт все доступные блоки с индикатором прогресса; автоматически пропускать оставшуюся часть файла нельзя. '+
    'Если проверка связей между блоками или отдельных контуров не завершена, это будет явно отмечено как неполная диагностика.';
}
