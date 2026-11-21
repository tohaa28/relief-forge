import {DOCTORTRACER_URL} from './doctortracer-fallback.js?v=0.2.0-alpha.92';


// Drive the published wizard through its file input and SVG export controls.
// The frame is restricted to the common Pages origin. No document is uploaded.
export async function traceInDoctorTracerInterface(png,{frame,returnButton,status,signal,
  url=DOCTORTRACER_URL}={}){
  const target=new URL(url);
  if(target.origin!==location.origin)throw Error('Интерфейс DoctorTracer доступен в опубликованной версии на GitHub Pages.');
  if(signal?.aborted)throw Error('Трассировка отменена.');
  return new Promise((resolve,reject)=>{
    let observer,settled=false,returning=false,connected=false;
    const timer=setTimeout(()=>finish(Error('Интерфейс DoctorTracer не загрузился.')),30000);
    const readiness=setInterval(()=>connect(),150);
    const abort=()=>finish(Error('Трассировка отменена.'));
    const finish=(error,result)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      clearInterval(readiness);
      observer?.disconnect();
      frame.removeEventListener('load',load);
      signal?.removeEventListener('abort',abort);
      returnButton.onclick=null;
      returnButton.disabled=true;
      frame.removeAttribute('src');
      error?reject(error):resolve(result);
    };
    const load=()=>connect(true);
    function connect(loaded=false){
      if(connected||settled)return;
      try{
        const win=frame.contentWindow,ui=frame.contentDocument;
        if(!ui||win.location.origin!==location.origin||win.location.pathname!==target.pathname)return;
        const input=ui.getElementById('file'),vector=ui.getElementById('vector');
        if(!input?.onchange||!vector){
          if(loaded)throw Error('Интерфейс DoctorTracer изменился. Передача изображения недоступна.');
          return;
        }
        if(win.doctorTracerInputContract!=='native-raster-v1')throw Error('Требуется DoctorTracer с поддержкой исходного разрешения (0.21.3 или новее). Передача отменена: уменьшение запрещено.');
        // Images and other decorative resources must not delay the handoff.
        connected=true;
        clearTimeout(timer);
        clearInterval(readiness);
        const transfer=new win.DataTransfer();
        transfer.items.add(new win.File([png],'Импортированный макет.png',{type:'image/png'}));
        input.files=transfer.files;
        input.dispatchEvent(new win.Event('change',{bubbles:true}));
        status('Настройте параметры и запустите трассировку в DoctorTracer.');
        const update=()=>{
          // Embedded export only returns bytes to the host application.
          const folder=ui.getElementById('browseFolder');
          if(folder&&!folder.disabled)folder.disabled=true;
          returnButton.disabled=vector.disabled||returning;
        };
        observer=new win.MutationObserver(update);
        observer.observe(ui.body,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
        update();
        returnButton.onclick=async()=>{
          if(vector.disabled||settled||returning)return;
          returning=true;
          returnButton.disabled=true;
          try{
            if(!ui.getElementById('format')){
              ui.dispatchEvent(new win.KeyboardEvent('keydown',{key:'s',ctrlKey:true,cancelable:true}));
            }
            const format=ui.getElementById('format'),download=ui.getElementById('download');
            if(!format||!download)throw Error('Закройте диалог настроек или откройте экран сохранения SVG.');
            format.value='svg';
            let blobUrl;
            const prototype=win.HTMLAnchorElement.prototype,click=prototype.click;
            prototype.click=function(){
              if(this.download.endsWith('.svg')&&this.href.startsWith('blob:'+location.origin+'/'))
                blobUrl=this.href;
            };
            try{download.click();}finally{prototype.click=click;}
            if(!blobUrl)throw Error('DoctorTracer не выдал SVG.');
            const response=await fetch(blobUrl);
            const blob=await response.blob();
            if(!response.ok||blob.size>32*1024*1024)throw Error('SVG не получен или превышает допустимый размер.');
            const svg=await blob.text();
            if(!svg.includes('<svg'))throw Error('DoctorTracer вернул некорректный SVG.');
            finish(null,{svg,backend:'DoctorTracer Web'});
          }catch(error){
            returning=false;
            if(!settled){status(error.message);update();}
          }
        };
      }catch(error){finish(error);}
    }
    signal?.addEventListener('abort',abort,{once:true});
    frame.addEventListener('load',load,{once:true});
    frame.src=target.href;
  });
}
