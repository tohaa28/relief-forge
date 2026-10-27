/* Independent of the ES-module graph: can report delayed or failed imports. */
(function(){
  var failures=[],started=Date.now(),node=null,report=null,poll=null;
  var script=document.currentScript,expectedVersion=null;
  try{expectedVersion=new URL(script.src,location.href).searchParams.get('v');}catch(e){}
  function ready(){return document.documentElement.dataset.doctorReady==='true';}
  function snapshot(){return {at:new Date().toISOString(),version:document.documentElement.dataset.doctorVersion||expectedVersion,
    versionSource:document.documentElement.dataset.doctorVersion?'runtime':'requested-script',
    userAgent:navigator.userAgent,appReady:document.documentElement.dataset.doctorReady||null,
    state:ready()?'ready':failures.length?'resource-error':'loading',elapsedMs:Date.now()-started,
    page:location.origin+location.pathname,errors:failures.slice(),
    resources:typeof performance!=='undefined'?performance.getEntriesByType('resource').filter(function(r){return r.name.indexOf(location.origin+'/')===0;}).slice(-12).map(function(r){return {url:r.name,durationMs:Math.round(r.duration),status:r.responseStatus||null};}):[]};}
  function dismiss(){if(node){node.remove();node=null;}if(poll){clearInterval(poll);poll=null;}}
  function update(){
    if(ready()){dismiss();return;}
    if(!node)return;
    node.querySelector('strong').textContent=failures.length?'Не удалось завершить загрузку рабочего поля.':'Интерфейс ещё загружается…';
    node.querySelector('[data-startup-info]').textContent=failures.length?
      'При загрузке зарегистрирована ошибка. Отчёт содержит адреса ресурсов; можно повторить загрузку страницы.':
      'Ожидаем загрузку модулей. Если ожидание затянется, откройте отчёт или повторите загрузку страницы.';
  }
  window.addEventListener('error',function(e){if(failures.length<15)failures.push(String(e.message||e.target&&e.target.src||'Resource error'));update();},true);
  window.addEventListener('unhandledrejection',function(e){if(failures.length<15)failures.push(String(e.reason&&e.reason.message||e.reason||'Rejected promise'));update();});
  document.addEventListener('doctor-ready',dismiss);
  setTimeout(function(){
    if(ready())return;
    node=document.createElement('section');node.id='doctor-startup-error';node.setAttribute('role','status');
    node.style.cssText='position:fixed;z-index:10001;left:12px;right:12px;bottom:46px;padding:14px 16px;background:#fff5eb;color:#572b20;border:2px solid #d99068;font:13px/1.55 system-ui,Arial,sans-serif;border-radius:10px;box-shadow:0 5px 25px #1235';
    var heading=document.createElement('strong'),info=document.createElement('div');info.setAttribute('data-startup-info','');
    report=document.createElement('textarea');report.readOnly=true;report.style.cssText='display:none;box-sizing:border-box;width:100%;height:140px;font:11px Consolas,monospace;margin-top:7px';
    var toggle=document.createElement('button');toggle.type='button';toggle.textContent='Показать отчёт';toggle.style.marginTop='7px';
    toggle.onclick=function(){report.value=JSON.stringify(snapshot(),null,2);report.style.display='block';report.focus();report.select();};
    var retry=document.createElement('button');retry.type='button';retry.textContent='Повторить загрузку';retry.style.marginLeft='8px';retry.onclick=function(){location.reload();};
    node.append(heading,info,toggle,retry,report);document.body.append(node);update();poll=setInterval(update,500);
  },6500);
})();
