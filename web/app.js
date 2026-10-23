import {importRichSvg,worldData,artworkMarkup,safeFragment,sampledContours,exportDocument} from './rich-svg.js?v=0.2.0-alpha.24';
import {issueViewBox} from './issue-focus.js';
import {visibleHealthyAnchors,circlePath} from './vector-points.js';
import {screenUnitsPerPixel,renderIssueMarkers} from './issue-markers.js?v=0.2.0-alpha.24';
import {exportEps} from './eps-export.js?v=0.2.0-alpha.24';
import {packedInput} from './auto-repair.js';
import {mappedComparison,activeComparisonFrame,zoomBox} from './central-comparison.js';
import {basename,epsResultFilename,readHistory,persistHistory,createHistoryEntry,updateHistoryEntry,formatHistoryStatus,formatHistoryDate} from './file-history.js';
import {selectedVectorIndices,smoothAndOptimizePaths} from './curve-optimizer.js?v=0.2.0-alpha.24';
import {repairVectorPoints} from './point-repair.js?v=0.2.0-alpha.24';
import {curveNodes,curveNodesTyped,moveCurveNode,nearestCurveSegment,addCurveNode,deleteCurveNode,curveHandles,curveNodeType,moveCurveHandle,setCurveNodeType,setCurveSegmentType,reverseCurveDirection,closeCurveAtNode,breakCurveAtNode} from './curve-edit.js?v=0.2.0-alpha.24';
import {keyboardAction} from './doctor-shortcuts.js?v=0.2.0-alpha.24';
import {planDiagnosticBatches,isSupportedDrop,droppedFiles} from './large-file-support.js?v=0.2.0-alpha.24';
import {epsSaveCandidate,epsSaveDecision,epsSaveWarningText} from './eps-save-flow.js?v=0.2.0-alpha.24';
let nodeTool='move',activeCurveNode=null,contextHit=null;
const nodeCursor=symbol=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="white" stroke="#173946" stroke-width="1.7"/><text x="13" y="19" text-anchor="middle" fill="#007e79" font-family="Arial" font-weight="bold" font-size="19">'+symbol+'</text></svg>';return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 13 13, crosshair';};
const plusCursor=nodeCursor('+'),minusCursor=nodeCursor('−');
const curveEditing=()=>mode==='nodes';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const names={open:'Открытый контур',coincident:'Совпадающие узлы',short:'Короткий отрезок',duplicate:'Дубликат',overlap:'Наложение отрезков',self_intersection:'Самопересечение',intersection:'Пересечение объектов'};
let diagnosticComplete=true,markersVisible=true,pointsVisible=true,appliedComparison=null,compareStage='before',displayedIssues=[],curvePreview=null,settingsTimeout=null;
let doc={format:'relief-forge',version:1,width:300,height:200,paths:[]},selected=new Set(),issues=[],metrics=[],past=[],future=[],mode='select',draft=[],drag=null,pan=null,worker,ready=false,pending=null,sequence=0,busy=false;
let epsWorker=null,epsTimer=null,epsImportActive=false;let importFonts=[];
let diagnosticGeneration=0,readGeneration=0;
const historyStorage=(()=>{try{return window.localStorage}catch{return null}})();
let fileHistory=readHistory(historyStorage),activeHistoryId=null;
const journal=[];const clone=v=>structuredClone(v);
function record(action,detail={}){journal.push({at:new Date().toISOString(),action,detail});}
function status(s){$('status').textContent=String(s).split('\n')[0];$('status').title=s;}
function progressStage(stage,percent,detail=''){
  const n=Math.max(0,Math.min(100,Math.round(percent)));
  $('task-status').hidden=false;
  $('task-progress').value=n;$('import-progress').value=n;
  $('task-stage').textContent=stage;$('busy-label').textContent=stage;
  $('task-percent').textContent=n+'%';$('task-count').textContent=detail;
}
function endProgress(){if(!busy)$('task-status').hidden=true;}
const yieldForUi=()=>new Promise(resolve=>setTimeout(resolve,0));
function checkpoint(before=doc){past.push(clone(before));if(past.length>100)past.shift();future=[];}
function renderFileHistory(){
  const rows=$('file-history-rows');rows.replaceChildren();
  $('file-history-count').textContent=fileHistory.length;
  if(!fileHistory.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='Файлы пока не открывались';tr.append(td);rows.append(tr);return;}
  for(const entry of fileHistory){
    const tr=document.createElement('tr');
    for(const [value,cls] of [[formatHistoryDate(entry.openedAt),'date'],[entry.filename,'filename'],[formatHistoryStatus(entry),'result']]){
      const td=document.createElement('td');td.textContent=value;td.className=cls;td.title=value;tr.append(td);
    }
    rows.append(tr);
  }
}
function updateFileHistory(patch){
  if(!activeHistoryId)return;
  fileHistory=updateHistoryEntry(fileHistory,activeHistoryId,patch);
  if(!persistHistory(historyStorage,fileHistory))$('file-history-note').textContent='Сохранение истории недоступно в этом браузере.';
  renderFileHistory();
}
function beginFileHistory(filename){
  const name=basename(filename);
  activeHistoryId=new Date().toISOString()+'-'+Math.random().toString(36).slice(2,12);
  fileHistory=createHistoryEntry(fileHistory,{id:activeHistoryId,filename:name,openedAt:new Date().toISOString()});
  if(!persistHistory(historyStorage,fileHistory))$('file-history-note').textContent='Сохранение истории недоступно в этом браузере.';
  renderFileHistory();
  return activeHistoryId;
}
function changed(action){if(!action.startsWith('curve-node')&&action!=='move-nodes')activeCurveNode=null;issues=[];metrics=[];diagnosticComplete=true;markersVisible=true;appliedComparison=null;curvePreview=null;compareStage='before';if(activeHistoryId&&!action.startsWith('import-')&&action!=='auto-apply')updateFileHistory({status:'Изменён · требуется повторная проверка',diagnosis:null,repair:null});record(action,{paths:doc.paths.length,nodes:doc.paths.reduce((n,p)=>n+p.points.length,0)});render();if(!action.startsWith('import-')&&action!=='unified-apply')requestRecalculation();}
function fit(){const pad=Math.max(doc.width,doc.height)*.07;$('canvas').setAttribute('viewBox',`${-pad} ${-pad} ${doc.width+pad*2} ${doc.height+pad*2}`);render();}
const currentComparison=()=>curvePreview?.comparisonData||appliedComparison;
function zoom(factor,center){const box=$('canvas').viewBox.baseVal,view=zoomBox({x:box.x,y:box.y,width:box.width,height:box.height},factor,center);if(!view)return; $('canvas').setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);render();}
function focusIssue(issue){
  const canvas=$('canvas'),view=canvas.viewBox.baseVal;
  const rawTolerance=Number($('tolerance').value);
  const tolerance=Number.isFinite(rawTolerance)&&rawTolerance>0?rawTolerance:0.01;
  const next=issueViewBox({x:view.x,y:view.y,width:view.width,height:view.height},issue.point,doc,tolerance);
  if(!next){status('Невозможно перейти к замечанию: неверные координаты.');return;}
  if(!currentComparison())selected=new Set([issue.path,issue.other].filter(i=>Number.isInteger(i)&&i>=0&&i<doc.paths.length));
  canvas.setAttribute('viewBox',`${next.x} ${next.y} ${next.width} ${next.height}`);
  record('focus-issue',{kind:issue.kind,path:issue.path,other:issue.other,point:issue.point});
  render();
}
function el(tag,attrs,parent){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
const pathData=worldData;
const svgMarkupCache=new Map();
function appendMarkup(parent,text){
  // Reuse parsed XML on pan/zoom and pointer drags; keep the cache small to
  // avoid retaining huge EPS/SVG trees after opening another document.
  let parsed=svgMarkupCache.get(text);
  if(!parsed){parsed=new DOMParser().parseFromString('<svg xmlns="'+ns+'" xmlns:xlink="http://www.w3.org/1999/xlink">'+text+'</svg>','image/svg+xml');
    if(text.length<250000){if(svgMarkupCache.size>=24)svgMarkupCache.delete(svgMarkupCache.keys().next().value);svgMarkupCache.set(text,parsed);}
  }
  for(const child of parsed.documentElement.children)parent.append(document.importNode(child,true));
}
function render(){
  document.body.classList.toggle('curve-editing',curveEditing());
  $('mascot-welcome').hidden=Boolean(doc.paths.length);
  $('curve-node-tools').hidden=!curveEditing();
  if(curveEditing())$('optimization-result').textContent='Автоматический предпросмотр появится после нажатия «Готово». Ручные изменения уже сохраняются в документе.';
  $('curve-edit').classList.toggle('active',curveEditing());
  $('curve-edit').setAttribute('aria-pressed',String(curveEditing()));
  for(const tool of ['move','add','remove','handles'])$('node-'+tool).classList.toggle('active',nodeTool===tool);
  $('canvas').dataset.nodeTool=curveEditing()?nodeTool:'';
  $('canvas').style.cursor=curveEditing()?(nodeTool==='add'?plusCursor:nodeTool==='remove'?minusCursor:nodeTool==='handles'?'crosshair':''):'';
  const chosenNode=curveEditing()&&activeCurveNode&&doc.paths[activeCurveNode.path];
  for(const name of ['cusp','smooth','symmetric','line','curve','break','close','reverse'])$('node-'+name).disabled=busy||!chosenNode;
  for(const name of ['cusp','smooth','symmetric'])$('node-'+name).classList.toggle('active',!!chosenNode&&curveNodeType(chosenNode,activeCurveNode.index)===name);
  $('node-hint').textContent=chosenNode?'Выбран узел: '+({cusp:'Перегиб',smooth:'Сглаженное',symmetric:'Симметрическая'}[curveNodeType(chosenNode,activeCurveNode.index)])+' · перетаскивайте ручки.':'Выберите узел; «Ручки углов» — управление касательными. Правый клик — контекстное меню.';
  const comparison=currentComparison();
  const frame=activeComparisonFrame(comparison,compareStage,doc,issues);
  const visibleDoc=frame.document,visibleIssues=frame.issues;
  displayedIssues=visibleIssues;
  const reviewing=frame.readOnly;
  $('canvas').classList.toggle('is-comparing',reviewing);
  $('compare-exit').hidden=!comparison;
  $('compare-exit').disabled=busy;
  $('compare-before').disabled=busy||!comparison;
  $('compare-after').disabled=busy||!comparison;
  $('compare-before').setAttribute('aria-pressed',String(!comparison||compareStage==='before'));
  $('compare-after').setAttribute('aria-pressed',String(Boolean(comparison&&compareStage==='after')));
  $('compare-status').textContent=comparison?
    (compareStage==='after'?'ПОСЛЕ':'ДО')+' · '+visibleDoc.paths.length+' контуров · '+(curvePreview?('стыков '+curvePreview.stats.smoothedJoints+' · сегменты '+(compareStage==='after'?curvePreview.stats.result:curvePreview.stats.original)+(compareStage==='after'?(curvePreview.afterDiagnosed?' · замечаний '+visibleIssues.length:' · проверка после выполняется'):' · исходные')):visibleIssues.length+' замечаний')+(curvePreview?' · автоисправление':' · применено'):
    'Сравнение после автоисправления';
  $('width').value=doc.width;$('height').value=doc.height;$('count').textContent=visibleDoc.paths.length;
  for(const id of ['sheet','grid-bg']){$(id).setAttribute('width',visibleDoc.width);$(id).setAttribute('height',visibleDoc.height);}
  $('geometry').replaceChildren();$('nodes').replaceChildren();$('markers').replaceChildren();$('paths').replaceChildren();
  if(visibleDoc.svgDefs)appendMarkup($('geometry'),visibleDoc.svgDefs);
  $('import-report').textContent=doc.epsImport?'EPS · '+doc.width.toFixed(3)+' × '+doc.height.toFixed(3)+' мм · '+doc.paths.filter(p=>p.kind!=='image').length+' векторов · '+doc.paths.filter(p=>p.kind==='image').length+' изображений. '+(doc.epsImport.warnings.length?'Предупреждения: '+doc.epsImport.warnings.join(' · '):'Импорт завершён.'):'';
  const view=$('canvas').viewBox.baseVal;
  const markerUnit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  const radius=Math.max(.00001,markerUnit*3.1);
  visibleDoc.paths.forEach((p,i)=>{
    const sel=!reviewing&&selected.has(i);
    const attrs={d:pathData(p),'data-path':i};
    if(reviewing&&p.kind!=='image'){
      // Draw the exact geometry commands, not the original imported SVG
      // markup: that artwork could still contain the unsmoothed curves.
      if(compareStage==='after'&&comparison?.beforeDoc.paths[i]&&
         worldData(comparison.beforeDoc.paths[i])!==worldData(p)){
        el('path',{d:worldData(comparison.beforeDoc.paths[i]),class:'comparison-ghost'},$('geometry'));
      }
      el('path',{...attrs,class:'comparison-path '+(compareStage==='after'?'after':'before')},$('geometry'));
    }else if(p.artwork){
      const painted=el('g',{'data-path':i,class:visibleDoc.epsImport?.outlineRecovery?'outline-artwork':'svg-artwork'},$('geometry'));
      appendMarkup(painted,artworkMarkup(p));
      if(sel)el('path',{...attrs,class:'path selected rich-selection'},$('geometry'));
    }else el('path',{...attrs,class:'path '+(sel?'selected':'')},$('geometry'));
    if(!reviewing)el('path',{...attrs,class:'hit'},$('geometry'));
    if(sel&&curveEditing()&&p.kind!=='image'){
      if(activeCurveNode?.path===i){
        const info=curveHandles(p,activeCurveNode.index);
        for(const handle of info.handles){
          const [hx,hy]=handle.point,[ax,ay]=info.anchor;
          el('path',{d:'M'+ax+' '+ay+'L'+hx+' '+hy,class:'curve-tangent-guide'},$('geometry'));
          el('circle',{cx:hx,cy:hy,r:markerUnit*4.5,class:'curve-control-handle',
            'data-path':i,'data-curve-node':activeCurveNode.index,'data-curve-handle':handle.side},$('geometry'));
        }
      }
      curveNodesTyped(p).forEach(node=>{
        const [cx,cy]=node.point,kind=node.type,chosen=activeCurveNode?.path===i&&activeCurveNode.index===node.index;
        const common={'data-path':i,'data-curve-node':node.index,class:'curve-node'+(chosen?' chosen':'')};
        if(kind==='smooth')el('circle',{...common,cx,cy,r:markerUnit*4.5},$('geometry'));
        else if(kind==='symmetric')el('polygon',{...common,points:[[cx,cy-markerUnit*5.2],[cx+markerUnit*5.2,cy],[cx,cy+markerUnit*5.2],[cx-markerUnit*5.2,cy]].map(a=>a.join(',')).join(' ')},$('geometry'));
        else el('rect',{...common,x:cx-markerUnit*4.2,y:cy-markerUnit*4.2,width:markerUnit*8.4,height:markerUnit*8.4},$('geometry'));
      });
    }
    else if(sel&&!p.artwork)p.points.forEach(([cx,cy],node)=>el('circle',{cx,cy,r:radius,class:'node','data-path':i,'data-node':node},$('geometry')));
    const b=document.createElement('button');
    b.textContent=(i+1)+'. '+(p.kind==='image'?'Изображение':p.artwork?'EPS / SVG':p.closed?'Замкнут':'Открыт')+' · '+p.points.length+' узлов';
    b.classList.toggle('selected',sel);b.disabled=reviewing;
    b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(i)?selected.delete(i):selected.add(i);render();};
    $('paths').append(b);
  });
  // White-backed hollow rings always overlie the geometric stroke, at a
  // fixed screen-pixel radius. No diagnostic markup enters exported EPS.
  if(pointsVisible&&!curveEditing()){
    // Deliberately cap healthy-node decoration on dense EPS: drawing thousands
    // of hollow rings blocks the main thread but does not add diagnostics.
    const count=visibleDoc.paths.reduce((n,p)=>n+(p.points?.length||0),0);
    if(count<=2400){
      const healthy=visibleHealthyAnchors(visibleDoc,visibleIssues,Number($('tolerance').value));
      if(healthy.length)el('path',{d:circlePath(healthy,radius),class:'healthy-anchors'},$('nodes'));
    }
  }
  const marked=markersVisible&&!curveEditing()?renderIssueMarkers($('markers'),visibleIssues,markerUnit):0;
  $('marker-status').textContent=visibleIssues.length?
    curveEditing()?'В режиме «Узлы» цветные отметки скрыты, чтобы не мешать редактированию.':markersVisible?'На чертеже: '+marked+' цветных колец с номерами'+
      (visibleIssues.length>marked?' из '+visibleIssues.length:'')+'. Нажмите кольцо, чтобы приблизить.':
      'Отметки проблем скрыты. Включите их в разделе «Видимость точек».':
    'В этой стадии проблемных мест не найдено.';
  $('draft').replaceChildren();
  if(!reviewing&&draft.length)el('path',{d:pathData({points:draft}),class:'path selected'},$('draft'));
  $('issues').replaceChildren();
  const counts={};visibleIssues.forEach(x=>counts[x.kind]=(counts[x.kind]||0)+1);
  if(!diagnosticComplete&&!comparison)$('summary').textContent='Диагностика частичная: лимит точек, блоки или ограничения движка. Найдено замечаний: '+visibleIssues.length+'. Межблочные дефекты не исключены.';
  else if(visibleIssues.length)$('summary').textContent='Замечаний: '+visibleIssues.length+' · '+Object.entries(counts).slice(0,2).map(([k,n])=>(names[k]||k)+': '+n).join(' · ');
  else $('summary').textContent=curvePreview&&compareStage==='after'&&!curvePreview.afterDiagnosed?'Диагностика оптимизированного результата пока недоступна.':comparison?'Для этой стадии замечаний не найдено.':metrics.length?'Проверка завершена: замечаний не найдено.':'Откройте SVG или нарисуйте векторы.';
  $('summary').title=Object.entries(counts).map(([k,n])=>(names[k]||k)+': '+n).join(' · ');
  $('issue-count').textContent=visibleIssues.length;
  visibleIssues.slice(0,100).forEach((x,i)=>{
    const b=document.createElement('button');b.className='issue';
    b.textContent=(i+1)+'. '+(names[x.kind]||x.kind)+' · '+(x.path+1)+(x.other!==x.path?' ↔ '+(x.other+1):'');
    b.title='Перейти к X '+x.point[0].toFixed(3)+' · Y '+x.point[1].toFixed(3)+' мм';
    b.onclick=()=>focusIssue(x);$('issues').append(b);
  });
  $('toggle-points').textContent=pointsVisible?'Скрыть здоровые точки':'Показать здоровые точки';
  $('toggle-markers').textContent=markersVisible?'Скрыть маркеры':'Показать маркеры';
  $('apply-changes').disabled=busy||!curvePreview||!curvePreview.hasGeometryChange;
  $('auto-status').textContent=busy?'Идёт расчёт…':curveEditing()?'Редактирование узлов · Ctrl+Z — отмена.':curvePreview?'Предварительный результат рассчитан, просмотрите ПОСЛЕ.':appliedComparison?'Изменения применены. ДО / ПОСЛЕ доступны для проверки.':doc.paths.length?'Проверка и расчёт после открытия файла.':'Откройте файл для автоматической проверки.';
  $('toggle-markers').disabled=busy||!visibleIssues.length;
  $('undo').disabled=busy||!past.length;$('redo').disabled=busy||!future.length;
  $('delete').disabled=busy||reviewing||curveEditing();
  for(const id of ['new','line','rect','circle','select'])$(id).disabled=busy||reviewing;
  // Diagnostics run automatically after opening/changing a document or settings.
  document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!ready||reviewing);
}
function lock(value,{coverCanvas=true}={}){
  busy=value;
  if(value)progressStage('Подготовка векторов…',0);
  $('busy').hidden=!value;$('busy').classList.toggle('compact',value&&!coverCanvas);
  document.querySelectorAll('button,input').forEach(e=>{if(e.id!=='cancel'&&e.id!=='log')e.disabled=value;});
  if(!value){endProgress();render();}
}

