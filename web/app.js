import {validateDocumentCurveChange} from './curve-quality.js?v=0.2.0-alpha.34';
import {importRichSvg,worldData,artworkMarkup,safeFragment,sampledContours,exportDocument} from './rich-svg.js?v=0.2.0-alpha.34';
import {issueViewBox} from './issue-focus.js';
import {visibleHealthyAnchors,circlePath} from './vector-points.js';
import {screenUnitsPerPixel,renderIssueMarkers,issueWithinContourBounds} from './issue-markers.js?v=0.2.0-alpha.34';
import {exportEps,exportColoredEps} from './eps-export.js?v=0.2.0-alpha.34';
import {geometryStamp} from './eps-paint.js?v=0.2.0-alpha.34';
import {packedInput} from './auto-repair.js';
import {mappedComparison,activeComparisonFrame,zoomBox} from './central-comparison.js';
import {basename,epsResultFilename,readHistory,persistHistory,createHistoryEntry,updateHistoryEntry,formatHistoryStatus,formatHistoryDate} from './file-history.js';
import {selectedVectorIndices,smoothAndOptimizePaths,smoothVectorPath,optimizeVectorPath} from './curve-optimizer.js?v=0.2.0-alpha.34';
import {repairVectorPoints} from './point-repair.js?v=0.2.0-alpha.34';
import {curveNodes,curveNodesTyped,moveCurveNode,nearestCurveSegment,addCurveNode,deleteCurveNode,curveHandles,curveNodeType,moveCurveHandle,setCurveNodeType,setCurveSegmentType,reverseCurveDirection,closeCurveAtNode,breakCurveAtNode} from './curve-edit.js?v=0.2.0-alpha.34';
import {keyboardAction} from './doctor-shortcuts.js?v=0.2.0-alpha.34';
import {planDiagnosticBatches,mapDiagnosticIssue,isSupportedDrop,droppedFiles} from './large-file-support.js?v=0.2.0-alpha.34';
import {syncWorkspaceMascot} from './mascot-visibility.js?v=0.2.0-alpha.34';
import {assessImportedGeometry} from './import-integrity.js?v=0.2.0-alpha.34';
import {inspectWorkspace,recoverWorkspace,shortWorkspaceDiagnosis,safeWorkspaceReport} from './workspace-health.js?v=0.2.0-alpha.34';
import {chooseAfterSnapshot,afterSaveDecision,afterSaveMessage} from './after-result.js?v=0.2.0-alpha.34';
import {diagnoseAfterDocument} from './after-diagnostics.js?v=0.2.0-alpha.34';
import {mergeOverlappingObjects} from './overlap-merge.js?v=0.2.0-alpha.34';
import {refitBooleanUnion} from './union-refit.js?v=0.2.0-alpha.34';
let nodeTool='move',activeCurveNode=null,contextHit=null;
const nodeCursor=symbol=>{const svg='<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26"><circle cx="13" cy="13" r="11" fill="white" stroke="#173946" stroke-width="1.7"/><text x="13" y="19" text-anchor="middle" fill="#007e79" font-family="Arial" font-weight="bold" font-size="19">'+symbol+'</text></svg>';return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 13 13, crosshair';};
const plusCursor=nodeCursor('+'),minusCursor=nodeCursor('−');
const curveEditing=()=>mode==='nodes';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';
const names={open:'Открытый контур',coincident:'Совпадающие узлы',short:'Короткий отрезок',duplicate:'Дубликат',overlap:'Наложение отрезков',self_intersection:'Самопересечение',intersection:'Пересечение объектов'};
let diagnosticComplete=true,markersVisible=true,pointsVisible=true,appliedComparison=null,compareStage='before',displayedIssues=[],curvePreview=null,settingsTimeout=null;
let doc={format:'relief-forge',version:1,width:300,height:200,paths:[]},selected=new Set(),issues=[],metrics=[],past=[],future=[],mode='select',draft=[],drag=null,pan=null,worker,ready=false,pending=null,sequence=0,busy=false;
let epsWorker=null,epsTimer=null,epsImportActive=false;let importFonts=[];
let diagnosticGeneration=0,readGeneration=0,readActive=false,openingFile=false,previewGeneration=0,previewActive=false,suppressNextDiagnostic=false,afterDiagnosticGeneration=0;
const historyStorage=(()=>{try{return window.localStorage}catch{return null}})();
let fileHistory=readHistory(historyStorage),activeHistoryId=null;
const journal=[];const clone=v=>structuredClone(v);
let workspaceHealth=null,workspaceChecks=0,workspaceCheckTimer=null,forceWireframe=false;
let lastImportAttempt=null,lastImportFailure=null;
const displayErrors=[];
window.addEventListener('error',e=>{displayErrors.push(String(e.message||'Unknown error'));if(displayErrors.length>25)displayErrors.shift();});
window.addEventListener('unhandledrejection',e=>{displayErrors.push(String(e.reason?.message||e.reason||'Unhandled rejection'));if(displayErrors.length>25)displayErrors.shift();});
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
function workspaceScan({attemptRepair=false,manual=false}={}){
  if(!lastImportFailure&&!doc.paths.length&&!doc.sourceFileName&&!doc.pdfImport&&!doc.epsImport){
    // Initial empty canvas is not an import failure.
    if(manual)status('Документ ещё не открыт. Рабочее поле готово к импорту.');
    return null;
  }
  const parts={canvas:$('canvas'),workspace:$('drop-target'),geometry:$('geometry'),
    mascot:$('mascot-welcome'),overlay:$('drop-overlay'),
    documentPaths:doc.paths.length,
    documentLoaded:Boolean(doc.paths.length||doc.sourceFileName||doc.pdfImport||doc.epsImport),
    documentType:doc.epsImport?'eps':doc.pdfImport?'pdf':
      /\.svg$/i.test(doc.sourceFileName||'')?'svg':'project',
    importFailure:lastImportFailure};
  let health=inspectWorkspace(parts),repairs=[];
  if(attemptRepair&&!health.ok){
    repairs=recoverWorkspace(health,parts);
    if(health.issues.includes('empty-svg')||health.issues.includes('invalid-geometry-bounds')){
      // Rebuild only from existing document geometry, never re-import.
      render();
      repairs.push('redraw');
    }
    health=inspectWorkspace(parts);
  }
  workspaceHealth=health;
  workspaceChecks++;
  const state=$('workspace-health-state');
  state.textContent=health.ok?'Рабочее поле: проверено':'Рабочее поле: '+shortWorkspaceDiagnosis(health);
  state.hidden=health.ok&&!manual;
  state.dataset.health=health.ok?'ok':'warning';
  $('workspace-health-report').value=safeWorkspaceReport(health,{
    version:'0.2.0-alpha.34',source:lastImportFailure?.source||doc.sourceFileName||'',
    errors:displayErrors});
  record('workspace-health',{ok:health.ok,issues:health.issues,forceWireframe,attempts:repairs,
    count:health.elementCount,rect:health.canvasRect,bbox:health.geometryBox});
  if(!health.ok)status('Проверка рабочего поля: '+shortWorkspaceDiagnosis(health)+
    (repairs.length?' · выполнено: '+repairs.join(', '):'')+
    '. Откройте «Проверка рабочего поля» для отчёта.');
  else if(repairs.length)status('Отображение рабочего поля восстановлено: '+repairs.join(', '));
  if(manual&&health.ok&&forceWireframe)status('Контурный режим включён: отображаются исходные векторные команды без оформления.');
  return health;
}
function scheduleWorkspaceCheck(){
  clearTimeout(workspaceCheckTimer);
  // Styles and images can settle after the first layout; check again once.
  workspaceCheckTimer=setTimeout(()=>{
    if(openingFile||readActive||epsImportActive)return;
    const result=workspaceScan({attemptRepair:true});
    if(result&&!result.ok)workspaceCheckTimer=setTimeout(()=>{
      if(!openingFile&&!readActive&&!epsImportActive)
        workspaceScan({attemptRepair:true});
    },850);
  },160);
}
$('workspace-check').onclick=()=>{
  const health=workspaceScan({attemptRepair:true,manual:true});
  $('workspace-health-report').value=safeWorkspaceReport(health||{
    ok:true,issues:[],note:'Документ не открыт'},{
    version:'0.2.0-alpha.34',source:lastImportFailure?.source||doc.sourceFileName||'',errors:displayErrors});
  $('workspace-health-dialog').showModal();
};
$('workspace-check-repair').onclick=()=>{
  workspaceScan({attemptRepair:true,manual:true});
};
$('workspace-check-copy').onclick=async()=>{
  const value=$('workspace-health-report').value;
  try{await navigator.clipboard.writeText(value);status('Отчёт о рабочем поле скопирован.');}
  catch{ $('workspace-health-report').focus();$('workspace-health-report').select();
    status('Скопируйте выделенный диагностический отчёт клавишами Ctrl+C.');}
};
$('workspace-check-close').onclick=()=>$('workspace-health-dialog').close();
function syncWireframeControl(){
  $('workspace-check-wireframe').textContent=forceWireframe?'Обычное отображение':'Показать контуры';
  $('workspace-check-wireframe').setAttribute('aria-pressed',String(forceWireframe));
}
$('workspace-check-wireframe').onclick=()=>{
  forceWireframe=!forceWireframe;syncWireframeControl();render();
  workspaceScan({attemptRepair:true,manual:true});
  record('workspace-wireframe-mode',{enabled:forceWireframe,source:doc.sourceFileName||null});
};

function updateMascot(){return syncWorkspaceMascot($('mascot-welcome'),$('drop-target'),{hasDocument:Boolean(doc.paths.length||doc.sourceFileName||doc.epsImport||doc.pdfImport),importing:openingFile});}
function render(){
  document.body.classList.toggle('curve-editing',curveEditing());
  updateMascot();
  $('curve-node-tools').hidden=!curveEditing();
  if(curveEditing())$('optimization-result').textContent='Редактируются реальные опорные точки команд M/L/C/Q текущей геометрии. Ручки Безье отображаются у соответствующих C-сегментов. Undo доступен.';
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
  const artworkCount=doc.paths.filter(p=>p.kind!=='image').length;
  const images=doc.paths.filter(p=>p.kind==='image').length;
  $('import-report').textContent=doc.pdfImport?
    'PDF · страница '+doc.pdfImport.pageNumber+' из '+doc.pdfImport.pageCount+
    ' · '+doc.width.toFixed(3)+' × '+doc.height.toFixed(3)+
    ' мм · '+artworkCount+' векторов · '+images+
    ' изображений. Кривые и текстовые контуры доступны для лечения.':
    doc.epsImport?'EPS · '+doc.width.toFixed(3)+' × '+doc.height.toFixed(3)+
      ' мм · '+artworkCount+' векторов · '+images+' изображений. '+
      ((doc.epsImport.warnings||[]).length?'Предупреждения: '+doc.epsImport.warnings.join(' · '):'Импорт завершён.'):'';

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
    }else if(p.artwork&&!forceWireframe){
      const painted=el('g',{'data-path':i,class:visibleDoc.epsImport?.outlineRecovery?'outline-artwork':'svg-artwork'},$('geometry'));
      appendMarkup(painted,artworkMarkup(p));
      if(sel)el('path',{...attrs,class:'path selected rich-selection'},$('geometry'));
    }else el('path',{...attrs,class:'path '+(sel?'selected':'')+(forceWireframe?' wireframe-override':'')},$('geometry'));
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
  const marked=markersVisible&&!curveEditing()?renderIssueMarkers($('markers'),visibleIssues,markerUnit,
    {x:0,y:0,width:visibleDoc.width,height:visibleDoc.height}):0;
  $('marker-status').textContent=visibleIssues.length?
    curveEditing()?'В режиме «Узлы» цветные отметки скрыты, чтобы не мешать редактированию.':markersVisible?'На чертеже: '+marked+' пространственно распределённых цветных маркеров'+
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
    const optimized=smoothAndOptimizePaths(repaired.document,scope,smoothingAmount,optimizationTolerance,diagnosticTolerance);
    const merged=$('merge-overlaps').checked?
      mergeOverlappingObjects(optimized.document,{indices:scope,tolerance:diagnosticTolerance,cleanupTolerance:optimizationTolerance}):
      {document:optimized.document,stats:{mergedObjects:0,weldedGroups:0,compoundGroups:0,skipped:0,holes:0,normalizedObjects:0,unionToleranceMm:0.005,cleanup:{coincident:0,collinear:0,short:0,shortEdgesRemaining:0,reverted:0}}};
    const refitted=refitBooleanUnion(merged.document,optimizationTolerance);
    const after=refitted.document;
    const actualCount=document=>document.paths.reduce((n,p)=>n+
      (p.kind==='image'?0:p.commands?.filter(c=>c[0]==='M'||c[0]==='L'||c[0]==='C'||c[0]==='Q').length??p.points.length),0);
    const st={...optimized.stats,refit:refitted.stats,
      actualNodesBefore:actualCount(doc),actualNodesAfter:actualCount(after),overlaps:merged.stats,mergeOverlaps:$('merge-overlaps').checked,pointRepairs:repaired.stats,diagnosticTolerance,smoothingAmount,smoothedJoints:optimized.stats.smoothed,
      smoothingDeviation:optimized.stats.smoothingError};
    const different=JSON.stringify(doc.paths.map(worldData))!==JSON.stringify(after.paths.map(worldData));
    const msg='Точки: убрано коротких/нулевых сегментов '+st.pointRepairs.removedNodes+
      ' · замкнуто близких концов '+st.pointRepairs.closedGaps+'.'+
      '\nБулево объединение Clipper: слито объектов '+st.overlaps.mergedObjects+
      ', сварено заполненных групп '+st.overlaps.weldedGroups+
      ', нормализовано составных заливок '+st.overlaps.normalizedObjects+
      ', сохранено отверстий '+st.overlaps.holes+
      ', составных обводок '+st.overlaps.compoundGroups+
      '. Очистка после Union: совпадающих точек '+st.overlaps.cleanup.coincident+
      ', лишних коллинеарных '+st.overlaps.cleanup.collinear+
      ', коротких сегментов '+st.overlaps.cleanup.short+
      (st.overlaps.cleanup.reverted?' · '+st.overlaps.cleanup.reverted+
        ' изменений отменено защитой топологии':'')+
      (st.overlaps.skipped?' · неподдерживаемых групп '+st.overlaps.skipped:'')+
      '. ПОСЛЕ содержит единый силуэт без внутренних наложений. Точность аппроксимации '+st.overlaps.unionToleranceMm.toFixed(5)+' мм.'+
      '\nИтоговая оптимизация ПОСЛЕ Union: '+st.refit.originalNodes+' → '+st.refit.finalNodes+
      ' реальных узлов (−'+st.refit.removed+'), кубических сегментов '+st.refit.cubicSegments+
      ', проходов '+st.refit.passes+(st.refit.skipped?' · пропущено объектов '+st.refit.skipped:'')+
      '. На экране реальных узлов: '+st.actualNodesBefore+' → '+st.actualNodesAfter+'.'+
      '\nКривые: сглажено стыков '+st.smoothedJoints+
      ' · оценённое отклонение сглаживания до '+st.smoothingDeviation.toFixed(5)+' мм.'+
      '\nСегментов: '+st.original+' → '+st.result+
      ' (−'+st.removed+'), оценка отклонения оптимизации до '+st.maxError.toFixed(5)+' мм.'+
      '\nКонтроль геометрии: отклонено изменений '+(st.rejected+st.smoothingRejected+(st.refit?.rejected||0))+'.'+
      '\nДопуски: сглаживание '+smoothingAmount+' мм · оптимизация '+optimizationTolerance+' мм.'+
      (different?'\nДля просмотра изменений выберите ДО / ПОСЛЕ. Красный пунктир — исходная кривая, зелёный — результат.':
        '\nПри этих допусках форма не изменена.');
    $('optimization-result').textContent=msg;
    const pv={source:clone(doc),result:after,stats:st,hasGeometryChange:different,
      beforeDiagnosticComplete:diagnosticComplete,afterDiagnosed:false,comparisonData:{
        beforeDoc:clone(doc),afterDoc:after,beforeIssues:clone(issues),afterIssues:[]
      }};
    curvePreview=pv;compareStage='after';
    record('autoheal-curve-preview',{scope,stats:st,changed:different});
    render();
    if(ready)void checkPreviewAfter(pv);
  }catch(err){curvePreview=null;$('optimization-result').textContent=err.message;render();status('Автоисправление: '+err.message);}
}
function applyUnifiedChanges(){
  if(busy||!curvePreview||!curvePreview.hasGeometryChange)return false;
  const pv=curvePreview;
  if(Number($('smoothing-amount').value)!==pv.stats.smoothingAmount||
     Number($('optimization-tolerance').value)!==pv.stats.tolerance||
     Number($('tolerance').value)!==pv.stats.diagnosticTolerance||
     $('merge-overlaps').checked!==pv.stats.mergeOverlaps){
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
$('merge-overlaps').onchange=requestRecalculation;
$('apply-changes').onclick=applyUnifiedChanges;

function spawnWorker(){
  worker=new Worker(new URL('worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id===0){ready=!data.error;$('engine').textContent=ready?'● Rust / WASM готов':'○ WASM не собран';status(data.error||'Rust-ядро готово');render();if(ready&&doc.paths.length&&!currentComparison()&&!suppressNextDiagnostic)calculate(0);suppressNextDiagnostic=false;return;}
    if(!pending||data.id!==pending.id)return;
    const task=pending;pending=null;
    if(task.largeDiagnostic){task.onResponse(data);return;}
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
  worker.onerror=e=>{++diagnosticGeneration;pending=null;ready=false;diagnosticComplete=false;$('engine').textContent='○ Ошибка WASM';lock(false);status(`Ошибка WASM worker: ${e.message}`);};worker.postMessage({id:0});
}
async function buildLargeUnifiedPreview(indices){
  if(busy||!doc.paths.length||curveEditing())return;
  const generation=++previewGeneration;
  previewActive=true;
  const source=clone(doc),result=clone(doc),qualitySource=clone(doc);
  const tol=Number($('tolerance').value),
    smoothingAmount=Number($('smoothing-amount').value),
    optimizationTolerance=Number($('optimization-tolerance').value);
  const stats={original:0,result:0,removed:0,maxError:0,tolerance:optimizationTolerance,
    smoothingAmount,smoothedJoints:0,smoothingDeviation:0,rejected:0,smoothingRejected:0,pointRepairs:{
      removedNodes:0,closedGaps:0,maxDeviation:0,skipped:0
    },diagnosticTolerance:tol};
  lock(true,{coverCanvas:false});
  try{
    for(let k=0;k<indices.length;k++){
      if(generation!==previewGeneration)return;
      const index=indices[k],input=source.paths[index];
      const repaired=repairVectorPoints({paths:[input]},[0],tol);
      qualitySource.paths[index]=clone(repaired.document.paths[0]);
      const smoothed=smoothVectorPath(repaired.document.paths[0],smoothingAmount,tol);
      const optimized=optimizeVectorPath(smoothed.path,optimizationTolerance,tol);
      result.paths[index]=optimized.path;
      stats.original+=optimized.before;stats.result+=optimized.after;
      stats.rejected+=Number(optimized.quality?.accepted===false);
      stats.smoothingRejected+=Number(smoothed.quality?.accepted===false);
      stats.removed+=optimized.removed;stats.smoothedJoints+=smoothed.changed;
      stats.smoothingDeviation=Math.max(stats.smoothingDeviation,smoothed.maxError);
      stats.maxError=Math.max(stats.maxError,optimized.maxError);
      stats.pointRepairs.removedNodes+=repaired.stats.removedNodes;
      stats.pointRepairs.closedGaps+=repaired.stats.closedGaps;
      stats.pointRepairs.skipped+=repaired.stats.skipped;
      stats.pointRepairs.maxDeviation=Math.max(stats.pointRepairs.maxDeviation,repaired.stats.maxDeviation);
      if((k+1)%3===0||k===indices.length-1){
        progressStage('Сглаживание и оптимизация кривых',Math.round(12+87*(k+1)/indices.length),
          (k+1)+' / '+indices.length+' контуров');
        await yieldForUi();
      }
    }
    if(generation!==previewGeneration)return;
    previewActive=false;
    stats.quality=validateDocumentCurveChange(qualitySource,result,{tolerance:smoothingAmount+optimizationTolerance,nodeTolerance:tol});
    if(!stats.quality.accepted){
      result.paths=qualitySource.paths;stats.rejected++;
      stats.result=stats.original;stats.removed=0;stats.smoothedJoints=0;
      stats.maxError=0;stats.smoothingDeviation=0;
    }
    const merged=$('merge-overlaps').checked?
      mergeOverlappingObjects(result,{indices,tolerance:tol,cleanupTolerance:optimizationTolerance}):
      {document:result,stats:{mergedObjects:0,weldedGroups:0,compoundGroups:0,skipped:0,holes:0,normalizedObjects:0,unionToleranceMm:0.005,cleanup:{coincident:0,collinear:0,short:0,shortEdgesRemaining:0,reverted:0}}};
    progressStage('Оптимизация контуров после Union',99);
    await yieldForUi();
    const refitted=refitBooleanUnion(merged.document,optimizationTolerance);
    if(generation!==previewGeneration)return;
    const after=refitted.document;
    stats.overlaps=merged.stats;stats.refit=refitted.stats;
    stats.mergeOverlaps=$('merge-overlaps').checked;
    const countReal=target=>target.paths.reduce((n,p)=>n+(p.kind==='image'?0:
      p.commands?.filter(c=>['M','L','C','Q'].includes(c[0])).length??p.points.length),0);
    stats.actualNodesBefore=countReal(doc);stats.actualNodesAfter=countReal(after);
    const different=JSON.stringify(doc.paths.map(worldData))!==JSON.stringify(after.paths.map(worldData));
    const pv={source,result:after,stats,hasGeometryChange:different,beforeDiagnosticComplete:false,
      afterDiagnosed:false,afterDiagnosticComplete:false,afterScope:'unknown',
      comparisonData:{beforeDoc:clone(source),afterDoc:after,beforeIssues:clone(issues),afterIssues:[]}};
    curvePreview=pv;compareStage='after';
    $('optimization-result').textContent='Большой документ: обработано '+indices.length+
      ' контуров; сглажено '+stats.smoothedJoints+' стыков, удалено '+stats.removed+
      ' сегментов; слито объектов '+stats.overlaps.mergedObjects+
      ', нормализовано заливок '+stats.overlaps.normalizedObjects+
      ', сохранено отверстий '+stats.overlaps.holes+
      ', очищено узлов '+(stats.overlaps.cleanup.coincident+stats.overlaps.cleanup.collinear+
        stats.overlaps.cleanup.short)+
      (stats.overlaps.cleanup.reverted?' · защищено контуров '+stats.overlaps.cleanup.reverted:'')+
      '. После Union оптимизировано узлов '+stats.refit.originalNodes+' → '+stats.refit.finalNodes+
      ' (−'+stats.refit.removed+'), кубических сегментов '+stats.refit.cubicSegments+
      '. Контроль геометрии: отклонено изменений '+(stats.rejected+stats.smoothingRejected+(stats.refit.rejected||0))+'. Реальные узлы '+stats.actualNodesBefore+' → '+stats.actualNodesAfter+'. '+(different?'Результат в режиме ПОСЛЕ. Применяйте изменения вручную после просмотра.':
      'Форма кривых не изменилась.')+
      '\nПолная диагностика между блоками не подтверждена; перед экспортом может появиться предупреждение.';
    record('large-preview',{paths:indices.length,stats,changed:different,afterDiagnosticComplete:false});
    progressStage('Оптимизация завершена',100,indices.length+' контуров');
    lock(false);
    if(ready)void checkPreviewAfter(pv);
  }catch(error){
    if(generation!==previewGeneration)return;
    previewActive=false;curvePreview=null;
    $('optimization-result').textContent='Оптимизация остановлена: '+error.message;
    record('large-preview-error',{error:error.message});
    lock(false);status('Оптимизация не завершена: '+error.message+'. Исходные кривые сохранены.');
  }
}

// After calculation belongs to the immutable optimized result and is reused
// by Save EPS; exporting must not trigger a second diagnostic pass.
async function checkPreviewAfter(preview){
  if(!preview||preview!==curvePreview||!ready||busy)return;
  const generation=++afterDiagnosticGeneration;
  preview.afterDiagnosed=false;preview.afterDiagnosticComplete=false;
  lock(true,{coverCanvas:false});
  const callRust=input=>new Promise((resolve,reject)=>{
    const id=++sequence;
    pending={id,largeDiagnostic:true,onResponse:data=>
      data.error?reject(new Error(data.error)):resolve(data.output)};
    worker.postMessage({id,input});
  });
  try{
    const report=await diagnoseAfterDocument(preview.result,
      Number($('tolerance').value),{
        runBatch:callRust,progress:progressStage,yieldUi:yieldForUi,
        cancelled:()=>generation!==afterDiagnosticGeneration||preview!==curvePreview
      });
    if(!report||generation!==afterDiagnosticGeneration||preview!==curvePreview)return;
    preview.comparisonData.afterIssues=report.issues;
    preview.comparisonData.afterDiagnosticComplete=report.complete;
    preview.comparisonData.afterScope=report.fullScope?'full':'partial';
    preview.afterDiagnosed=true;preview.afterDiagnosticComplete=report.complete;
    preview.afterScope=report.fullScope?'full':'partial';
    markersVisible=true;compareStage='after';
    record('after-diagnose-cached',report);
    lock(false);
    status('ПОСЛЕ: '+report.issues.length+' неисправленных проблем.'+
      (report.complete?'':' Проверка частичная — межблочные ошибки не исключены.'));
  }catch(error){
    if(generation!==afterDiagnosticGeneration)return;
    preview.afterDiagnosed=true;preview.afterDiagnosticComplete=false;
    preview.afterScope='partial';record('after-diagnosis-error',{error:error.message});
    lock(false);status('ПОСЛЕ: проверка не завершилась: '+error.message);
  }
}

async function runProgressiveDiagnostics(indices,tolerance){
  const generation=++diagnosticGeneration;
  const scope=[],contours=[],unreadable=[];
  lock(true,{coverCanvas:false});
  progressStage('Подготовка контуров к диагностике',2,'0 / '+indices.length);
  try{
    for(let j=0;j<indices.length;j++){
      if(generation!==diagnosticGeneration)return;
      const idx=indices[j];
      try{
        const parts=sampledContours(doc.paths[idx],tolerance);
        if(!parts.length){unreadable.push(idx);}
        for(const part of parts){contours.push(part);scope.push(idx);}
      }catch(error){unreadable.push(idx);record('diagnostic-path-unreadable',{path:idx,message:error.message});}
      if((j+1)%4===0||j===indices.length-1){
        progressStage('Подготовка EPS: контуры',3+32*(j+1)/indices.length,
          (j+1)+' / '+indices.length+' объектов');
        await yieldForUi();
      }
    }
    if(generation!==diagnosticGeneration)return;
    const plan=planDiagnosticBatches(contours,scope);
    if(!plan.batches.length){
      diagnosticComplete=false;issues=[];metrics=[];
      curvePreview=null;
      lock(false);
      status('Не удалось проверить контуры: нет доступных расчётных сегментов.');
      return;
    }
    let nextIndex=0,checked=0,complete=!plan.partial&&!unreadable.length,misplaced=0;
    const results=[],pathMetrics=doc.paths.map(()=>null);
    const dispatch=()=>{
      if(generation!==diagnosticGeneration)return;
      if(nextIndex===plan.batches.length){
        diagnosticComplete=complete;
        markersVisible=true;
        issues=results;metrics=pathMetrics;
        curvePreview=null;appliedComparison=null;
        compareStage='before';
        progressStage('Диагностика завершена',100,checked+' расчётных точек');
        record('diagnose-large',{batchCount:plan.batches.length,totalPoints:plan.totalPoints,
          checked,issues:issues.length,complete,skipped:unreadable.length+plan.skipped.length,
          split:plan.split,misplaced});
        updateFileHistory({diagnosis:{count:issues.length,complete,
          selected:Boolean($('selection-only').checked)}});
        lock(false);
        status('Проверено '+checked+' расчётных точек в '+plan.batches.length+
          ' блоках; найдено '+issues.length+' замечаний.'+
          (complete?'':' Проверка частичная: взаимодействия между блоками не исключены.')+
          (misplaced?' Исключены '+misplaced+' маркеров вне соответствующих контуров.':''));
        if(complete)buildUnifiedPreview();
        else if(!curveEditing())void buildLargeUnifiedPreview(indices);
        return;
      }
      const batch=plan.batches[nextIndex];
      const id=++sequence;
      const ordinal=nextIndex+1;
      pending={id,largeDiagnostic:true,onResponse:data=>{
        if(generation!==diagnosticGeneration)return;
        if(data.error||!Array.isArray(data.output?.issues)){
          complete=false;
          record('diagnostic-batch-error',{batch:ordinal,message:data.error||'Некорректный результат Rust'});
        }else{
          complete=complete&&data.output.diagnosticComplete===true;
          for(const issue of data.output.issues){
            if(results.length>=10000){complete=false;break;}
            if(!issueWithinContourBounds(issue,batch.paths,tolerance)){
              misplaced++;complete=false;continue;
            }
            const mapped=mapDiagnosticIssue(issue,batch);
            if(mapped)results.push(mapped);
          }
          data.output.paths?.forEach((p,i)=>{pathMetrics[batch.scope[i]]=p;});
        }
        checked+=batch.points;nextIndex++;
        progressStage('Поиск дефектных точек · блок '+nextIndex+'/'+plan.batches.length,
          35+64*nextIndex/plan.batches.length,
          checked.toLocaleString('ru-RU')+' / '+plan.totalPoints.toLocaleString('ru-RU')+' точек');
        setTimeout(dispatch,0);
      }};
      progressStage('Диагностика: блок '+ordinal+' / '+plan.batches.length,
        35+64*nextIndex/plan.batches.length,
        checked.toLocaleString('ru-RU')+' точек обработано');
      worker.postMessage({id,input:packedInput(batch.paths,tolerance,0)});
    };
    dispatch();
  }catch(error){
    if(generation!==diagnosticGeneration)return;
    pending=null;diagnosticComplete=false;curvePreview=null;
    lock(false);status('Ошибка пакетной диагностики: '+error.message);
    record('diagnostic-large-error',{message:error.message});
  }
}

function calculate(action){
  if(!ready||busy)return;
  if(currentComparison()&&action){status('Закройте режим ДО/ПОСЛЕ перед ручным редактированием.');return;}
  const selectedScope=doc.paths.map((_,i)=>i).filter(i=>(!$('selection-only').checked||!selected.size||selected.has(i))&&doc.paths[i].kind!=='image');
  if(!selectedScope.length){status('Нет векторов для проверки');return;}
  const tol=Number($('tolerance').value),parameter=Number($('loop-percent').value);
  if(!Number.isFinite(tol)||tol<1e-9||tol>1000){status('Укажите допуск от 0.000000001 до 1000 мм');return;}
  if(action&&selectedScope.some(i=>doc.paths[i].artwork)){status('Исходные EPS-кривые сохранены. Для лечения сначала создайте полилинии кнопкой «Копия для лечения».');return;}
  if(action===0){void runProgressiveDiagnostics(selectedScope,tol);return;}
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
  // In AFTER, edit actual optimized geometry, never throw away the preview
  // and silently return to the original dense input document.
  if(curvePreview&&compareStage==='after'){
    if(curvePreview.hasGeometryChange&&!applyUnifiedChanges()){
      status('ПОСЛЕ устарел: пересчитайте изменения перед редактированием узлов.');return;
    }
  }
  clearTimeout(settingsTimeout);
  curvePreview=null;appliedComparison=null;compareStage='before';
  mode='nodes';nodeTool='move';activeCurveNode=null;draft=[];
  selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));
  if(!selected.size){const i=doc.paths.findIndex(p=>p.kind!=='image');if(i>=0)selected=new Set([i]);}
  render();status('Открыты реальные опорные узлы обработанной геометрии ПОСЛЕ. Исходник доступен через Undo.');
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
  return clone({format:'relief-forge',version:1,width:value.width,height:value.height,paths:value.paths,svgDefs:value.svgDefs||'',sourceSvg:value.sourceSvg||'',...(value.sourceFileName?{sourceFileName:basename(value.sourceFileName)}:{}),...(value.epsImport?{epsImport:value.epsImport}:{}),...(value.pdfImport?{pdfImport:value.pdfImport}:{})});
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
$('cancel').onclick=()=>{++diagnosticGeneration;++readGeneration;++previewGeneration;++afterDiagnosticGeneration;if(previewActive){previewActive=false;lock(false);status('Оптимизация отменена, оригинальные кривые сохранены.');return;}if(readActive){readActive=false;openingFile=false;updateMascot();lock(false);status('Чтение файла отменено.');return;}if(epsImportActive){stopEps({destroy:true});openingFile=false;updateMascot();lock(false);record('vector-import-cancel');status('Импорт отменён. Предыдущий документ сохранён.');return;}worker.terminate();pending=null;ready=false;suppressNextDiagnostic=true;lock(false);record('engine-cancel');status('Расчёт отменён, документ сохранён.');spawnWorker();};
$('undo').onclick=()=>{if(!past.length||busy)return;future.push(clone(doc));doc=past.pop();if(curveEditing())selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));else selected.clear();changed('undo');};
$('redo').onclick=()=>{if(!future.length||busy)return;past.push(clone(doc));doc=future.pop();if(curveEditing())selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));else selected.clear();changed('redo');};
$('delete').onclick=()=>{if(!selected.size)return;checkpoint();doc.paths=doc.paths.filter((_,i)=>!selected.has(i));selected.clear();changed('delete');};
$('new').onclick=()=>{activeHistoryId=null;checkpoint();doc={format:'relief-forge',version:1,width:300,height:200,paths:[]};selected.clear();changed('new');fit();};
for(const key of ['width','height'])$(key).onchange=()=>{const v=Number($(key).value);if(v>0&&v<1e6){checkpoint();doc[key]=v;changed('resize-sheet');fit();}else render();};
$('save').onclick=()=>{record('save-project');download('doktor-uzelkov.rf.json',JSON.stringify({...doc,journal,history:{past,future}},null,2));};
function stopEps({destroy=false}={}){const picker=$('pdf-page-picker');if(picker?.open)picker.close();epsImportActive=false;clearTimeout(epsTimer);epsTimer=null;if(epsWorker){epsWorker.onmessage=null;epsWorker.onerror=null;}if(destroy){epsWorker?.terminate();epsWorker=null;}}
function openValue(value,name,historyStarted=false){const next=validate(value),old=clone(doc);openingFile=false;lastImportFailure=null;lastImportAttempt={source:name,status:'opened',objects:next.paths.length};forceWireframe=false;syncWireframeControl();if(!historyStarted)beginFileHistory(name);next.sourceFileName=basename(next.sourceFileName||next.epsImport?.name||name);const restoredPast=Array.isArray(value.history?.past)?value.history.past.slice(-100).map(validate):null;const restoredFuture=Array.isArray(value.history?.future)?value.history.future.slice(-100).map(validate):[];const restoredJournal=Array.isArray(value.journal)?value.journal.slice(-100000):[];checkpoint();if(restoredPast){past=[old,...restoredPast].slice(-100);future=restoredFuture;}journal.push(...restoredJournal);doc=next;selected.clear();changed('import-'+name);fit();scheduleWorkspaceCheck();updateFileHistory({status:'Открыт · '+doc.paths.length+' контуров; ожидает проверки'});if(ready&&doc.paths.some(p=>p.kind!=='image'))calculate(0);}
function importEps(bytes,name,historyStarted=false){
  if(busy)return;openingFile=true;lastImportFailure=null;lastImportAttempt={source:name,status:'converting',bytes:bytes.byteLength};updateMascot();if(!historyStarted)beginFileHistory(name);lock(true);$('busy-label').textContent='Подготовка импорта '+(/\.pdf$/i.test(name)?'PDF':'EPS')+'…';record('vector-import-start',{name,bytes:bytes.byteLength,fonts:importFonts.map(f=>f.name)});
  epsImportActive=true;epsWorker??=new Worker(new URL('eps-worker.js?v=0.2.0-alpha.34',import.meta.url));
  progressStage(/\.pdf$/i.test(name)?'Импорт PDF: подготовка MuPDF':'Импорт EPS: подготовка интерпретатора',9);
  const started=performance.now();
  const fail=message=>{
    const reason=String(message||'Неизвестная ошибка импорта');
    lastImportFailure={source:name,code:/0 контуров|пустая страница|нет векторных объектов/i.test(reason)?
      'EPS_EMPTY_GEOMETRY':'IMPORT_FAILED',message:reason.slice(0,1100)};
    lastImportAttempt={source:name,status:'failed',bytes:bytes.byteLength};
    stopEps({destroy:true});openingFile=false;updateMascot();lock(false);
    workspaceScan({manual:true});status(reason);$('import-report').textContent='Не удалось открыть '+(/\.pdf$/i.test(name)?'PDF':'EPS')+': '+message;record('vector-import-error',{name,message});updateFileHistory({status:'Ошибка открытия: '+String(message).slice(0,180)});};
  const armTimer=()=>{clearTimeout(epsTimer);epsTimer=setTimeout(()=>fail('Импорт превысил лимит 120 секунд. Исходный документ сохранён.'),120000);};
  armTimer();
  epsWorker.onerror=e=>fail('Ошибка импортера: '+e.message);
  epsWorker.onmessage=({data})=>{
    if(data.type==='progress'){progressStage(data.message,data.percent);return;}
    if(data.type==='pages'){
      clearTimeout(epsTimer);epsTimer=null;
      const picker=$('pdf-page-picker'),select=$('pdf-page-number');
      select.replaceChildren();
      for(const page of data.pages){
        const option=document.createElement('option');option.value=String(page.index);
        option.textContent='Страница '+page.number+' · '+(page.widthPt*25.4/72).toFixed(1)+
          ' × '+(page.heightPt*25.4/72).toFixed(1)+' мм';
        select.append(option);
      }
      $('pdf-page-count').textContent='Страниц в документе: '+data.count+
        '. Выберите страницу для редактирования. Исходный PDF не изменяется.';
      $('pdf-page-confirm').disabled=false;$('pdf-page-cancel').disabled=false;select.disabled=false;
      picker.showModal();
      $('pdf-page-confirm').onclick=()=>{
        const index=Number(select.value);
        if(!Number.isInteger(index)||index<0||index>=data.count)return;
        picker.close();$('pdf-page-confirm').disabled=true;$('pdf-page-cancel').disabled=true;
        progressStage('Извлечение выбранной страницы PDF',60,'Страница '+(index+1));
        armTimer();
        epsWorker.postMessage({type:'select-pdf-page',pageIndex:index});
      };
      $('pdf-page-cancel').onclick=()=>fail('Выбор страницы PDF отменён; предыдущий документ сохранён.');
      picker.oncancel=e=>{e.preventDefault();fail('Выбор страницы PDF отменён; предыдущий документ сохранён.');};
      return;
    }
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='done')try{
      progressStage('Создание редактируемых кривых',92);
      const next=importRichSvg(data.result.svg,{unitsPerInch:72});
      const integrity=assessImportedGeometry(next,{format:data.format==='pdf'?'pdf':'eps',
        source:name,allowEmpty:data.format==='pdf',conversion:data.result});
      record('import-integrity',{name,format:data.format||'eps',...integrity});
      let binary='';if(data.format!=='pdf'){const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));binary=chunks.join('');}
      if(data.format==='pdf'){
        next.pdfImport={name,...data.result.metadata,engine:'MuPDF 1.28.1'};
      }else{
        next.epsImport={name,originalBase64:btoa(binary),originalGeometryStamp:geometryStamp(next),
          ...data.result.metadata,warnings:data.result.warnings,logs:data.result.logs,
          outlineRecovery:data.result.outlineRecovery||null,engines:{ghostscript:'10.08.0',mupdf:'1.28.1'}};
      }
      const durationMs=performance.now()-started;stopEps();lock(false);openValue(next,name,true);record(data.format==='pdf'?'pdf-import-time':'eps-import-time',{name,format:data.format||'eps',bytes:bytes.length,ms:Math.round(durationMs),workerMs:data.durationMs||0,fastPath:Boolean(data.fastPath),warm:Boolean(data.warm)});
      if(data.format==='pdf'){
        status('PDF импортирован: страница '+data.result.metadata.pageNumber+'/'+data.result.metadata.pageCount+
          ' · '+next.paths.length+' объектов. Векторные кривые доступны для редактирования.');
      }else if(data.result.outlineRecovery){
        record('eps-outline-recovery',data.result.outlineRecovery);
        status(`Восстановлено ${data.result.outlineRecovery.count} непечатаемых EPS-контуров. Обводки только для просмотра; начинается проверка векторов…`);
      }else status(`EPS импортирован: ${next.paths.length} объектов. ${data.result.warnings.length?'Есть предупреждения — см. панель EPS.':'Кривые и оформление сохранены.'}`);
    }catch(e){fail(e.message);}
  };
  const transfer=bytes.slice();epsWorker.postMessage({kind:/\.pdf$/i.test(name)?'pdf':'eps',bytes:transfer,fonts:importFonts},[transfer.buffer]);
}
async function importUserFile(file,origin='dialog'){
  if(!file||busy||readActive)return;
  if(!isSupportedDrop(file)){status('Поддерживаются PDF, EPS, PS, SVG и проекты JSON.');return;}
  if(file.size>64*1024*1024){status('Файл превышает 64 МБ. Импорт отклонён.');return;}
  beginFileHistory(file.name);
  const token=++readGeneration;
  openingFile=true;updateMascot();
  readActive=true;lock(true,{coverCanvas:false});
  record('open-file',{name:file.name,origin,bytes:file.size});
  try{
    // Stream reads expose real byte progress and avoid one big unresponsive
    // FileReader result on large files. Keep original filename intact.
    const parts=[];let size=0;
    const reader=file.stream().getReader();
    try{
      for(;;){
        const {value,done}=await reader.read();if(done)break;
        if(token!==readGeneration)throw Error('Чтение отменено');
        parts.push(value);size+=value.byteLength;
        progressStage('Чтение файла «'+file.name+'»',Math.round(8*size/Math.max(1,file.size)),
          (size/1024/1024).toFixed(1)+' / '+(file.size/1024/1024).toFixed(1)+' МБ');
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let pos=0;
    for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}
    readActive=false;lock(false);
    if(/\.(eps|epsf|epsi|ps|pdf)$/i.test(file.name))importEps(bytes,file.name,true);
    else{
      progressStage('Разбор документа',35);
      const content=new TextDecoder().decode(bytes);
      openValue(/\.svg$/i.test(file.name)?importRichSvg(content):JSON.parse(content),file.name,true);
      endProgress();
    }
  }catch(err){
    readActive=false;openingFile=false;updateMascot();lock(false);
    lastImportFailure={source:file.name,code:'FILE_READ_FAILED',message:String(err.message).slice(0,1100)};
    lastImportAttempt={source:file.name,status:'failed',bytes:file.size};
    workspaceScan({manual:true});endProgress();
    status(err.message);record('import-error',{name:file.name,origin,message:err.message});
    updateFileHistory({status:'Ошибка открытия: '+String(err.message).slice(0,180)});
  }
}
$('open').onclick=()=>$('file').click();
$('file').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importUserFile(file);};
let fileDragDepth=0;
const hasFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
const showDropOverlay=on=>{
  $('drop-overlay').hidden=!on;
  $('drop-target').classList.toggle('is-file-dragging',on);
};
window.addEventListener('dragenter',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();fileDragDepth++;
  if(!busy)showDropOverlay(true);
});
window.addEventListener('dragover',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();
  if(e.dataTransfer)e.dataTransfer.dropEffect=busy?'none':'copy';
});
window.addEventListener('dragleave',e=>{
  if(!hasFiles(e))return;
  fileDragDepth=Math.max(0,fileDragDepth-1);
  if(fileDragDepth===0)showDropOverlay(false);
});
window.addEventListener('drop',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();fileDragDepth=0;showDropOverlay(false);
  if(busy||readActive){status('Идёт обработка. Завершите или отмените её перед открытием другого файла.');return;}
  const files=droppedFiles(e);
  if(files.length!==1||e.dataTransfer.files.length!==1){
    status('Перетащите один PDF, EPS, PS, SVG или JSON-файл.');return;
  }
  void importUserFile(files[0],'drag-drop');
});
$('fonts').onchange=async e=>{try{const files=[...e.target.files];if(files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('Шрифты: максимум 32 МБ');importFonts=await Promise.all(files.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));$('font-count').textContent=importFonts.length+' шрифтов';status('Шрифты будут использованы при следующем импорте EPS.');}catch(error){status(error.message);}};
$('demo-eps').onclick=async()=>{try{const response=await fetch('examples/curves-text-clip.eps');if(!response.ok)throw Error('Не удалось загрузить пример');importEps(new Uint8Array(await response.arrayBuffer()),'curves-text-clip.eps');}catch(e){status(e.message);}};
$('heal-copy').onclick=()=>{try{const ids=[...selected].filter(i=>doc.paths[i].kind!=='image');if(!ids.length)throw Error('Выделите импортированные векторы');const tol=Number($('tolerance').value);if(!Number.isFinite(tol)||tol<1e-6||tol>1000)throw Error('Укажите допуск от 0.000001 до 1000 мм');const copies=ids.flatMap(i=>sampledContours(doc.paths[i],tol));checkpoint();const start=doc.paths.length;doc.paths.push(...copies);selected=new Set(copies.map((_,i)=>start+i));changed('create-healing-copy');status(`Создано ${copies.length} полилиний, допуск ${tol} мм. Исходные кривые сохранены отдельными объектами.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{download('relief-forge.svg',exportDocument(doc),'image/svg+xml');record('export-svg');};
function readEpsSaveSettings(){
  return {diagnosticTolerance:Number($('tolerance').value),
    smoothingAmount:Number($('smoothing-amount').value),
    optimizationTolerance:Number($('optimization-tolerance').value),
    mergeOverlaps:$('merge-overlaps').checked};
}
let epsColorMode='outline';
function prepareEpsOutput(document){
  return epsColorMode==='original'?exportColoredEps(document):{content:exportEps(document),source:'outline'};
}
let pendingAfterSave=null;
function exportConfirmedEps({snapshot=null,overridden=false}={}){
  try{
    const chosen=snapshot||chooseAfterSnapshot(doc,curvePreview,readEpsSaveSettings(),
      appliedComparison,{issues,complete:diagnosticComplete,current:false,fullScope:false});
    if(!chosen.valid)throw Error('Результат ПОСЛЕ устарел. Повторите обработку.');
    const prepared=prepareEpsOutput(chosen.document);
    const eps=prepared.content;
    const resultName=epsResultFilename(chosen.document.sourceFileName||doc.sourceFileName||
      doc.epsImport?.name||'relief-forge.eps');
    download(resultName,eps,'application/postscript');
    // Commit the exact exported optimized geometry; Undo restores the
    // original, and no second repair or diagnostic is invoked.
    const applied=Boolean(chosen.preview&&applyUnifiedChanges());
    updateFileHistory({exportName:resultName,exportAt:new Date().toISOString(),
      status:'EPS ПОСЛЕ · '+(epsColorMode==='original'?'цвет':'без цвета')+
        (overridden?' · остаточные ошибки подтверждены':'')});
    record('export-eps-after',{name:resultName,source:chosen.stage,
      colorMode:epsColorMode,colorSource:prepared.source,
      bytes:eps.length,applied,overridden,issues:chosen.issues?.length??null,
      verified:chosen.complete,diagnosticReused:true});
    status('EPS сохранён: '+resultName+
      ' · экспортирован готовый результат '+(chosen.stage==='current'?'': 'ПОСЛЕ')+
      ' без повторной обработки'+
      (overridden?' · с подтверждёнными замечаниями':'')+'.');
    pendingAfterSave=null;
  }catch(error){
    record('eps-export-error',{message:error.message,mode:epsColorMode});
    status('Не удалось сохранить EPS: '+error.message);
  }
}
function showEpsSaveWarning(decision,snapshot){
  const dialog=$('eps-save-warning');
  pendingAfterSave=snapshot;
  $('eps-save-warning-message').textContent=afterSaveMessage(decision,snapshot.stage)+
    '\nСохранить обработанный результат с замечаниями или вернуться к редактированию?';
  record('eps-save-after-warning',{count:decision.count,complete:decision.complete,
    stage:snapshot.stage,reason:decision.reason});
  if(!dialog.open)dialog.showModal();
  $('eps-save-return').focus();
}
$('eps-save-return').onclick=()=>{
  $('eps-save-warning').close();pendingAfterSave=null;
  record('eps-save-return');status('Сохранение отменено. Исправления ПОСЛЕ остаются в редакторе.');
};
$('eps-save-anyway').onclick=()=>{
  if(!$('eps-save-warning').open||!pendingAfterSave)return;
  const snapshot=pendingAfterSave;
  $('eps-save-warning').close();
  record('eps-save-after-confirmed');
  exportConfirmedEps({snapshot,overridden:true});
};
$('eps-save-warning').addEventListener('cancel',()=>{
  pendingAfterSave=null;record('eps-save-return');
  status('Сохранение отменено. Результат ПОСЛЕ сохранён в редакторе.');
});
function saveExistingAfterResult(){
  if(busy||readActive||$('eps-save-warning').open)return;
  const snapshot=chooseAfterSnapshot(doc,curvePreview,readEpsSaveSettings(),
    appliedComparison,{issues,complete:diagnosticComplete,current:false,fullScope:false});
  const decision=afterSaveDecision(snapshot);
  record('eps-save-cached-result',{stage:snapshot.stage||'stale',
    complete:snapshot.complete,errors:decision.count,action:decision.action});
  if(decision.action==='stop'){
    status(afterSaveMessage(decision));return;
  }
  if(decision.action==='warn'){
    showEpsSaveWarning(decision,snapshot);return;
  }
  exportConfirmedEps({snapshot});
}
$('export-eps').onclick=()=>{
  if(busy||readActive)return;
  $('eps-color-choice').showModal();
};
$('eps-color-cancel').onclick=()=>$('eps-color-choice').close();
$('eps-color-confirm').onclick=()=>{
  const choice=document.querySelector('input[name="eps-color-mode"]:checked');
  epsColorMode=choice?.value==='original'?'original':'outline';
  $('eps-color-choice').close();
  record('eps-export-mode',{mode:epsColorMode});
  saveExistingAfterResult();
};
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
record('session-start',{version:'0.2.0-alpha.34'});renderFileHistory();spawnWorker();fit();document.documentElement.dataset.doctorReady='true';
