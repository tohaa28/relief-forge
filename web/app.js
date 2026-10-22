import {importRichSvg,worldData,artworkMarkup,safeFragment,sampledContours,exportDocument} from './rich-svg.js';
import {issueViewBox} from './issue-focus.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const names={open:'Открытый контур',coincident:'Совпадающие узлы',short:'Короткий отрезок',duplicate:'Дубликат',overlap:'Наложение отрезков',self_intersection:'Самопересечение',intersection:'Пересечение объектов'};
let diagnosticComplete=true,markersVisible=true;
let doc={format:'relief-forge',version:1,width:300,height:200,paths:[]},selected=new Set(),issues=[],metrics=[],past=[],future=[],mode='select',draft=[],drag=null,pan=null,worker,ready=false,pending=null,sequence=0,busy=false;
let epsWorker=null,epsTimer=null;let importFonts=[];
const journal=[];const clone=v=>structuredClone(v);
function record(action,detail={}){journal.push({at:new Date().toISOString(),action,detail});}
function status(s){$('status').textContent=String(s).split('\n')[0];$('status').title=s;}
function checkpoint(before=doc){past.push(clone(before));if(past.length>100)past.shift();future=[];}
function changed(action){issues=[];metrics=[];diagnosticComplete=true;markersVisible=true;record(action,{paths:doc.paths.length,nodes:doc.paths.reduce((n,p)=>n+p.points.length,0)});render();}
function fit(){const pad=Math.max(doc.width,doc.height)*.07;$('canvas').setAttribute('viewBox',`${-pad} ${-pad} ${doc.width+pad*2} ${doc.height+pad*2}`);render();}
function focusIssue(issue){
  const canvas=$('canvas'),view=canvas.viewBox.baseVal;
  const rawTolerance=Number($('tolerance').value);
  const tolerance=Number.isFinite(rawTolerance)&&rawTolerance>0?rawTolerance:0.01;
  const next=issueViewBox({x:view.x,y:view.y,width:view.width,height:view.height},issue.point,doc,tolerance);
  if(!next){status('Невозможно перейти к замечанию: неверные координаты.');return;}
  selected=new Set([issue.path,issue.other].filter(i=>Number.isInteger(i)&&i>=0&&i<doc.paths.length));
  canvas.setAttribute('viewBox',`${next.x} ${next.y} ${next.width} ${next.height}`);
  record('focus-issue',{kind:issue.kind,path:issue.path,other:issue.other,point:issue.point});
  render();
}
function el(tag,attrs,parent){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
const pathData=worldData;
function appendMarkup(parent,text){const parsed=new DOMParser().parseFromString(`<svg xmlns="${ns}" xmlns:xlink="http://www.w3.org/1999/xlink">${text}</svg>`,'image/svg+xml');for(const child of [...parsed.documentElement.children])parent.append(document.importNode(child,true));}
function render(){
  $('width').value=doc.width;$('height').value=doc.height;$('count').textContent=doc.paths.length;
  for(const id of ['sheet','grid-bg']){ $(id).setAttribute('width',doc.width);$(id).setAttribute('height',doc.height); }
  $('geometry').replaceChildren();$('markers').replaceChildren();$('paths').replaceChildren();
  if(doc.svgDefs)appendMarkup($('geometry'),doc.svgDefs);
  $('import-report').textContent=doc.epsImport?`EPS · ${doc.width.toFixed(3)} × ${doc.height.toFixed(3)} мм · ${doc.paths.filter(p=>p.kind!=='image').length} векторов · ${doc.paths.filter(p=>p.kind==='image').length} изображений. ${doc.epsImport.warnings.length?'Предупреждения: '+doc.epsImport.warnings.join(' · '):'Импорт завершён.'}`:'';
  const radius=$('canvas').viewBox.baseVal.width/450;
  doc.paths.forEach((p,i)=>{
    const attrs={d:pathData(p),'data-path':i};if(p.artwork){const painted=el('g',{'data-path':i},$('geometry'));appendMarkup(painted,artworkMarkup(p));if(selected.has(i))el('path',{...attrs,class:'path selected rich-selection'},$('geometry'));}else el('path',{...attrs,class:`path ${selected.has(i)?'selected':''}`},$('geometry'));el('path',{...attrs,class:'hit'},$('geometry'));
    if(selected.has(i)&&!p.artwork)p.points.forEach(([cx,cy],node)=>el('circle',{cx,cy,r:radius,class:'node','data-path':i,'data-node':node},$('geometry')));
    const b=document.createElement('button');b.textContent=`${i+1}. ${p.kind==='image'?'Изображение':p.artwork?'EPS / SVG':p.closed?'Замкнут':'Открыт'} · ${p.points.length} узлов`;b.classList.toggle('selected',selected.has(i));b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(i)?selected.delete(i):selected.add(i);render();};$('paths').append(b);
  });
  if(markersVisible)issues.slice(0,1000).forEach((x,i)=>el('circle',{cx:x.point[0],cy:x.point[1],r:radius*1.6,class:`problem ${x.path!==x.other?'external':''}`,'data-issue':i},$('markers')));
  $('draft').replaceChildren();if(draft.length)el('path',{d:pathData({points:draft}),class:'path selected'},$('draft'));
  $('issues').replaceChildren();const counts={};issues.forEach(x=>counts[x.kind]=(counts[x.kind]||0)+1);
  if(!diagnosticComplete)$('summary').textContent='Показаны первые 10000 замечаний. Проверка неполная: уменьшите выборку.';
  else if(issues.length)$('summary').textContent=Object.entries(counts).map(([k,n])=>`${names[k]}: ${n}`).join(' · ');
  else $('summary').textContent=metrics.length?'Проверка завершена: замечаний не найдено.':'Откройте SVG или нарисуйте векторы.';
  issues.slice(0,100).forEach(x=>{const b=document.createElement('button');b.className='issue';b.textContent=`${names[x.kind]} · ${x.path+1}${x.other!==x.path?' ↔ '+(x.other+1):''}`;b.title=`Перейти к X ${x.point[0].toFixed(3)} · Y ${x.point[1].toFixed(3)} мм`;b.onclick=()=>focusIssue(x);$('issues').append(b);});
  $('toggle-markers').textContent=markersVisible?'Скрыть маркеры':'Показать маркеры';
  $('toggle-markers').disabled=busy||!issues.length;
  $('undo').disabled=busy||!past.length;$('redo').disabled=busy||!future.length;
  $('diagnose').disabled=busy||!ready;document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!ready);
}
function lock(value,{coverCanvas=true}={}){busy=value;if(value){$('busy-label').textContent='Расчёт в Rust…';$('import-progress').value=0;}$('busy').hidden=!value;$('busy').classList.toggle('compact',value&&!coverCanvas);document.querySelectorAll('button,input').forEach(e=>{if(e.id!=='cancel'&&e.id!=='log')e.disabled=value;});if(!value)render();}
function spawnWorker(){
  worker=new Worker(new URL('worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id===0){ready=!data.error;$('engine').textContent=ready?'● Rust / WASM готов':'○ WASM не собран';status(data.error||'Rust-ядро готово');render();return;}
    if(!pending||data.id!==pending.id)return;
    const task=pending;pending=null;lock(false);
    if(data.error){record('engine-error',{error:data.error});status(data.error);return;}
    if(task.action){
      checkpoint(task.before);
      const scope=new Set(task.scope);const next=[];let inserted=false;const changedIndices=[];
      doc.paths.forEach((p,i)=>{if(scope.has(i)){if(!inserted){for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}inserted=true;}}else next.push(p);});
      if(!inserted)for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}
      doc.paths=next;selected=new Set(changedIndices);changed(`repair-${task.action}`);
      status('Изменения применены. Для повторной проверки нажмите «Найти проблемы».');
    }else{
      diagnosticComplete=data.output.diagnosticComplete;markersVisible=true;issues=data.output.issues.map(x=>({...x,path:task.scope[x.path],other:task.scope[x.other]}));metrics=doc.paths.map(()=>null);data.output.paths.forEach((p,i)=>metrics[task.scope[i]]=p);
      record('diagnose',{issues:issues.length,scope:task.scope});render();status(diagnosticComplete?`Проверено объектов: ${task.scope.length}. Замечаний: ${issues.length}.`:'Проверка неполная: достигнут лимит 10000 замечаний.');
    }
  };
  worker.onerror=e=>{pending=null;ready=false;$('engine').textContent='○ Ошибка WASM';lock(false);status(`Ошибка WASM worker: ${e.message}`);};worker.postMessage({id:0});
}
function calculate(action){
  if(!ready||busy)return;
  const selectedScope=doc.paths.map((_,i)=>i).filter(i=>(!$('selection-only').checked||!selected.size||selected.has(i))&&doc.paths[i].kind!=='image');
  if(!selectedScope.length){status('Нет векторов для проверки');return;}
  const tol=Number($('tolerance').value),parameter=Number($('loop-percent').value);
  if(!Number.isFinite(tol)||tol<1e-9||tol>1000){status('Укажите допуск от 0.000000001 до 1000 мм');return;}
  if(action&&selectedScope.some(i=>doc.paths[i].artwork)){status('Исходные EPS-кривые сохранены. Для лечения сначала создайте полилинии кнопкой «Копия для лечения».');return;}
  try{
    const scope=[],paths=[];
    for(const i of selectedScope)for(const p of sampledContours(doc.paths[i],tol)){scope.push(i);paths.push(p);}
    if(paths.reduce((n,p)=>n+p.points.length,0)>2000)throw Error('Для диагностики доступно 2000 узлов за раз. Выделите меньше объектов или увеличьте допуск. Оригиналы не изменены.');
    const input=[tol,action,parameter,paths.length];for(const p of paths)input.push(+p.closed,p.points.length,...p.points.flat());
    const id=++sequence;pending={id,action,scope,before:clone(doc)};record('engine-start',{action,scope,tolerance:tol,curveSampling:!action});lock(true,{coverCanvas:false});worker.postMessage({id,input});
  }catch(e){status(e.message);}
}
function at(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());return [p.x,p.y];}
function setMode(m){mode=m;draft=[];for(const key of ['select','line','rect','circle'])$(key).classList.toggle('active',key===mode);render();}
function download(name,content,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function validate(value){
  if(value?.format!=='relief-forge'||value.version!==1||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<=0||value.height<=0||!Array.isArray(value.paths))throw Error('Неверный формат проекта');
  let nodes=0;for(const p of value.paths){if(typeof p.closed!=='boolean'||!Array.isArray(p.points)||p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('Неверная геометрия');nodes+=p.points.length;}
  if(nodes>200000)throw Error('Документ превышает лимит импорта 200000 узлов. Для расчёта alpha выбирайте не более 2000 узлов за раз.');
  if(value.svgDefs)safeFragment(value.svgDefs);
  for(const p of value.paths)if(p.artwork){safeFragment(p.artwork);if(!['image','vector'].includes(p.kind)||!Array.isArray(p.offset)||p.offset.length!==2||p.offset.some(n=>!Number.isFinite(n))||!Array.isArray(p.commands)||p.commands.some(s=>!Array.isArray(s)||!['M','L','C','Q','Z'].includes(s[0])||s.length!==({M:3,L:3,C:7,Q:5,Z:1}[s[0]])||s.slice(1).some(n=>!Number.isFinite(n))))throw Error('Неверная геометрия EPS / SVG');}
  return clone({format:'relief-forge',version:1,width:value.width,height:value.height,paths:value.paths,svgDefs:value.svgDefs||'',sourceSvg:value.sourceSvg||'',...(value.epsImport?{epsImport:value.epsImport}:{})});
}
$('canvas').addEventListener('pointerdown',e=>{
  if(busy)return;const pos=at(e);const canvas=$('canvas');
  if(e.button===1){e.preventDefault();pan={pos};const b=canvas.viewBox.baseVal;pan.view=[b.x,b.y,b.width,b.height];canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  const issueMarker=e.target.closest('[data-issue]');
  if(issueMarker){const issue=issues[Number(issueMarker.dataset.issue)];if(issue)focusIssue(issue);return;}
  if(mode==='line'){draft.push(pos);render();return;}
  if(mode==='rect'||mode==='circle'){drag={start:pos,before:clone(doc),shape:mode};canvas.setPointerCapture(e.pointerId);return;}
  const target=e.target.closest('[data-path]');
  if(target){const i=Number(target.dataset.path);if(!e.shiftKey&&!selected.has(i))selected.clear();if(e.shiftKey&&selected.has(i))selected.delete(i);else selected.add(i);
    if(target.dataset.node!==undefined)drag={path:i,node:Number(target.dataset.node),before:clone(doc)};
    else drag={move:[...selected],start:pos,before:clone(doc)};
    canvas.setPointerCapture(e.pointerId);
  }else selected.clear();render();
});
$('canvas').addEventListener('pointermove',e=>{
  const pos=at(e);$('coords').textContent=`X ${pos[0].toFixed(2)} · Y ${pos[1].toFixed(2)} мм`;
  if(pan){const b=$('canvas').viewBox.baseVal;const dx=pos[0]-pan.pos[0],dy=pos[1]-pan.pos[1];b.x-=dx;b.y-=dy;return;}
  if(!drag||busy)return;
  if(drag.node!==undefined){doc.paths[drag.path].points[drag.node]=pos;render();}
  else if(drag.move){const dx=pos[0]-drag.start[0],dy=pos[1]-drag.start[1];for(const i of drag.move){doc.paths[i].points=drag.before.paths[i].points.map(([x,y])=>[x+dx,y+dy]);if(doc.paths[i].artwork)doc.paths[i].offset=[drag.before.paths[i].offset[0]+dx,drag.before.paths[i].offset[1]+dy];}render();}
  else{drag.end=pos;$('draft').replaceChildren();el('path',{d:pathData(makeShape(drag)),class:'path selected'},$('draft'));}
});
function makeShape(d){const [x,y]=d.start,[a,b]=d.end||d.start;
  return d.shape==='rect'?{closed:true,points:[[x,y],[a,y],[a,b],[x,b]]}:{closed:true,points:Array.from({length:96},(_,i)=>{const t=i*Math.PI*2/96,r=Math.hypot(a-x,b-y);return [x+r*Math.cos(t),y+r*Math.sin(t)];})};
}
$('canvas').addEventListener('pointerup',e=>{
  if(pan){pan=null;return;}if(!drag)return;
  if(drag.shape&&drag.end&&Math.hypot(drag.end[0]-drag.start[0],drag.end[1]-drag.start[1])>.001){doc.paths.push(makeShape(drag));selected=new Set([doc.paths.length-1]);}
  if(JSON.stringify(doc)!==JSON.stringify(drag.before)){checkpoint(drag.before);changed(drag.shape?'draw-'+drag.shape:'move-nodes');}else render();drag=null;
});
$('canvas').addEventListener('pointercancel',()=>{if(drag)doc=drag.before;drag=null;pan=null;render();});
$('canvas').addEventListener('wheel',e=>{if(busy)return;e.preventDefault();const p=at(e),b=$('canvas').viewBox.baseVal,f=e.deltaY>0?1.15:1/1.15;if(b.width*f<.1||b.width*f>1e7)return;b.x=p[0]+(b.x-p[0])*f;b.y=p[1]+(b.y-p[1])*f;b.width*=f;b.height*=f;render();},{passive:false});
document.addEventListener('keydown',e=>{if(busy||e.target.matches('input'))return;if(e.key==='Escape'){draft=[];render();}if(e.key==='Enter'&&draft.length>1){checkpoint();doc.paths.push({closed:false,points:draft});draft=[];changed('draw-polyline');}if(e.key==='Delete')$('delete').click();if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();$('undo').click();}});
for(const m of ['select','line','rect','circle'])$(m).onclick=()=>setMode(m);
$('fit').onclick=fit;
$('toggle-markers').onclick=()=>{if(busy||!issues.length)return;markersVisible=!markersVisible;record('toggle-issue-markers',{visible:markersVisible});render();};
$('diagnose').onclick=()=>calculate(0);document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>calculate(Number(e.dataset.action)));
$('cancel').onclick=()=>{if(epsWorker){stopEps();lock(false);record('eps-cancel');status('Импорт EPS отменён. Документ сохранён.');return;}worker.terminate();pending=null;ready=false;lock(false);record('engine-cancel');status('Расчёт отменён, документ сохранён.');spawnWorker();};
$('undo').onclick=()=>{if(!past.length||busy)return;future.push(clone(doc));doc=past.pop();selected.clear();changed('undo');};
$('redo').onclick=()=>{if(!future.length||busy)return;past.push(clone(doc));doc=future.pop();selected.clear();changed('redo');};
$('delete').onclick=()=>{if(!selected.size)return;checkpoint();doc.paths=doc.paths.filter((_,i)=>!selected.has(i));selected.clear();changed('delete');};
$('new').onclick=()=>{checkpoint();doc={format:'relief-forge',version:1,width:300,height:200,paths:[]};selected.clear();changed('new');fit();};
for(const key of ['width','height'])$(key).onchange=()=>{const v=Number($(key).value);if(v>0&&v<1e6){checkpoint();doc[key]=v;changed('resize-sheet');fit();}else render();};
$('save').onclick=()=>{record('save-project');download('relief-forge.rf.json',JSON.stringify({...doc,journal,history:{past,future}},null,2));};
function stopEps(){epsWorker?.terminate();epsWorker=null;clearTimeout(epsTimer);}
function openValue(value,name){const next=validate(value),old=clone(doc);const restoredPast=Array.isArray(value.history?.past)?value.history.past.slice(-100).map(validate):null;const restoredFuture=Array.isArray(value.history?.future)?value.history.future.slice(-100).map(validate):[];const restoredJournal=Array.isArray(value.journal)?value.journal.slice(-100000):[];checkpoint();if(restoredPast){past=[old,...restoredPast].slice(-100);future=restoredFuture;}journal.push(...restoredJournal);doc=next;selected.clear();changed('import-'+name);fit();}
function importEps(bytes,name){
  if(busy)return;lock(true);$('busy-label').textContent='Подготовка импорта EPS…';record('eps-start',{name,bytes:bytes.byteLength,fonts:importFonts.map(f=>f.name)});
  epsWorker=new Worker(new URL('eps-worker.js',import.meta.url));
  const fail=message=>{stopEps();lock(false);status(message);$('import-report').textContent='Не удалось открыть EPS: '+message;record('eps-error',{name,message});};
  epsTimer=setTimeout(()=>fail('EPS превысил лимит 120 секунд. Импорт отменён, документ сохранён.'),120000);
  epsWorker.onerror=e=>fail('Ошибка EPS: '+e.message);
  epsWorker.onmessage=({data})=>{
    if(data.type==='progress'){$('busy-label').textContent=data.message;$('import-progress').value=data.percent;return;}
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='done')try{
      const next=importRichSvg(data.result.svg,{unitsPerInch:72});
      let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
      next.epsImport={name,originalBase64:btoa(binary),...data.result.metadata,warnings:data.result.warnings,logs:data.result.logs,outlineRecovery:data.result.outlineRecovery||null,engines:{ghostscript:'10.08.0',mupdf:'1.28.1'}};
      stopEps();lock(false);openValue(next,name);
      if(data.result.outlineRecovery){
        record('eps-outline-recovery',data.result.outlineRecovery);
        status(`Восстановлено ${data.result.outlineRecovery.count} непечатаемых EPS-контуров. Обводки только для просмотра; начинается проверка векторов…`);
        if(ready)calculate(0);
      }else status(`EPS импортирован: ${next.paths.length} объектов. ${data.result.warnings.length?'Есть предупреждения — см. панель EPS.':'Кривые и оформление сохранены.'}`);
    }catch(e){fail(e.message);}
  };
  epsWorker.postMessage({bytes,fonts:importFonts});
}
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{
  if(/\.(eps|epsf|epsi|ps)$/i.test(f.name)){if(f.size>64*1024*1024)throw Error('EPS превышает 64 МБ');importEps(new Uint8Array(await f.arrayBuffer()),f.name);}
  else{const text=await f.text();openValue(/\.svg$/i.test(f.name)?importRichSvg(text):JSON.parse(text),f.name);}
}catch(err){status(err.message);record('import-error',{message:err.message});}e.target.value='';};
$('fonts').onchange=async e=>{try{const files=[...e.target.files];if(files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('Шрифты: максимум 32 МБ');importFonts=await Promise.all(files.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));$('font-count').textContent=importFonts.length+' шрифтов';status('Шрифты будут использованы при следующем импорте EPS.');}catch(error){status(error.message);}};
$('demo-eps').onclick=async()=>{try{const response=await fetch('examples/curves-text-clip.eps');if(!response.ok)throw Error('Не удалось загрузить пример');importEps(new Uint8Array(await response.arrayBuffer()),'curves-text-clip.eps');}catch(e){status(e.message);}};
$('heal-copy').onclick=()=>{try{const ids=[...selected].filter(i=>doc.paths[i].kind!=='image');if(!ids.length)throw Error('Выделите импортированные векторы');const tol=Number($('tolerance').value);if(!Number.isFinite(tol)||tol<1e-6||tol>1000)throw Error('Укажите допуск от 0.000001 до 1000 мм');const copies=ids.flatMap(i=>sampledContours(doc.paths[i],tol));checkpoint();const start=doc.paths.length;doc.paths.push(...copies);selected=new Set(copies.map((_,i)=>start+i));changed('create-healing-copy');status(`Создано ${copies.length} полилиний, допуск ${tol} мм. Исходные кривые сохранены отдельными объектами.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{download('relief-forge.svg',exportDocument(doc),'image/svg+xml');record('export-svg');};
$('log').onclick=()=>download('relief-forge-session.jsonl',journal.map(x=>JSON.stringify(x)).join('\n'),'application/x-ndjson');
$('demo').onclick=()=>{checkpoint();doc={format:'relief-forge',version:1,width:150,height:100,paths:[{closed:true,points:[[10,10],[50,50],[10,50],[50,10]]},{closed:true,points:[[70,10],[110,10],[110,40],[70,40]]},{closed:true,points:[[110,40],[110,10],[70,10],[70,40]]},{closed:false,points:[[10,70],[30,70],[30.003,70],[50,70]]},{closed:false,points:[[50.005,70],[80,70],[80,90]]}]};selected.clear();changed('load-demo');fit();};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
  const filter=b.dataset.filter;
  if(filter==='none'){selected.clear();render();return;}
  if(filter==='duplicate'&&!issues.length){status('Сначала найдите проблемы (для всех объектов снимите выделение).');return;}
  const area=p=>p.closed?p.points.reduce((sum,a,i)=>{const b=p.points[(i+1)%p.points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2:0;
  const length=p=>p.points.reduce((sum,a,i)=>{if(i===p.points.length-1&&!p.closed)return sum;const b=p.points[(i+1)%p.points.length];return sum+Math.hypot(a[0]-b[0],a[1]-b[1]);},0);
  const al=Number($('area-limit').value),ll=Number($('length-limit').value);
  selected=new Set(doc.paths.map((p,i)=>({p,i})).filter(({p,i})=>filter==='all'||filter==='open'&&!p.closed||filter==='closed'&&p.closed||filter==='cw'&&area(p)>0||filter==='ccw'&&area(p)<0||filter==='duplicate'&&issues.some(x=>x.kind==='duplicate'&&x.path===i)||filter==='area-less'&&p.closed&&Math.abs(area(p))<al||filter==='area-more'&&p.closed&&Math.abs(area(p))>al||filter==='length-less'&&length(p)<ll||filter==='length-more'&&length(p)>ll).map(({i})=>i));render();
});
record('session-start',{version:'0.2.0-alpha.4'});spawnWorker();fit();
