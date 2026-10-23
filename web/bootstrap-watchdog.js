/* Non-module safety net: this runs even when app.js or its SVG/WASM imports
 * fail to load on one machine. Deliberately independent of app.js imports. */
(function(){
  var failures=[];
  window.addEventListener('error',function(e){
    if(failures.length<15)failures.push(String(e.message||e.target&&e.target.src||'Resource error'));
  },true);
  window.addEventListener('unhandledrejection',function(e){
    if(failures.length<15)failures.push(String(e.reason&&e.reason.message||e.reason||'Rejected promise'));
  });
  setTimeout(function(){
    if(document.documentElement.dataset.doctorReady==='true')return;
    var node=document.getElementById('doctor-startup-error');
    if(node)return;
    node=document.createElement('section');node.id='doctor-startup-error';
    node.style.cssText='position:fixed;z-index:10001;left:12px;right:12px;bottom:46px;'+
      'padding:14px 16px;background:#fff5eb;color:#572b20;border:2px solid #d99068;'+
      'font:13px/1.55 system-ui,Arial,sans-serif;border-radius:10px;box-shadow:0 5px 25px #1235';
    var heading=document.createElement('strong');
    heading.textContent='Не удалось завершить загрузку рабочего поля.';
    var info=document.createElement('div');
    info.textContent='Интерфейс SVG не инициализирован. Возможно, не загрузился модуль или один из ресурсов. '+
      'Попробуйте Ctrl+F5. Если ошибка останется, скопируйте отчёт.';
    var report=document.createElement('textarea');report.readOnly=true;
    report.style.cssText='display:none;box-sizing:border-box;width:100%;height:85px;'+
      'font:11px Consolas,monospace;margin-top:7px';
    report.value=JSON.stringify({at:new Date().toISOString(),version:'0.2.0-alpha.31',
      userAgent:navigator.userAgent,appReady:document.documentElement.dataset.doctorReady||null,
      errors:failures},null,2);
    var toggle=document.createElement('button');toggle.type='button';
    toggle.textContent='Показать отчёт';toggle.style.marginTop='7px';
    toggle.onclick=function(){report.style.display='block';report.focus();report.select();};
    node.append(heading,info,toggle,report);document.body.append(node);
  },6500);
})();
