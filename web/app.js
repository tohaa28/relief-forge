import {importSvg} from './svg-import.js';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const names={open:'Открытый контур',coincident:'Совпадающие узлы',short:'Короткий отрезок',duplicate:'Дубликат',overlap:'Наложение отрезков',self_intersection:'Самопересечение',intersection:'Пересечение объектов'};
let diagnosticComplete=true;
let doc={format:'relief-forge',version:1,width:300,height:200,paths:[]},selected=new Set(),issues=[],metrics=[],past=[],future=[],mode='select',draft=[],drag=null,pan=null,worker,ready=false,pending=null,sequence=0,busy=false;
const journal=[];const clone=v=>structuredClone(v);
function record(action,detail={}){journal.push({at:new Date().toISOString(),action,detail});}
function status(s){$('status').textContent=s;}
function checkpoint(before=doc){past.push(clone(before));if(past.length>100)past.shift();future=[];}
function changed(action){issues=[];metrics=[];diagnosticComplete=true;record(action,{paths:doc.paths.length,nodes:doc.paths.reduce((n,p)=>n+p.points.length,0)});render();}
function fit(){const pad=Math.max(doc.width,doc.height)*.07;$('canvas').setAttribute('viewBox',`${-pad} ${-pad} ${doc.width+pad*2} ${doc.height+pad*2}`);render();}
function el(tag,attrs,parent){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function pathData(p){return p.points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ')+(p.closed?' Z':'');}
function render(){
  $('width').value=doc.width;$('height').value=doc.height;$('count').textContent=doc.paths.length;
  for(const id of ['sheet','grid-bg']){ $(id).setAttribute('width',doc.width);$(id).setAttribute('height',doc.height); }
  $('geometry').replaceChildren();$('markers').replaceChildren();$('paths').replaceChildren();
  const radius=$('canvas').viewBox.baseVal.width/450;
  doc.paths.forEach((p,i)=>{
    const attrs={d:pathData(p),'data-path':i};el('path',{...attrs,class:`path ${selected.has(i)?'selected':''}`},$('geometry'));el('path',{...attrs,class:'hit'},$('geometry'));
    if(selected.has(i))p.points.forEach(([cx,cy],node)=>el('circle',{cx,cy,r:radius,class:'node','data-path':i,'data-node':node},$('geometry')));
    const b=document.createElement('button');b.textContent=`${i+1}. ${p.closed?'Замкнут':'Открыт'} · ${p.points.length} узлов`;b.classList.toggle('selected',selected.has(i));b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(i)?selected.delete(i):selected.add(i);render();};$('paths').append(b);
  });
  issues.slice(0,1000).forEach(x=>el('circle',{cx:x.point[0],cy:x.point[1],r:radius*1.6,class:`problem ${x.path!==x.other?'external':''}`,'data-path':x.path},$('markers')));
  $('draft').replaceChildren();if(draft.length)el('path',{d:pathData({points:draft}),class:'path selected'},$('draft'));
  $('issues').replaceChildren();const counts={};issues.forEach(x=>counts[x.kind]=(counts[x.kind]||0)+1);
  if(!diagnosticComplete)$('summary').textContent='Показаны первые 10000 замечаний. Проверка неполная: уменьшите выборку.';
  else if(issues.length)$('summary').textContent=Object.entries(counts).map(([k,n])=>`${names[k]}: ${n}`).join(' · ');
  else $('summary').textContent=metrics.length?'Проверка завершена: замечаний не найдено.':'Откройте SVG или нарисуйте векторы.';
  issues.slice(0,100).forEach(x=>{const b=document.createElement('button');b.className='issue';b.textContent=`${names[x.kind]} · ${x.path+1}${x.other!==x.path?' ↔ '+(x.other+1):''}`;b.onclick=()=>{selected=new Set([x.path,x.other]);render();};$('issues').append(b);});
  $('undo').disabled=busy||!past.length;$('redo').disabled=busy||!future.length;
  $('diagnose').disabled=busy||!ready;document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!ready);
}
function lock(value){busy=value;$('busy').hidden=!value;document.querySelectorAll('button,input').forEach(e=>{if(e.id!=='cancel'&&e.id!=='log')e.disabled=value;});if(!value)render();}
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
      diagnosticComplete=data.output.diagnosticComplete;issues=data.output.issues.map(x=>({...x,path:task.scope[x.path],other:task.scope[x.other]}));metrics=doc.paths.map(()=>null);data.output.paths.forEach((p,i)=>metrics[task.scope[i]]=p);
      record('diagnose',{issues:issues.length,scope:task.scope});render();status(diagnosticComplete?`Проверено объектов: ${task.scope.length}. Замечаний: ${issues.length}.`:'Проверка неполная: достигнут лимит 10000 замечаний.');
    }
  };
  worker.onerror=e=>{pending=null;ready=false;$('engine').textContent='○ Ошибка WASM';lock(false);status(`Ошибка WASM worker: ${e.message}`);};worker.postMessage({id:0});
}
function calculate(action){
  if(!ready||busy)return;const scope=doc.paths.map((_,i)=>i).filter(i=>!$('selection-only').checked||!selected.size||selected.has(i));
  if(!scope.length){status('Нет объектов для проверки');return;}
  const tol=Number($('tolerance').value),parameter=Number($('loop-percent').value);
  if(!Number.isFinite(tol)||tol<1e-9||tol>1000){status('Укажите допуск от 0.000000001 до 1000 мм');return;}
  const input=[tol,action,parameter,scope.length];for(const i of scope){const p=doc.paths[i];input.push(+p.closed,p.points.length,...p.points.flat());}
  const id=++sequence;pending={id,action,scope,before:clone(doc)};record('engine-start',{action,scope,tolerance:tol});lock(true);worker.postMessage({id,input});
}
function at(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());return [p.x,p.y];}
function setMode(m){mode=m;draft=[];for(const key of ['select','line','rect','circle'])$(key).classList.toggle('active',key===mode);render();}
function download(name,content,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function validate(value){
  if(value?.format!=='relief-forge'||value.version!==1||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<=0||value.height<=0||!Array.isArray(value.paths))throw Error('Неверный формат проекта');
  let nodes=0;for(const p of value.paths){if(typeof p.closed!=='boolean'||!Array.isArray(p.points)||p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('Неверная геометрия');nodes+=p.points.length;}
  if(nodes>200000)throw Error('Документ превышает лимит импорта 200000 узлов. Для расчёта alpha выбирайте не более 2000 узлов за раз.');
  return {format:'relief-forge',version:1,width:value.width,height:value.height,paths:value.paths.map(p=>({closed:p.closed,points:p.points})),...(typeof value.sourceSvg==='string'?{sourceSvg:value.sourceSvg}:{})};
}
$('canvas').addEventListener('pointerdown',e=>{
  if(busy)return;const pos=at(e);const canvas=$('canvas');
  if(e.button===1){e.preventDefault();pan={pos};const b=canvas.viewBox.baseVal;pan.view=[b.x,b.y,b.width,b.height];canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
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
  else if(drag.move){const dx=pos[0]-drag.start[0],dy=pos[1]-drag.start[1];for(const i of drag.move)doc.paths[i].points=drag.before.paths[i].points.map(([x,y])=>[x+dx,y+dy]);render();}
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
$('fit').onclick=fit;$('diagnose').onclick=()=>calculate(0);document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>calculate(Number(e.dataset.action)));
$('cancel').onclick=()=>{worker.terminate();pending=null;ready=false;lock(false);record('engine-cancel');status('Расчёт отменён, документ сохранён.');spawnWorker();};
$('undo').onclick=()=>{if(!past.length||busy)return;future.push(clone(doc));doc=past.pop();selected.clear();changed('undo');};
$('redo').onclick=()=>{if(!future.length||busy)return;past.push(clone(doc));doc=future.pop();selected.clear();changed('redo');};
$('delete').onclick=()=>{if(!selected.size)return;checkpoint();doc.paths=doc.paths.filter((_,i)=>!selected.has(i));selected.clear();changed('delete');};
$('new').onclick=()=>{checkpoint();doc={format:'relief-forge',version:1,width:300,height:200,paths:[]};selected.clear();changed('new');fit();};
for(const key of ['width','height'])$(key).onchange=()=>{const v=Number($(key).value);if(v>0&&v<1e6){checkpoint();doc[key]=v;changed('resize-sheet');fit();}else render();};
$('save').onclick=()=>{record('save-project');download('relief-forge.rf.json',JSON.stringify({...doc,journal,history:{past,future}},null,2));};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const text=await f.text();const value=f.name.toLowerCase().endsWith('.svg')?importSvg(text):JSON.parse(text);const next=validate(value);const old=clone(doc);const restoredPast=Array.isArray(value.history?.past)?value.history.past.slice(-100).map(validate):null;const restoredFuture=Array.isArray(value.history?.future)?value.history.future.slice(-100).map(validate):[];const restoredJournal=Array.isArray(value.journal)?value.journal.slice(-100000):[];checkpoint();if(restoredPast){past=[old,...restoredPast].slice(-100);future=restoredFuture;}journal.push(...restoredJournal);doc=next;selected.clear();changed('import-'+f.name);fit();}catch(err){status(err.message);record('import-error',{message:err.message});}e.target.value='';};
$('export').onclick=()=>{const content=`<svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}mm" height="${doc.height}mm" viewBox="0 0 ${doc.width} ${doc.height}">${doc.paths.map(p=>`<path d="${pathData(p)}" fill="none" stroke="#000" stroke-width="0.1"/>`).join('')}</svg>`;download('relief-forge.svg',content,'image/svg+xml');record('export-svg');};
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
record('session-start',{version:'0.1.0-alpha.2'});spawnWorker();fit();
