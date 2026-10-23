/**
 * Fail closed when an EPS interpreter emits a syntactically valid but empty
 * SVG. An empty PDF page is a valid, different case and is reported as such.
 * The caller must check before creating a checkpoint/replacing the document.
 */
export class EmptyVectorImportError extends Error {
  constructor(format, source, detail=''){
    const name=String(source||'файл');
    super(format==='eps'?
      'EPS «'+name+'» обработан, но векторные объекты не извлечены (0 контуров). '+
      'Импорт отменён, предыдущий документ сохранён. Проверьте EPS в исходном редакторе '+
      'и при необходимости повторно экспортируйте его с преобразованием текста в кривые. '+
      'Скачайте журнал и диагностический отчёт рабочего поля.':
      'SVG «'+name+'» не содержит редактируемых векторов.');
    this.name='EmptyVectorImportError';
    this.code=format==='eps'?'EPS_EMPTY_GEOMETRY':'SVG_EMPTY_GEOMETRY';
    this.format=format;
    this.source=name;
    this.detail=String(detail||'');
  }
}
export function assessImportedGeometry(document,{format='eps',source='',allowEmpty=false,
  conversion=null}={}){
  if(!document||!Array.isArray(document.paths))
    throw Error('Импортёр вернул документ без списка объектов.');
  const count=document.paths.length;
  const vectors=document.paths.filter(p=>p?.kind!=='image').length;
  const images=count-vectors;
  const result={format,source,count,vectors,images,empty:count===0,
    conversion:conversion?{
      svgBytes:typeof conversion.svg==='string'?conversion.svg.length:null,
      logs:(conversion.logs||[]).slice(-10),
      outlineRecovery:conversion.outlineRecovery||null
    }:null};
  if(!count&&!allowEmpty&&format==='eps')throw new EmptyVectorImportError('eps',source,
    'Конвертер SVG получил '+(result.conversion?.svgBytes??'неизвестно')+' символов.');
  return result;
}