// The automatic section is declarative: settings trigger calculation, no
// "start/cancel" action. Only Apply commits a candidate to the document.
function buildUnifiedPreview(){
  if(busy||!doc.paths.length||curveEditing())return;
  const scope=selectedVectorIndices(doc,selected,$('selection-only').checked);
  if(!scope.length){curvePreview=null;$('optimization-result').textContent='Нет векторных кривых для обработки.';render();return;}
  try{
    const smoothingAmount=Number($('smoothing-amount').value);
    const optimizationTolerance=Number($('optimization-tolerance').value);
    const diagnosticTolerance=Number($('tolerance').value);
    const repaired=repairVectorPoints(doc,scope,diagnosticTolerance);
    const optimized=smoothAndOptimizePaths(repaired.document,scope,smoothingAmount,optimizationTolerance);
    const st={...optimized.stats,pointRepairs:repaired.stats,diagnosticTolerance,smoothingAmount,smoothedJoints:optimized.stats.smoothed,
      smoothingDeviation:optimized.stats.smoothingError};
    const different=scope.some(i=>worldData(doc.paths[i])!==worldData(optimized.document.paths[i]));
    const msg='Точки: убрано коротких/нулевых сегментов '+st.pointRepairs.removedNodes+
      ' · замкнуто близких концов '+st.pointRepairs.closedGaps+'.'+
      '\nПересечения, наложения и неоднозначные соединения требуют ручного решения.'+
      '\nКривые: сглажено стыков '+st.smoothedJoints+
      ' · оценённое отклонение сглаживания до '+st.smoothingDeviation.toFixed(5)+' мм.'+
      '\nСегментов: '+st.original+' → '+st.result+
      ' (−'+st.removed+'), оценка отклонения оптимизации до '+st.maxError.toFixed(5)+' мм.'+
      '\nДопуски: сглаживание '+smoothingAmount+' мм · оптимизация '+optimizationTolerance+' мм.'+
      (different?'\nДля просмотра изменений выберите ДО / ПОСЛЕ. Красный пунктир — исходная кривая, зелёный — результат.':
        '\nПри этих допусках форма не изменена.');
    $('optimization-result').textContent=msg;
    const pv={source:clone(doc),result:optimized.document,stats:st,hasGeometryChange:different,
      beforeDiagnosticComplete:diagnosticComplete,afterDiagnosed:false,comparisonData:{
        beforeDoc:clone(doc),afterDoc:optimized.document,beforeIssues:clone(issues),afterIssues:[]
      }};
    curvePreview=pv;compareStage='after';
    record('autoheal-curve-preview',{scope,stats:st,changed:different});
    render();
    if(!ready)return;
    try{
      const tolerance=Number($('tolerance').value),samples=[],mapping=[];
      for(const i of scope)for(const part of sampledContours(optimized.document.paths[i],tolerance)){
        samples.push(part);mapping.push(i);
      }
      const input=packedInput(samples,tolerance,0),id=++sequence;
      pending={id,unifiedAfterDiagnostic:true,scope:mapping,preview:pv};
      lock(true,{coverCanvas:false});
      worker.postMessage({id,input});
    }catch(err){
      status('Геометрия ПОСЛЕ рассчитана; Rust-проверка недоступна: '+err.message);
      $('optimization-result').textContent+='\nПроверка дефектов ПОСЛЕ недоступна: '+err.message;
    }
  }catch(err){curvePreview=null;$('optimization-result').textContent=err.message;render();status('Автоисправление: '+err.message);}
}
function applyUnifiedChanges(){
  if(busy||!curvePreview||!curvePreview.hasGeometryChange)return false;
  const pv=curvePreview;
  if(Number($('smoothing-amount').value)!==pv.stats.smoothingAmount||
     Number($('optimization-tolerance').value)!==pv.stats.tolerance||
     Number($('tolerance').value)!==pv.stats.diagnosticTolerance){
    status('Параметры изменились. Автоматический расчёт ещё не завершён.');return false;
  }
  const baseline=clone(doc),comparison=pv.comparisonData;
  checkpoint(baseline);doc=clone(pv.result);
  changed('unified-apply');appliedComparison=comparison;compareStage='after';render();
  const st=pv.stats;
  const beforeCount=comparison.beforeIssues.length,afterCount=comparison.afterIssues.length;
  const complete=pv.afterDiagnosed&&pv.afterDiagnosticComplete&&pv.beforeDiagnosticComplete;
  updateFileHistory({status:'Исправлено точек: '+st.pointRepairs.removedNodes+' · замкнуто: '+st.pointRepairs.closedGaps+
      ' · сглажено стыков: '+st.smoothedJoints+' · сегментов '+st.original+' → '+st.result,
    diagnosis:pv.afterDiagnosed?{count:afterCount,complete:pv.afterDiagnosticComplete}:null,
    repair:complete?{before:beforeCount,after:afterCount}:null});
  record('unified-apply',{stats:st});
  status('Изменения применены: '+st.pointRepairs.removedNodes+' исправлений точек, '+st.pointRepairs.closedGaps+
    ' замыканий, '+st.smoothedJoints+' сглаженных стыков, '+st.removed+
    ' удалённых сегментов. Undo восстанавливает исходные кривые.');
  return true;
}
function requestRecalculation(){
  clearTimeout(settingsTimeout);settingsTimeout=setTimeout(()=>{
    if(busy){requestRecalculation();return;}
    curvePreview=null;appliedComparison=null;compareStage='before';
    if(ready&&doc.paths.some(p=>p.kind!=='image'))calculate(0);
    else render();
  },180);
}
$('optimization-range').oninput=()=>{
  $('optimization-tolerance').value=$('optimization-range').value;requestRecalculation();
};
$('optimization-tolerance').onchange=()=>{
  const t=Number($('optimization-tolerance').value);
  if(Number.isFinite(t))$('optimization-range').value=String(Math.max(.001,Math.min(.25,t)));
  requestRecalculation();
};
$('smoothing-amount').onchange=requestRecalculation;
$('tolerance').onchange=requestRecalculation;
$('selection-only').onchange=requestRecalculation;
$('apply-changes').onclick=applyUnifiedChanges;

function spawnWorker(){
  worker=new Worker(new URL('worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id===0){ready=!data.error;$('engine').textContent=ready?'● Rust / WASM готов':'○ WASM не собран';status(data.error||'Rust-ядро готово');render();if(ready&&doc.paths.length&&!currentComparison())calculate(0);return;}
    if(!pending||data.id!==pending.id)return;
    const task=pending;pending=null;
    if(task.epsSavePreflight){
      lock(false);
      if(data.error){
        record('eps-save-preflight-error',{message:data.error});
        showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},task.autoApply),
          'Rust-диагностика завершилась ошибкой: '+data.error);
        return;
      }
      const checkedIssues=Array.isArray(data.output?.issues)?data.output.issues:null;
      const report={complete:data.output?.diagnosticComplete===true&&checkedIssues!==null,
        fullScope:true,issueCount:checkedIssues?.length??null};
      const decision=epsSaveDecision(report,task.autoApply);
      record('eps-save-preflight',{issues:report.issueCount,complete:report.complete,
        sampledPaths:task.contours,autoApplyRequested:task.autoApply});
      if(decision.action==='warn'){showEpsSaveWarning(decision);return;}
      if(decision.action==='apply-and-save'){
        const fresh=epsSaveCandidate(doc,curvePreview,readEpsSaveSettings());
        if(!fresh.autoApply||!applyUnifiedChanges()){
          showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:report.issueCount},true),
            'Подготовленные изменения успели устареть. Требуется повторная проверка.');
          return;
        }
      }
      exportConfirmedEps({autoApplied:decision.action==='apply-and-save',verified:true,remainingIssues:0});
      return;
    }
    if(data.error){lock(false);record('engine-error',{error:data.error});status(data.error);return;}
    if(task.unifiedAfterDiagnostic){
      if(curvePreview&&task.preview===curvePreview){
        curvePreview.comparisonData.afterIssues=data.output.issues.map(x=>({
          ...x,path:task.scope[x.path]??-1,other:task.scope[x.other]??-1
        }));
        curvePreview.afterDiagnosed=true;
        curvePreview.afterDiagnosticComplete=data.output.diagnosticComplete;
        record('unified-autoheal-diagnose',{issues:data.output.issues.length,complete:data.output.diagnosticComplete});
      }
      lock(false);render();
      status('Сглаживание и оптимизация: '+(curvePreview?.stats.original||0)+' → '+(curvePreview?.stats.result||0)+' сегментов; после: '+data.output.issues.length+' замечаний'+(data.output.diagnosticComplete?'':' (неполная проверка)'));
      return;
    }
    lock(false);
    if(task.action){
      checkpoint(task.before);
      const scope=new Set(task.scope);const next=[];let inserted=false;const changedIndices=[];
      doc.paths.forEach((p,i)=>{if(scope.has(i)){if(!inserted){for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}inserted=true;}}else next.push(p);});
      if(!inserted)for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}
      doc.paths=next;selected=new Set(changedIndices);changed(`repair-${task.action}`);
      status('Изменения применены. Для повторной проверки нажмите «Найти проблемы».');
    }else{
      diagnosticComplete=data.output.diagnosticComplete;markersVisible=true;issues=data.output.issues.map(x=>({...x,path:task.scope[x.path],other:task.scope[x.other]}));metrics=doc.paths.map(()=>null);data.output.paths.forEach((p,i)=>metrics[task.scope[i]]=p);
      record('diagnose',{issues:issues.length,scope:task.scope});updateFileHistory({diagnosis:{count:issues.length,complete:diagnosticComplete,selected:Boolean(task.selectedOnly)}});render();status(diagnosticComplete?`Проверено объектов: ${task.scope.length}. Замечаний: ${issues.length}.`:'Проверка неполная: достигнут лимит 10000 замечаний.');
      if(task.action===0)buildUnifiedPreview();
    }
  };
  worker.onerror=e=>{pending=null;ready=false;$('engine').textContent='○ Ошибка WASM';lock(false);status(`Ошибка WASM worker: ${e.message}`);};worker.postMessage({id:0});
}
function calculate(action){
  if(!ready||busy)return;
  if(currentComparison()&&action){status('Закройте режим ДО/ПОСЛЕ перед ручным редактированием.');return;}
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
    const id=++sequence;pending={id,action,scope,before:clone(doc),selectedOnly:selectedScope.length!==doc.paths.filter(p=>p.kind!=='image').length};record('engine-start',{action,scope,tolerance:tol,curveSampling:!action});lock(true,{coverCanvas:false});worker.postMessage({id,input});
  }catch(e){status(e.message);}
}
function at(e){const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());return [p.x,p.y];}
function setMode(m){if(currentComparison()){status('Закройте режим ДО/ПОСЛЕ перед редактированием.');return;}mode=m;draft=[];for(const key of ['select','line','rect','circle'])$(key).classList.toggle('active',key===mode);render();}
function startCurveEditor(){
  if(busy)return;
  if(curveEditing()){mode='select';activeCurveNode=null;render();requestRecalculation();return;}
  clearTimeout(settingsTimeout);curvePreview=null;appliedComparison=null;compareStage='before';
  mode='nodes';nodeTool='move';activeCurveNode=null;draft=[];
  if(!selected.size){const i=doc.paths.findIndex(p=>p.kind!=='image');if(i>=0)selected=new Set([i]);}
  render();status('Узлы: + и −, контрольные ручки, Перегиб/Сглаженное/Симметрическая. Правый клик — контекстное меню.');
}
function changeCurveNode(path,index,operation,keep=false){
  if(busy||!doc.paths[path])return;
  try{
    const before=doc.paths[path],atNode=keep&&activeCurveNode?curveNodes(before).find(n=>n.index===activeCurveNode.index):null;
    const next=operation(before);
    if(JSON.stringify(next)===JSON.stringify(before)){status('Геометрия не изменилась.');return;}
    checkpoint();doc.paths[path]=next;selected=new Set([path]);activeCurveNode=null;
    if(atNode){
      const candidate=curveNodes(next).find(n=>n.part===atNode.part&&Math.hypot(n.point[0]-atNode.point[0],n.point[1]-atNode.point[1])<1e-8);
      if(candidate)activeCurveNode={path,index:candidate.index};
    }
    changed('curve-node-'+index);
  }catch(error){status(error.message);}
}
function removeActiveCurveNode(){
  if(!activeCurveNode){status('Выберите узел для удаления.');return;}
  const {path,index}=activeCurveNode;changeCurveNode(path,'delete',p=>deleteCurveNode(p,index));
}
function runNodeCommand(name){
  if(busy||!curveEditing())return;
  if(name==='add'){nodeTool='add';render();status('Курсор +: нажмите между узлами на кривой.');return;}
  if(name==='remove'){removeActiveCurveNode();return;}
  if(!activeCurveNode){status('Сначала выберите узел.');return;}
  const {path,index}=activeCurveNode;
  const op=({cusp:p=>setCurveNodeType(p,index,'cusp'),smooth:p=>setCurveNodeType(p,index,'smooth'),
    symmetric:p=>setCurveNodeType(p,index,'symmetric'),line:p=>setCurveSegmentType(p,index,'line'),
    curve:p=>setCurveSegmentType(p,index,'curve'),break:p=>breakCurveAtNode(p,index),
    close:p=>closeCurveAtNode(p,index),reverse:p=>reverseCurveDirection(p)})[name];
  if(op)changeCurveNode(path,name,op,true);
}
$('curve-edit').onclick=startCurveEditor;
for(const tool of ['move','add','remove','handles'])$('node-'+tool).onclick=()=>{if(busy)return;nodeTool=tool;$('node-context').hidden=true;render();};
for(const name of ['cusp','smooth','symmetric','line','curve','break','close','reverse'])
  $('node-'+name).onclick=()=>runNodeCommand(name);
$('node-done').onclick=()=>{$('node-context').hidden=true;startCurveEditor();};
$('node-context').querySelectorAll('[data-node-menu]').forEach(button=>button.onclick=()=>{
  const name=button.dataset.nodeMenu;$('node-context').hidden=true;
  if(name==='add'&&contextHit?.nearest&&contextHit.node===null&&contextHit.nearest.t>1e-6&&contextHit.nearest.t<1-1e-6)
    changeCurveNode(contextHit.path,'add',p=>addCurveNode(p,contextHit.nearest.index,contextHit.nearest.t));
  else runNodeCommand(name);
});
$('canvas').addEventListener('contextmenu',e=>{
  if(!curveEditing()||busy)return;
  const target=e.target.closest('[data-path]');if(!target)return;
  const path=Number(target.dataset.path);if(!doc.paths[path]||doc.paths[path].kind==='image')return;
  e.preventDefault();const node=target.dataset.curveNode===undefined?null:Number(target.dataset.curveNode);
  selected=new Set([path]);activeCurveNode=node===null?null:{path,index:node};
  const pos=at(e);contextHit={path,node,nearest:nearestCurveSegment(doc.paths[path],pos)};
  render();const menu=$('node-context');
  for(const button of menu.querySelectorAll('[data-node-menu]'))
    button.disabled=(node===null&&button.dataset.nodeMenu!=='add')||(node!==null&&button.dataset.nodeMenu==='add');
  menu.hidden=false;
  menu.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-240))+'px';
  menu.style.top=Math.max(4,Math.min(e.clientY,window.innerHeight-330))+'px';
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#node-context'))$('node-context').hidden=true;});
function download(name,content,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function validate(value){
  if(value?.format!=='relief-forge'||value.version!==1||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<=0||value.height<=0||!Array.isArray(value.paths))throw Error('Неверный формат проекта');
  let nodes=0;for(const p of value.paths){if(typeof p.closed!=='boolean'||!Array.isArray(p.points)||p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('Неверная геометрия');nodes+=p.points.length;}
  if(nodes>200000)throw Error('Документ превышает лимит импорта 200000 узлов. Для расчёта alpha выбирайте не более 2000 узлов за раз.');
  if(value.svgDefs)safeFragment(value.svgDefs);
  for(const p of value.paths)if(p.artwork){safeFragment(p.artwork);if(!['image','vector'].includes(p.kind)||!Array.isArray(p.offset)||p.offset.length!==2||p.offset.some(n=>!Number.isFinite(n))||!Array.isArray(p.commands)||p.commands.some(s=>!Array.isArray(s)||!['M','L','C','Q','Z'].includes(s[0])||s.length!==({M:3,L:3,C:7,Q:5,Z:1}[s[0]])||s.slice(1).some(n=>!Number.isFinite(n))))throw Error('Неверная геометрия EPS / SVG');}
  return clone({format:'relief-forge',version:1,width:value.width,height:value.height,paths:value.paths,svgDefs:value.svgDefs||'',sourceSvg:value.sourceSvg||'',...(value.sourceFileName?{sourceFileName:basename(value.sourceFileName)}:{}),...(value.epsImport?{epsImport:value.epsImport}:{})});
}
$('markers').addEventListener('keydown',e=>{
  if(busy||!['Enter',' '].includes(e.key))return;
  const marker=e.target.closest('[data-issue]');
  const issue=marker&&displayedIssues[Number(marker.dataset.issue)];
  if(issue){e.preventDefault();e.stopPropagation();focusIssue(issue);}
});
window.addEventListener('resize',()=>render());
$('canvas').addEventListener('pointerdown',e=>{
  if(busy)return;const pos=at(e);const canvas=$('canvas');
  if(e.button===1){e.preventDefault();pan={pos};const b=canvas.viewBox.baseVal;pan.view=[b.x,b.y,b.width,b.height];canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  const issueMarker=e.target.closest('[data-issue]');
  if(issueMarker){const issue=displayedIssues[Number(issueMarker.dataset.issue)];if(issue)focusIssue(issue);return;}
  if(currentComparison()){status('Сравнение ДО/ПОСЛЕ доступно только для просмотра. Нажмите × для редактирования.');return;}
  if(curveEditing()){
    const target=e.target.closest('[data-path]');
    if(!target){activeCurveNode=null;selected.clear();render();return;}
    const i=Number(target.dataset.path);if(doc.paths[i].kind==='image'){status('Изображение не содержит узлов кривой.');return;}
    selected=new Set([i]);
    const index=target.dataset.curveNode===undefined?null:Number(target.dataset.curveNode);
    if(index!==null){
      activeCurveNode={path:i,index};
      if(target.dataset.curveHandle&&nodeTool==='handles'){
        drag={curveHandle:target.dataset.curveHandle,curveNode:index,path:i,before:clone(doc)};
        canvas.setPointerCapture(e.pointerId);
      }else if(nodeTool==='remove'&&!target.dataset.curveHandle){removeActiveCurveNode();return;}
      else if(nodeTool==='move'&&!target.dataset.curveHandle){drag={curveNode:index,path:i,before:clone(doc)};canvas.setPointerCapture(e.pointerId);}
    }else if(nodeTool==='add'){
      const nearest=nearestCurveSegment(doc.paths[i],pos),view=canvas.viewBox.baseVal;
      const hit=screenUnitsPerPixel(view,canvas.clientWidth,canvas.clientHeight)*12;
      if(nearest&&nearest.distance<=hit)changeCurveNode(i,'add',p=>addCurveNode(p,nearest.index,nearest.t));
      else status('Нажмите ближе к кривой, чтобы добавить узел.');
    }else activeCurveNode=null;
    render();return;
  }
  if(mode==='line'){draft.push(pos);render();return;}
  if(mode==='rect'||mode==='circle'){drag={start:pos,before:clone(doc),shape:mode};canvas.setPointerCapture(e.pointerId);return;}
  const target=e.target.closest('[data-path]');
  if(target){const i=Number(target.dataset.path);if(!e.shiftKey&&!selected.has(i))selected.clear();if(e.shiftKey&&selected.has(i))selected.delete(i);else selected.add(i);
    if(target.dataset.node!==undefined)drag={path:i,node:Number(target.dataset.node),before:clone(doc)};
    else drag={move:[...selected],start:pos,before:clone(doc)};
    canvas.setPointerCapture(e.pointerId);
  }else selected.clear();render();
});
let dragRenderFrame=0;
const scheduleDragRender=()=>{if(!dragRenderFrame)dragRenderFrame=requestAnimationFrame(()=>{dragRenderFrame=0;render();});};
const flushDragRender=()=>{if(dragRenderFrame){cancelAnimationFrame(dragRenderFrame);dragRenderFrame=0;}};
$('canvas').addEventListener('pointermove',e=>{
  const pos=at(e);$('coords').textContent=`X ${pos[0].toFixed(2)} · Y ${pos[1].toFixed(2)} мм`;
  if(pan){const b=$('canvas').viewBox.baseVal;const dx=pos[0]-pan.pos[0],dy=pos[1]-pan.pos[1];b.x-=dx;b.y-=dy;return;}
  if(!drag||busy)return;
  if(drag.curveHandle){
    try{doc.paths[drag.path]=moveCurveHandle(drag.before.paths[drag.path],drag.curveNode,drag.curveHandle,pos);scheduleDragRender();}
    catch(error){status(error.message);}
  }else if(drag.curveNode!==undefined){
    try{doc.paths[drag.path]=moveCurveNode(drag.before.paths[drag.path],drag.curveNode,pos);scheduleDragRender();}
    catch(error){status(error.message);}
  }else if(drag.node!==undefined){doc.paths[drag.path].points[drag.node]=pos;scheduleDragRender();}
  else if(drag.move){const dx=pos[0]-drag.start[0],dy=pos[1]-drag.start[1];for(const i of drag.move){doc.paths[i].points=drag.before.paths[i].points.map(([x,y])=>[x+dx,y+dy]);if(doc.paths[i].artwork)doc.paths[i].offset=[drag.before.paths[i].offset[0]+dx,drag.before.paths[i].offset[1]+dy];}render();}
  else{drag.end=pos;$('draft').replaceChildren();el('path',{d:pathData(makeShape(drag)),class:'path selected'},$('draft'));}
});
function makeShape(d){const [x,y]=d.start,[a,b]=d.end||d.start;
  return d.shape==='rect'?{closed:true,points:[[x,y],[a,y],[a,b],[x,b]]}:{closed:true,points:Array.from({length:96},(_,i)=>{const t=i*Math.PI*2/96,r=Math.hypot(a-x,b-y);return [x+r*Math.cos(t),y+r*Math.sin(t)];})};
}
$('canvas').addEventListener('pointerup',e=>{
  flushDragRender();
  if(pan){pan=null;return;}if(!drag)return;
  if(drag.shape&&drag.end&&Math.hypot(drag.end[0]-drag.start[0],drag.end[1]-drag.start[1])>.001){doc.paths.push(makeShape(drag));selected=new Set([doc.paths.length-1]);}
  if(JSON.stringify(doc)!==JSON.stringify(drag.before)){checkpoint(drag.before);changed(drag.curveHandle?'curve-node-handle':drag.curveNode!==undefined?'curve-node-move':drag.shape?'draw-'+drag.shape:'move-nodes');}else render();drag=null;
});
$('canvas').addEventListener('pointercancel',()=>{flushDragRender();if(drag)doc=drag.before;drag=null;pan=null;render();});
$('canvas').addEventListener('wheel',e=>{if(busy)return;e.preventDefault();zoom(e.deltaY>0?1.15:1/1.15,at(e));},{passive:false});
document.addEventListener('keydown',e=>{
  if(busy||e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
  if(e.key==='Escape'){$('node-context').hidden=true;flushDragRender();if(drag){doc=drag.before;drag=null;}pan=null;draft=[];activeCurveNode=null;render();}
  if(e.key==='Enter'&&draft.length>1){checkpoint();doc.paths.push({closed:false,points:draft});draft=[];changed('draw-polyline');}
  const action=keyboardAction(e,curveEditing());if(!action)return;
  e.preventDefault();
  if(action.button){$(action.button).click();return;}
  if(action.repair){document.querySelector('[data-action="'+action.repair+'"]').click();return;}
  if(action.tool){nodeTool=action.tool;render();return;}
  if(action.operation)runNodeCommand(action.operation);
});
for(const m of ['select','line','rect','circle'])$(m).onclick=()=>setMode(m);
$('fit').onclick=fit;
$('zoom-in').onclick=()=>zoom(0.8);
$('zoom-out').onclick=()=>zoom(1.25);
$('compare-before').onclick=()=>{if(!currentComparison())return;compareStage='before';record('compare-stage',{stage:'before'});render();};
$('compare-after').onclick=()=>{if(!currentComparison())return;compareStage='after';record('compare-stage',{stage:'after'});render();};
$('compare-exit').onclick=()=>{if(busy)return;appliedComparison=null;curvePreview=null;compareStage='before';record('compare-close');render();status('Сравнение закрыто, редактирование доступно.');};
$('toggle-info').onclick=()=>{if(busy)return;const panel=$('info-panel'),expanded=panel.hidden;panel.hidden=!expanded;$('main-layout').classList.toggle('left-collapsed',!expanded);$('toggle-info').setAttribute('aria-expanded',String(expanded));$('toggle-info').textContent=expanded?'Сведения ◂':'Сведения ▸';record('info-panel-toggle',{expanded});};
$('toggle-points').onclick=()=>{pointsVisible=!pointsVisible;record('toggle-all-anchors',{visible:pointsVisible});render();};
$('toggle-markers').onclick=()=>{if(busy||!issues.length)return;markersVisible=!markersVisible;record('toggle-issue-markers',{visible:markersVisible});render();};
document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>calculate(Number(e.dataset.action)));
$('cancel').onclick=()=>{if(epsImportActive){stopEps({destroy:true});lock(false);record('eps-cancel');status('Импорт EPS отменён. Документ сохранён.');return;}worker.terminate();pending=null;ready=false;lock(false);record('engine-cancel');status('Расчёт отменён, документ сохранён.');spawnWorker();};
$('undo').onclick=()=>{if(!past.length||busy)return;future.push(clone(doc));doc=past.pop();if(curveEditing())selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));else selected.clear();changed('undo');};
$('redo').onclick=()=>{if(!future.length||busy)return;past.push(clone(doc));doc=future.pop();if(curveEditing())selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));else selected.clear();changed('redo');};
$('delete').onclick=()=>{if(!selected.size)return;checkpoint();doc.paths=doc.paths.filter((_,i)=>!selected.has(i));selected.clear();changed('delete');};
$('new').onclick=()=>{activeHistoryId=null;checkpoint();doc={format:'relief-forge',version:1,width:300,height:200,paths:[]};selected.clear();changed('new');fit();};
for(const key of ['width','height'])$(key).onchange=()=>{const v=Number($(key).value);if(v>0&&v<1e6){checkpoint();doc[key]=v;changed('resize-sheet');fit();}else render();};
$('save').onclick=()=>{record('save-project');download('doktor-uzelkov.rf.json',JSON.stringify({...doc,journal,history:{past,future}},null,2));};
function stopEps({destroy=false}={}){epsImportActive=false;clearTimeout(epsTimer);epsTimer=null;if(epsWorker){epsWorker.onmessage=null;epsWorker.onerror=null;}if(destroy){epsWorker?.terminate();epsWorker=null;}}
function openValue(value,name,historyStarted=false){const next=validate(value),old=clone(doc);if(!historyStarted)beginFileHistory(name);next.sourceFileName=basename(next.sourceFileName||next.epsImport?.name||name);const restoredPast=Array.isArray(value.history?.past)?value.history.past.slice(-100).map(validate):null;const restoredFuture=Array.isArray(value.history?.future)?value.history.future.slice(-100).map(validate):[];const restoredJournal=Array.isArray(value.journal)?value.journal.slice(-100000):[];checkpoint();if(restoredPast){past=[old,...restoredPast].slice(-100);future=restoredFuture;}journal.push(...restoredJournal);doc=next;selected.clear();changed('import-'+name);fit();updateFileHistory({status:'Открыт · '+doc.paths.length+' контуров; ожидает проверки'});if(ready&&doc.paths.some(p=>p.kind!=='image'))calculate(0);}
function importEps(bytes,name,historyStarted=false){
  if(busy)return;if(!historyStarted)beginFileHistory(name);lock(true);$('busy-label').textContent='Подготовка импорта EPS…';record('eps-start',{name,bytes:bytes.byteLength,fonts:importFonts.map(f=>f.name)});
  epsImportActive=true;epsWorker??=new Worker(new URL('eps-worker.js?v=0.2.0-alpha.24',import.meta.url));
  const started=performance.now();
  const fail=message=>{stopEps({destroy:true});lock(false);status(message);$('import-report').textContent='Не удалось открыть EPS: '+message;record('eps-error',{name,message});updateFileHistory({status:'Ошибка открытия: '+String(message).slice(0,180)});};
  epsTimer=setTimeout(()=>fail('EPS превысил лимит 120 секунд. Импорт отменён, документ сохранён.'),120000);
  epsWorker.onerror=e=>fail('Ошибка EPS: '+e.message);
  epsWorker.onmessage=({data})=>{
    if(data.type==='progress'){$('busy-label').textContent=data.message;$('import-progress').value=data.percent;return;}
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='done')try{
      const next=importRichSvg(data.result.svg,{unitsPerInch:72});
      const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));const binary=chunks.join('');
      next.epsImport={name,originalBase64:btoa(binary),...data.result.metadata,warnings:data.result.warnings,logs:data.result.logs,outlineRecovery:data.result.outlineRecovery||null,engines:{ghostscript:'10.08.0',mupdf:'1.28.1'}};
      const durationMs=performance.now()-started;stopEps();lock(false);openValue(next,name,true);record('eps-import-time',{name,bytes:bytes.length,ms:Math.round(durationMs),workerMs:data.durationMs||0,fastPath:Boolean(data.fastPath),warm:Boolean(data.warm)});
      if(data.result.outlineRecovery){
        record('eps-outline-recovery',data.result.outlineRecovery);
        status(`Восстановлено ${data.result.outlineRecovery.count} непечатаемых EPS-контуров. Обводки только для просмотра; начинается проверка векторов…`);
      }else status(`EPS импортирован: ${next.paths.length} объектов. ${data.result.warnings.length?'Есть предупреждения — см. панель EPS.':'Кривые и оформление сохранены.'}`);
    }catch(e){fail(e.message);}
  };
  const transfer=bytes.slice();epsWorker.postMessage({bytes:transfer,fonts:importFonts},[transfer.buffer]);
}
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;beginFileHistory(f.name);try{
  if(/\.(eps|epsf|epsi|ps)$/i.test(f.name)){if(f.size>64*1024*1024)throw Error('EPS превышает 64 МБ');importEps(new Uint8Array(await f.arrayBuffer()),f.name,true);}
  else{const text=await f.text();openValue(/\.svg$/i.test(f.name)?importRichSvg(text):JSON.parse(text),f.name,true);}
}catch(err){status(err.message);record('import-error',{message:err.message});updateFileHistory({status:'Ошибка открытия: '+String(err.message).slice(0,180)});}e.target.value='';};
$('fonts').onchange=async e=>{try{const files=[...e.target.files];if(files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('Шрифты: максимум 32 МБ');importFonts=await Promise.all(files.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));$('font-count').textContent=importFonts.length+' шрифтов';status('Шрифты будут использованы при следующем импорте EPS.');}catch(error){status(error.message);}};
$('demo-eps').onclick=async()=>{try{const response=await fetch('examples/curves-text-clip.eps');if(!response.ok)throw Error('Не удалось загрузить пример');importEps(new Uint8Array(await response.arrayBuffer()),'curves-text-clip.eps');}catch(e){status(e.message);}};
$('heal-copy').onclick=()=>{try{const ids=[...selected].filter(i=>doc.paths[i].kind!=='image');if(!ids.length)throw Error('Выделите импортированные векторы');const tol=Number($('tolerance').value);if(!Number.isFinite(tol)||tol<1e-6||tol>1000)throw Error('Укажите допуск от 0.000001 до 1000 мм');const copies=ids.flatMap(i=>sampledContours(doc.paths[i],tol));checkpoint();const start=doc.paths.length;doc.paths.push(...copies);selected=new Set(copies.map((_,i)=>start+i));changed('create-healing-copy');status(`Создано ${copies.length} полилиний, допуск ${tol} мм. Исходные кривые сохранены отдельными объектами.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{download('relief-forge.svg',exportDocument(doc),'image/svg+xml');record('export-svg');};
function readEpsSaveSettings(){
  return {diagnosticTolerance:Number($('tolerance').value),
    smoothingAmount:Number($('smoothing-amount').value),
    optimizationTolerance:Number($('optimization-tolerance').value)};
}
function exportConfirmedEps({autoApplied=false,verified=false,overridden=false,remainingIssues=null}={}){
  try{
    const eps=exportEps(doc);
    const resultName=epsResultFilename(doc.sourceFileName||doc.epsImport?.name||'relief-forge.eps');
    download(resultName,eps,'application/postscript');
    const suffix=overridden?' · сохранено с предупреждением':autoApplied?' · автоисправления применены':' · проверено';
    updateFileHistory({exportName:resultName,exportAt:new Date().toISOString(),status:'EPS экспортирован'+suffix});
    record('export-eps',{name:resultName,source:doc.sourceFileName||null,paths:doc.paths.length,
      bytes:eps.length,autoApplied,verified,overridden,remainingIssues});
    status('EPS сохранён: '+resultName+
      (autoApplied?' · изменения применены автоматически, Undo доступен.':
        overridden?' · по вашему подтверждению, неприменённый предпросмотр исключён.':
        verified?' · ошибок узлов не обнаружено.':' · экспортирована подтверждённая геометрия.'));
  }catch(error){record('eps-export-error',{message:error.message});status('Не удалось сохранить EPS: '+error.message);}
}
function showEpsSaveWarning(decision,extra=''){
  const dialog=$('eps-save-warning');
  $('eps-save-warning-message').textContent=epsSaveWarningText(decision)+(extra?'\n'+extra:'')+
    '\nСохранить EPS с текущими узлами или вернуться к редактированию?';
  record('eps-save-warning',{count:decision.count,complete:decision.verified,reason:decision.reason});
  if(!dialog.open)dialog.showModal();
  $('eps-save-return').focus();
}
$('eps-save-return').onclick=()=>{
  $('eps-save-warning').close();
  record('eps-save-return');status('Сохранение отменено. Продолжите редактировать точки и повторите проверку.');
};
$('eps-save-anyway').onclick=()=>{
  if(!$('eps-save-warning').open)return;
  $('eps-save-warning').close();
  record('eps-save-confirmed-with-warnings');
  exportConfirmedEps({overridden:true,verified:false});
};
$('eps-save-warning').addEventListener('cancel',()=>{
  record('eps-save-return');status('Сохранение отменено.');
});
function saveEpsWithPreflight(){
  if(busy||$('eps-save-warning').open)return;
  clearTimeout(settingsTimeout);
  if(!ready){
    showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},false),
      'Движок диагностики ещё не готов.');return;
  }
  if(drag||draft.length){status('Завершите редактирование текущего сегмента перед сохранением EPS.');return;}
  const candidate=epsSaveCandidate(doc,curvePreview,readEpsSaveSettings());
  const vectors=candidate.document.paths.filter(p=>p.kind!=='image');
  if(!vectors.length){
    showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},false),
      'В документе нет векторных контуров для проверки.');
    return;
  }
  try{
    const tolerance=Number($('tolerance').value);
    if(!Number.isFinite(tolerance)||tolerance<1e-9||tolerance>1000)
      throw Error('Недопустимый допуск диагностики. Укажите число от 0.000000001 до 1000 мм.');
    const samples=[];
    let uncheckedContours=0;
    for(const path of vectors){
      const parts=sampledContours(path,tolerance);
      if(!parts.length||parts.some(part=>!Array.isArray(part.points)||part.points.length<2))uncheckedContours++;
      else samples.push(...parts);
    }
    const numberOfPoints=samples.reduce((total,part)=>total+part.points.length,0);
    if(uncheckedContours){
      showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},candidate.autoApply),
        'Часть векторных объектов нельзя проверить: '+uncheckedContours+'.');
      return;
    }
    if(!samples.length||numberOfPoints>2000){
      showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},candidate.autoApply),
        numberOfPoints>2000?'Для полной проверки более 2000 точек. Диагностика не может подтвердить отсутствие дефектов.':
          'Векторные контуры не удалось подготовить к проверке.');
      return;
    }
    const id=++sequence,input=packedInput(samples,tolerance,0);
    pending={id,epsSavePreflight:true,autoApply:candidate.autoApply,contours:samples.length};
    record('eps-save-preflight-start',{contours:samples.length,nodes:numberOfPoints,
      autoApplyCandidate:candidate.autoApply,scope:'all-vectors'});
    lock(true,{coverCanvas:false});
    $('busy-label').textContent='Проверка всех точек перед сохранением EPS…';
    worker.postMessage({id,input});
  }catch(error){
    showEpsSaveWarning(epsSaveDecision({complete:false,fullScope:false,issueCount:null},candidate.autoApply),
      'Не удалось проверить EPS: '+error.message);
  }
}
$('export-eps').onclick=saveEpsWithPreflight;
$('log').onclick=()=>download('relief-forge-session.jsonl',journal.map(x=>JSON.stringify(x)).join('\n'),'application/x-ndjson');
$('demo').onclick=()=>{activeHistoryId=null;checkpoint();doc={format:'relief-forge',version:1,width:150,height:100,paths:[{closed:true,points:[[10,10],[50,50],[10,50],[50,10]]},{closed:true,points:[[70,10],[110,10],[110,40],[70,40]]},{closed:true,points:[[110,40],[110,10],[70,10],[70,40]]},{closed:false,points:[[10,70],[30,70],[30.003,70],[50,70]]},{closed:false,points:[[50.005,70],[80,70],[80,90]]}]};selected.clear();changed('load-demo');fit();};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
  const filter=b.dataset.filter;
  if(filter==='none'){selected.clear();render();return;}
  if(filter==='duplicate'&&!issues.length){status('Сначала найдите проблемы (для всех объектов снимите выделение).');return;}
  const area=p=>p.closed?p.points.reduce((sum,a,i)=>{const b=p.points[(i+1)%p.points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2:0;
  const length=p=>p.points.reduce((sum,a,i)=>{if(i===p.points.length-1&&!p.closed)return sum;const b=p.points[(i+1)%p.points.length];return sum+Math.hypot(a[0]-b[0],a[1]-b[1]);},0);
  const al=Number($('area-limit').value),ll=Number($('length-limit').value);
  selected=new Set(doc.paths.map((p,i)=>({p,i})).filter(({p,i})=>filter==='all'||filter==='open'&&!p.closed||filter==='closed'&&p.closed||filter==='cw'&&area(p)>0||filter==='ccw'&&area(p)<0||filter==='duplicate'&&issues.some(x=>x.kind==='duplicate'&&x.path===i)||filter==='area-less'&&p.closed&&Math.abs(area(p))<al||filter==='area-more'&&p.closed&&Math.abs(area(p))>al||filter==='length-less'&&length(p)<ll||filter==='length-more'&&length(p)>ll).map(({i})=>i));render();
});
record('session-start',{version:'0.2.0-alpha.24'});renderFileHistory();spawnWorker();fit();
